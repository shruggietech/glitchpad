import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyStartupSamples,
  parseArguments,
} from './test-package-lifecycle.mjs';

test('lifecycle arguments require explicit artifact, manifest, receipt, and architecture', () => {
  assert.deepEqual(
    parseArguments([
      '--dmg',
      'candidate.dmg',
      '--manifest',
      'manifest.json',
      '--receipt',
      'receipt.json',
      '--architecture',
      'arm64',
    ]),
    {
      dmg: 'candidate.dmg',
      manifest: 'manifest.json',
      receipt: 'receipt.json',
      architecture: 'arm64',
    },
  );
  assert.throws(
    () => parseArguments(['--dmg', 'candidate.dmg']),
    /argument_missing/u,
  );
  assert.throws(
    () =>
      parseArguments([
        '--dmg',
        'candidate.dmg',
        '--manifest',
        'manifest.json',
        '--receipt',
        'receipt.json',
        '--architecture',
        'i386',
      ]),
    /architecture_invalid/u,
  );
});

test('startup evidence uses five samples and the S018 hard limit', () => {
  assert.deepEqual(classifyStartupSamples([500, 600, 700, 800, 900]), {
    p95: 900,
    classification: 'pass',
  });
  assert.deepEqual(classifyStartupSamples([1501, 1600, 1700, 1800, 2000]), {
    p95: 2000,
    classification: 'warning',
  });
  assert.throws(
    () => classifyStartupSamples([2600, 2600, 2600, 2600, 2600]),
    /startup_hard_limit/u,
  );
  assert.throws(() => classifyStartupSamples([500]), /startup_sample_count/u);
});
