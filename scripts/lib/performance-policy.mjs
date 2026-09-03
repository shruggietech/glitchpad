const REQUIRED_METRICS = [
  'cold_shell_desktop',
  'cold_shell_android',
  'text_first_content',
  'markdown_first_content',
  'mermaid_first_content_desktop',
  'mermaid_first_content_android',
  'mermaid_current_preview',
  'editor_input_paint',
  'cancellation_acknowledgement',
  'repeated_interaction_task',
  'idle_desktop_working_set',
  'idle_android_pss',
  'suspended_text_tab_overhead',
  'desktop_installer_size',
  'universal_android_apk_size',
  'renderer_resource_disposal',
];

const ALLOWED_EVIDENCE_KEYS = new Set([
  'schema_version',
  'catalog_version',
  'metric_id',
  'scenario_id',
  'scenario_digest',
  'profile_id',
  'evidence_class',
  'build_profile',
  'build_id',
  'runtime_version',
  'cold_state',
  'method',
  'samples',
  'median',
  'p95',
  'maximum',
  'source_bytes',
  'peak_memory_bytes',
  'invariants',
  'classification',
  'cleanup_complete',
  'measured_at',
]);

const ID_PATTERN = /^[a-z0-9][a-z0-9_]{0,63}$/u;
const TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,127}$/u;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;

export const nearestRank = (samples, fraction) => {
  if (!Array.isArray(samples) || samples.length === 0)
    throw new Error('samples_empty');
  if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1)
    throw new Error('percentile_invalid');
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
};

export const summarizeSamples = (samples, minimum = 1, maximum = 1000) => {
  if (
    !Array.isArray(samples) ||
    samples.length < minimum ||
    samples.length > maximum
  )
    throw new Error('sample_count_invalid');
  if (samples.some((sample) => !Number.isFinite(sample) || sample < 0))
    throw new Error('sample_value_invalid');
  return {
    median: nearestRank(samples, 0.5),
    p95: nearestRank(samples, 0.95),
    maximum: nearestRank(samples, 1),
  };
};

export const thresholdsFor = (metric, sourceBytes) => {
  if (metric.threshold_kind === 'source_relative') {
    if (!Number.isSafeInteger(sourceBytes) || sourceBytes < 0)
      throw new Error('source_bytes_invalid');
    return {
      target: sourceBytes * metric.target_multiplier + metric.target_constant,
      hardLimit: sourceBytes * metric.hard_multiplier + metric.hard_constant,
    };
  }
  return { target: metric.target, hardLimit: metric.hard_limit };
};

export const classifyValue = (
  metric,
  value,
  { sourceBytes, invariants = {} } = {},
) => {
  if (!Number.isFinite(value) || value < 0)
    throw new Error('observation_invalid');
  if (
    (metric.failure_invariants ?? []).some((name) => invariants[name] === true)
  )
    return 'failure';
  const { target, hardLimit } = thresholdsFor(metric, sourceBytes);
  if (value <= target) return 'pass';
  if (value <= hardLimit) return 'warning';
  return 'failure';
};

export const observationFor = (metric, summary, samples = []) => {
  if (metric.aggregation === 'p95') return summary.p95;
  if (metric.aggregation === 'maximum' || metric.aggregation === 'invariant')
    return summary.maximum;
  if (metric.aggregation === 'minimum') {
    if (!Array.isArray(samples) || samples.length === 0)
      throw new Error('samples_empty');
    return Math.min(...samples);
  }
  throw new Error('aggregation_invalid');
};

