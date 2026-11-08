import { it, expect } from 'vitest';
import { parsePdfPrintRange } from './pdf-print-gateway';
it('binds selected and all ranges to the current document without duplicates', () => {
  expect(parsePdfPrintRange('all', 4)).toEqual([0, 1, 2, 3]);
  expect(parsePdfPrintRange('4, 2-3, 2', 4)).toEqual([1, 2, 3]);
  for (const value of ['0', '5', '2-1', '1,', '1e2', '-1', '1-2-3'])
    expect(() => parsePdfPrintRange(value, 4)).toThrow();
  expect(() => parsePdfPrintRange('all', 10001)).toThrow();
});
