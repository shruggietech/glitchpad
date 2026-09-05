import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual, promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectApplicationInventory,
  digestApplicationInventory,
} from './lib/macos-artifact.mjs';

const defaultRepositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const execFileAsync = promisify(execFile);
const sha256Pattern = /^[a-f0-9]{64}$/u;
const sourceCommitPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const semanticVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const secretPattern =
  /PRIVATE KEY|apple[_-]?(?:api[_-]?key|certificate|password|team[_-]?id|id)|keychain[_-]?password|client[_-]?secret/iu;
const automatedReceiptKeys = [
  'mount',
  'applications_link',
  'copy',
  'launch',
  'finder_delivery',
  'running_instance_delivery',
  'read',
  'edit',
  'save',
  'metadata',
  'recovery',
  'remove',
  'cleanup',
  'universal_architecture',
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
  'voiceover',
  'markdown_wkwebview',
  'mermaid_wkwebview',
];

function fail(message) {
  throw new Error(`Invalid macOS package contract: ${message}`);
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function same(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
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
  const block = source.match(
    /const extensions = new Map<string, LanguageId>\(\[([\s\S]*?)\]\);/u,
  )?.[1];
  if (!block) fail('could not locate the editor extension inventory');
  return [...block.matchAll(/\['([^']+)',\s*'[^']+'\]/gu)]
    .map((match) => match[1])
    .sort();
}

function rustDeliveryExtensions(source) {
  const block = source.match(
    /const GOVERNED_EXTENSIONS: &\[&str\] = &\[([\s\S]*?)\];/u,
  )?.[1];
  if (!block) fail('could not locate the native delivery extension inventory');
  return [...block.matchAll(/"([a-z0-9]+)"/gu)].map((match) => match[1]).sort();
}

export function classifyPackageSize(bytes, budget) {
  if (!Number.isSafeInteger(bytes) || bytes < 1)
    fail('artifact byte length must be positive');
  if (bytes <= budget.target_bytes) return 'pass';
  if (bytes <= budget.hard_limit_bytes) return 'warning';
  return 'failure';
}

function validateRelativeInventoryPath(path) {
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    path.includes('\\') ||
    path.startsWith('/') ||
    /^[a-z]:/iu.test(path) ||
    path.includes(':') ||
    path.split('/').some((segment) => segment === '..' || segment === '')
  )
    fail(`unsafe application inventory path ${String(path)}`);
}

function validateFreshTimestamp(value, maximumAgeSeconds) {
  const completed = Date.parse(value);
  const age = Date.now() - completed;
  return (
    Number.isFinite(completed) &&
    age >= -300_000 &&
    age <= maximumAgeSeconds * 1000
  );
}