export const validateCatalog = (catalog) => {
  const problems = [];
  if (catalog?.schema_version !== 1) problems.push('catalog_schema_invalid');
  if (!TOKEN_PATTERN.test(catalog?.catalog_version ?? ''))
    problems.push('catalog_version_invalid');
  const metrics = Array.isArray(catalog?.metrics) ? catalog.metrics : [];
  const profiles = Array.isArray(catalog?.profiles) ? catalog.profiles : [];
  const scenarios = Array.isArray(catalog?.scenarios) ? catalog.scenarios : [];
  const metricIds = new Set();
  const profileIds = new Set();
  const scenarioIds = new Set();
  for (const profile of profiles) {
    if (!ID_PATTERN.test(profile.id ?? '') || profileIds.has(profile.id))
      problems.push('profile_id_invalid');
    profileIds.add(profile.id);
    if (
      !['reference', 'hosted_smoke', 'structural'].includes(
        profile.evidence_class,
      )
    )
      problems.push(`profile_class_invalid:${profile.id}`);
    if (
      !Number.isSafeInteger(profile.minimum_memory_bytes) ||
      profile.minimum_memory_bytes <= 0
    )
      problems.push(`profile_memory_invalid:${profile.id}`);
  }
  for (const scenario of scenarios) {
    if (!ID_PATTERN.test(scenario.id ?? '') || scenarioIds.has(scenario.id))
      problems.push('scenario_id_invalid');
    scenarioIds.add(scenario.id);
    if (
      !['fixture', 'generated', 'interaction', 'artifact'].includes(
        scenario.kind,
      )
    )
      problems.push(`scenario_kind_invalid:${scenario.id}`);
    if (scenario.sha256 !== undefined && !DIGEST_PATTERN.test(scenario.sha256))
      problems.push(`scenario_digest_invalid:${scenario.id}`);
    if (!['cold', 'warm', 'either'].includes(scenario.state))
      problems.push(`scenario_state_invalid:${scenario.id}`);
  }
  for (const metric of metrics) {
    if (!ID_PATTERN.test(metric.id ?? '') || metricIds.has(metric.id))
      problems.push('metric_id_invalid');
    metricIds.add(metric.id);
    if (!['milliseconds', 'bytes', 'count'].includes(metric.unit))
      problems.push(`metric_unit_invalid:${metric.id}`);
    if (
      !['p95', 'maximum', 'minimum', 'invariant'].includes(metric.aggregation)
    )
      problems.push(`metric_aggregation_invalid:${metric.id}`);
    if (metric.direction !== 'at_most')
      problems.push(`metric_direction_invalid:${metric.id}`);
    if (
      !Number.isSafeInteger(metric.minimum_samples) ||
      !Number.isSafeInteger(metric.maximum_samples) ||
      metric.minimum_samples < 1 ||
      metric.maximum_samples < metric.minimum_samples ||
      metric.maximum_samples > 1000
    )
      problems.push(`metric_samples_invalid:${metric.id}`);
    if (!scenarioIds.has(metric.scenario_id))
      problems.push(`metric_scenario_invalid:${metric.id}`);
    if (
      !['required', 'smoke', 'structural', 'inactive'].includes(
        metric.pull_request,
      )
    )
      problems.push(`metric_pull_request_invalid:${metric.id}`);
    if (!['required', 'inactive'].includes(metric.release))
      problems.push(`metric_release_invalid:${metric.id}`);
    if (
      !Array.isArray(metric.release_profiles) ||
      new Set(metric.release_profiles).size !==
        metric.release_profiles.length ||
      metric.release_profiles.some((id) => !profileIds.has(id)) ||
      (metric.release === 'required' && metric.release_profiles.length === 0) ||
      (metric.release === 'inactive' && metric.release_profiles.length !== 0)
    )
      problems.push(`metric_release_profiles_invalid:${metric.id}`);
    try {
      thresholdsFor(
        metric,
        metric.threshold_kind === 'source_relative' ? 1 : undefined,
      );
    } catch {
      problems.push(`metric_threshold_invalid:${metric.id}`);
    }
    const thresholds = (() => {
      try {
        return thresholdsFor(
          metric,
          metric.threshold_kind === 'source_relative' ? 1 : undefined,
        );
      } catch {
        return null;
      }
    })();
    if (
      !thresholds ||
      !Number.isFinite(thresholds.target) ||
      !Number.isFinite(thresholds.hardLimit) ||
      thresholds.target < 0 ||
      thresholds.hardLimit < thresholds.target
    )
      problems.push(`metric_threshold_invalid:${metric.id}`);
    if (
      !Array.isArray(metric.failure_invariants) ||
      new Set(metric.failure_invariants).size !==
        metric.failure_invariants.length
    )
      problems.push(`metric_invariants_invalid:${metric.id}`);
  }
  for (const id of REQUIRED_METRICS)
    if (!metricIds.has(id)) problems.push(`required_metric_missing:${id}`);
  return [...new Set(problems)];
};

const canonicalTimestamp = (value) => {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
};

