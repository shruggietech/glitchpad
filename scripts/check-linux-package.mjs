import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const defaultRepositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceCommitPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const semanticVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const mediaTypePattern = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u;
const secretPattern =
  /PRIVATE KEY|identity[_-]?token|signing[_-]?(?:key|password)|client[_-]?secret|authorization:\s*bearer/iu;
const automatedReceiptKeys = [
  'artifact_integrity',
  'install_or_extract',
  'desktop_registration',
  'mime_registration',
  'launch',
  'startup_delivery',
  'running_instance_delivery',
  'read',
  'edit',
  'save',
  'metadata',
  'recovery',
  'remove',
  'registration_cleanup',
  'document_preservation',
  'performance',
];
const manualReceiptKeys = [
  'dialog',
  'drag_drop',
  'save_as',
  'print',
  'keyboard',
  'focus',
  'text_scale',
  'increased_contrast',
  'reduced_motion',
  'assistive_technology',
  'markdown_webkitgtk',
  'mermaid_webkitgtk',
];
const candidateUnexercisedAutomatedKeys = new Set([
  'read', 'edit', 'save', 'metadata', 'recovery',
]);

function fail(message) {
  throw new Error(`Invalid Linux package contract: ${message}`);
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function sorted(values) {
  return [...values].sort();
}

function same(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function exactKeys(value, expected, label) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !same(Object.keys(value), expected)
  )
    fail(`${label} contains missing or undeclared fields`);
}