export async function checkMacosConfiguration(
  repositoryRoot = defaultRepositoryRoot,
) {
  const packagingRoot = join(repositoryRoot, 'packaging', 'macos');
  const [
    capabilities,
    contract,
    tauri,
    languageSource,
    deliverySource,
    hostSource,
    lifecycleScript,
    releaseWorkflow,
    packageWorkflow,
  ] = await Promise.all([
    json(join(repositoryRoot, 'packaging', 'desktop', 'capabilities.json')),
    json(join(packagingRoot, 'package-contract.json')),
    json(
      join(
        repositoryRoot,
        'crates',
        'glitchpad-host',
        'tauri.s020-macos.conf.json',
      ),
    ),
    readFile(
      join(repositoryRoot, 'apps', 'glitchpad', 'src', 'domain', 'language.ts'),
      'utf8',
    ),
    readFile(
      join(
        repositoryRoot,
        'crates',
        'glitchpad-host',
        'src',
        'desktop_delivery.rs',
      ),
      'utf8',
    ),
    readFile(
      join(repositoryRoot, 'crates', 'glitchpad-host', 'src', 'lib.rs'),
      'utf8',
    ),
    readFile(
      join(repositoryRoot, 'scripts', 'macos', 'test-package-lifecycle.mjs'),
      'utf8',
    ),
    readFile(
      join(repositoryRoot, '.github', 'workflows', 'release.yml'),
      'utf8',
    ),
    readFile(
      join(repositoryRoot, '.github', 'workflows', 'macos-package.yml'),
      'utf8',
    ),
  ]);

  if (capabilities.schema_version !== 1 || capabilities.release !== '0.1.0')
    fail('capability inventory version is not v0.1.0 schema 1');
  const configured = uniqueExtensions(capabilities.families);
  if (!same(contract.document_extensions ?? [], configured))
    fail(
      'package contract document declarations drift from shared capabilities',
    );
  for (const extension of ['md', 'markdown', 'mmd', 'mermaid', 'txt'])
    if (!configured.includes(extension))
      fail(`missing stable extension ${extension}`);
  const sourceFamily = capabilities.families.find(({ id }) => id === 'source');
  if (
    !sourceFamily ||
    !same(sourceFamily.extensions, sourceExtensions(languageSource))
  )
    fail(
      'source associations drift from the stable editor extension inventory',
    );
  if (!same(configured, rustDeliveryExtensions(deliverySource)))
    fail(
      'native delivery extensions drift from the shared capability inventory',
    );
  if (
    !deliverySource.includes('enqueue_file_urls') ||
    !deliverySource.includes('to_file_path')
  )
    fail('native delivery omits safe macOS file URL conversion');
  if (
    !hostSource.includes('tauri::RunEvent::Opened') ||
    !hostSource.includes('enqueue_opened_urls') ||
    !hostSource.includes('record_desktop_lifecycle_probe')
  )
    fail('native host omits macOS open-event delivery');
  const forbidden = new Set(capabilities.forbidden_extensions);
  for (const extension of configured)
    if (forbidden.has(extension))
      fail(`forbidden extension ${extension} is associated`);

  if (
    contract.schema_version !== 1 ||
    contract.platform !== 'macos' ||
    contract.architecture !== 'universal' ||
    !semanticVersionPattern.test(contract.candidate_version) ||
    contract.candidate_version === '0.0.0' ||
    contract.artifact?.name !==
      `glitchpad-${contract.candidate_version}-macos-universal.dmg`
  )
    fail('candidate identity is invalid');
  if (
    contract.size_budget.target_bytes !== 35 * 1024 * 1024 ||
    contract.size_budget.hard_limit_bytes !== 60 * 1024 * 1024
  )
    fail('S018 desktop package limits drifted');
  if (
    contract.candidate_trust.application_signature_status !== 'ad_hoc' ||
    contract.candidate_trust.dmg_signature_status !== 'not_signed_candidate' ||
    contract.candidate_trust.notarization_status !==
      'not_submitted_candidate' ||
    contract.candidate_trust.staple_status !== 'not_applicable_candidate'
  )
    fail('candidate Apple trust limitations are not explicit');

  if (
    tauri.version !== contract.candidate_version ||
    tauri.bundle?.active !== true ||
    !same(tauri.bundle.targets, ['app', 'dmg']) ||
    !tauri.bundle.icon?.includes('icons/icon.icns') ||
    tauri.bundle.macOS?.minimumSystemVersion !==
      contract.bundle.minimum_system_version ||
    tauri.bundle.macOS?.signingIdentity !== '-'
  )
    fail('Tauri overlay is not the governed universal macOS configuration');
  const associated = tauri.bundle.fileAssociations
    .flatMap(({ ext }) => ext)
    .sort();
  if (!same(associated, configured))
    fail('Tauri document declarations drift from shared capabilities');
  if (tauri.bundle.fileAssociations.some(({ role }) => role !== 'Editor'))
    fail('macOS document declarations must use the Editor role');
  for (const required of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.txt']) {
    if (!Object.values(tauri.bundle.resources ?? {}).includes(required))
      fail(`Tauri bundle omits ${required}`);
  }

  for (const marker of [
    'macos-15',
    'macos-15-intel',
    'universal-apple-darwin',
    'check-macos-package.mjs',
    '--artifact-root',
    '--runner-image',
    'non-notarized-candidate',
    'desktop_source_conformance',
    'desktop_delivery_conformance',
    'recovery_conformance',
    'editor-conformance.test.ts',
    'metadata-gateway.test.ts',
  ])
    if (!packageWorkflow.includes(marker))
      fail(`macOS package workflow omits ${marker}`);
  if (!/branches:\r?\n\s+- '\*\*'/u.test(packageWorkflow))
    fail('macOS package workflow does not cover every branch push');
  for (const marker of [
    'waitForLifecycleReadiness',
    'waitForShellReadiness',
    'waitForSingleNewDelivery',
    'lifecycleProbeEnvironment(',
    'initialLaunchArguments(',
    'const child = spawn(',
    "'--env'",
    "command('open'",
  ])
    if (!lifecycleScript.includes(marker))
      fail(`macOS lifecycle omits interactive acknowledgement ${marker}`);
  if (
    /(?:softprops\/action-gh-release|actions\/upload-release-asset|\bgh\s+release\b|contents:\s*write)/iu.test(
      packageWorkflow,
    )
  )
    fail('branch and pull-request package workflow must not publish');
  if (
    /^ {6}APPLE_API_KEY_PATH:\s*\$\{\{\s*runner\.temp\s*\}\}/mu.test(
      releaseWorkflow,
    )
  )
    fail('release workflow uses the step-only runner context at job scope');
  for (const marker of [
    'APPLE_CERTIFICATE',
    'APPLE_CERTIFICATE_PASSWORD',
    'APPLE_SIGNING_IDENTITY',
    'APPLE_API_ISSUER',
    'APPLE_API_KEY',
    'APPLE_API_KEY_PATH',
  ])
    if (!releaseWorkflow.includes(marker))
      fail(`release workflow omits ${marker}`);
  for (const evidence of contract.official.required_evidence)
    if (!releaseWorkflow.includes(evidence))
      fail(`release workflow omits required macOS evidence ${evidence}`);

  return { capabilityCount: configured.length, artifactCount: 1 };
}

