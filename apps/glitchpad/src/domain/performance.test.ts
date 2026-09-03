import { describe, expect, it, vi } from 'vitest';

import { classifyPerformanceValue, nearestRank, runCooperatively, summarizePerformanceSamples, warningHistoryRequiresFollowUp, type PerformanceMetric } from './performance';

const metric: PerformanceMetric = {
  id: 'editor_input_paint',
  aggregation: 'p95',
  target: 50,
  hard_limit: 100,
  minimum_samples: 1,
  maximum_samples: 100,
  failure_invariants: ['repeated_hard_stall'],
};

describe('performance policy', () => {
  it('uses deterministic nearest-rank summaries and inclusive boundaries', () => {
    expect(nearestRank([5, 1, 4, 2, 3], 0.95)).toBe(5);
    expect(summarizePerformanceSamples([5, 1, 4, 2, 3], 5, 5)).toEqual({ median: 3, p95: 5, maximum: 5 });
    expect(classifyPerformanceValue(metric, 50)).toBe('pass');
    expect(classifyPerformanceValue(metric, 50.001)).toBe('warning');
    expect(classifyPerformanceValue(metric, 100)).toBe('warning');
    expect(classifyPerformanceValue(metric, 100.001)).toBe('failure');
    expect(classifyPerformanceValue(metric, 1, { invariants: { repeated_hard_stall: true } })).toBe('failure');
  });

  it('enforces source-relative suspended tab thresholds', () => {
    const relative: PerformanceMetric = { ...metric, id: 'suspended_text_tab_overhead', threshold_kind: 'source_relative', target: undefined, hard_limit: undefined, target_multiplier: 2.5, target_constant: 10, hard_multiplier: 4, hard_constant: 20 };
    expect(classifyPerformanceValue(relative, 260, { sourceBytes: 100 })).toBe('pass');
    expect(classifyPerformanceValue(relative, 261, { sourceBytes: 100 })).toBe('warning');
    expect(classifyPerformanceValue(relative, 421, { sourceBytes: 100 })).toBe('failure');
  });

  it('chunks repeated work and observes cancellation after a yield', async () => {
    const handled: number[] = [];
    const abort = new AbortController();
    let now = 0;
    const yieldControl = vi.fn(() => {
      abort.abort();
      return Promise.resolve();
    });
    await expect(runCooperatively({
      items: [1, 2, 3, 4],
      signal: abort.signal,
      handle: (item) => { handled.push(item); now += 5; },
      maximumSliceMs: 8,
      clock: () => now,
      yieldControl,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(handled).toEqual([1, 2]);
    expect(yieldControl).toHaveBeenCalledOnce();
  });

  it('requires only adjacent comparable warnings to trigger follow-up', () => {
    const base = { catalog_version: '1', metric_id: 'm', scenario_id: 's', profile_id: 'p', evidence_class: 'reference', build_profile: 'release', cold_state: false, method: 'v1' };
    expect(warningHistoryRequiresFollowUp([{ ...base, classification: 'warning' }, { ...base, classification: 'warning' }])).toBe(true);
    expect(warningHistoryRequiresFollowUp([{ ...base, classification: 'warning' }, { ...base, method: 'v2', classification: 'warning' }])).toBe(false);
  });
});
