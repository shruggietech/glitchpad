import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateGate, validateCatalog, validateEvidence } from './lib/performance-policy.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const governed = [
  'fixtures/performance/budgets.json',
  'fixtures/performance/corpus.json',
  'fixtures/performance/evidence/policy-cases.json',
];

export const generatePerformanceFixture = (scenarioId, bytes = 1024 * 1024) => {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > 32 * 1024 * 1024) throw new Error('generated_fixture_size_invalid');
  const prefixes = {
    text_1mib: '',
    markdown_1mib: '# Performance fixture\n\n',
    mermaid_1mib: 'flowchart TB\n  A --> B\n%%',
    suspended_text_tab: '',
  };
  const prefix = prefixes[scenarioId];
  if (prefix === undefined || Buffer.byteLength(prefix) > bytes) throw new Error('generated_fixture_unknown');
  return `${prefix}${'x'.repeat(bytes - Buffer.byteLength(prefix))}`;
};

export const verifyPerformanceFixtures = async (root = repositoryRoot) => {
  const problems = [];
  const [catalogBytes, corpusBytes, policyBytes, provenance] = await Promise.all([
    ...governed.map((path) => readFile(resolve(root, path))),
    readFile(resolve(root, 'fixtures/provenance.toml'), 'utf8'),
  ]);
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const corpus = JSON.parse(corpusBytes.toString('utf8'));
  const policy = JSON.parse(policyBytes.toString('utf8'));
  problems.push(...validateCatalog(catalog));
  for (const scenario of catalog.scenarios.filter(({ kind }) => kind === 'generated')) {
    try {
      const generated = generatePerformanceFixture(scenario.id, scenario.generated_bytes);
      const digest = createHash('sha256').update(generated).digest('hex');
      if (Buffer.byteLength(generated) !== scenario.generated_bytes || digest !== scenario.sha256) problems.push(`performance_generated_fixture_mismatch:${scenario.id}`);
    } catch {
      problems.push(`performance_generated_fixture_invalid:${scenario.id}`);
    }
  }
  if (corpus.schema_version !== 1 || corpus.catalog_version !== catalog.catalog_version) problems.push('performance_corpus_version_invalid');
  if (policy.schema_version !== 1 || !Array.isArray(policy.classification_cases) || !Array.isArray(policy.history_cases) || !Array.isArray(policy.invalid_cases)) problems.push('performance_policy_cases_invalid');
  const boundaryFamilies = new Set((corpus.boundaries ?? []).map(({ family }) => family));
  for (const family of ['text', 'markdown', 'mermaid']) if (!boundaryFamilies.has(family)) problems.push(`performance_boundary_missing:${family}`);
  for (const operation of ['syntax', 'markdown', 'mermaid', 'checksum', 'large_text_search', 'source_stream']) if (!corpus.cancellation_operations?.includes(operation)) problems.push(`performance_cancellation_missing:${operation}`);
  if (new Set(corpus.resource_kinds ?? []).size !== 8) problems.push('performance_resource_kinds_invalid');
  for (let index = 0; index < governed.length; index += 1) {
    const path = governed[index];
    const bytes = [catalogBytes, corpusBytes, policyBytes][index];
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (!provenance.includes(`path = "${path}"`)) problems.push(`performance_provenance_missing:${path}`);
    if (!provenance.includes(`sha256 = "${digest}"`)) problems.push(`performance_provenance_stale:${path}`);
  }
  return [...new Set(problems)];
};

export const verifyEvidenceGate = async (evidencePath, stage = 'release', root = repositoryRoot) => {
  if (!['pull_request', 'release'].includes(stage)) throw new Error('gate_stage_invalid');
  const [catalogBytes, evidenceBytes] = await Promise.all([
    readFile(resolve(root, governed[0])),
    readFile(resolve(evidencePath)),
  ]);
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const records = JSON.parse(evidenceBytes.toString('utf8'));
  if (!Array.isArray(records)) throw new Error('evidence_collection_invalid');
  return evaluateGate(catalog, records, stage);
};

export const verifyAndroidInstrumentationOutput = async (outputPath, apiLevel, root = repositoryRoot) => {
  if (!['24', '36'].includes(String(apiLevel))) throw new Error('android_instrumentation_api_invalid');
  const [catalogBytes, output] = await Promise.all([
    readFile(resolve(root, governed[0])),
    readFile(resolve(outputPath), 'utf8'),
  ]);
  const prefix = 'INSTRUMENTATION_STATUS: performance_evidence=';
  const receipts = output
    .split(/\r?\n/u)
    .filter((line) => line.includes(prefix))
    .map((line) => JSON.parse(line.slice(line.indexOf(prefix) + prefix.length)));
  if (receipts.length !== 1) throw new Error('android_instrumentation_receipt_count_invalid');

  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const receipt = receipts[0];
  const expectedApi = String(apiLevel);
  if (
    receipt.metric_id !== 'idle_android_pss' ||
    receipt.profile_id !== `android_api${expectedApi}_reference_v1` ||
    receipt.runtime_version !== `android-api${expectedApi}` ||
    receipt.build_profile !== 'debug'
  ) throw new Error('android_instrumentation_identity_invalid');

  const { problems } = validateEvidence(catalog, receipt);
  if (problems.length !== 1 || problems[0] !== 'evidence_reference_build_invalid') throw new Error('android_instrumentation_evidence_invalid');
  if (receipt.classification === 'failure') throw new Error('android_instrumentation_hard_limit_exceeded');
  return receipt;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const arguments_ = process.argv.slice(2);
    let evidencePath = null;
    let androidInstrumentationOutput = null;
    let apiLevel = null;
    let stage = 'release';
    for (let index = 0; index < arguments_.length; index += 1) {
      if (arguments_[index] === '--evidence') evidencePath = arguments_[++index] ?? null;
      else if (arguments_[index] === '--android-instrumentation-output') androidInstrumentationOutput = arguments_[++index] ?? null;
      else if (arguments_[index] === '--api-level') apiLevel = arguments_[++index] ?? null;
      else if (arguments_[index] === '--stage') stage = arguments_[++index] ?? '';
      else throw new Error('argument_unknown');
    }
    if ((androidInstrumentationOutput === null) !== (apiLevel === null) || (evidencePath !== null && androidInstrumentationOutput !== null)) throw new Error('argument_combination_invalid');
    const problems = await verifyPerformanceFixtures();
    if (problems.length) {
      process.stderr.write(`${problems.join('\n')}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write('Performance catalog, scenarios, policy cases, and provenance are valid.\n');
      if (evidencePath) {
        const gate = await verifyEvidenceGate(evidencePath, stage);
        process.stdout.write(`${JSON.stringify(gate)}\n`);
        if (gate.status === 'failure') process.exitCode = 1;
      }
      if (androidInstrumentationOutput) {
        const receipt = await verifyAndroidInstrumentationOutput(androidInstrumentationOutput, apiLevel);
        process.stdout.write(`Android API ${apiLevel} instrumentation evidence is valid (${receipt.classification}).\n`);
      }
    }
  } catch {
    process.stderr.write('performance_evidence_input_invalid\n');
    process.exitCode = 1;
  }
}
