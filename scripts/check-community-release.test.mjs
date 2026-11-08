import { readFileSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { releaseIdentity } from './lib/release-identity.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateFinalReleaseHandoff,
  validateGovernedClaims,
  validateReleaseAuthorityGate,
  validateReleaseContract,
  validateReleaseReadinessEvidence,
  validateTagPackageWorkflows,
  validateLinuxOfflineProvenance,
} from './check-community-release.mjs';

const finalHandoff = () => ({
  releaseNotes:
    'S046 and S047 product recovery for #244 and #255; issue #66 and #239 remain open. unsigned not notarized SHA-256',
  releaseReceipt:
    'S046 and S047 product recovery for #244 and #255. Preparation is unpublished; final source/package evidence is confirmed in the PR handoff. issue #66 and #239 remain open.',
  operatorRunbook:
    'Stop unmerged with auto-merge disabled. Tagging and publication require later owner authorization. Use the accepted candidate SHA and accepted staging inputs; consume accepted payloads without rebuilding. S046 S047 product recovery #244 #255.',
  changelog: 'S046 and S047 product recovery.',
});

test('accepts the S048 preparation handoff without publication authority', () =>
  assert.equal(validateFinalReleaseHandoff(finalHandoff()), true));
for (const [name, mutate, expected] of [
  [
    'premature publication authority',
    (h) => {
      h.operatorRunbook +=
        ' The owner explicitly authorizes publication before final PR merge.';
    },
    /publication authority/u,
  ],
  [
    'missing later owner authorization',
    (h) => {
      h.operatorRunbook = h.operatorRunbook.replace(
        'later owner authorization',
        'automatic publication',
      );
    },
    /owner authorization/u,
  ],
  [
    'wrong future source binding',
    (h) => {
      h.operatorRunbook = h.operatorRunbook.replace(
        'accepted candidate SHA',
        'current main SHA',
      );
    },
    /accepted candidate/u,
  ],
  [
    'payload rebuild',
    (h) => {
      h.operatorRunbook = h.operatorRunbook.replace(
        'consume accepted payloads without rebuilding',
        'rebuild packages after tagging',
      );
    },
    /accepted payloads/u,
  ],
  [
    'missing recovery traceability',
    (h) => {
      h.releaseNotes = h.releaseNotes.replace('S047', 'S043');
    },
    /S047/u,
  ],
  [
    'missing tracked recovery gate',
    (h) => {
      h.releaseReceipt = h.releaseReceipt.replace('#255', '#75');
    },
    /#255/u,
  ],
])
  test('rejects handoff with ' + name, () => {
    const h = finalHandoff();
    mutate(h);
    assert.throws(() => validateFinalReleaseHandoff(h), expected);
  });

const contract = () => ({
  schema_version: 1,
  version: releaseIdentity.version,
  tag: releaseIdentity.tag,
  repository: 'shruggietech/glitchpad',
  artifacts: [...releaseIdentity.artifacts],
  accepted_staging_evidence: [
    'accepted-staging.json',
    'accepted-input-receipt.json',
  ],
  trust_states: {
    windows: 'unsigned_community',
    macos: 'adhoc_non_notarized_community',
    linux: 'repository_attested',
    android: 'stable_project_key',
  },
  manual_validation: 'physical_and_screen_reader_unavailable_owner_2026_11_02',
  practical_use_evidence: {
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
  },
  practical_use_required_passes: {
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
  },
});

test('accepts the exact community release inventory', () =>
  assert.equal(validateReleaseContract(contract()), true));
test('rejects the stale v0.1.2 release identity', () =>
  assert.throws(
    () =>
      validateReleaseContract({
        ...contract(),
        version: '0.1.2',
        tag: 'v0.1.2',
      }),
    /release identity/u,
  ));
test('rejects an incomplete release inventory', () =>
  assert.throws(
    () =>
      validateReleaseContract({
        ...contract(),
        artifacts: contract().artifacts.slice(1),
      }),
    /exactly eight/u,
  ));
