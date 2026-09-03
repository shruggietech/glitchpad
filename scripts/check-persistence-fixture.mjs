import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const relativeFixture = 'fixtures/persistence/corpus.json';

export function validatePersistenceCorpus(corpus) {
  const problems = [];
  if (corpus.schema_version !== 1) problems.push('persistence fixture schema_version must be 1');
  const statuses = new Set(corpus.preference_cases?.map(({ expected_status }) => expected_status));
  for (const status of ['loaded', 'migrated', 'unsupported']) {
    if (!statuses.has(status)) problems.push(`persistence fixture is missing status: ${status}`);
  }
  const failures = new Set(corpus.failure_cases?.map(({ name }) => name));
  for (const name of ['corrupt', 'oversized', 'unavailable']) {
    if (!failures.has(name)) problems.push(`persistence fixture is missing failure case: ${name}`);
  }
  if (!Array.isArray(corpus.hostile_diagnostic_sentinels) || corpus.hostile_diagnostic_sentinels.length < 7)
    problems.push('persistence hostile diagnostic coverage is incomplete');
  const platforms = corpus.platform_lifecycle_cases ?? [];
  if (!platforms.some(({ platform, restorable }) => platform === 'desktop' && restorable)
      || !platforms.some(({ platform, restorable }) => platform === 'android' && restorable)
      || !platforms.some(({ platform, restorable }) => platform === 'android' && !restorable))
    problems.push('persistence desktop and Android lifecycle coverage is incomplete');
  const limits = corpus.limits ?? {};
  if (limits.sessions !== 32 || limits.language_overrides !== 128)
    problems.push('persistence projection limits disagree with S017');
  if (limits.diagnostic_events !== 2000 || limits.diagnostic_bytes !== 2 * 1024 * 1024 || limits.diagnostic_age_ms !== 7 * 24 * 60 * 60 * 1000)
    problems.push('persistence diagnostic retention limits disagree with S017');
  const sessionBytes = JSON.stringify(corpus.session_case ?? {});
  for (const forbidden of ['content', 'raw_text', 'normalized_text', 'source_identity']) {
    if (sessionBytes.includes(forbidden)) problems.push(`session fixture contains forbidden field: ${forbidden}`);
  }
  return problems;
}

export async function verifyPersistenceFixture(root = repositoryRoot) {
  const fixtureBytes = await readFile(resolve(root, relativeFixture));
  const corpus = JSON.parse(fixtureBytes.toString('utf8'));
  const problems = validatePersistenceCorpus(corpus);
  const provenance = await readFile(resolve(root, 'fixtures/provenance.toml'), 'utf8');
  const digest = createHash('sha256').update(fixtureBytes).digest('hex');
  if (!provenance.includes(`path = "${relativeFixture}"`)) problems.push('persistence fixture provenance record is missing');
  if (!provenance.includes(`sha256 = "${digest}"`)) problems.push('persistence fixture provenance digest is missing or stale');
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = await verifyPersistenceFixture();
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Persistence fixtures, safety declarations, limits, and provenance are valid.');
  }
}