function validateMacosEvidenceShape(evidence, contract, official) {
  if (secretPattern.test(JSON.stringify(evidence)))
    fail('evidence contains a secret-shaped value');
  exactKeys(
    evidence,
    [
      'schema_version',
      'version',
      'platform',
      'architecture',
      'source_commit',
      'workflow_identity',
      'official',
      'gate_status',
      'artifact',
      'application',
      'application_inventory',
      'document_extensions',
      ...(official ? ['event', 'tag', 'evidence_files'] : []),
    ],
    'package evidence',
  );
  if (
    evidence.schema_version !== 1 ||
    evidence.version !== contract.candidate_version ||
    evidence.platform !== 'macos' ||
    evidence.architecture !== 'universal'
  )
    fail('evidence identity is invalid');
  if (!sourceCommitPattern.test(evidence.source_commit))
    fail('source commit is invalid');
  if (
    typeof evidence.workflow_identity !== 'string' ||
    evidence.workflow_identity.length === 0
  )
    fail('workflow identity is invalid');
  const artifact = evidence.artifact;
  exactKeys(
    artifact,
    [
      'kind',
      'name',
      'bytes',
      'sha256',
      'size_classification',
      'signature_status',
      'notarization_status',
      'staple_status',
    ],
    'DMG evidence',
  );
  if (
    artifact?.kind !== contract.artifact.kind ||
    artifact?.name !== contract.artifact.name
  )
    fail('DMG identity is invalid');
  if (!sha256Pattern.test(artifact.sha256)) fail('DMG digest is invalid');
  const sizeClassification = classifyPackageSize(
    artifact.bytes,
    contract.size_budget,
  );
  if (
    sizeClassification !== artifact.size_classification ||
    sizeClassification === 'failure'
  )
    fail('invalid DMG size result');

  const application = evidence.application;
  exactKeys(
    application,
    [
      'bundle_name',
      'identifier',
      'version',
      'minimum_system_version',
      'executable_path',
      'executable_sha256',
      'bundle_sha256',
      'architectures',
      'signature_status',
      'hardened_runtime_status',
      'timestamp_status',
    ],
    'application evidence',
  );
  if (
    application?.bundle_name !== contract.bundle.name ||
    application?.identifier !== contract.bundle.identifier ||
    application?.version !== contract.candidate_version ||
    application?.minimum_system_version !==
      contract.bundle.minimum_system_version ||
    application?.executable_path !== contract.bundle.executable ||
    !sha256Pattern.test(application?.executable_sha256 ?? '') ||
    !sha256Pattern.test(application?.bundle_sha256 ?? '')
  )
    fail('application identity is invalid');
  if (
    !same(
      application.architectures ?? [],
      contract.bundle.required_architectures,
    )
  )
    fail('application architecture set is invalid');

  if (!Array.isArray(evidence.application_inventory))
    fail('application inventory is missing');
  const seen = new Set();
  const names = new Set();
  let previousPath = '';
  for (const entry of evidence.application_inventory) {
    validateRelativeInventoryPath(entry.relative_path);
    const folded = entry.relative_path.toLowerCase();
    if (seen.has(folded))
      fail(`case-colliding application inventory path ${entry.relative_path}`);
    if (previousPath && entry.relative_path.localeCompare(previousPath) <= 0)
      fail('application inventory is not deterministically ordered');
    previousPath = entry.relative_path;
    seen.add(folded);
    names.add(entry.relative_path);
    if (!['file', 'symlink'].includes(entry.kind))
      fail(`invalid inventory kind for ${entry.relative_path}`);
    if (entry.kind === 'file') {
      exactKeys(
        entry,
        ['relative_path', 'kind', 'role', 'bytes', 'sha256', 'executable'],
        `application inventory entry ${entry.relative_path}`,
      );
      if (entry.role !== (entry.executable ? 'executable' : 'resource'))
        fail(`invalid inventory role for ${entry.relative_path}`);
      if (
        !sha256Pattern.test(entry.sha256) ||
        !Number.isSafeInteger(entry.bytes) ||
        entry.bytes < 1
      )
        fail(`invalid inventory facts for ${entry.relative_path}`);
      if (
        entry.executable === true &&
        entry.relative_path !== contract.bundle.executable
      )
        fail(`unexpected executable ${entry.relative_path}`);
    } else {
      exactKeys(
        entry,
        ['relative_path', 'kind', 'role', 'link_target'],
        `application inventory entry ${entry.relative_path}`,
      );
      if (
        entry.role !== 'link' ||
        typeof entry.link_target !== 'string' ||
        entry.link_target.length === 0 ||
        entry.link_target.startsWith('/') ||
        entry.link_target.split('/').includes('..')
      )
        fail(`unsafe application symlink ${entry.relative_path}`);
    }
  }
  for (const required of contract.bundle.required_files)
    if (!names.has(required)) fail(`application inventory omits ${required}`);
  if (
    application.bundle_sha256 !==
    digestApplicationInventory(evidence.application_inventory)
  )
    fail('application inventory digest is invalid');

  const capabilitySet = evidence.document_extensions;
  if (
    !Array.isArray(capabilitySet) ||
    new Set(capabilitySet).size !== capabilitySet.length ||
    !same(capabilitySet, contract.document_extensions ?? [])
  )
    fail('document declarations drift from shared capabilities');

  if (!official) {
    const candidate = contract.candidate_trust;
    if (
      evidence.official !== false ||
      evidence.gate_status !== 'candidate_valid' ||
      artifact.signature_status !== candidate.dmg_signature_status ||
      artifact.notarization_status !== candidate.notarization_status ||
      artifact.staple_status !== candidate.staple_status ||
      application.signature_status !== candidate.application_signature_status ||
      application.hardened_runtime_status !== 'not_applicable_candidate' ||
      application.timestamp_status !== 'not_applicable_candidate'
    )
      fail('candidate trust state is invalid');
    return true;
  }

  if (
    evidence.official !== true ||
    evidence.gate_status !== 'official_valid' ||
    evidence.event !== contract.official.authorized_event ||
    evidence.tag !== contract.official.tag_pattern ||
    !same(evidence.evidence_files ?? [], contract.official.required_evidence)
  )
    fail('official evidence is unauthorized or incomplete');
  if (
    artifact.signature_status !== contract.official.required_signature_status ||
    artifact.notarization_status !==
      contract.official.required_notarization_status ||
    artifact.staple_status !== contract.official.required_staple_status ||
    application.signature_status !==
      contract.official.required_signature_status ||
    application.hardened_runtime_status !==
      contract.official.required_hardened_runtime_status ||
    application.timestamp_status !== contract.official.required_timestamp_status
  )
    fail('official Apple trust state is incomplete');
  return true;
}

