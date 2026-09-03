import { describe, expect, it } from 'vitest';

import { deterministicMarkdownFixture, measureMarkdownProjection } from './markdown-performance';

describe('Markdown performance evidence', () => {
  it('records repeatable 1 MiB projection samples and fixture digest', async () => {
    const source = deterministicMarkdownFixture();
    const measurement = await measureMarkdownProjection(source, 3);
    expect(measurement.source_bytes).toBe(1024 * 1024);
    expect(measurement.source_digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(measurement.samples_ms).toHaveLength(3);
    expect(measurement.samples_ms.every(Number.isFinite)).toBe(true);
    const referenceProfile = import.meta.env.VITE_GLITCHPAD_REFERENCE_PERFORMANCE === '1';
    const thresholdMs = referenceProfile ? 800 : 2500;
    expect(measurement.p95_ms).toBeLessThan(thresholdMs);
  });
});
