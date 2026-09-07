import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGovernedClaims,
  validateReleaseContract,
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
