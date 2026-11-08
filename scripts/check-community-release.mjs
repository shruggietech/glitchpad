import { parse as parseYaml } from 'yaml';
import {
  releaseIdentity,
  targetReleaseIdentity,
} from './lib/release-identity.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const loadJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const text = async (path) => readFile(path, 'utf8');

export function validateReleaseContract(contract) {
  if (
    contract.schema_version !== 1 ||
    contract.version !== releaseIdentity.version ||
    contract.tag !== releaseIdentity.tag ||
    contract.repository !== 'shruggietech/glitchpad'
  )
    throw new Error('release identity is invalid');
  if (
    !Array.isArray(contract.artifacts) ||
    contract.artifacts.length !== 8 ||
    new Set(contract.artifacts).size !== 8
  )
    throw new Error('release must declare exactly eight unique artifacts');
  targetReleaseIdentity(contract);
  if (
    JSON.stringify(contract.accepted_staging_evidence) !==
    JSON.stringify(['accepted-staging.json', 'accepted-input-receipt.json'])
  )
    throw new Error('accepted staging evidence asset inventory is incomplete');
  const expectedTrust = {
    windows: 'unsigned_community',
    macos: 'adhoc_non_notarized_community',
    linux: 'repository_attested',
    android: 'stable_project_key',
  };
  if (JSON.stringify(contract.trust_states) !== JSON.stringify(expectedTrust))
    throw new Error('release trust states are invalid');
  const expectedPracticalUseEvidence = {
    windows: [
      'installed-markdown-lifecycle-receipt.json',
      'portable-lifecycle-receipt.json',
    ],
    macos: ['clean-host-arm64.json', 'clean-host-x86_64.json'],
    linux: [
      'clean-ubuntu-22.04-appimage.json',
      'clean-ubuntu-22.04-deb.json',
      'clean-ubuntu-24.04-appimage.json',
      'clean-ubuntu-24.04-deb.json',
    ],
  };
  const expectedPracticalUseRequiredPasses = {
    windows: [
      'clean_launch',
      'text_delivery',
      'markdown_delivery',
      'markdown_minimal',
      'markdown_edit_save_preview',
      'document_scoped_recovery',
      'markdown_alpha_beta',
      'markdown_beta_alpha',
      'menu_geometry',
      'toolbar_reserved_region',
      'geometry_scale_100',
      'geometry_scale_125',
      'geometry_scale_150',
      'geometry_scale_200',
      'document_preservation',
    ],
    macos: [
      'automated.mount',
      'automated.copy',
      'automated.launch',
      'automated.finder_delivery',
      'automated.running_instance_delivery',
      'automated.read',
      'automated.edit',
      'automated.save',
      'automated.recovery',
      'automated.remove',
      'automated.cleanup',
      'automated.universal_architecture',
    ],
    linux: [
      'automated.artifact_integrity',
      'automated.install_or_extract',
      'automated.desktop_registration',
      'automated.mime_registration',
      'automated.launch',
      'automated.startup_delivery',
      'automated.running_instance_delivery',
      'automated.read',
      'automated.edit',
      'automated.save',
      'automated.metadata',
      'automated.recovery',
      'automated.remove',
      'automated.registration_cleanup',
      'automated.document_preservation',
    ],
  };
  if (
    JSON.stringify(contract.practical_use_evidence) !==
    JSON.stringify(expectedPracticalUseEvidence)
  )
    throw new Error('practical-use evidence inventory is invalid');
  if (
    JSON.stringify(contract.practical_use_required_passes) !==
    JSON.stringify(expectedPracticalUseRequiredPasses)
  )
    throw new Error('practical-use required-pass inventory is invalid');
  if (
    contract.manual_validation !==
    'physical_and_screen_reader_unavailable_owner_2026_11_02'
  )
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
  const workflow = parseYaml(releaseWorkflow);
  const readiness = workflow.jobs?.readiness?.steps ?? [];
  const authority = readiness.find(
    (step) => step.name === 'Confirm stable Android release authority',
  );
  if (
    authority?.env?.ANDROID_SIGNING_CERT_SHA256 !==
    '${{ secrets.ANDROID_SIGNING_CERT_SHA256 }}'
  )
    throw new Error('release readiness omits ANDROID_SIGNING_CERT_SHA256');
  if (
    !authority.run?.includes('if [[ ! "$ANDROID_SIGNING_CERT_SHA256" =~') ||
    !authority.run.includes('exit 1')
  )
    throw new Error('release authority readiness does not fail closed');
  const manual = readiness.find(
    (step) => step.name === 'Confirm manual readiness source',
  );
  if (
    manual?.if !== "github.event_name == 'workflow_dispatch'" ||
    !manual.run?.includes(
      'if [[ "$GITHUB_REF" != \'refs/heads/main\' ]]; then',
    ) ||
    !manual.run.includes('exit 1')
  )
    throw new Error('manual release readiness does not fail closed');
  const publisher = workflow.jobs?.publish;
  if (
    publisher?.if !==
    "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/')"
  )
    throw new Error('only a later owner tag push may publish');
  const commands = (publisher.steps ?? [])
    .map((step) => step.run ?? '')
    .join('\n');
  if (
    !commands.includes(
      'scripts/accepted-release-inputs.mjs --accepted accepted-staging.json',
    ) ||
    !commands.includes(
      'cp accepted-staging.json accepted-input-receipt.json release-assets/',
    ) ||
    !commands.includes('git cat-file -t "$GITHUB_REF"') ||
    !commands.includes('origin/main^{tree}') ||
    /(?:cargo|tauri)\s+(?:android\s+)?build|pnpm\s+(?:run\s+)?build|actions\/workflows\/.*dispatches/u.test(
      commands,
    )
  )
    throw new Error(
      'publication must consume accepted staged bytes without rebuilding',
    );
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

export function validateFinalReleaseHandoff({
  releaseNotes,
  releaseReceipt,
  operatorRunbook,
  changelog,
}) {
  if (
    /authorizes publication before final PR merge|owner publication is already authorized/iu.test(
      operatorRunbook,
    )
  )
    throw new Error('Preparation cannot grant publication authority');
  for (const phrase of [
    'later owner authorization',
    'Stop unmerged',
    'auto-merge disabled',
  ])
    if (!operatorRunbook.includes(phrase))
      throw new Error(
        'Preparation handoff omits owner authorization boundary: ' + phrase,
      );
  if (
    !operatorRunbook.includes('accepted candidate SHA') ||
    !operatorRunbook.includes('accepted staging inputs')
  )
    throw new Error(
      'Future publication must bind the accepted candidate and staging inputs',
    );
  if (!operatorRunbook.includes('consume accepted payloads without rebuilding'))
    throw new Error(
      'Future publication must consume accepted payloads without rebuilding',
    );
  for (const [source, content] of [
    ['release notes', releaseNotes],
    ['release receipt', releaseReceipt],
    ['operator runbook', operatorRunbook],
    ['changelog', changelog],
  ]) {
    for (const phrase of ['S046', 'S047', 'product recovery'])
      if (!content.includes(phrase))
        throw new Error(source + ' omits ' + phrase);
  }
  for (const issue of ['#244', '#255'])
    if (!releaseNotes.includes(issue) || !releaseReceipt.includes(issue))
      throw new Error('Release handoff omits tracked recovery gate ' + issue);
  for (const issue of ['#66', '#239'])
    if (!releaseNotes.includes(issue) || !releaseReceipt.includes(issue))
      throw new Error('Release handoff omits separate follow-up ' + issue);
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
    !releaseWorkflow.includes("- '" + releaseIdentity.tag + "'") ||
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
  windowsWorkflow,
  macosWorkflow,
  linuxWorkflow,
}) {
  for (const [platform, source] of Object.entries({
    android: androidWorkflow,
    windows: windowsWorkflow,
    macos: macosWorkflow,
    linux: linuxWorkflow,
  })) {
    const workflow = parseYaml(source ?? '');
    if (
      !workflow ||
      workflow.on?.push?.tags ||
      workflow.on?.workflow_dispatch?.inputs?.stage_release?.type !==
        'boolean' ||
      workflow.on.workflow_dispatch.inputs.stage_release.default !== false
    )
      throw new Error(
        platform +
          ' staging must be explicit manual preparation without tag rebuilds',
      );
    if (
      workflow.env?.GLITCHPAD_BUILD_COMMIT !== '${{ github.sha }}' ||
      workflow.env?.VITE_GLITCHPAD_BUILD_COMMIT !== '${{ github.sha }}'
    )
      throw new Error(
        platform + ' staging omits actual native/frontend source',
      );
    const steps = workflow.jobs?.candidate?.steps ?? [];
    const authority = steps.find(
      (step) => step.name === 'Validate preparation authority',
    );
    if (
      !authority?.run?.includes('test "$GITHUB_REF_TYPE" = branch') ||
      !authority.run.includes(
        'test "$GITHUB_EVENT_NAME" = workflow_dispatch',
      ) ||
      !authority.run.includes(
        'test "$GITHUB_REPOSITORY" = shruggietech/glitchpad',
      )
    )
      throw new Error(platform + ' preparation authority must fail closed');
    if (platform !== 'android') {
      const promotion = steps.findIndex(
        (step) => step.name === 'Promote truthful community evidence',
      );
      if (promotion < 0 || steps[promotion].if !== 'inputs.stage_release')
        throw new Error(
          platform + ' promotion must select explicit unpublished staging',
        );
      const assembly = steps.findIndex(
        (step) => step.name === 'Assemble final-byte candidate and evidence',
      );
      if (assembly < 0 || promotion <= assembly)
        throw new Error(
          platform + ' promotion must follow final-byte assembly',
        );
      if (
        platform === 'windows' &&
        steps.findIndex(
          (step) => step.name === 'Exercise installed and portable lifecycles',
        ) <= promotion
      )
        throw new Error('Windows staged manifest must precede native receipt');
    }
  }
  const android = parseYaml(androidWorkflow);
  const androidSteps = android.jobs.candidate.steps;
  const raw = androidSteps.find(
    (step) => step.name === 'Inspect raw signed packages and resolver groups',
  );
  if (
    raw?.env?.ANDROID_SIGNING_CERT_SHA256 !==
    '${{ secrets.ANDROID_SIGNING_CERT_SHA256 }}'
  )
    throw new Error('Android official raw inspection lacks signing authority');
  const stable = androidSteps.find(
    (step) => step.name === 'Restore stable project signing authority',
  );
  for (const name of releaseAuthoritySecrets)
    if (stable?.env?.[name] !== '${{ secrets.' + name + ' }}')
      throw new Error('Android stable staging omits ' + name);
  if (
    !stable?.if?.includes("github.event_name == 'workflow_dispatch'") ||
    !stable.if.includes('inputs.stage_release')
  )
    throw new Error(
      'Android stable key restoration must require manual staging',
    );
  const linux = parseYaml(linuxWorkflow);
  const steps = linux.jobs.candidate.steps;
  const ownership = steps.findIndex(
    (step) =>
      typeof step.run === 'string' &&
      step.run.includes(
        'sudo chown --recursive "$(id --user):$(id --group)" artifacts/linux',
      ),
  );
  const promotion = steps.findIndex(
    (step) => step.name === 'Promote truthful community evidence',
  );
  const attestation = steps.findIndex((step) => step.id === 'attest');
  const preserved = steps.findIndex(
    (step) =>
      typeof step.run === 'string' &&
      step.run.includes('steps.attest.outputs.bundle-path'),
  );
  const upload = steps.findIndex(
    (step) => step.name === 'Upload governed Linux community package',
  );
  if (
    ownership < 0 ||
    promotion <= ownership ||
    attestation <= promotion ||
    preserved <= attestation ||
    upload <= preserved
  )
    throw new Error(
      'Linux staged native path requires ownership, promotion, attestation and immutable upload in order',
    );
  for (const source of [macosWorkflow, linuxWorkflow])
    if (!source.includes("inputs.stage_release && '--official' || ''"))
      throw new Error(
        'staged native lifecycle must select official eligible metadata',
      );
  return true;
}

