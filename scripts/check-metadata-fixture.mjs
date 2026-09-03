import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const relativeFixture = 'fixtures/metadata/catalog.json';
const requiredStates = new Set([
  'available',
  'not_provided',
  'unsupported',
  'redacted',
  'pending',
  'errored',
]);
const requiredCopyPolicies = new Set([
  'direct',
  'explicit_confirmation',
  'denied',
]);

export function validateMetadataCorpus(corpus, catalogKeys) {
  const problems = [];
  if (corpus.schema_version !== 1) problems.push('metadata fixture schema_version must be 1');
  const states = new Set(corpus.cases?.map(({ availability }) => availability));
  const policies = new Set(corpus.cases?.map(({ copy_policy }) => copy_policy));
  for (const state of requiredStates) {
    if (!states.has(state)) problems.push(`metadata fixture is missing availability state: ${state}`);
  }
  for (const policy of requiredCopyPolicies) {
    if (!policies.has(policy)) problems.push(`metadata fixture is missing copy policy: ${policy}`);
  }
  if (!corpus.expected?.hostile_values_render_as_text) problems.push('hostile metadata must be declared text-only');
  if (!corpus.expected?.native_locators_are_never_catalog_values) problems.push('native locator exclusion must be declared');
  if (!Array.isArray(corpus.hostile_values) || corpus.hostile_values.length < 6) problems.push('metadata hostile-value coverage is incomplete');
  if (catalogKeys) {
    for (const fixtureCase of corpus.cases ?? []) {
      if (!catalogKeys.has(fixtureCase.key)) problems.push(`metadata fixture uses unknown catalog key: ${fixtureCase.key}`);
    }
  }
  return problems;
}

export async function verifyMetadataFixture(root = repositoryRoot) {
  const fixtureBytes = await readFile(resolve(root, relativeFixture));
  const corpus = JSON.parse(fixtureBytes.toString('utf8'));
  const catalogSource = await readFile(resolve(root, 'apps/glitchpad/src/domain/metadata.ts'), 'utf8');
  const catalogKeys = new Set([...catalogSource.matchAll(/\bentry\('([^']+)'/gu)].map((match) => match[1]));
  const problems = validateMetadataCorpus(corpus, catalogKeys);
  if (catalogKeys.size < 1) problems.push('metadata catalog source did not expose any stable keys');
  const provenance = await readFile(resolve(root, 'fixtures/provenance.toml'), 'utf8');
  const digest = createHash('sha256').update(fixtureBytes).digest('hex');
  if (!provenance.includes(`path = "${relativeFixture}"`)) problems.push('metadata fixture provenance record is missing');
  if (!provenance.includes(`sha256 = "${digest}"`)) problems.push('metadata fixture provenance digest is missing or stale');
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = await verifyMetadataFixture();
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Metadata fixture catalog, safety declarations, and provenance are valid.');
  }
}
