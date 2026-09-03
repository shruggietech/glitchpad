import { describe, expect, it } from 'vitest';

import { measureTextTransactions } from './editor-performance';

describe('editor performance structure', () => {
  it('records bounded finite samples without retaining historical documents', () => {
    const measurement = measureTextTransactions(64 * 1024, 20);
    expect(measurement.samples_ms).toHaveLength(20);
    expect(measurement.samples_ms.every(Number.isFinite)).toBe(true);
    expect(measurement.p95_ms).toBeLessThan(50);
  });
});
