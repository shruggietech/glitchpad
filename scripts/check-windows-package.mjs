import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRepositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const sha256Pattern = /^[a-f0-9]{64}$/u;
const semanticVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;

function fail(message) {
  throw new Error(`Invalid Windows package contract: ${message}`);
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function uniqueExtensions(families) {
  const extensions = families.flatMap((family) => family.extensions);
  if (new Set(extensions).size !== extensions.length)
    fail('capability extensions must be globally unique');
  for (const extension of extensions) {
    if (!/^[a-z0-9]+$/u.test(extension))
      fail(`invalid capability extension ${extension}`);
  }
  return extensions.sort();
}

function sourceExtensions(source) {
  const block = source.match(/const extensions = new Map<string, LanguageId>\(\[([\s\S]*?)\]\);/u)?.[1];
  if (!block) fail('could not locate the editor extension inventory');
  return [...block.matchAll(/\['([^']+)',\s*'[^']+'\]/gu)]
    .map((match) => match[1])
    .sort();
}

function same(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

export function classifyPackageSize(bytes, budget) {
  if (!Number.isSafeInteger(bytes) || bytes < 1) fail('artifact byte length must be positive');
  if (bytes <= budget.target_bytes) return 'pass';
  if (bytes <= budget.hard_limit_bytes) return 'warning';
  return 'failure';
}

function validateRelativeInventoryPath(path) {
  if (
    typeof path !== 'string'
    || path.length === 0
    || path.includes('\\')
    || path.startsWith('/')
    || /^[a-z]:/iu.test(path)
    || path.split('/').some((segment) => segment === '..' || segment === '')
    || path.includes(':')
  ) fail(`unsafe portable inventory path ${String(path)}`);
}

export async function checkWindowsConfiguration(repositoryRoot = defaultRepositoryRoot) {
  const packagingRoot = join(repositoryRoot, 'packaging', 'windows');
  const [capabilities, contract, tauri, languageSource, installerHooks] = await Promise.all([
    json(join(packagingRoot, 'capabilities.json')),
    json(join(packagingRoot, 'package-contract.json')),
    json(join(repositoryRoot, 'crates', 'glitchpad-host', 'tauri.s019-windows.conf.json')),
    readFile(join(repositoryRoot, 'apps', 'glitchpad', 'src', 'domain', 'language.ts'), 'utf8'),
    readFile(join(repositoryRoot, 'crates', 'glitchpad-host', 'windows', 'installer-hooks.nsh'), 'utf8'),
  ]);

  if (capabilities.schema_version !== 1 || capabilities.release !== '0.1.0')
    fail('capability inventory version is not v0.1.0 schema 1');
  const configured = uniqueExtensions(capabilities.families);
  const expectedBase = ['markdown', 'md', 'mermaid', 'mmd', 'txt'];
  for (const extension of expectedBase)
    if (!configured.includes(extension)) fail(`missing stable extension ${extension}`);
  const sourceFamily = capabilities.families.find(({ id }) => id === 'source');
  if (!sourceFamily || !same(sourceFamily.extensions, sourceExtensions(languageSource)))
    fail('source associations drift from the stable editor extension inventory');
  const forbidden = new Set(capabilities.forbidden_extensions);
  for (const extension of configured)
    if (forbidden.has(extension)) fail(`forbidden extension ${extension} is associated`);

  if (
    contract.schema_version !== 1
    || contract.platform !== 'windows'
    || contract.architecture !== 'x86_64'
    || !semanticVersionPattern.test(contract.candidate_version)
    || contract.candidate_version === '0.0.0'
  ) fail('candidate identity is invalid');
  const expectedNames = [
    `glitchpad-${contract.candidate_version}-windows-x86_64-setup.exe`,
    `glitchpad-${contract.candidate_version}-windows-x86_64.zip`,
  ];
  if (!same(contract.artifacts.map(({ name }) => name), expectedNames))
    fail('candidate artifact names are not canonical');
  if (
    contract.size_budget.target_bytes !== 35 * 1024 * 1024
    || contract.size_budget.hard_limit_bytes !== 60 * 1024 * 1024
  ) fail('S018 desktop package limits drifted');
  if (contract.candidate_signature_status !== 'not_applicable_unsigned_candidate')
    fail('unsigned candidate signature state is not explicit');
  if (!contract.official.required_evidence.includes('signature-evidence.json'))
    fail('official gate does not require signature evidence');

  if (
    tauri.version !== contract.candidate_version
    || tauri.bundle.active !== true
    || !same(tauri.bundle.targets, ['nsis'])
    || tauri.bundle.windows?.nsis?.installMode !== 'currentUser'
    || tauri.bundle.windows?.nsis?.installerHooks !== 'windows/installer-hooks.nsh'
    || tauri.bundle.windows?.webviewInstallMode?.type !== 'skip'
  ) fail('Tauri overlay is not the governed current-user NSIS configuration');
  const associated = tauri.bundle.fileAssociations.flatMap(({ ext }) => ext).sort();
  if (!same(associated, configured)) fail('Tauri associations drift from capabilities.json');
  for (const association of tauri.bundle.fileAssociations) {
    for (const extension of association.ext) {
      for (const operation of ['BACKUP', 'RESTORE']) {
        const invocation = `!insertmacro GLITCHPAD_${operation}_ASSOCIATION "${extension}" "${association.name}"`;
        if (!installerHooks.includes(invocation)) fail(`installer hooks omit ${operation.toLowerCase()} for ${extension}`);
      }
    }
  }
  for (const required of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.txt']) {
    if (!Object.values(tauri.bundle.resources ?? {}).includes(required))
      fail(`Tauri bundle omits ${required}`);
  }

  return { capabilityCount: configured.length, artifactCount: contract.artifacts.length };
}

export function validateWindowsEvidence(evidence, contract, { official = false } = {}) {
  const serialized = JSON.stringify(evidence);
  if (/PRIVATE KEY|client[_-]?secret|certificate[_-]?password/iu.test(serialized))
    fail('evidence contains a secret-shaped value');
  if (evidence.schema_version !== 1 || evidence.version !== contract.candidate_version)
    fail('evidence version is invalid');
  if (evidence.platform !== 'windows' || evidence.architecture !== 'x86_64')
    fail('evidence platform identity is invalid');
  if (!sha256Pattern.test(evidence.source_commit)) fail('source commit is invalid');
  if (!Array.isArray(evidence.artifacts) || evidence.artifacts.length !== 2)
    fail('evidence must contain both Windows artifacts');

  const expected = new Map(contract.artifacts.map((artifact) => [artifact.kind, artifact.name]));
  const seen = new Set();
  for (const artifact of evidence.artifacts) {
    if (seen.has(artifact.kind) || expected.get(artifact.kind) !== artifact.name)
      fail(`unexpected or duplicate artifact ${artifact.kind}`);
    seen.add(artifact.kind);
    if (!sha256Pattern.test(artifact.sha256)) fail(`invalid digest for ${artifact.kind}`);
    const classification = classifyPackageSize(artifact.bytes, contract.size_budget);
    if (classification !== artifact.size_classification || classification === 'failure')
      fail(`invalid size result for ${artifact.kind}`);
    if (!official && artifact.signature_status !== contract.candidate_signature_status)
      fail(`candidate ${artifact.kind} has an invalid signature state`);
  }

  if (!Array.isArray(evidence.portable_inventory)) fail('portable inventory is missing');
  const caseFolded = new Set();
  const inventoryNames = new Set();
  for (const entry of evidence.portable_inventory) {
    validateRelativeInventoryPath(entry.relative_path);
    const folded = entry.relative_path.toLowerCase();
    if (caseFolded.has(folded)) fail(`case-colliding inventory path ${entry.relative_path}`);
    caseFolded.add(folded);
    inventoryNames.add(entry.relative_path);
    if (!sha256Pattern.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1)
      fail(`invalid inventory facts for ${entry.relative_path}`);
    if (entry.relative_path.toLowerCase().endsWith('.exe') && entry.relative_path !== 'Glitchpad.exe')
      fail(`unexpected executable ${entry.relative_path}`);
  }
  for (const required of contract.portable_required_files)
    if (!inventoryNames.has(required)) fail(`portable inventory omits ${required}`);

  if (!official) {
    if (evidence.official !== false || evidence.gate_status !== 'candidate_valid')
      fail('unsigned evidence must remain candidate-only');
    return true;
  }

  if (evidence.official !== true || evidence.gate_status !== 'official_valid')
    fail('official evidence is not explicitly authorized');
  if (evidence.event !== contract.official.authorized_event || evidence.tag !== contract.official.tag_pattern)
    fail('official evidence came from an unauthorized context');
  for (const name of contract.official.required_evidence)
    if (!evidence.evidence_files?.includes(name)) fail(`official evidence omits ${name}`);
  for (const artifact of evidence.artifacts) {
    if (
      artifact.signature_status !== contract.official.required_signature_status
      || artifact.timestamp_status !== contract.official.required_timestamp_status
      || artifact.signature_sha256 !== artifact.sha256
    ) fail(`official signature evidence does not bind ${artifact.kind}`);
  }
  return true;
}

async function main() {
  const result = await checkWindowsConfiguration();
  const evidenceIndex = process.argv.indexOf('--evidence');
  if (evidenceIndex >= 0) {
    const evidencePath = process.argv[evidenceIndex + 1];
    if (!evidencePath) fail('--evidence requires a path');
    const contract = await json(join(defaultRepositoryRoot, 'packaging', 'windows', 'package-contract.json'));
    validateWindowsEvidence(await json(resolve(evidencePath)), contract, {
      official: process.argv.includes('--official'),
    });
  }
  console.log(`Validated ${result.capabilityCount} Windows extensions and ${result.artifactCount} artifact contracts.`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