export function validateMacosEvidence(
  evidence,
  contract,
  { official = false } = {},
) {
  if (official) fail('official mode requires live Apple trust verification');
  return validateMacosEvidenceShape(evidence, contract, false);
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
    sbom.metadata?.component?.name !== 'Glitchpad for macOS' ||
    sbom.metadata?.component?.version !== evidence.version ||
    sbomCommit !== evidence.source_commit ||
    !references.some((reference) => reference.startsWith('pkg:cargo/')) ||
    !references.some((reference) => reference.startsWith('pkg:npm/'))
  )
    fail('CycloneDX evidence is incomplete or stale');
}

function validateProvenance(provenance, evidence, { candidateOnly }) {
  const expectedSubjects = [
    { name: evidence.artifact.name, sha256: evidence.artifact.sha256 },
    {
      name: `application/${evidence.application.bundle_name}`,
      sha256: evidence.application.bundle_sha256,
    },
  ];
  if (
    provenance.schema_version !== 1 ||
    provenance.predicate_type !== 'https://slsa.dev/provenance/v1' ||
    provenance.candidate_only !== candidateOnly ||
    provenance.repository !== 'shruggietech/glitchpad' ||
    provenance.source_commit !== evidence.source_commit ||
    provenance.workflow_identity !== evidence.workflow_identity ||
    !isDeepStrictEqual(provenance.subjects, expectedSubjects)
  )
    fail('provenance is incomplete or stale');
  if (
    candidateOnly &&
    (provenance.runner_image !== 'macos-15' ||
      !isDeepStrictEqual(provenance.tool_versions, {
        rust: '1.96.0',
        node: '24.11.0',
        pnpm: '10.28.2',
      }))
  )
    fail('candidate provenance omits locked build authority');
}

