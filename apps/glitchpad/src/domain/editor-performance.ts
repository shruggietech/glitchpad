import { applyTextTransaction, createTextDocument } from './text-document';

export interface PerformanceSample {
  samples_ms: number[];
  median_ms: number;
  p95_ms: number;
  maximum_ms: number;
}

export const measureTextTransactions = (sourceBytes = 1024 * 1024, iterations = 40): PerformanceSample => {
  let document = createTextDocument({ rawText: 'x'.repeat(sourceBytes), displayName: 'performance.txt' });
  let revision = 1;
  const samples: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    const result = applyTextTransaction(document, revision, revision, [{ from: index, to: index, insert: 'y' }]);
    samples.push(performance.now() - started);
    if (!result.ok) throw new Error(`Performance transaction failed: ${result.reason}`);
    document = result.document;
    revision = result.revision;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  return { samples_ms: samples, median_ms: percentile(0.5), p95_ms: percentile(0.95), maximum_ms: percentile(1) };
};
