import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';

const defaultRepositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceCommitPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const semanticVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const execFileAsync = promisify(execFile);

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

function rustDeliveryExtensions(source) {
  const block = source.match(/const GOVERNED_EXTENSIONS: &\[&str\] = &\[([\s\S]*?)\];/u)?.[1];
  if (!block) fail('could not locate the native delivery extension inventory');
  return [...block.matchAll(/"([a-z0-9]+)"/gu)].map((match) => match[1]).sort();
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
  const [capabilities, contract, tauri, languageSource, deliverySource, installerHooks] = await Promise.all([
    json(join(packagingRoot, 'capabilities.json')),
    json(join(packagingRoot, 'package-contract.json')),
    json(join(repositoryRoot, 'crates', 'glitchpad-host', 'tauri.s019-windows.conf.json')),
    readFile(join(repositoryRoot, 'apps', 'glitchpad', 'src', 'domain', 'language.ts'), 'utf8'),
    readFile(join(repositoryRoot, 'crates', 'glitchpad-host', 'src', 'desktop_delivery.rs'), 'utf8'),
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
  if (!same(configured, rustDeliveryExtensions(deliverySource)))
    fail('native delivery extensions drift from capabilities.json');
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
  if (typeof contract.official.publisher_subject !== 'string' || contract.official.publisher_subject.length < 4)
    fail('official publisher subject is not governed');

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

function validateWindowsEvidenceShape(evidence, contract, official) {
  const serialized = JSON.stringify(evidence);
  if (/PRIVATE KEY|client[_-]?secret|certificate[_-]?password/iu.test(serialized))
    fail('evidence contains a secret-shaped value');
  if (evidence.schema_version !== 1 || evidence.version !== contract.candidate_version)
    fail('evidence version is invalid');
  if (evidence.platform !== 'windows' || evidence.architecture !== 'x86_64')
    fail('evidence platform identity is invalid');
  if (!sourceCommitPattern.test(evidence.source_commit)) fail('source commit is invalid');
  if (typeof evidence.workflow_identity !== 'string' || evidence.workflow_identity.length === 0)
    fail('workflow identity is invalid');
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
  if (!Array.isArray(evidence.evidence_files) || !same(evidence.evidence_files, contract.official.required_evidence))
    fail('official evidence file inventory is incomplete or unexpected');
  for (const artifact of evidence.artifacts) {
    if (
      artifact.signature_status !== contract.official.required_signature_status
      || artifact.timestamp_status !== contract.official.required_timestamp_status
      || !sha256Pattern.test(artifact.signature_sha256)
    ) fail(`official signature evidence does not bind ${artifact.kind}`);
  }
  return true;
}

export function validateWindowsEvidence(evidence, contract, { official = false } = {}) {
  if (official) fail('official mode requires live final-byte and Authenticode verification');
  return validateWindowsEvidenceShape(evidence, contract, false);
}

async function inspectAuthenticode(path) {
  if (process.platform !== 'win32') fail('official Authenticode verification requires Windows');
  const script = fileURLToPath(new URL('./windows/read-authenticode-evidence.ps1', import.meta.url));
  const { stdout } = await execFileAsync(
    'pwsh.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', script, '-Artifact', path],
    { windowsHide: true, timeout: 30_000 },
  );
  return JSON.parse(stdout);
}

export async function validateOfficialWindowsEvidence(
  evidence,
  contract,
  { artifactRoot, authenticodeInspector = inspectAuthenticode } = {},
) {
  if (!artifactRoot) fail('official mode requires the final artifact root');
  validateWindowsEvidenceShape(evidence, contract, true);
  const root = resolve(artifactRoot);
  const manifestPath = join(root, 'windows-package-manifest.json');
  const [manifestBytes, checksums, sbom, provenance, cleanReceipt] = await Promise.all([
    readFile(manifestPath),
    readFile(join(root, 'SHA256SUMS'), 'utf8'),
    json(join(root, 'glitchpad-windows.cdx.json')),
    json(join(root, 'provenance.json')),
    json(join(root, 'clean-machine-receipt.json')),
  ]);
  if (!isDeepStrictEqual(JSON.parse(manifestBytes.toString('utf8')), evidence))
    fail('manifest evidence does not match the validated document');

  const checksumEntries = checksums.trim().split(/\r?\n/u).map((line) => line.match(/^([a-f0-9]{64})  ([^/\\]+)$/u));
  if (checksumEntries.some((entry) => !entry) || checksumEntries.length !== evidence.artifacts.length)
    fail('SHA256SUMS is malformed or incomplete');
  const checksumMap = new Map(checksumEntries.map((entry) => [entry[2], entry[1]]));
  for (const artifact of evidence.artifacts)
    if (checksumMap.get(artifact.name) !== artifact.sha256) fail(`SHA256SUMS does not bind ${artifact.kind}`);

  const sbomCommit = sbom.metadata?.properties?.find(({ name }) => name === 'glitchpad:source_commit')?.value;
  const references = Array.isArray(sbom.components) ? sbom.components.map((component) => component['bom-ref']) : [];
  if (
    sbom.bomFormat !== 'CycloneDX'
    || sbom.specVersion !== '1.6'
    || sbom.metadata?.component?.name !== 'Glitchpad for Windows'
    || sbom.metadata?.component?.version !== evidence.version
    || sbomCommit !== evidence.source_commit
    || references.length === 0
    || new Set(references).size !== references.length
    || !references.some((reference) => reference.startsWith('pkg:cargo/'))
    || !references.some((reference) => reference.startsWith('pkg:npm/'))
  ) fail('CycloneDX evidence is incomplete or stale');

  const provenanceSubjects = new Map((provenance.subjects ?? []).map(({ name, sha256: digest }) => [name, digest]));
  if (
    provenance.schema_version !== 1
    || provenance.predicate_type !== 'https://slsa.dev/provenance/v1'
    || provenance.candidate_only !== false
    || provenance.repository !== 'shruggietech/glitchpad'
    || provenance.source_commit !== evidence.source_commit
    || provenance.workflow_identity !== evidence.workflow_identity
    || provenanceSubjects.size !== evidence.artifacts.length
    || evidence.artifacts.some((artifact) => provenanceSubjects.get(artifact.name) !== artifact.sha256)
  ) fail('official provenance is incomplete or stale');

  const requiredAutomated = ['install', 'launch', 'command_line', 'association', 'read', 'edit', 'save', 'metadata', 'recovery', 'uninstall', 'portable', 'cleanup', 'performance'];
  const requiredManual = ['dialog', 'drag_drop', 'save_as', 'print', 'keyboard', 'focus', 'text_scale', 'forced_colors', 'screen_reader'];
  const completed = Date.parse(cleanReceipt.completed_utc);
  const age = Date.now() - completed;
  if (
    cleanReceipt.schema_version !== 1
    || cleanReceipt.candidate_manifest_sha256 !== createHash('sha256').update(manifestBytes).digest('hex')
    || cleanReceipt.windows?.architecture !== 'x86_64'
    || ['edition', 'build', 'webview2_version'].some((key) => typeof cleanReceipt.windows?.[key] !== 'string' || cleanReceipt.windows[key].length === 0 || cleanReceipt.windows[key] === 'REQUIRED')
    || requiredAutomated.some((key) => cleanReceipt.automated?.[key] !== 'pass')
    || requiredManual.some((key) => cleanReceipt.manual?.[key] !== 'pass')
    || cleanReceipt.content_free !== true
    || !Number.isFinite(completed)
    || age < -5 * 60_000
    || age > 24 * 60 * 60_000
  ) fail('clean-machine evidence is incomplete or stale');

  const actualArtifactDigests = new Map();
  for (const artifact of evidence.artifacts) {
    const artifactPath = join(root, artifact.name);
    const bytes = await readFile(artifactPath);
    const digest = createHash('sha256').update(bytes).digest('hex');
    actualArtifactDigests.set(artifact.kind, digest);
    if (digest !== artifact.sha256 || bytes.length !== artifact.bytes)
      fail(`final bytes do not match ${artifact.kind}`);
  }
  for (const entry of evidence.portable_inventory) {
    const bytes = await readFile(join(root, 'portable', entry.relative_path));
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== entry.sha256 || bytes.length !== entry.bytes)
      fail(`portable bytes do not match ${entry.relative_path}`);
  }

  const signatureEvidence = await json(join(root, 'signature-evidence.json'));
  if (signatureEvidence.schema_version !== 1 || !Array.isArray(signatureEvidence.artifacts) || signatureEvidence.artifacts.length !== 2)
    fail('signature evidence is invalid');
  const expectedTargets = [
    {
      kind: 'nsis',
      path: join(root, evidence.artifacts.find(({ kind }) => kind === 'nsis').name),
      digest: actualArtifactDigests.get('nsis'),
    },
    {
      kind: 'portable_executable',
      path: join(root, 'portable', 'Glitchpad.exe'),
      digest: evidence.portable_inventory.find(({ relative_path }) => relative_path === 'Glitchpad.exe').sha256,
    },
  ];
  for (const target of expectedTargets) {
    const observed = await authenticodeInspector(target.path);
    if (
      observed.status !== 'Valid'
      || observed.signer_subject !== contract.official.publisher_subject
      || typeof observed.signer_thumbprint !== 'string'
      || typeof observed.timestamp_subject !== 'string'
      || typeof observed.timestamp_thumbprint !== 'string'
    ) fail(`Authenticode trust, publisher, or timestamp is invalid for ${target.kind}`);
    const recorded = signatureEvidence.artifacts.find(({ kind }) => kind === target.kind);
    if (
      !recorded
      || recorded.sha256 !== target.digest
      || recorded.status !== observed.status
      || recorded.signer_subject !== observed.signer_subject
      || recorded.signer_thumbprint !== observed.signer_thumbprint
      || recorded.timestamp_subject !== observed.timestamp_subject
      || recorded.timestamp_thumbprint !== observed.timestamp_thumbprint
    ) fail(`signature evidence does not match live verification for ${target.kind}`);
    const manifestArtifact = evidence.artifacts.find(({ kind }) =>
      target.kind === 'nsis' ? kind === 'nsis' : kind === 'portable_zip');
    if (manifestArtifact.signature_sha256 !== target.digest)
      fail(`official signature evidence does not bind ${manifestArtifact.kind}`);
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
    const evidence = await json(resolve(evidencePath));
    if (process.argv.includes('--official')) {
      const artifactRootIndex = process.argv.indexOf('--artifact-root');
      const artifactRoot = process.argv[artifactRootIndex + 1];
      await validateOfficialWindowsEvidence(evidence, contract, { artifactRoot });
    } else {
      validateWindowsEvidence(evidence, contract);
    }
  }
  console.log(`Validated ${result.capabilityCount} Windows extensions and ${result.artifactCount} artifact contracts.`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