export const validateEvidence = (catalog, evidence) => {
  const problems = [];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence))
    return { problems: ['evidence_invalid'], summary: null, metric: null };
  for (const key of Object.keys(evidence))
    if (!ALLOWED_EVIDENCE_KEYS.has(key))
      problems.push(`evidence_key_forbidden:${key}`);
  const metric =
    catalog.metrics.find(({ id }) => id === evidence.metric_id) ?? null;
  const profile =
    catalog.profiles.find(({ id }) => id === evidence.profile_id) ?? null;
  const scenario =
    catalog.scenarios.find(({ id }) => id === evidence.scenario_id) ?? null;
  if (evidence.schema_version !== 1) problems.push('evidence_schema_invalid');
  if (evidence.catalog_version !== catalog.catalog_version)
    problems.push('evidence_catalog_stale');
  if (!metric) problems.push('evidence_metric_unknown');
  if (!profile) problems.push('evidence_profile_unknown');
  if (!scenario) problems.push('evidence_scenario_unknown');
  if (metric && evidence.scenario_id !== metric.scenario_id)
    problems.push('evidence_scenario_mismatch');
  if (profile && evidence.evidence_class !== profile.evidence_class)
    problems.push('evidence_class_mismatch');
  if (
    profile &&
    metric &&
    profile.platform_family !== 'all' &&
    metric.platform_family !== 'all' &&
    profile.platform_family !== metric.platform_family
  )
    problems.push('evidence_platform_mismatch');
  for (const field of [
    'build_profile',
    'build_id',
    'runtime_version',
    'method',
  ])
    if (!TOKEN_PATTERN.test(evidence[field] ?? ''))
      problems.push(`evidence_${field}_invalid`);
  if (
    evidence.evidence_class === 'reference' &&
    evidence.build_profile !== 'release'
  )
    problems.push('evidence_reference_build_invalid');
  if (typeof evidence.cold_state !== 'boolean')
    problems.push('evidence_cold_state_invalid');
  if (scenario?.state === 'cold' && evidence.cold_state !== true)
    problems.push('evidence_scenario_state_mismatch');
  if (scenario?.state === 'warm' && evidence.cold_state !== false)
    problems.push('evidence_scenario_state_mismatch');
  if (scenario?.sha256 && evidence.scenario_digest !== scenario.sha256)
    problems.push('evidence_digest_mismatch');
  if (!canonicalTimestamp(evidence.measured_at))
    problems.push('evidence_timestamp_invalid');
  if (evidence.cleanup_complete !== true)
    problems.push('evidence_cleanup_incomplete');
  if (
    !evidence.invariants ||
    typeof evidence.invariants !== 'object' ||
    Array.isArray(evidence.invariants)
  ) {
    problems.push('evidence_invariants_invalid');
  } else if (metric) {
    const declared = new Set(metric.failure_invariants);
    for (const key of Object.keys(evidence.invariants))
      if (!declared.has(key))
        problems.push(`evidence_invariant_unknown:${key}`);
    for (const key of declared)
      if (typeof evidence.invariants[key] !== 'boolean')
        problems.push(`evidence_invariant_invalid:${key}`);
  }
  if (
    metric?.threshold_kind === 'source_relative' &&
    (!Number.isSafeInteger(evidence.source_bytes) || evidence.source_bytes < 0)
  )
    problems.push('evidence_source_bytes_invalid');
  let summary = null;
  if (metric) {
    try {
      summary = summarizeSamples(
        evidence.samples,
        metric.minimum_samples,
        metric.maximum_samples,
      );
      for (const field of ['median', 'p95', 'maximum'])
        if (evidence[field] !== summary[field])
          problems.push(`evidence_${field}_mismatch`);
      if (
        metric.id === 'idle_desktop_working_set' ||
        metric.id === 'idle_android_pss'
      ) {
        if (
          !Number.isSafeInteger(evidence.peak_memory_bytes) ||
          evidence.peak_memory_bytes !== summary.maximum
        )
          problems.push('evidence_peak_memory_invalid');
      }
      const computed = classifyValue(
        metric,
        observationFor(metric, summary, evidence.samples),
        { sourceBytes: evidence.source_bytes, invariants: evidence.invariants },
      );
      if (evidence.classification !== computed)
        problems.push('evidence_classification_mismatch');
    } catch (error) {
      problems.push(
        error instanceof Error
          ? `evidence_${error.message}`
          : 'evidence_samples_invalid',
      );
    }
  }
  return { problems: [...new Set(problems)], summary, metric };
};