export async function validateCandidateMacosArtifactSet(
  evidence,
  contract,
  { artifactRoot } = {},
) {
  if (!artifactRoot) fail('candidate mode requires the final artifact root');
  validateMacosEvidenceShape(evidence, contract, false);
  const root = resolve(artifactRoot);
  const applicationRoot = join(
    root,
    'application',
    evidence.application.bundle_name,
  );
  const executablePath = join(
    applicationRoot,
    ...evidence.application.executable_path.split('/'),
  );
  const [
    manifestBytes,
    dmgBytes,
    executableBytes,
    checksums,
    sbom,
    provenance,
    observedInventory,
    license,
    notice,
    thirdPartyNotices,
    expectedLicense,
    expectedNotice,
    expectedThirdPartyNotices,
    applicationLicense,
    applicationNotice,
    applicationThirdPartyNotices,
  ] = await Promise.all([
    readFile(join(root, 'macos-package-manifest.json')),
    readFile(join(root, evidence.artifact.name)),
    readFile(executablePath),
    readFile(join(root, 'SHA256SUMS'), 'utf8'),
    json(join(root, 'glitchpad-macos.cdx.json')),
    json(join(root, 'provenance.json')),
    collectApplicationInventory(applicationRoot),
    readFile(join(root, 'LICENSE')),
    readFile(join(root, 'NOTICE')),
    readFile(join(root, 'THIRD_PARTY_NOTICES.txt')),
    readFile(join(defaultRepositoryRoot, 'LICENSE')),
    readFile(join(defaultRepositoryRoot, 'NOTICE')),
    readFile(
      join(
        defaultRepositoryRoot,
        'packaging',
        'macos',
        'THIRD_PARTY_NOTICES.txt',
      ),
    ),
    readFile(join(applicationRoot, 'Contents', 'Resources', 'LICENSE')),
    readFile(join(applicationRoot, 'Contents', 'Resources', 'NOTICE')),
    readFile(
      join(applicationRoot, 'Contents', 'Resources', 'THIRD_PARTY_NOTICES.txt'),
    ),
  ]);
  if (!isDeepStrictEqual(JSON.parse(manifestBytes.toString('utf8')), evidence))
    fail('manifest evidence does not match the validated document');
  const dmgDigest = createHash('sha256').update(dmgBytes).digest('hex');
  if (
    dmgDigest !== evidence.artifact.sha256 ||
    dmgBytes.length !== evidence.artifact.bytes
  )
    fail('final DMG bytes do not match evidence');
  if (checksums !== `${dmgDigest}  ${evidence.artifact.name}\n`)
    fail('SHA256SUMS does not bind the final DMG');
  const executableDigest = createHash('sha256')
    .update(executableBytes)
    .digest('hex');
  if (
    executableDigest !== evidence.application.executable_sha256 ||
    !isDeepStrictEqual(observedInventory, evidence.application_inventory) ||
    digestApplicationInventory(observedInventory) !==
      evidence.application.bundle_sha256
  )
    fail('final application bytes do not match evidence');
  if (
    !license.equals(expectedLicense) ||
    !notice.equals(expectedNotice) ||
    !thirdPartyNotices.equals(expectedThirdPartyNotices) ||
    !applicationLicense.equals(expectedLicense) ||
    !applicationNotice.equals(expectedNotice) ||
    !applicationThirdPartyNotices.equals(expectedThirdPartyNotices)
  )
    fail('candidate notice evidence is incomplete or stale');
  validateSbom(sbom, evidence);
  validateProvenance(provenance, evidence, { candidateOnly: true });
  return true;
}

