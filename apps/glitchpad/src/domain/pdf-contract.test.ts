import { describe, expect, it } from 'vitest';
import { assertPdfSource, assertPdfPages, assertPdfRange, pdfSurfaceBytes, pdfCapabilities, PDF_LIMITS } from './pdf-contract';

describe('PDF contract boundaries', () => {
  it.each(['desktop', 'android'] as const)('accepts exact %s source threshold and refuses the next byte', (platform) => {
    expect(() => assertPdfSource(PDF_LIMITS[platform].sourceBytes, platform)).not.toThrow();
    expect(() => assertPdfSource(PDF_LIMITS[platform].sourceBytes + 1, platform)).toThrow('source_limit');
    for (const size of [0, -1, NaN, Infinity, 0.5]) expect(() => assertPdfSource(size, platform)).toThrow();
  });
  it('checks page count before requesting a page', () => {
    expect(() => assertPdfPages(10_000)).not.toThrow();
    expect(() => assertPdfPages(10_001)).toThrow('page_limit');
    expect(() => assertPdfPages(0)).toThrow('malformed');
  });
  it('rejects overflow, negative, oversized and escaping source ranges', () => {
    expect(() => assertPdfRange(8, 8, 16)).not.toThrow();
    for (const [offset, length, total] of [[-1,1,16],[0,0,16],[16,1,16],[0,PDF_LIMITS.rangeBytes+1,PDF_LIMITS.rangeBytes+1],[Number.MAX_SAFE_INTEGER,1,16]]) expect(() => assertPdfRange(offset!, length!, total!)).toThrow();
  });
  it('refuses huge/nonfinite surfaces before allocation', () => {
    expect(pdfSurfaceBytes(1024, 768, 'android')).toBe(3_145_728);
    for (const [w,h] of [[Infinity,1],[0,1],[32768,1],[10000,10000]]) expect(() => pdfSurfaceBytes(w!,h!,'android')).toThrow('surface_limit');
  });
  it('disables inert and degraded controls while retaining navigation', () => {
    expect(pdfCapabilities('password_required',false,true)).toMatchObject({ view:false,print:'unavailable',search:false });
    expect(pdfCapabilities('limited',true,true)).toMatchObject({ navigate:true,thumbnails:false,print:'available' });
    expect(pdfCapabilities('ready',false,false).print).toBe('unavailable');
  });
});
