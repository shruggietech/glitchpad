import { describe, it, expect, vi } from 'vitest';
import { createAndroidDiagnosticExportGateway } from './persistence-gateway';
import { diagnosticEnvironment } from './persistence';
import type { invoke } from '@tauri-apps/api/core';

describe('native frozen diagnostic export', () => {
  const bundle = {
    schema_version: 1 as const,
    generated_unix_ms: 42,
    environment: diagnosticEnvironment(),
    events: [],
  };
  it('sends exactly the previewed JSON bytes and requires a matching write receipt', async () => {
    const json = JSON.stringify(bundle, null, 2);
    const bytes = [...new TextEncoder().encode(json)];
    const call = vi
      .fn()
      .mockResolvedValueOnce({
        source: { source_id: 'saved' },
        byte_count: bytes.length,
        saved_revision: 0,
      })
      .mockResolvedValueOnce(undefined);
    expect(
      await createAndroidDiagnosticExportGateway(call as typeof invoke).export(
        bundle,
      ),
    ).toEqual({ status: 'saved' });
    expect(call.mock.calls[0]).toEqual([
      'create_android_document',
      {
        request: {
          bytes,
          suggested_name: 'glitchpad-diagnostics-42.json',
          media_type: 'application/json',
          session_revision: 0,
        },
      },
    ]);
    const mismatch = vi
      .fn()
      .mockResolvedValue({
        source: { source_id: 'saved' },
        byte_count: 1,
        saved_revision: 0,
      });
    await expect(
      createAndroidDiagnosticExportGateway(mismatch as typeof invoke).export(
        bundle,
      ),
    ).rejects.toThrow('invalid_receipt');
  });
  it('distinguishes native cancellation and Sharesheet handoff', async () => {
    const cancel = vi
      .fn()
      .mockRejectedValue({ context: { reason: 'picker_cancelled' } });
    expect(
      await createAndroidDiagnosticExportGateway(
        cancel as typeof invoke,
      ).export(bundle),
    ).toEqual({ status: 'cancelled' });
    const share = vi.fn().mockResolvedValue({ status: 'handed_off' });
    expect(
      await createAndroidDiagnosticExportGateway(share as typeof invoke).share!(
        bundle,
      ),
    ).toEqual({ status: 'handed_off' });
  });
});
