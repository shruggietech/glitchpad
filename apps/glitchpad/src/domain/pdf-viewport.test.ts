import { expect, it } from 'vitest';
import { pageAtOffset, pageOffsets, continuousFits } from './pdf-viewport';

it('keeps10000page navigation bounded and locates exact visible boundaries',()=>{
  const offsets=pageOffsets(10000,600,new Map([[1,800]]));expect(offsets).toHaveLength(10001);expect(offsets[2]).toBe(1416);
  expect(pageAtOffset(offsets,0)).toBe(0);expect(pageAtOffset(offsets,608)).toBe(1);expect(pageAtOffset(offsets,offsets[10000])).toBe(9999);expect(pageAtOffset(offsets,-1)).toBe(0);
});
it('uses the actual host scroll ceiling instead of creating a clipped giant surface',()=>{
  expect(continuousFits([0,600,1200],1200)).toBe(true);expect(continuousFits([0,600,1201],1200)).toBe(false);
});
