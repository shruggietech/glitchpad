import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGovernedClaims,
  validateReleaseAuthorityGate,
  validateReleaseContract,
  validateTagPackageWorkflows,
} from './check-community-release.mjs';

const contract = () => ({
  schema_version: 1,
  version: '0.1.0',
  tag: 'v0.1.0',
  repository: 'shruggietech/glitchpad',
  artifacts: Array.from(
    { length: 8 },
    (_, index) => `glitchpad-0.1.0-${index}`,
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
        releaseWorkflow: "workflow_dispatch:\n- 'v0.1.0'\nAPPLE_API_KEY",
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
    linuxWorkflow:
      "id: attest\n${{ steps.attest.outputs.bundle-path }}\nartifacts/linux/repository-attestation.json\n${{ startsWith(github.ref, 'refs/tags/') && '--official' || '' }}",
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
