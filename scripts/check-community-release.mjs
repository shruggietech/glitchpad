import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const loadJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const text = async (path) => readFile(path, 'utf8');

export function validateReleaseContract(contract) {
  if (
    contract.schema_version !== 1 ||
    contract.version !== '0.1.0' ||
    contract.tag !== 'v0.1.0' ||
    contract.repository !== 'shruggietech/glitchpad'
  )
    throw new Error('release identity is invalid');
  if (
    !Array.isArray(contract.artifacts) ||
    contract.artifacts.length !== 8 ||
    new Set(contract.artifacts).size !== 8
  )
    throw new Error('release must declare exactly eight unique artifacts');
  if (contract.artifacts.some((name) => !name.includes('0.1.0')))
    throw new Error('artifact version is stale');
  const expectedTrust = {
    windows: 'unsigned_community',
    macos: 'adhoc_non_notarized_community',
    linux: 'repository_attested',
    android: 'stable_project_key',
  };
  if (JSON.stringify(contract.trust_states) !== JSON.stringify(expectedTrust))
    throw new Error('release trust states are invalid');
  if (contract.manual_validation !== 'deferred_post_release_issue_66')
    throw new Error('manual validation policy is invalid');
  return true;
}

export const releaseAuthoritySecrets = [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
  'ANDROID_SIGNING_CERT_SHA256',
];

export function validateReleaseAuthorityGate(releaseWorkflow) {
  for (const name of releaseAuthoritySecrets) {
    const binding = `${name}: \${{ secrets.${name} }}`;
    if (!releaseWorkflow.includes(binding))
      throw new Error(`release readiness omits ${name}`);
  }
  if (
    !releaseWorkflow.includes('Confirm stable Android release authority') ||
    !releaseWorkflow.includes('[[ -z "${!name:-}" ]]') ||
    !releaseWorkflow.includes(
      '::error title=Missing release authority::$name is not configured.',
    ) ||
    !releaseWorkflow.includes('Confirm manual readiness source') ||
    !releaseWorkflow.includes(
      `if [[ "$GITHUB_REF" != 'refs/heads/main' ]]; then`,
    ) ||
    !releaseWorkflow.includes('exit 1')
  )
    throw new Error('release authority readiness does not fail closed');
  return true;
}

export function validateReleaseReadinessEvidence(readinessScript) {
  for (const path of ['brand/manifest.json', 'brand/INTEGRATION.md']) {
    if (!readinessScript.includes(`'${path}'`))
      throw new Error(
        `release readiness omits current brand evidence: ${path}`,
      );
  }
  if (readinessScript.includes('brand/references/01-canon.json'))
    throw new Error('release readiness retains removed brand evidence');
  return true;
}

export function validateGovernedClaims({
  releaseWorkflow,
  windowsContract,
  macosContract,
  androidContract,
  releaseNotes,
}) {
  const forbidden = [
    'WINDOWS_SIGNING_CERTIFICATE',
    'APPLE_CERTIFICATE',
    'APPLE_SIGNING_IDENTITY',
    'APPLE_API_ISSUER',
    'APPLE_API_KEY',
  ];
  if (forbidden.some((value) => releaseWorkflow.includes(value)))
    throw new Error('paid desktop authority remains in the release workflow');
  if (
    !releaseWorkflow.includes("- 'v0.1.0'") ||
    !releaseWorkflow.includes('workflow_dispatch:')
  )
    throw new Error('release event guards are incomplete');
  if (
    windowsContract.official?.trust_state !== 'unsigned_community' ||
    windowsContract.official?.required_signature_status !== 'not_signed'
  )
    throw new Error('Windows community trust is invalid');
  if (
    macosContract.official?.trust_state !== 'adhoc_non_notarized_community' ||
    macosContract.official?.required_application_signature_status !==
      'ad_hoc' ||
    macosContract.official?.required_notarization_status !== 'not_submitted'
  )
    throw new Error('macOS community trust is invalid');
  if (
    androidContract.official?.certificate_sha256_environment !==
    'ANDROID_SIGNING_CERT_SHA256'
  )
    throw new Error('Android stable authority is missing');
  for (const phrase of ['unsigned', 'not notarized', 'SHA-256', 'issue #66'])
    if (!releaseNotes.includes(phrase))
      throw new Error(`release notes omit ${phrase}`);
  return true;
}