test('rejects paid desktop credentials', () =>
  assert.throws(
    () =>
      validateGovernedClaims({
        releaseWorkflow: "workflow_dispatch:\n- 'v0.2.1'\nAPPLE_API_KEY",
        windowsContract: {
          official: {
            trust_state: 'unsigned_community',
            required_signature_status: 'not_signed',
          },
        },
        macosContract: {
          official: {
            trust_state: 'adhoc_non_notarized_community',
            required_application_signature_status: 'ad_hoc',
            required_notarization_status: 'not_submitted',
          },
        },
        androidContract: {
          official: {
            certificate_sha256_environment: 'ANDROID_SIGNING_CERT_SHA256',
          },
        },
        releaseNotes: 'unsigned not notarized SHA-256 issue #66',
      }),
    /paid desktop/u,
  ));

const releaseAuthorityWorkflow = readFileSync(
  new URL('../.github/workflows/release.yml', import.meta.url),
  'utf8',
);
const packageWorkflows = Object.fromEntries(
  ['android', 'windows', 'macos', 'linux'].map((platform) => [
    platform + 'Workflow',
    readFileSync(
      new URL(
        '../.github/workflows/' + platform + '-package.yml',
        import.meta.url,
      ),
      'utf8',
    ),
  ]),
);
test('explicit staging preserves signed authority, native bindings and later accepted-input publication', () => {
  assert.equal(validateTagPackageWorkflows(packageWorkflows), true);
  assert.equal(validateReleaseAuthorityGate(releaseAuthorityWorkflow), true);
});
test('stable Android authority cannot be omitted from staging or final readback', () => {
  assert.throws(
    () =>
      validateTagPackageWorkflows({
        ...packageWorkflows,
        androidWorkflow: packageWorkflows.androidWorkflow.replace(
          'ANDROID_SIGNING_CERT_SHA256: ${{ secrets.ANDROID_SIGNING_CERT_SHA256 }}',
          '',
        ),
      }),
    /signing authority|omits/u,
  );
  assert.throws(
    () =>
      validateReleaseAuthorityGate(
        releaseAuthorityWorkflow.replace(
          'ANDROID_SIGNING_CERT_SHA256: ${{ secrets.ANDROID_SIGNING_CERT_SHA256 }}',
          '',
        ),
      ),
    /ANDROID_SIGNING_CERT_SHA256/u,
  );
});
test('manual readiness and stable staging fail closed', () => {
  assert.throws(
    () =>
      validateReleaseAuthorityGate(
        releaseAuthorityWorkflow.replace(
          'if [[ ! "$ANDROID_SIGNING_CERT_SHA256" =~',
          'if [[ "$ANDROID_SIGNING_CERT_SHA256" =~',
        ),
      ),
    /fail closed/u,
  );
  assert.throws(
    () =>
      validateReleaseAuthorityGate(
        releaseAuthorityWorkflow.replace(
          'if [[ "$GITHUB_REF" != \'refs/heads/main\' ]]; then',
          'if false; then',
        ),
      ),
    /fail closed/u,
  );
  assert.throws(
    () =>
      validateTagPackageWorkflows({
        ...packageWorkflows,
        androidWorkflow: packageWorkflows.androidWorkflow.replace(
          'test "$GITHUB_EVENT_NAME" = workflow_dispatch',
          'true',
        ),
      }),
    /authority/u,
  );
});
test('tag rebuilds, automatic publication and post-qualification manifest changes are rejected', () => {
  const automatic = parseYaml(releaseAuthorityWorkflow);
  automatic.jobs.publish.if = 'always()';
  assert.throws(
    () => validateReleaseAuthorityGate(stringifyYaml(automatic)),
    /later owner tag/u,
  );
  const rebuild = parseYaml(releaseAuthorityWorkflow);
  rebuild.jobs.publish.steps.push({ run: 'pnpm tauri android build --apk' });
  assert.throws(
    () => validateReleaseAuthorityGate(stringifyYaml(rebuild)),
    /without rebuilding/u,
  );
  const tagBuild = parseYaml(packageWorkflows.linuxWorkflow);
  tagBuild.on.push.tags = ['v0.2.1'];
  assert.throws(
    () =>
      validateTagPackageWorkflows({
        ...packageWorkflows,
        linuxWorkflow: stringifyYaml(tagBuild),
      }),
    /without tag rebuilds/u,
  );
  const lateManifest = parseYaml(packageWorkflows.windowsWorkflow);
  const steps = lateManifest.jobs.candidate.steps;
  const index = steps.findIndex(
    (step) => step.name === 'Promote truthful community evidence',
  );
  const [promotion] = steps.splice(index, 1);
  steps.push(promotion);
  assert.throws(
    () =>
      validateTagPackageWorkflows({
        ...packageWorkflows,
        windowsWorkflow: stringifyYaml(lateManifest),
      }),
    /precede native receipt/u,
  );
  assert.throws(
    () =>
      validateTagPackageWorkflows({
        ...packageWorkflows,
        linuxWorkflow: packageWorkflows.linuxWorkflow.replace(
          'sudo chown --recursive "$(id --user):$(id --group)" artifacts/linux',
          'true',
        ),
      }),
    /ownership/u,
  );
});