export function validateLinuxOfflineProvenance(workflow) {
  const stages = [
    'Validate source and package contracts',
    'Prove locked metadata is independent of network',
    'Build governed AppImage and Debian candidates',
    'Assemble final-byte candidate and evidence',
  ].map((name) => {
    const start = workflow.indexOf('- name: ' + name);
    return start < 0
      ? ''
      : workflow.slice(start).split(/\n[ \t]*- name:/u, 1)[0];
  });
  const mounts = [
    '--volume "$RUNNER_TEMP/glitchpad-cargo/registry:/usr/local/cargo/registry"',
    '--volume "$RUNNER_TEMP/glitchpad-cargo/git:/usr/local/cargo/git"',
  ];
  if (
    stages.some(
      (stage) =>
        !stage.includes('docker run --rm') ||
        mounts.some((mount) => !stage.includes(mount)),
    ) ||
    !stages[0].includes('cargo fetch --locked') ||
    !stages[1].includes('--network none') ||
    !stages[1].includes(
      'cargo metadata --locked --offline --format-version 1',
    ) ||
    !stages[3].includes(
      'cargo metadata --locked --offline --format-version 1 > artifacts/linux/cargo-metadata.json',
    ) ||
    stages.some(
      (stage) =>
        stage.includes('--no-deps') || stage.includes('--filter-platform'),
    )
  )
    throw new Error(
      'Linux offline provenance must preserve complete locked inputs across containers',
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
    releaseReceipt,
    operatorRunbook,
    changelog,
    androidWorkflow,
    windowsWorkflow,
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
    text(join(repositoryRoot, 'docs/releases/' + releaseIdentity.tag + '.md')),
    text(
      join(
        repositoryRoot,
        'docs/releases/' + releaseIdentity.tag + '-receipt.md',
      ),
    ),
    text(
      join(
        repositoryRoot,
        'docs/releases/' + releaseIdentity.tag + '-operator-runbook.md',
      ),
    ),
    text(join(repositoryRoot, 'CHANGELOG.md')),
    text(join(repositoryRoot, '.github/workflows/android-package.yml')),
    text(join(repositoryRoot, '.github/workflows/windows-package.yml')),
    text(join(repositoryRoot, '.github/workflows/macos-package.yml')),
    text(join(repositoryRoot, '.github/workflows/linux-package.yml')),
    loadJson(join(repositoryRoot, 'package.json')),
    loadJson(join(repositoryRoot, 'apps/glitchpad/package.json')),
    loadJson(join(repositoryRoot, 'crates/glitchpad-host/tauri.conf.json')),
  ]);
  validateReleaseContract(contract);
  validateReleaseAuthorityGate(releaseWorkflow);
  validateReleaseReadinessEvidence(readinessScript);
  validateFinalReleaseHandoff({
    releaseNotes,
    releaseReceipt,
    operatorRunbook,
    changelog,
  });
  validateGovernedClaims({
    releaseWorkflow,
    windowsContract,
    macosContract,
    androidContract,
    releaseNotes,
  });
  validateLinuxOfflineProvenance(linuxWorkflow);
  validateTagPackageWorkflows({
    androidWorkflow,
    windowsWorkflow,
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
  console.log(
    releaseIdentity.tag +
      ' community release preparation policy is internally consistent.',
  );
}
