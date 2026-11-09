import { describe, expect, it, vi } from 'vitest';
import { PdfBinaryDataFactory } from './pdf-resources';

describe('offline fixed PDF resources', () => {
  it('supplies the reviewed BSD symbol font without any URL request', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    try {
      const bytes = await new PdfBinaryDataFactory().fetch({
        kind: 'standardFontDataUrl',
        filename: 'FoxitSymbol.pfb',
      });
      expect(bytes.length).toBeGreaterThan(1000);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
  it.each([
    ['standardFontDataUrl', 'LiberationSans-Regular.ttf'],
    ['wasmUrl', 'quickjs-eval.js'],
    ['https://example.invalid/', 'font'],
    ['cMapUrl', '../../etc/passwd'],
    ['cMapUrl', 'https://example.invalid/a.bcmap'],
  ])('refuses arbitrary resource %s %s', async (kind, filename) => {
    await expect(
      new PdfBinaryDataFactory().fetch({ kind, filename }),
    ).rejects.toThrow();
  });
});