const releaseReadinessScript = `
$requiredEvidence = @(
    'brand/manifest.json',
    'brand/INTEGRATION.md'
)
`;

test('accepts current brand evidence in tag-context readiness', () =>
  assert.equal(validateReleaseReadinessEvidence(releaseReadinessScript), true));

test('rejects removed brand evidence in tag-context readiness', () =>
  assert.throws(
    () =>
      validateReleaseReadinessEvidence(
        releaseReadinessScript.replace(
          'brand/manifest.json',
          'brand/references/01-canon.json',
        ),
      ),
    /current brand evidence|removed brand evidence/u,
  ));

const offlineLinuxWorkflow = `
- name: Prepare job-local Cargo inputs
  run: mkdir -p "$RUNNER_TEMP/glitchpad-cargo/registry" "$RUNNER_TEMP/glitchpad-cargo/git"
- name: Validate source and package contracts
  run: |
    docker run --rm --volume "$RUNNER_TEMP/glitchpad-cargo/registry:/usr/local/cargo/registry" --volume "$RUNNER_TEMP/glitchpad-cargo/git:/usr/local/cargo/git" image sh -c '
      cargo fetch --locked
    '
- name: Prove locked metadata is independent of network
  run: |
    docker run --rm --network none --volume "$RUNNER_TEMP/glitchpad-cargo/registry:/usr/local/cargo/registry" --volume "$RUNNER_TEMP/glitchpad-cargo/git:/usr/local/cargo/git" image sh -c '
      cargo metadata --locked --offline --format-version 1
    '
- name: Build governed AppImage and Debian candidates
  run: |
    docker run --rm --volume "$RUNNER_TEMP/glitchpad-cargo/registry:/usr/local/cargo/registry" --volume "$RUNNER_TEMP/glitchpad-cargo/git:/usr/local/cargo/git" image sh -c build
- name: Assemble final-byte candidate and evidence
  run: |
    docker run --rm --volume "$RUNNER_TEMP/glitchpad-cargo/registry:/usr/local/cargo/registry" --volume "$RUNNER_TEMP/glitchpad-cargo/git:/usr/local/cargo/git" image sh -c '
      cargo metadata --locked --offline --format-version 1 > artifacts/linux/cargo-metadata.json
    '
`;

test('requires complete locked offline Linux provenance across container boundaries', () => {
  assert.equal(validateLinuxOfflineProvenance(offlineLinuxWorkflow), true);
  for (const [before, after] of [
    ['cargo fetch --locked', 'cargo fetch'],
    ['--network none', ''],
    ['cargo metadata --locked --offline', 'cargo metadata --locked'],
    ['--format-version 1', '--no-deps --format-version 1'],
    ['registry:/usr/local/cargo/registry', 'registry:/tmp/unshared-registry'],
    ['git:/usr/local/cargo/git', 'git:/tmp/unshared-git'],
  ]) {
    assert.throws(
      () =>
        validateLinuxOfflineProvenance(
          offlineLinuxWorkflow.replace(before, after),
        ),
      /Linux offline provenance/u,
    );
  }
});

test('accepted staging evidence remains a separate complete asset inventory', () => {
  assert.throws(
    () =>
      validateReleaseContract({ ...contract(), accepted_staging_evidence: [] }),
    /staging evidence asset inventory/u,
  );
});