function compareVersions(left, right) {
  const normalize = (value) => value.split('.').map((part) => Number(part));
  const a = normalize(left);
  const b = normalize(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function uniqueExtensions(capabilities) {
  const extensions = capabilities.families.flatMap((family) => family.extensions);
  if (new Set(extensions).size !== extensions.length)
    fail('capability extensions must be globally unique');
  for (const extension of extensions)
    if (!/^[a-z0-9]+$/u.test(extension))
      fail(`invalid capability extension ${extension}`);
  return sorted(extensions);
}

function parseDesktopEntry(source) {
  const result = {};
  for (const line of source.split(/\r?\n/u)) {
    if (!line || line.startsWith('#') || line.startsWith('[')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) fail(`malformed desktop entry line ${line}`);
    const key = line.slice(0, separator);
    if (Object.hasOwn(result, key)) fail(`duplicate desktop entry key ${key}`);
    result[key] = line.slice(separator + 1);
  }
  return result;
}

function mimeMapFacts(mimeMap) {
  const mediaTypes = [];
  const extensions = [];
  const families = new Map();
  for (const family of mimeMap.families ?? []) {
    if (families.has(family.id)) fail(`duplicate MIME family ${family.id}`);
    const familyExtensions = [];
    for (const mapping of family.mappings ?? []) {
      if (!mediaTypePattern.test(mapping.media_type))
        fail(`invalid media type ${mapping.media_type}`);
      mediaTypes.push(mapping.media_type);
      for (const extension of mapping.extensions ?? []) {
        if (!/^[a-z0-9]+$/u.test(extension))
          fail(`invalid MIME extension ${extension}`);
        extensions.push(extension);
        familyExtensions.push(extension);
      }
    }
    families.set(family.id, sorted(familyExtensions));
  }
  if (new Set(mediaTypes).size !== mediaTypes.length)
    fail('MIME media types must be unique');
  if (new Set(extensions).size !== extensions.length)
    fail('MIME extensions must be globally unique');
  return { extensions: sorted(extensions), families, mediaTypes: sorted(mediaTypes) };
}

export function classifyPackageSize(bytes, budget) {
  if (!Number.isSafeInteger(bytes) || bytes < 1)
    fail('artifact byte length must be positive');
  if (bytes <= budget.target_bytes) return 'pass';
  if (bytes <= budget.hard_limit_bytes) return 'warning';
  return 'failure';
}

export function validateBuildBaseline(baseline, contract) {
  const expected = contract.build_baseline;
  if (
    baseline?.distribution !== expected.distribution ||
    baseline?.release !== expected.release ||
    baseline?.architecture !== expected.architecture ||
    baseline?.container_target !== expected.container_target
  )
    fail('build baseline must be Ubuntu 22.04 x86_64 linux-package');
  if (baseline.webkitgtk_api !== expected.webkitgtk_api)
    fail('build baseline must use WebKitGTK 4.1');
  if (
    compareVersions(baseline.glibc_version, expected.maximum_glibc_version) > 0 ||
    compareVersions(
      baseline.maximum_imported_glibc,
      expected.maximum_glibc_version,
    ) > 0
  )
    fail(`final executable imports newer than GLIBC_${expected.maximum_glibc_version}`);
  return true;
}

export function validateLinuxEvidence(
  evidence,
  contract,
  { official = false, attestation } = {},
) {
  if (
    evidence?.schema_version !== 1 ||
    evidence.version !== contract.candidate_version ||
    evidence.platform !== 'linux' ||
    evidence.architecture !== 'x86_64' ||
    !sourceCommitPattern.test(evidence.source_commit ?? '') ||
    typeof evidence.workflow_identity !== 'string' ||
    !evidence.workflow_identity.includes('.github/workflows/linux-package.yml@')
  )
    fail('candidate identity is invalid');
  validateBuildBaseline(evidence.build_baseline, contract);
  if (
    !Array.isArray(evidence.artifacts) ||
    evidence.artifacts.length !== contract.artifacts.length ||
    !contract.artifacts.every((expected) =>
      evidence.artifacts.some(
        (actual) => actual.kind === expected.kind && actual.name === expected.name,
      ),
    )
  )
    fail('artifact pair is incomplete or noncanonical');
  for (const artifact of evidence.artifacts) {
    if (
      !sha256Pattern.test(artifact.sha256 ?? '') ||
      !sha256Pattern.test(artifact.inventory_sha256 ?? '') ||
      classifyPackageSize(artifact.bytes, contract.size_budget) !==
        artifact.size_classification ||
      artifact.size_classification === 'failure'
    )
      fail(`artifact evidence is invalid for ${artifact.name}`);
  }
  if (!same(evidence.desktop_entry?.mime_types ?? [], contract.desktop_entry.mime_types))
    fail('manifest desktop MIME types drift from contract');
  if (!official) {
    if (
      evidence.official !== false ||
      evidence.gate_status !== 'candidate_valid' ||
      evidence.repository_attestation_status !==
        contract.candidate_trust.repository_attestation_status
    )
      fail('candidate attestation and publication limitations are not explicit');
    return true;
  }
  if (
    !attestation ||
    attestation.status !== contract.official.required_attestation_status ||
    attestation.repository !== contract.official.repository ||
    attestation.source_commit !== evidence.source_commit ||
    attestation.version !== evidence.version ||
    !same(
      attestation.artifacts?.map(({ name, sha256 }) => `${name}:${sha256}`) ?? [],
      evidence.artifacts.map(({ name, sha256 }) => `${name}:${sha256}`),
    )
  )
    fail('official mode requires live repository attestation for both final artifacts');
  return true;
}

function validateFreshTimestamp(value, maximumAgeSeconds) {
  const completed = Date.parse(value);
  const age = Date.now() - completed;
  return Number.isFinite(completed) && age >= -300_000 && age <= maximumAgeSeconds * 1000;
}

export function validateCleanEnvironmentReceipt(
  receipt,
  manifestBytes,
  contract,
  { official = false } = {},
) {
  exactKeys(
    receipt,
    [
      'schema_version',
      'candidate_manifest_sha256',
      'evidence_authority',
      'linux',
      'automated',
      'manual',
      'performance',
      'content_free',
      'completed_utc',
    ],
    'receipt',
  );
  exactKeys(
    receipt.evidence_authority,
    ['kind', 'workflow_identity', 'source_commit', 'native_test_suites'],
    'receipt evidence authority',
  );
  exactKeys(
    receipt.linux,
    [
      'distribution',
      'release',
      'architecture',
      'package_form',
      'product_version',
      'webkitgtk_version',
    ],
    'receipt Linux identity',
  );
  exactKeys(receipt.automated, automatedReceiptKeys, 'receipt automated results');
  exactKeys(receipt.manual, manualReceiptKeys, 'receipt manual results');
  exactKeys(
    receipt.performance,
    [
      'startup_evidence_class',
      'startup_samples_ms',
      'startup_p95_ms',
      'startup_classification',
      'artifact_size_classification',
    ],
    'receipt performance results',
  );
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const manifestDigest = createHash('sha256').update(manifestBytes).digest('hex');
  if (
    receipt.schema_version !== 1 ||
    receipt.candidate_manifest_sha256 !== manifestDigest ||
    receipt.content_free !== true ||
    receipt.evidence_authority.kind !== 'github_actions_workflow' ||
    receipt.evidence_authority.workflow_identity !== manifest.workflow_identity ||
    receipt.evidence_authority.source_commit !== manifest.source_commit ||
    receipt.linux.distribution !== 'ubuntu' ||
    !['22.04', '24.04'].includes(receipt.linux.release) ||
    receipt.linux.architecture !== 'x86_64' ||
    !['appimage', 'deb'].includes(receipt.linux.package_form) ||
    receipt.linux.product_version !== contract.candidate_version ||
    typeof receipt.linux.webkitgtk_version !== 'string' ||
    receipt.linux.webkitgtk_version.length === 0 ||
    !validateFreshTimestamp(
      receipt.completed_utc,
      contract.official.maximum_evidence_age_seconds,
    )
  )
    fail('clean-environment receipt identity or freshness is invalid');
  const serialized = JSON.stringify(receipt);
  if (secretPattern.test(serialized)) fail('receipt contains prohibited secret material');
  if (
    !Array.isArray(receipt.performance.startup_samples_ms) ||
    receipt.performance.startup_samples_ms.length < 5 ||
    !receipt.performance.startup_samples_ms.every(
      (sample) => Number.isSafeInteger(sample) && sample > 0,
    ) ||
    !['pass', 'warning', 'failure'].includes(
      receipt.performance.startup_classification,
    ) ||
    receipt.performance.startup_p95_ms >
      contract.performance.hosted_smoke_startup_hard_limit_ms
  )
    fail('startup evidence is invalid or exceeds hosted-smoke hard limit');
  if (official && receipt.performance.startup_evidence_class !== 'reference')
    fail('official receipt requires reference startup evidence');
  if (!official && receipt.performance.startup_evidence_class !== 'hosted_smoke')
    fail('candidate receipt requires hosted_smoke startup evidence');
  for (const [key, value] of Object.entries(receipt.automated)) {
    const expected = official
      ? 'pass'
      : key === 'performance'
        ? 'measured_hosted_smoke'
        : candidateUnexercisedAutomatedKeys.has(key)
          ? 'not_run_candidate'
          : 'pass';
    if (value !== expected)
      fail(`automated receipt result ${key} is not valid for its evidence class`);
  }
  for (const value of Object.values(receipt.manual))
    if (value !== (official ? 'pass' : 'not_run_candidate'))
      fail('manual receipt results do not match candidate authority');
  return true;
}

export async function checkLinuxConfiguration(
  repositoryRoot = defaultRepositoryRoot,
) {
  const packagingRoot = join(repositoryRoot, 'packaging', 'linux');
  const [
    capabilities,
    contract,
    mimeMap,
    tauri,
    desktopSource,
    mimeSource,
    dockerSource,
    packageWorkflow,
    releaseWorkflow,
    deliverySource,
    lifecycleSource,
  ] = await Promise.all([
    json(join(repositoryRoot, 'packaging', 'desktop', 'capabilities.json')),
    json(join(packagingRoot, 'package-contract.json')),
    json(join(packagingRoot, 'mime-map.json')),
    json(join(repositoryRoot, 'crates', 'glitchpad-host', 'tauri.s021-linux.conf.json')),
    readFile(join(repositoryRoot, 'crates', 'glitchpad-host', 'linux', 'glitchpad.desktop.hbs'), 'utf8'),
    readFile(join(packagingRoot, 'glitchpad.xml'), 'utf8'),
    readFile(join(repositoryRoot, 'scripts', 'docker', 'validation.Dockerfile'), 'utf8'),
    readFile(join(repositoryRoot, '.github', 'workflows', 'linux-package.yml'), 'utf8'),
    readFile(join(repositoryRoot, '.github', 'workflows', 'release.yml'), 'utf8'),
    readFile(join(repositoryRoot, 'crates', 'glitchpad-host', 'src', 'desktop_delivery.rs'), 'utf8'),
    readFile(join(repositoryRoot, 'scripts', 'linux', 'test-package-lifecycle.mjs'), 'utf8'),
  ]);
  if (capabilities.schema_version !== 1 || capabilities.release !== '0.1.0')
    fail('capability inventory version is not v0.1.0 schema 1');
  const capabilityExtensions = uniqueExtensions(capabilities);
  const mimeFacts = mimeMapFacts(mimeMap);
  const packageOwnedTypes = sorted(mimeMap.package_owned_types ?? []);
  if (
    packageOwnedTypes.length === 0 ||
    new Set(packageOwnedTypes).size !== packageOwnedTypes.length ||
    packageOwnedTypes.some((type) => !mimeFacts.mediaTypes.includes(type))
  )
    fail('package-owned MIME types are invalid');
  const packageOwnedExtensions = sorted(mimeMap.families.flatMap((family) =>
    family.mappings
      .filter((mapping) => packageOwnedTypes.includes(mapping.media_type))
      .flatMap((mapping) => mapping.extensions),
  ));
  if (!same(capabilityExtensions, mimeFacts.extensions))
    fail('Linux MIME extensions drift from shared stable capabilities');
  for (const family of capabilities.families) {
    if (!same(family.extensions, mimeFacts.families.get(family.id) ?? []))
      fail(`Linux MIME family ${family.id} drifts from shared capabilities`);
  }
  const forbidden = new Set(capabilities.forbidden_extensions);
  for (const extension of mimeFacts.extensions)
    if (forbidden.has(extension)) fail(`forbidden extension ${extension} is associated`);
  if (
    contract.schema_version !== 1 ||
    contract.platform !== 'linux' ||
    contract.architecture !== 'x86_64' ||
    !semanticVersionPattern.test(contract.candidate_version) ||
    contract.candidate_version === '0.0.0' ||
    contract.artifacts?.length !== 2
  )
    fail('Linux candidate identity is invalid');
  if (
    contract.size_budget.target_bytes !== 35 * 1024 * 1024 ||
    contract.size_budget.hard_limit_bytes !== 60 * 1024 * 1024 ||
    contract.performance.hosted_smoke_startup_hard_limit_ms !== 10_000
  )
    fail('S018 Linux package or hosted-smoke limits drifted');
  if (!same(contract.desktop_entry.mime_types, mimeFacts.mediaTypes))
    fail('desktop contract MIME types drift from Linux MIME map');
  const desktop = parseDesktopEntry(desktopSource);
  if (
    desktop.Type !== 'Application' ||
    desktop.Terminal !== 'false' ||
    desktop.Exec !== '{{exec}} %F' ||
    desktop.Icon !== '{{icon}}' ||
    !same(
      desktop.MimeType.split(';').filter(Boolean),
      contract.desktop_entry.mime_types,
    ) ||
    /\$\(|`|\||&&|;\s*\//u.test(desktop.Exec) ||
    /^(?:Patterns|DefaultApp)=/mu.test(desktopSource)
  )
    fail('desktop entry is unsafe or drifts from contract');
  const xmlGlobs = [...mimeSource.matchAll(/<glob pattern="\*\.([a-z0-9]+)"[^>]*\/>/gu)].map(
    (match) => match[1],
  );
  const xmlTypes = [...mimeSource.matchAll(/<mime-type type="([^"]+)"/gu)].map(
    (match) => match[1],
  );
  if (!same(xmlGlobs, packageOwnedExtensions) || !same(xmlTypes, packageOwnedTypes))
    fail('shared MIME XML must define only package-owned mappings');
  const associations = tauri.bundle?.fileAssociations ?? [];
  if (
    tauri.version !== contract.candidate_version ||
    tauri.bundle?.active !== true ||
    !same(tauri.bundle.targets ?? [], ['appimage', 'deb']) ||
    tauri.bundle?.linux?.appimage?.bundleMediaFramework !== false ||
    !same(associations.flatMap(({ ext }) => ext), capabilityExtensions) ||
    !same(associations.map(({ mimeType }) => mimeType), mimeFacts.mediaTypes)
  )
    fail('Tauri Linux package overlay drifts from governed contract');
  for (const required of [
    'FROM ubuntu:22.04 AS linux-package',
    'libwebkit2gtk-4.1-dev',
    'shared-mime-info',
    'desktop-file-utils',
    'CreateNoWindow',
  ])
    if (!dockerSource.includes(required) && required !== 'CreateNoWindow')
      fail(`Linux package environment is missing ${required}`);
  for (const required of [
    "branches:\n      - '**'",
    'glitchpad-linux-package:local',
    "release: '22.04'",
    "release: '24.04'",
    'non-official',
  ])
    if (!packageWorkflow.includes(required))
      fail(`Linux package workflow is missing ${required}`);
  if (
    !releaseWorkflow.includes('linux-authority') ||
    !releaseWorkflow.includes('LINUX_REQUIRED_EVIDENCE') ||
    !releaseWorkflow.includes('attestations: write')
  )
    fail('release workflow omits Linux authority preflight');
  for (const evidenceName of contract.official.required_evidence)
    if (!releaseWorkflow.includes(evidenceName))
      fail(`release workflow omits required Linux evidence ${evidenceName}`);
  if (
    !deliverySource.includes('enqueue_arguments') ||
    !deliverySource.includes('GOVERNED_EXTENSIONS') ||
    !lifecycleSource.includes('GLITCHPAD_LIFECYCLE_PROBE_DIR') ||
    !lifecycleSource.includes('running_instance_delivery')
  )
    fail('Linux delivery lifecycle omits established native boundaries');
  return {
    artifactCount: contract.artifacts.length,
    capabilityCount: capabilityExtensions.length,
    mimeTypeCount: mimeFacts.mediaTypes.length,
  };
}

async function validateArtifactFiles(evidence, contract, artifactRoot) {
  for (const artifact of evidence.artifacts) {
    const path = join(artifactRoot, artifact.name);
    const bytes = await readFile(path);
    const metadata = await stat(path);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (metadata.size !== artifact.bytes || digest !== artifact.sha256)
      fail(`final artifact bytes drifted for ${artifact.name}`);
    if (classifyPackageSize(metadata.size, contract.size_budget) === 'failure')
      fail(`final artifact exceeds hard size limit: ${artifact.name}`);
  }
}

function validateSbom(sbom, evidence) {
  const sbomCommit = sbom.metadata?.properties?.find(
    ({ name }) => name === 'glitchpad:source_commit',
  )?.value;
  const references = Array.isArray(sbom.components)
    ? sbom.components.map((component) => component['bom-ref'])
    : [];
  if (
    sbom.bomFormat !== 'CycloneDX' ||
    sbom.specVersion !== '1.6' ||
    sbom.metadata?.component?.name !== 'Glitchpad for Linux' ||
    sbom.metadata?.component?.version !== evidence.version ||
    sbomCommit !== evidence.source_commit ||
    !references.some((reference) => reference.startsWith('pkg:cargo/')) ||
    !references.some((reference) => reference.startsWith('pkg:npm/'))
  )
    fail('CycloneDX evidence is incomplete or stale');
}

function validateProvenance(provenance, evidence, contract) {
  const subjects = evidence.artifacts.map(({ name, sha256 }) => ({ name, sha256 }));
  if (
    provenance.schema_version !== 1 ||
    provenance.predicate_type !== 'https://slsa.dev/provenance/v1' ||
    provenance.candidate_only !== true ||
    provenance.repository !== contract.official.repository ||
    provenance.source_commit !== evidence.source_commit ||
    provenance.workflow_identity !== evidence.workflow_identity ||
    !isDeepStrictEqual(provenance.build_baseline, evidence.build_baseline) ||
    !isDeepStrictEqual(provenance.subjects, subjects)
  )
    fail('provenance is incomplete or stale');
}

export async function validateOfficialLinuxArtifactSet(
  evidence,
  contract,
  { artifactRoot, attestation } = {},
) {
  if (!artifactRoot) fail('official mode requires the final artifact root');
  validateLinuxEvidence(evidence, contract, { official: true, attestation });
  const root = resolve(artifactRoot);
  const evidenceBytes = new Map();
  for (const name of contract.official.required_evidence ?? []) {
    if (name !== name.split('/').at(-1) || name !== name.split('\\').at(-1))
      fail(`required official evidence name is unsafe: ${name}`);
    try {
      const [bytes, metadata] = await Promise.all([
        readFile(join(root, name)),
        stat(join(root, name)),
      ]);
      if (!metadata.isFile()) throw new Error('not_a_file');
      evidenceBytes.set(name, bytes);
    } catch {
      fail(`required official evidence is missing or unreadable: ${name}`);
    }
  }
  const manifestBytes = evidenceBytes.get('linux-package-manifest.json');
  if (
    !manifestBytes ||
    !isDeepStrictEqual(JSON.parse(manifestBytes.toString('utf8')), evidence)
  )
    fail('manifest evidence does not match the validated document');
  const expectedChecksums = `${evidence.artifacts
    .map(({ name, sha256 }) => `${sha256}  ${name}`)
    .join('\n')}\n`;
  if (evidenceBytes.get('SHA256SUMS')?.toString('utf8') !== expectedChecksums)
    fail('SHA256SUMS does not bind the final Linux artifact pair');
  const baseline = JSON.parse(evidenceBytes.get('build-baseline.json').toString('utf8'));
  if (!isDeepStrictEqual(baseline, evidence.build_baseline))
    fail('build baseline evidence is incomplete or stale');
  validateSbom(
    JSON.parse(evidenceBytes.get('glitchpad-linux.cdx.json').toString('utf8')),
    evidence,
  );
  validateProvenance(
    JSON.parse(evidenceBytes.get('provenance.json').toString('utf8')),
    evidence,
    contract,
  );
  const recordedAttestation = JSON.parse(
    evidenceBytes.get('repository-attestation.json').toString('utf8'),
  );
  if (!isDeepStrictEqual(recordedAttestation, attestation))
    fail('repository attestation file does not match live verification');
  for (const name of contract.official.required_evidence.filter((value) =>
    /^clean-ubuntu-(?:22\.04|24\.04)-(?:appimage|deb)\.json$/u.test(value),
  )) {
    validateCleanEnvironmentReceipt(
      JSON.parse(evidenceBytes.get(name).toString('utf8')),
      manifestBytes,
      contract,
      { official: true },
    );
  }
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const take = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const repositoryRoot = resolve(take('--repository-root') ?? defaultRepositoryRoot);
  const result = await checkLinuxConfiguration(repositoryRoot);
  const evidencePath = take('--evidence');
  if (evidencePath) {
    const contract = await json(join(repositoryRoot, 'packaging', 'linux', 'package-contract.json'));
    const evidence = await json(resolve(evidencePath));
    const official = args.includes('--official');
    const attestationPath = take('--attestation');
    const attestation = attestationPath ? await json(resolve(attestationPath)) : undefined;
    const artifactRoot = resolve(
      take('--artifact-root') ?? new URL('.', `file://${resolve(evidencePath)}`).pathname,
    );
    validateLinuxEvidence(evidence, contract, { official, attestation });
    await validateArtifactFiles(
      evidence,
      contract,
      artifactRoot,
    );
    if (official)
      await validateOfficialLinuxArtifactSet(evidence, contract, {
        artifactRoot,
        attestation,
      });
  }
  console.log(
    `Linux package contract valid (${result.artifactCount} artifacts, ${result.capabilityCount} extensions, ${result.mimeTypeCount} media types).`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