export function validateCleanHostReceipt(
  receipt,
  manifestBytes,
  contract,
  { expectedArchitecture, official = false } = {},
) {
  if (secretPattern.test(JSON.stringify(receipt)))
    fail('clean-host receipt contains a secret-shaped value');
  exactKeys(
    receipt,
    [
      'schema_version',
      'candidate_manifest_sha256',
      'evidence_authority',
      'macos',
      'automated',
      'manual',
      'performance',
      'content_free',
      'completed_utc',
    ],
    'clean-host receipt',
  );
  exactKeys(
    receipt.evidence_authority,
    ['kind', 'workflow_identity', 'source_commit', 'native_test_suites'],
    'clean-host evidence authority',
  );
  exactKeys(
    receipt.macos,
    [
      'product_version',
      'build_version',
      'hardware_architecture',
      'application_architectures',
      'wkwebview_version',
    ],
    'clean-host macOS facts',
  );
  exactKeys(
    receipt.automated,
    automatedReceiptKeys,
    'clean-host automated results',
  );
  exactKeys(receipt.manual, manualReceiptKeys, 'clean-host manual results');
  exactKeys(
    receipt.performance,
    [
      'cold_startup_samples_ms',
      'cold_startup_p95_ms',
      'cold_startup_classification',
      'dmg_size_classification',
    ],
    'clean-host performance results',
  );
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (
    receipt.evidence_authority.kind !== 'github_actions_workflow' ||
    receipt.evidence_authority.workflow_identity !==
      manifest.workflow_identity ||
    receipt.evidence_authority.source_commit !== manifest.source_commit ||
    !isDeepStrictEqual(receipt.evidence_authority.native_test_suites, [
      'app_document_workflow',
      'desktop_delivery_conformance',
      'desktop_source_conformance',
      'recovery_conformance',
    ])
  )
    fail('clean-host evidence authority is invalid');
  const expectedManifestDigest = createHash('sha256')
    .update(manifestBytes)
    .digest('hex');
  if (
    receipt.schema_version !== 1 ||
    receipt.candidate_manifest_sha256 !== expectedManifestDigest
  )
    fail('clean-host receipt manifest binding is invalid');
  if (
    !['arm64', 'x86_64'].includes(expectedArchitecture) ||
    receipt.macos?.hardware_architecture !== expectedArchitecture
  )
    fail('clean-host hardware architecture is invalid');
  if (
    typeof receipt.macos?.product_version !== 'string' ||
    receipt.macos.product_version.length === 0 ||
    typeof receipt.macos?.build_version !== 'string' ||
    receipt.macos.build_version.length === 0 ||
    typeof receipt.macos?.wkwebview_version !== 'string' ||
    receipt.macos.wkwebview_version.length === 0 ||
    !same(
      receipt.macos?.application_architectures ?? [],
      contract.bundle.required_architectures,
    )
  )
    fail('clean-host macOS facts are incomplete');
  if (automatedReceiptKeys.some((key) => receipt.automated?.[key] !== 'pass'))
    fail('clean-host automated evidence is incomplete');
  const requiredManualState = official ? 'pass' : 'not_run_candidate';
  if (
    manualReceiptKeys.some(
      (key) => receipt.manual?.[key] !== requiredManualState,
    )
  )
    fail(
      official
        ? 'official manual evidence is incomplete'
        : 'candidate manual evidence must remain not_run_candidate',
    );
  if (receipt.content_free !== true)
    fail('clean-host receipt is not content-free');
  if (
    !validateFreshTimestamp(
      receipt.completed_utc,
      contract.official.maximum_evidence_age_seconds,
    )
  )
    fail('clean-host receipt is stale');
  const samples = receipt.performance?.cold_startup_samples_ms;
  if (
    !Array.isArray(samples) ||
    samples.length < 5 ||
    samples.some((value) => !Number.isFinite(value) || value < 0)
  )
    fail('cold startup evidence is invalid');
  const p95 = [...samples].sort((left, right) => left - right)[
    Math.ceil(samples.length * 0.95) - 1
  ];
  const classification =
    p95 <= 1500 ? 'pass' : p95 <= 2500 ? 'warning' : 'failure';
  if (
    receipt.performance.cold_startup_p95_ms !== p95 ||
    receipt.performance.cold_startup_classification !== classification ||
    classification === 'failure' ||
    !['pass', 'warning'].includes(receipt.performance.dmg_size_classification)
  )
    fail('cold startup evidence exceeds or misstates the S018 budget');
  return true;
}

