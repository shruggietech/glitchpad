export type PerformanceClassification = 'pass' | 'warning' | 'failure';

export interface PerformanceMetric {
  id: string;
  aggregation: 'p95' | 'maximum' | 'minimum' | 'invariant';
  target?: number;
  hard_limit?: number;
  threshold_kind?: 'source_relative';
  target_multiplier?: number;
  target_constant?: number;
  hard_multiplier?: number;
  hard_constant?: number;
  minimum_samples: number;
  maximum_samples: number;
  failure_invariants: string[];
}

export interface PerformanceSummary {
  median: number;
  p95: number;
  maximum: number;
}

export interface RendererPerformanceMeasurement {
  renderer: 'markdown' | 'mermaid';
  owner_id: string;
  source_revision: number;
  source_bytes: number;
  duration_ms: number;
  status: string;
}

export const nearestRank = (samples: readonly number[], fraction: number): number => {
  if (samples.length === 0) throw new Error('samples_empty');
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
};

export const summarizePerformanceSamples = (
  samples: readonly number[],
  minimum = 1,
  maximum = 1_000,
): PerformanceSummary => {
  if (samples.length < minimum || samples.length > maximum) throw new Error('sample_count_invalid');
  if (samples.some((sample) => !Number.isFinite(sample) || sample < 0)) throw new Error('sample_value_invalid');
  return {
    median: nearestRank(samples, 0.5),
    p95: nearestRank(samples, 0.95),
    maximum: nearestRank(samples, 1),
  };
};

const thresholdsFor = (metric: PerformanceMetric, sourceBytes?: number) => {
  if (metric.threshold_kind === 'source_relative') {
    if (!Number.isSafeInteger(sourceBytes) || sourceBytes! < 0) throw new Error('source_bytes_invalid');
    return {
      target: sourceBytes! * metric.target_multiplier! + metric.target_constant!,
      hard: sourceBytes! * metric.hard_multiplier! + metric.hard_constant!,
    };
  }
  if (!Number.isFinite(metric.target) || !Number.isFinite(metric.hard_limit)) throw new Error('threshold_invalid');
  return { target: metric.target!, hard: metric.hard_limit! };
};

export const classifyPerformanceValue = (
  metric: PerformanceMetric,
  value: number,
  options: { sourceBytes?: number; invariants?: Readonly<Record<string, boolean>> } = {},
): PerformanceClassification => {
  if (!Number.isFinite(value) || value < 0) throw new Error('observation_invalid');
  if (metric.failure_invariants.some((name) => options.invariants?.[name] === true)) return 'failure';
  const { target, hard } = thresholdsFor(metric, options.sourceBytes);
  if (value <= target) return 'pass';
  return value <= hard ? 'warning' : 'failure';
};

export interface CooperativeRunOptions<T> {
  items: readonly T[];
  signal?: AbortSignal;
  handle: (item: T, index: number) => void;
  maximumSliceMs?: number;
  clock?: () => number;
  yieldControl?: () => Promise<void>;
}

const abortError = () => new DOMException('Operation cancelled', 'AbortError');

export const yieldToMainThread = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export async function runCooperatively<T>({
  items,
  signal,
  handle,
  maximumSliceMs = 8,
  clock = () => performance.now(),
  yieldControl = yieldToMainThread,
}: CooperativeRunOptions<T>): Promise<void> {
  if (!Number.isFinite(maximumSliceMs) || maximumSliceMs <= 0 || maximumSliceMs > 50) throw new Error('slice_budget_invalid');
  let sliceStarted = clock();
  for (let index = 0; index < items.length; index += 1) {
    if (signal?.aborted) throw abortError();
    handle(items[index], index);
    if (index + 1 < items.length && clock() - sliceStarted >= maximumSliceMs) {
      await yieldControl();
      if (signal?.aborted) throw abortError();
      sliceStarted = clock();
    }
  }
}

export const evidenceComparable = (
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean => [
  'catalog_version', 'metric_id', 'scenario_id', 'scenario_digest', 'profile_id',
  'evidence_class', 'build_profile', 'cold_state', 'method',
].every((field) => left[field] === right[field]);

export const warningHistoryRequiresFollowUp = (
  records: readonly Readonly<Record<string, unknown>>[],
): boolean => {
  let previous: Readonly<Record<string, unknown>> | null = null;
  let warnings = 0;
  for (const record of records.slice(-20)) {
    if (record.classification === 'pass' || record.classification === 'failure') {
      previous = record;
      warnings = 0;
      continue;
    }
    if (record.classification !== 'warning') {
      previous = null;
      warnings = 0;
      continue;
    }
    warnings = previous?.classification === 'warning' && evidenceComparable(previous, record) ? warnings + 1 : 1;
    if (warnings >= 2) return true;
    previous = record;
  }
  return false;
};
