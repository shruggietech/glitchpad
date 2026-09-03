import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import catalog from '../fixtures/performance/budgets.json' with { type: 'json' };
import policyCases from '../fixtures/performance/evidence/policy-cases.json' with { type: 'json' };
import {
  generatePerformanceFixture,
  verifyPerformanceFixtures,
} from './check-performance.mjs';
import {
  classifyValue,
  evaluateGate,
  evaluateHistory,
  nearestRank,
  observationFor,
  summarizeSamples,
  validateCatalog,
  validateEvidence,
} from './lib/performance-policy.mjs';

const metric = {
  target: 50,
  hard_limit: 100,
  threshold_kind: 'fixed',
  failure_invariants: [],
};

test('repository performance catalog and provenance pass', async () => {
  assert.deepEqual(await verifyPerformanceFixtures(), []);
});

test('Android PSS instrumentation emits a complete evidence envelope', async () => {
  const source = await readFile(
    new URL(
      '../crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/performance/PerformanceInstrumentedTest.kt',
      import.meta.url,
    ),
    'utf8',
  );
  for (const field of [
    'catalog_version',
    'scenario_id',
    'evidence_class',
    'build_profile',
    'build_id',
    'runtime_version',
    'cold_state',
    'median',
    'p95',
    'maximum',
    'invariants',
    'classification',
    'measured_at',
  ]) {
    assert.match(source, new RegExp(`\\.put\\("${field}"`, 'u'));
  }
});

test('classification cases enforce inclusive target and hard boundaries', () => {
  for (const fixture of policyCases.classification_cases)
    assert.equal(
      classifyValue(
        { ...metric, target: fixture.target, hard_limit: fixture.hard_limit },
        fixture.value,
      ),
      fixture.expected,
      fixture.name,
    );
});

test('nearest-rank summaries are deterministic and bounded', () => {
  assert.equal(nearestRank([5, 1, 4, 2, 3], 0.95), 5);
  assert.throws(() => nearestRank([1], 0), /percentile_invalid/u);
  assert.throws(() => nearestRank([1], 1.01), /percentile_invalid/u);
  assert.deepEqual(summarizeSamples([5, 1, 4, 2, 3], 5, 5), {
    median: 3,
    p95: 5,
    maximum: 5,
  });
  assert.throws(() => summarizeSamples([], 1, 2), /sample_count_invalid/u);
  assert.throws(
    () => summarizeSamples([Number.NaN], 1, 2),
    /sample_value_invalid/u,
  );
});

test('minimum observations require and inspect the original samples', () => {
  assert.equal(observationFor({ aggregation: 'minimum' }, {}, [5, 2, 4]), 2);
  assert.throws(
    () => observationFor({ aggregation: 'minimum' }, {}),
    /samples_empty/u,
  );
});

test('generated fixtures are exact and deterministic', () => {
  for (const scenario of catalog.scenarios.filter(
    ({ kind }) => kind === 'generated',
  ))
    assert.equal(
      Buffer.byteLength(
        generatePerformanceFixture(scenario.id, scenario.generated_bytes),
      ),
      scenario.generated_bytes,
    );
  assert.throws(
    () => generatePerformanceFixture('unknown'),
    /generated_fixture_unknown/u,
  );
});

test('catalog failures are stable and required metrics cannot disappear', () => {
  const broken = structuredClone(catalog);
  broken.metrics = broken.metrics.filter(
    ({ id }) => id !== 'editor_input_paint',
  );
  assert.ok(
    validateCatalog(broken).includes(
      'required_metric_missing:editor_input_paint',
    ),
  );
  const missingProfile = structuredClone(catalog);
  missingProfile.metrics[0].release_profiles = [];
  assert.ok(
    validateCatalog(missingProfile).includes(
      'metric_release_profiles_invalid:cold_shell_desktop',
    ),
  );
});