async function inspectAppleTrust(artifactRoot, evidence) {
  if (process.platform !== 'darwin')
    fail('official Apple trust verification requires macOS');
  const applicationPath = join(
    artifactRoot,
    'application',
    evidence.application.bundle_name,
  );
  const dmgPath = join(artifactRoot, evidence.artifact.name);
  await execFileAsync('codesign', [
    '--verify',
    '--deep',
    '--strict',
    '--verbose=4',
    applicationPath,
  ]);
  const { stderr: applicationDetails } = await execFileAsync('codesign', [
    '--display',
    '--verbose=4',
    applicationPath,
  ]);
  await execFileAsync('codesign', [
    '--verify',
    '--strict',
    '--verbose=4',
    dmgPath,
  ]);
  await execFileAsync('xcrun', ['stapler', 'validate', dmgPath]);
  await execFileAsync('spctl', [
    '--assess',
    '--type',
    'open',
    '--context',
    'context:primary-signature',
    '--verbose=4',
    dmgPath,
  ]);
  const logBytes = await readFile(join(artifactRoot, 'notarization-log.json'));
  const log = JSON.parse(logBytes.toString('utf8'));
  const authority = applicationDetails.match(/^Authority=(.+)$/mu)?.[1] ?? '';
  const runtime = /flags=0x[0-9a-f]+\(runtime\)/iu.test(applicationDetails);
  const timestamp = /^Timestamp=.+$/mu.test(applicationDetails);
  return {
    schema_version: 1,
    application: {
      status: 'valid_developer_id',
      authority,
      hardened_runtime_status: runtime ? 'enabled' : 'missing',
      timestamp_status: timestamp ? 'valid' : 'missing',
      executable_sha256: evidence.application.executable_sha256,
    },
    dmg: { status: 'valid_developer_id', sha256: evidence.artifact.sha256 },
    notarization: {
      status: String(log.status).toLowerCase(),
      submission_id: log.id,
      artifact_sha256: log.artifact_sha256,
      log_sha256: createHash('sha256').update(logBytes).digest('hex'),
      warning_count: Array.isArray(log.issues)
        ? log.issues.filter(({ severity }) => severity === 'warning').length
        : 0,
    },
    stapling: { status: 'valid' },
    gatekeeper: { status: 'accepted' },
    completed_utc: new Date().toISOString(),
  };
}