export const evidenceComparable = (left, right) =>
  [
    'catalog_version',
    'metric_id',
    'scenario_id',
    'scenario_digest',
    'profile_id',
    'evidence_class',
    'build_profile',
    'cold_state',
    'method',
  ].every((field) => left[field] === right[field]);

export const evaluateHistory = (records) => {
  const bounded = [...records]
    .sort((left, right) =>
      String(left.measured_at).localeCompare(String(right.measured_at)),
    )
    .slice(-20);
  let warningStreak = 0;
  let previous = null;
  for (const record of bounded) {
    if (record.classification === 'failure')
      return { failure: true, followUp: false, warningStreak };
    if (record.classification === 'pass') {
      warningStreak = 0;
      previous = record;
      continue;
    }
    if (record.classification !== 'warning') {
      warningStreak = 0;
      previous = null;
      continue;
    }
    warningStreak =
      previous &&
      evidenceComparable(previous, record) &&
      previous.classification === 'warning'
        ? warningStreak + 1
        : 1;
    if (warningStreak >= 2)
      return { failure: false, followUp: true, warningStreak };
    previous = record;
  }
  return { failure: false, followUp: false, warningStreak };
};

export const evaluateGate = (
  catalog,
  evidenceRecords,
  stage = 'pull_request',
) => {
  if (!['pull_request', 'release'].includes(stage))
    throw new Error('gate_stage_invalid');
  const diagnostics = [];
  const accepted = [];
  const notApplicable = [];
  let status = 'pass';
  for (const metric of catalog.metrics) {
    const activation = metric[stage];
    if (activation === 'inactive') {
      notApplicable.push(metric.id);
      continue;
    }
    const matching = evidenceRecords.filter(
      ({ metric_id }) => metric_id === metric.id,
    );
    if (matching.length === 0) {
      if (activation === 'required') {
        diagnostics.push({
          code: 'required_evidence_missing',
          metric_id: metric.id,
        });
        status = 'failure';
      }
      continue;
    }
    const eligibleProfiles = new Set();
    const eligibleMatching = [];
    for (const record of matching) {
      const { problems } = validateEvidence(catalog, record);
      if (problems.length) {
        diagnostics.push(
          ...problems
            .map((code) => ({ code, metric_id: metric.id }))
            .slice(0, 100 - diagnostics.length),
        );
        status = 'failure';
      } else {
        if (stage === 'release' && record.evidence_class === 'hosted_smoke') {
          diagnostics.push({
            code: 'release_evidence_not_reference',
            metric_id: metric.id,
          });
          continue;
        }
        if (
          stage === 'release' &&
          !metric.release_profiles.includes(record.profile_id)
        ) {
          diagnostics.push({
            code: 'release_profile_inapplicable',
            metric_id: metric.id,
            profile_id: record.profile_id,
          });
          continue;
        }
        eligibleProfiles.add(record.profile_id);
        eligibleMatching.push(record);
        accepted.push(
          `${metric.id}:${record.profile_id}:${record.measured_at}`,
        );
        if (record.classification === 'failure') status = 'failure';
        else if (record.classification === 'warning' && status === 'pass')
          status = 'warning';
      }
    }
    if (activation === 'required') {
      const requiredProfiles =
        stage === 'release' ? metric.release_profiles : [null];
      for (const profileId of requiredProfiles) {
        if (
          (profileId === null && eligibleMatching.length === 0) ||
          (profileId !== null && !eligibleProfiles.has(profileId))
        ) {
          diagnostics.push({
            code: 'required_evidence_missing',
            metric_id: metric.id,
            ...(profileId === null ? {} : { profile_id: profileId }),
          });
          status = 'failure';
        }
      }
    }
    const history = evaluateHistory(eligibleMatching);
    if (history.followUp) {
      diagnostics.push({ code: 'consecutive_warnings', metric_id: metric.id });
      status = 'failure';
    }
  }
  return {
    status,
    accepted: accepted.sort(),
    not_applicable: notApplicable.sort(),
    diagnostics: diagnostics.slice(0, 100),
  };
};
