import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { assembleAndroidPackage } from './assemble-package.mjs';

test('assembly copies exact final bytes and emits canonical checksums and manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-android-'));
  const inputs = [];
  for (const [role, extension, content] of [
    ['universal', 'apk', 'universal'],
    ['arm64', 'apk', 'arm64'],
    ['play', 'aab', 'play'],
  ]) {
    const artifact = join(root, `input-${role}.${extension}`);
    const inventory = join(root, `${role}-input.json`);
    await writeFile(artifact, content, 'utf8');
    await writeFile(
      inventory,
      JSON.stringify({
        role,
        kind: extension,
        certificate_sha256: 'A'.repeat(64),
      }),
      'utf8',
    );
    inputs.push({ role, artifact, inventory });
  }
  const output = join(root, 'out');
  const result = await assembleAndroidPackage({
    contract: {
      candidate_version: '0.1.1',
      artifacts: [
        {
          role: 'universal',
          kind: 'apk',
          name: 'glitchpad-0.1.1-android-universal.apk',
        },
        {
          role: 'arm64',
          kind: 'apk',
          name: 'glitchpad-0.1.1-android-arm64.apk',
        },
        {
          role: 'play',
          kind: 'aab',
          name: 'glitchpad-0.1.1-android-universal.aab',
        },
      ],
      candidate_trust: { publication_status: 'blocked_candidate' },
    },
    inputs,
    output,
    sourceCommit: 'b'.repeat(40),
    authority: 'candidate',
    generatedAt: '2026-09-06T12:00:00.000Z',
  });
  assert.equal(result.artifacts.length, 3);
  assert.match(
    await readFile(join(output, 'SHA256SUMS'), 'utf8'),
    /glitchpad-0\.1\.1-android-arm64\.apk/u,
  );
  const manifest = JSON.parse(
    await readFile(join(output, 'android-package-manifest.json'), 'utf8'),
  );
  assert.equal(manifest.publication_status, 'blocked_candidate');
  assert.deepEqual(manifest.artifacts.map(({ role }) => role).sort(), [
    'arm64',
    'play',
    'universal',
  ]);
});

test('assembly rejects duplicate or missing roles', async () => {
  await assert.rejects(
    () =>
      assembleAndroidPackage({
        contract: { artifacts: [] },
        inputs: [],
        output: '.',
        sourceCommit: 'b'.repeat(40),
        authority: 'candidate',
      }),
    /exactly three/u,
  );
});