export async function validateOfficialMacosEvidence(
  evidence,
  contract,
  {
    artifactRoot,
    expectedSigningIdentity,
    trustInspector = inspectAppleTrust,
  } = {},
) {
  if (!artifactRoot) fail('official mode requires the final artifact root');
  if (
    typeof expectedSigningIdentity !== 'string' ||
    !expectedSigningIdentity.startsWith(
      contract.official.signer_authority_prefix,
    )
  )
    fail('official mode requires the exact authorized signing identity');
  validateMacosEvidenceShape(evidence, contract, true);
  const root = resolve(artifactRoot);
  const manifestPath = join(root, 'macos-package-manifest.json');
  const applicationRoot = join(
    root,
    'application',
    evidence.application.bundle_name,
  );
  const executablePath = join(
    applicationRoot,
    ...evidence.application.executable_path.split('/'),
  );
  const [
    manifestBytes,
    dmgBytes,
    checksums,
    sbom,
    provenance,
    armReceipt,
    intelReceipt,
    recordedTrust,
    notaryLog,
    executableBytes,
    observedInventory,
    applicationLicense,
    applicationNotice,
    applicationThirdPartyNotices,
    expectedLicense,
    expectedNotice,
    expectedThirdPartyNotices,
  ] = await Promise.all([
    readFile(manifestPath),
    readFile(join(root, evidence.artifact.name)),
    readFile(join(root, 'SHA256SUMS'), 'utf8'),
    json(join(root, 'glitchpad-macos.cdx.json')),
    json(join(root, 'provenance.json')),
    json(join(root, 'clean-host-arm64.json')),
    json(join(root, 'clean-host-x86_64.json')),
    json(join(root, 'apple-trust-evidence.json')),
    json(join(root, 'notarization-log.json')),
    readFile(executablePath),
    collectApplicationInventory(applicationRoot),
    readFile(join(applicationRoot, 'Contents', 'Resources', 'LICENSE')),
    readFile(join(applicationRoot, 'Contents', 'Resources', 'NOTICE')),
    readFile(
      join(applicationRoot, 'Contents', 'Resources', 'THIRD_PARTY_NOTICES.txt'),
    ),
    readFile(join(defaultRepositoryRoot, 'LICENSE')),
    readFile(join(defaultRepositoryRoot, 'NOTICE')),
    readFile(
      join(
        defaultRepositoryRoot,
        'packaging',
        'macos',
        'THIRD_PARTY_NOTICES.txt',
      ),
    ),
  ]);
  if (!isDeepStrictEqual(JSON.parse(manifestBytes.toString('utf8')), evidence))
    fail('manifest evidence does not match the validated document');
  const dmgDigest = createHash('sha256').update(dmgBytes).digest('hex');
  if (
    dmgDigest !== evidence.artifact.sha256 ||
    dmgBytes.length !== evidence.artifact.bytes
  )
    fail('final DMG bytes do not match evidence');
  if (checksums !== `${dmgDigest}  ${evidence.artifact.name}\n`)
    fail('SHA256SUMS does not bind the final DMG');
  if (
    createHash('sha256').update(executableBytes).digest('hex') !==
      evidence.application.executable_sha256 ||
    !isDeepStrictEqual(observedInventory, evidence.application_inventory) ||
    digestApplicationInventory(observedInventory) !==
      evidence.application.bundle_sha256 ||
    !applicationLicense.equals(expectedLicense) ||
    !applicationNotice.equals(expectedNotice) ||
    !applicationThirdPartyNotices.equals(expectedThirdPartyNotices)
  )
    fail('final application bytes do not match evidence');
  validateSbom(sbom, evidence);
  validateProvenance(provenance, evidence, { candidateOnly: false });
  validateCleanHostReceipt(armReceipt, manifestBytes, contract, {
    expectedArchitecture: 'arm64',
    official: true,
  });
  validateCleanHostReceipt(intelReceipt, manifestBytes, contract, {
    expectedArchitecture: 'x86_64',
    official: true,
  });
  const observedTrust = await trustInspector(root, evidence);
  const comparable = (value) => ({ ...value, completed_utc: undefined });
  if (!isDeepStrictEqual(comparable(recordedTrust), comparable(observedTrust)))
    fail('recorded Apple trust evidence does not match live verification');
  if (
    !validateFreshTimestamp(
      recordedTrust.completed_utc,
      contract.official.maximum_evidence_age_seconds,
    ) ||
    recordedTrust.application?.status !==
      contract.official.required_signature_status ||
    recordedTrust.application?.authority !== expectedSigningIdentity ||
    recordedTrust.application?.hardened_runtime_status !==
      contract.official.required_hardened_runtime_status ||
    recordedTrust.application?.timestamp_status !==
      contract.official.required_timestamp_status ||
    recordedTrust.application?.executable_sha256 !==
      evidence.application.executable_sha256 ||
    recordedTrust.dmg?.status !== contract.official.required_signature_status ||
    recordedTrust.dmg?.sha256 !== dmgDigest ||
    recordedTrust.notarization?.status !==
      contract.official.required_notarization_status ||
    recordedTrust.notarization?.submission_id !== notaryLog.id ||
    recordedTrust.notarization?.artifact_sha256 !== dmgDigest ||
    notaryLog.artifact_sha256 !== dmgDigest ||
    recordedTrust.notarization?.log_sha256 !==
      createHash('sha256')
        .update(await readFile(join(root, 'notarization-log.json')))
        .digest('hex') ||
    recordedTrust.notarization?.warning_count !== 0 ||
    String(notaryLog.status).toLowerCase() !==
      contract.official.required_notarization_status ||
    !Array.isArray(notaryLog.issues) ||
    notaryLog.issues.length !== 0 ||
    recordedTrust.stapling?.status !==
      contract.official.required_staple_status ||
    recordedTrust.gatekeeper?.status !==
      contract.official.required_gatekeeper_status
  )
    fail('live Apple trust evidence is incomplete or stale');
  return true;
}

async function main() {
  const result = await checkMacosConfiguration();
  const evidenceIndex = process.argv.indexOf('--evidence');
  if (evidenceIndex >= 0) {
    const evidencePath = process.argv[evidenceIndex + 1];
    if (!evidencePath) fail('--evidence requires a path');
    const contract = await json(
      join(
        defaultRepositoryRoot,
        'packaging',
        'macos',
        'package-contract.json',
      ),
    );
    const evidence = await json(resolve(evidencePath));
    const artifactRootIndex = process.argv.indexOf('--artifact-root');
    const artifactRoot =
      artifactRootIndex >= 0 ? process.argv[artifactRootIndex + 1] : undefined;
    if (process.argv.includes('--official')) {
      await validateOfficialMacosEvidence(evidence, contract, {
        artifactRoot,
        expectedSigningIdentity: process.env.APPLE_SIGNING_IDENTITY,
      });
    } else {
      await validateCandidateMacosArtifactSet(evidence, contract, {
        artifactRoot,
      });
    }
  }
  console.log(
    `Validated ${result.capabilityCount} macOS extensions and ${result.artifactCount} artifact contract.`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
