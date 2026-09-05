import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  classifyStartupSamples,
  clearLifecycleProbes,
  parseArguments,
  waitForLifecycleReadiness,
  waitForSingleNewDelivery,
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

test('interactive readiness requires both shell and document acknowledgements', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-lifecycle-probes-'));
  try {
    await writeFile(join(root, 'shell-ready.marker'), 'ready\n');
    await writeFile(join(root, 'delivery-1.marker'), 'ready\n');
    assert.deepEqual(
      await waitForLifecycleReadiness(root),
      new Set(['delivery-1.marker']),
    );
    await writeFile(join(root, 'delivery-2.marker'), 'ready\n');
    await assert.rejects(
      waitForLifecycleReadiness(root),
      /delivery_acknowledgement_duplicate/u,
    );
    await clearLifecycleProbes(root);
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('running-instance delivery requires exactly one new acknowledgement', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-lifecycle-delivery-'));
  try {
    const previous = new Set(['delivery-1.marker']);
    await writeFile(join(root, 'delivery-1.marker'), 'ready\n');
    await writeFile(join(root, 'delivery-2.marker'), 'ready\n');
    assert.deepEqual(
      await waitForSingleNewDelivery(root, previous),
      new Set(['delivery-1.marker', 'delivery-2.marker']),
    );
    await writeFile(join(root, 'delivery-3.marker'), 'ready\n');
    await assert.rejects(
      waitForSingleNewDelivery(root, previous),
      /delivery_acknowledgement_duplicate/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
