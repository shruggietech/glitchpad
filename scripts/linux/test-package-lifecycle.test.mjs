import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCleanEnvironmentReceipt,
  percentile95,
  validateLifecycleOptions,
} from './test-package-lifecycle.mjs';

const digest = 'a'.repeat(64);

test('lifecycle options allow only governed package forms and Ubuntu releases', () => {
  assert.equal(validateLifecycleOptions({ packageForm: 'appimage', release: '22.04' }), true);
  assert.equal(validateLifecycleOptions({ packageForm: 'deb', release: '24.04' }), true);
  assert.throws(() => validateLifecycleOptions({ packageForm: 'rpm', release: '22.04' }), /package form/u);
  assert.throws(() => validateLifecycleOptions({ packageForm: 'deb', release: '26.04' }), /Ubuntu release/u);
});

test('startup percentile uses the nearest-rank governed sample', () => {
  assert.equal(percentile95([680, 600, 660, 620, 640]), 680);
});

test('receipt builder emits a closed content-free candidate result', () => {
  const receipt = buildCleanEnvironmentReceipt({
    manifestSha256: digest,
    workflowIdentity:
      'shruggietech/glitchpad/.github/workflows/linux-package.yml@refs/heads/test',
    sourceCommit: 'b'.repeat(40),
    release: '22.04',
    packageForm: 'appimage',
    productVersion: '0.1.0',
    webkitgtkVersion: '2.52.0',
    startupSamplesMs: [600, 620, 640, 660, 680],
    startupClassification: 'pass',
    artifactSizeClassification: 'pass',
  });
  assert.equal(receipt.content_free, true);
  assert.equal(receipt.automated.performance, 'measured_hosted_smoke');
  assert.equal(receipt.performance.startup_p95_ms, 680);
  assert.equal(JSON.stringify(receipt).includes('/home/'), false);
  assert.equal(JSON.stringify(receipt).includes('fixture'), false);
});
