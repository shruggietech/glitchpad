import { it, expect, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { createPdfSession } from './pdf-source-gateway';
import { noSourceCapabilities, type ExternalRevision } from './contracts';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
import {
  parsePdfPrintRange,
  nativePdfPrintGateway,
  pdfPrintScale,
} from './pdf-print-gateway';
it('binds selected and all ranges to the current document without duplicates', () => {
  expect(parsePdfPrintRange('all', 4)).toEqual([0, 1, 2, 3]);
  expect(parsePdfPrintRange('4, 2-3, 2', 4)).toEqual([1, 2, 3]);
  for (const value of ['0', '5', '2-1', '1,', '1e2', '-1', '1-2-3'])
    expect(() => parsePdfPrintRange(value, 4)).toThrow();
  expect(() => parsePdfPrintRange('all', 10001)).toThrow();
});

it.each(['afterprint', 'glitchpad-native-print-completed'])(
  'retains the source-bound snapshot across tab disposal until %s',
  async (completion) => {
    const identity = {
      authority: 'synthetic' as const,
      scope: 'print',
      token: 'source',
      strength: 'strong' as const,
    };
    const revision: ExternalRevision = {
      identity,
      byte_length: 16,
      modified_unix_nanos: null,
      change_token: null,
    };
    const session = createPdfSession(
      {
        identity,
        display_name: 'fixture.pdf',
        claimed_media_type: 'application/pdf',
        byte_length: 16,
        modified_unix_ms: null,
        kind: 'file',
        capabilities: { ...noSourceCapabilities(), read: true, seek: true },
      },
      'source',
      revision,
      'desktop',
    );
    vi.mocked(invoke).mockResolvedValue(undefined);
    const revoke = vi.fn();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL() {
          return 'blob:pdf-print-test';
        }
        static revokeObjectURL = revoke;
      },
    );
    const job = nativePdfPrintGateway(session);
    await job.begin(1);
    const appended = job.append(
      0,
      { blob: new Blob(['png']), width: 612, height: 792, pixelBytes: 4 },
      new AbortController().signal,
    );
    const image = document.querySelector('.pdf-print-document img')!;
    image.dispatchEvent(new Event('load'));
    await appended;
    await job.handoff();
    job.dispose();
    expect(image.isConnected).toBe(true);
    expect(document.body.classList.contains('pdf-print-active')).toBe(true);
    expect(revoke).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('request_pdf_desktop_print', {
      sourceId: 'source',
      expectedRevision: revision,
    });
    window.dispatchEvent(new Event(completion));
    expect(image.isConnected).toBe(false);
    expect(document.body.classList.contains('pdf-print-active')).toBe(false);
    expect(revoke).toHaveBeenCalledWith('blob:pdf-print-test');
    const next = nativePdfPrintGateway(session);
    await next.begin(1);
    await next.cancel();
    vi.unstubAllGlobals();
  },
);

it('keeps actual ceil-rounded print rasters inside the native pixel and dimension bounds', () => {
  for (const [width, height] of [
    [5000, 4000],
    [4000, 5000],
    [16000, 500],
    [612, 792],
  ]) {
    const scale = pdfPrintScale(width, height);
    expect(scale).toBeGreaterThan(0);
    expect(
      Math.ceil(width * scale) * Math.ceil(height * scale),
    ).toBeLessThanOrEqual(16000000);
    expect(
      Math.max(Math.ceil(width * scale), Math.ceil(height * scale)),
    ).toBeLessThanOrEqual(8192);
  }
  expect(() => pdfPrintScale(Infinity, 5)).toThrow('print_surface_limit');
});