export function validateTagPackageWorkflows({
  androidWorkflow,
  macosWorkflow,
  linuxWorkflow,
}) {
  const rawAndroidInspection = androidWorkflow.match(
    /- name: Inspect raw signed packages[\s\S]*?run: \|/u,
  )?.[0];
  if (
    !rawAndroidInspection?.includes(
      'ANDROID_SIGNING_CERT_SHA256: ${{ secrets.ANDROID_SIGNING_CERT_SHA256 }}',
    )
  )
    throw new Error('Android official raw inspection lacks signing authority');
  if (!macosWorkflow.includes("&& '--official' || ''"))
    throw new Error('macOS tag lifecycle does not select official evidence');
  for (const value of [
    'id: attest',
    'steps.attest.outputs.bundle-path',
    'artifacts/linux/repository-attestation.json',
    "&& '--official' || ''",
  ])
    if (!linuxWorkflow.includes(value))
      throw new Error(`Linux tag lifecycle is incomplete: ${value}`);
  const assemblyIndex = linuxWorkflow.indexOf(
    '- name: Assemble final-byte candidate and evidence',
  );
  const ownershipIndex = linuxWorkflow.indexOf(
    'sudo chown --recursive "$(id --user):$(id --group)" artifacts/linux',
  );
  const promotionIndex = linuxWorkflow.indexOf(
    '- name: Promote truthful community evidence',
  );
  const probeIndex = linuxWorkflow.indexOf(
    '- name: Exercise release promotion mutation before merge',
  );
  const candidateUploadIndex = linuxWorkflow.indexOf(
    '- name: Upload governed Linux package',
  );
  const promotionCommand =
    "node scripts/promote-community-package.mjs --platform linux --directory artifacts/linux --source-commit '${{ github.sha }}'";
  if (
    assemblyIndex < 0 ||
    ownershipIndex <= assemblyIndex ||
    probeIndex <= ownershipIndex ||
    candidateUploadIndex <= probeIndex ||
    promotionIndex <= candidateUploadIndex ||
    linuxWorkflow.split(promotionCommand).length - 1 !== 2 ||
    !linuxWorkflow.includes("if: ${{ !startsWith(github.ref, 'refs/tags/') }}")
  )
    throw new Error(
      'Linux release path must exercise runner-side promotion before merge',
    );
  return true;
}

export async function checkCommunityRelease(repositoryRoot = root) {
  const [
    contract,
    windowsContract,
    macosContract,
    androidContract,
    releaseWorkflow,
    readinessScript,
    releaseNotes,
    androidWorkflow,
    macosWorkflow,
    linuxWorkflow,
    rootPackage,
    appPackage,
    tauri,
  ] = await Promise.all([
    loadJson(join(repositoryRoot, 'packaging/release/package-contract.json')),
    loadJson(join(repositoryRoot, 'packaging/windows/package-contract.json')),
    loadJson(join(repositoryRoot, 'packaging/macos/package-contract.json')),
    loadJson(join(repositoryRoot, 'packaging/android/package-contract.json')),
    text(join(repositoryRoot, '.github/workflows/release.yml')),
    text(join(repositoryRoot, 'scripts/check-release-readiness.ps1')),
    text(join(repositoryRoot, 'docs/releases/v0.1.0.md')),
    text(join(repositoryRoot, '.github/workflows/android-package.yml')),
    text(join(repositoryRoot, '.github/workflows/macos-package.yml')),
    text(join(repositoryRoot, '.github/workflows/linux-package.yml')),
    loadJson(join(repositoryRoot, 'package.json')),
    loadJson(join(repositoryRoot, 'apps/glitchpad/package.json')),
    loadJson(join(repositoryRoot, 'crates/glitchpad-host/tauri.conf.json')),
  ]);
  validateReleaseContract(contract);
  validateReleaseAuthorityGate(releaseWorkflow);
  validateReleaseReadinessEvidence(readinessScript);
  validateGovernedClaims({
    releaseWorkflow,
    windowsContract,
    macosContract,
    androidContract,
    releaseNotes,
  });
  validateTagPackageWorkflows({
    androidWorkflow,
    macosWorkflow,
    linuxWorkflow,
  });
  if (
    [rootPackage.version, appPackage.version, tauri.version].some(
      (version) => version !== contract.version,
    )
  )
    throw new Error('JSON version authorities disagree');
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await checkCommunityRelease();
  console.log('v0.1.0 community release policy is internally consistent.');
}
