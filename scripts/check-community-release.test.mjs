import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateFinalReleaseHandoff,
  validateGovernedClaims,
  validateReleaseAuthorityGate,
  validateReleaseContract,
  validateReleaseReadinessEvidence,
  validateTagPackageWorkflows,
} from './check-community-release.mjs';

const finalHandoff = () => ({
  releaseNotes:
    'S033 dependency security maintenance resolves issue #167 before the S034 release boundary.',
  releaseReceipt:
    '| Dependency security slice | S033 |\n| Final release authority slice | S034 |\n| Included corrective issues | #167 |',
  operatorRunbook:
    '1. Confirm the S034 pull request is merged after S033 issue #167 at the reviewed S034 merge commit.\n5. Create the annotated tag `v0.1.2` on the reviewed S034 merge commit and push only that tag.',
  changelog:
    'S033 (#167) patched Next.js 16.3.3 and the transitive `smol-toml` 1.7.1 resolution before release.',
});

test('accepts the final S034 release handoff', () =>
  assert.equal(validateFinalReleaseHandoff(finalHandoff()), true));

for (const [name, mutate, expected] of [
  [
    'stale S032 tag target',
    (handoff) => {
      handoff.operatorRunbook = handoff.operatorRunbook.replaceAll(
        'S034',
        'S032',
      );
    },
    /S034 release authority/u,
  ],
  [
    'tag instruction targeting S033',
    (handoff) => {
      handoff.operatorRunbook = handoff.operatorRunbook.replace(
        'on the reviewed S034 merge commit and push only that tag',
        'on the reviewed S033 merge commit and push only that tag',
      );
    },
    /tag instruction does not target S034/u,
  ],
  [
    'missing S033 traceability',
    (handoff) => {
      handoff.releaseNotes = handoff.releaseNotes.replace('S033', 'S032');
    },
    /S033 security remediation/u,
  ],
  [
    'missing issue 167 traceability',
    (handoff) => {
      handoff.releaseReceipt = handoff.releaseReceipt.replace('#167', '#166');
    },
    /issue #167/u,
  ],
  [
    'missing S033 traceability from the operator runbook',
    (handoff) => {
      handoff.operatorRunbook = handoff.operatorRunbook.replace('S033', 'S032');
    },
    /operator runbook omits the S033 security remediation/u,
  ],
  [
    'missing issue 167 traceability from the changelog',
    (handoff) => {
      handoff.changelog = handoff.changelog.replace('#167', '#166');
    },
    /changelog omits issue #167/u,
  ],
  [
    'missing patched dependency record',
    (handoff) => {
      handoff.changelog = 'S033 (#167) dependency maintenance completed.';
    },
    /patched dependency versions/u,
  ],
]) {
  test(`rejects a final handoff with ${name}`, () => {
    const handoff = finalHandoff();
    mutate(handoff);
    assert.throws(() => validateFinalReleaseHandoff(handoff), expected);
  });
}

const contract = () => ({
  schema_version: 1,
  version: '0.1.2',
  tag: 'v0.1.2',
  repository: 'shruggietech/glitchpad',
  artifacts: Array.from(
    { length: 8 },
    (_, index) => `glitchpad-0.1.2-${index}`,
  ),
  trust_states: {
    windows: 'unsigned_community',
    macos: 'adhoc_non_notarized_community',
    linux: 'repository_attested',
    android: 'stable_project_key',
  },
  manual_validation: 'deferred_post_release_issue_66',
});

test('accepts the exact community release inventory', () =>
  assert.equal(validateReleaseContract(contract()), true));