const validEvidence = () => {
  const selected = catalog.metrics.find(
    ({ id }) => id === 'renderer_resource_disposal',
  );
  const samples = Array.from({ length: selected.minimum_samples }, () => 0);
  return {
    schema_version: 1,
    catalog_version: catalog.catalog_version,
    metric_id: selected.id,
    scenario_id: selected.scenario_id,
    profile_id: 'structural_v1',
    evidence_class: 'structural',
    build_profile: 'production_web',
    build_id: 'test-build',
    runtime_version: 'deterministic-1',
    cold_state: false,
    method: 'resource-ledger-v1',
    samples,
    median: 0,
    p95: 0,
    maximum: 0,
    invariants: { incomplete_cleanup: false, resource_growth: false },
    classification: 'pass',
    cleanup_complete: true,
    measured_at: '2026-09-03T00:00:00.000Z',
  };
};

test('evidence validation rejects hostile fields and recomputes results', () => {
  assert.deepEqual(validateEvidence(catalog, validEvidence()).problems, []);
  const hostile = {
    ...validEvidence(),
    path: 'C:/private/document.txt',
    classification: 'warning',
  };
  const problems = validateEvidence(catalog, hostile).problems;
  assert.ok(problems.includes('evidence_key_forbidden:path'));
  assert.ok(problems.includes('evidence_classification_mismatch'));
});

test('only adjacent comparable warnings require follow-up', () => {
  const first = { ...validEvidence(), classification: 'warning' };
  const second = { ...first, measured_at: '2026-09-03T00:01:00.000Z' };
  assert.equal(evaluateHistory([first, second]).followUp, true);
  assert.equal(
    evaluateHistory([first, { ...second, method: 'different' }, second])
      .followUp,
    false,
  );
  assert.equal(
    evaluateHistory([first, { ...second, classification: 'pass' }, second])
      .followUp,
    false,
  );
  assert.equal(evaluateHistory([second, first]).followUp, true);
});

test('aggregate gates reject missing required release evidence and hard failures', () => {
  const missing = evaluateGate(catalog, [], 'release');
  assert.equal(missing.status, 'failure');
  assert.ok(
    missing.diagnostics.some(
      ({ code, metric_id }) =>
        code === 'required_evidence_missing' &&
        metric_id === 'cold_shell_desktop',
    ),
  );
  assert.ok(missing.not_applicable.includes('desktop_installer_size'));

  const hosted = validEvidence();
  hosted.profile_id = 'hosted_windows_smoke_v1';
  hosted.evidence_class = 'hosted_smoke';
  assert.ok(
    evaluateGate(catalog, [hosted], 'release').diagnostics.some(
      ({ code }) => code === 'release_evidence_not_reference',
    ),
  );

  const wrongProfile = validEvidence();
  wrongProfile.profile_id = 'desktop_reference_v1';
  wrongProfile.evidence_class = 'reference';
  wrongProfile.build_profile = 'release';
  assert.ok(
    evaluateGate(catalog, [wrongProfile], 'release').diagnostics.some(
      ({ code }) => code === 'release_profile_inapplicable',
    ),
  );

  const androidOnly = structuredClone(catalog);
  androidOnly.metrics = androidOnly.metrics.filter(
    ({ id }) => id === 'cold_shell_android',
  );
  const api24 = {
    ...validEvidence(),
    metric_id: 'cold_shell_android',
    scenario_id: 'cold_shell',
    profile_id: 'android_api24_reference_v1',
    evidence_class: 'reference',
    build_profile: 'release',
    cold_state: true,
    samples: [100, 100, 100, 100, 100],
    median: 100,
    p95: 100,
    maximum: 100,
    invariants: {},
  };
  const incompleteCoverage = evaluateGate(androidOnly, [api24], 'release');
  assert.equal(incompleteCoverage.status, 'failure');
  assert.ok(
    incompleteCoverage.diagnostics.some(
      ({ code, profile_id }) =>
        code === 'required_evidence_missing' &&
        profile_id === 'android_api36_reference_v1',
    ),
  );

  const failed = validEvidence();
  failed.samples = Array.from({ length: 100 }, () => 1);
  failed.median = 1;
  failed.p95 = 1;
  failed.maximum = 1;
  failed.classification = 'failure';
  assert.equal(
    evaluateGate(catalog, [failed], 'pull_request').status,
    'failure',
  );
});
