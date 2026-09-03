import { applyTextTransaction, createTextDocument } from './text-document';
import { classifyPerformanceValue, summarizePerformanceSamples, type PerformanceClassification } from './performance';

export interface PerformanceSample {
  samples_ms: number[];
  median_ms: number;
  p95_ms: number;
  maximum_ms: number;
  classification: PerformanceClassification;
  repeated_hard_stall: boolean;
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
  const summary = summarizePerformanceSamples(samples, iterations, iterations);
  const repeatedHardStall = samples.filter((sample) => sample > 100).length > 1;
  return {
    samples_ms: samples,
    median_ms: summary.median,
    p95_ms: summary.p95,
    maximum_ms: summary.maximum,
    classification: classifyPerformanceValue({
      id: 'editor_input_paint',
      aggregation: 'p95',
      target: 50,
      hard_limit: 100,
      minimum_samples: 40,
      maximum_samples: 200,
      failure_invariants: ['repeated_hard_stall'],
    }, summary.p95, { invariants: { repeated_hard_stall: repeatedHardStall } }),
    repeated_hard_stall: repeatedHardStall,
  };
};