test('rejects the stale v0.1.1 release identity', () =>
  assert.throws(
    () =>
      validateReleaseContract({
        ...contract(),
        version: '0.1.1',
        tag: 'v0.1.1',
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
        releaseWorkflow: "workflow_dispatch:\n- 'v0.1.2'\nAPPLE_API_KEY",
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

test('requires every tag-only package input and persisted attestation', () => {
  const workflows = {
    androidWorkflow:
      '- name: Inspect raw signed packages\n  env:\n    ANDROID_SIGNING_CERT_SHA256: ${{ secrets.ANDROID_SIGNING_CERT_SHA256 }}\n  run: |',
    macosWorkflow:
      "${{ startsWith(github.ref, 'refs/tags/') && '--official' || '' }}",
    linuxWorkflow: `
- name: Assemble final-byte candidate and evidence
sudo chown --recursive "$(id --user):$(id --group)" artifacts/linux
- name: Exercise release promotion mutation before merge
if: \${{ !startsWith(github.ref, 'refs/tags/') }}
node scripts/promote-community-package.mjs --platform linux --directory artifacts/linux --source-commit '\${{ github.sha }}'
- name: Upload governed Linux package
if: \${{ !startsWith(github.ref, 'refs/tags/') }}
- name: Promote truthful community evidence
node scripts/promote-community-package.mjs --platform linux --directory artifacts/linux --source-commit '\${{ github.sha }}'
id: attest
\${{ steps.attest.outputs.bundle-path }}
artifacts/linux/repository-attestation.json
\${{ startsWith(github.ref, 'refs/tags/') && '--official' || '' }}
`,
  };
  assert.equal(validateTagPackageWorkflows(workflows), true);
  assert.throws(
    () => validateTagPackageWorkflows({ ...workflows, androidWorkflow: '' }),
    /Android official raw inspection/u,
  );
  assert.throws(
    () => validateTagPackageWorkflows({ ...workflows, linuxWorkflow: '' }),
    /Linux tag lifecycle/u,
  );
  assert.throws(
    () =>
      validateTagPackageWorkflows({
        ...workflows,
        linuxWorkflow: workflows.linuxWorkflow.replace(
          'sudo chown --recursive "$(id --user):$(id --group)" artifacts/linux',
          '',
        ),
      }),
    /exercise runner-side promotion/u,
  );
  assert.throws(
    () =>
      validateTagPackageWorkflows({
        ...workflows,
        linuxWorkflow: workflows.linuxWorkflow.replace(
          '- name: Exercise release promotion mutation before merge',
          '- name: Candidate-only shortcut',
        ),
      }),
    /exercise runner-side promotion/u,
  );
  assert.throws(
    () =>
      validateTagPackageWorkflows({
        ...workflows,
        linuxWorkflow: workflows.linuxWorkflow.replace(
          "if: ${{ !startsWith(github.ref, 'refs/tags/') }}",
          '',
        ),
      }),
    /exercise runner-side promotion/u,
  );
});

const releaseAuthorityWorkflow = `
- name: Confirm stable Android release authority
  env:
    ANDROID_KEYSTORE_BASE64: \${{ secrets.ANDROID_KEYSTORE_BASE64 }}
    ANDROID_KEYSTORE_PASSWORD: \${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
    ANDROID_KEY_ALIAS: \${{ secrets.ANDROID_KEY_ALIAS }}
    ANDROID_KEY_PASSWORD: \${{ secrets.ANDROID_KEY_PASSWORD }}
    ANDROID_SIGNING_CERT_SHA256: \${{ secrets.ANDROID_SIGNING_CERT_SHA256 }}
  run: |
    required=(ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD ANDROID_SIGNING_CERT_SHA256)
    for name in "\${required[@]}"; do
      if [[ -z "\${!name:-}" ]]; then
        echo "::error title=Missing release authority::$name is not configured."
        exit 1
      fi
    done
- name: Confirm manual readiness source
  if: github.event_name == 'workflow_dispatch'
  run: |
    if [[ "$GITHUB_REF" != 'refs/heads/main' ]]; then
      echo '::error title=Invalid readiness source::Manual release readiness must run from current main.'
      exit 1
    fi
`;

test('accepts the complete fail-closed Android release authority gate', () =>
  assert.equal(validateReleaseAuthorityGate(releaseAuthorityWorkflow), true));

for (const name of [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
  'ANDROID_SIGNING_CERT_SHA256',
]) {
  test(`rejects a release authority gate without ${name}`, () =>
    assert.throws(
      () =>
        validateReleaseAuthorityGate(
          releaseAuthorityWorkflow.replace(
            `    ${name}: \${{ secrets.${name} }}\n`,
            '',
          ),
        ),
      new RegExp(name, 'u'),
    ));
}

test('rejects a release authority gate that does not fail on empty values', () =>
  assert.throws(
    () =>
      validateReleaseAuthorityGate(
        releaseAuthorityWorkflow.replace('[[ -z "\${!name:-}" ]]', 'false'),
      ),
    /fail closed/u,
  ));

test('rejects manual readiness that is not restricted to main', () =>
  assert.throws(
    () =>
      validateReleaseAuthorityGate(
        releaseAuthorityWorkflow.replace(
          `if [[ "$GITHUB_REF" != 'refs/heads/main' ]]; then`,
          'if false; then',
        ),
      ),
    /fail closed/u,
  ));

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
