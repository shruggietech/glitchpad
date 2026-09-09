import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assembleCommunityRelease } from './assemble-community-release.mjs';

test('assembles exactly the declared artifact set', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-release-'));
  const input = join(root, 'input');
  const output = join(root, 'output');
  await mkdir(input);
  const artifacts = Array.from(
    { length: 8 },
    (_, index) => `glitchpad-0.1.1-${index}.bin`,
  );
  for (const name of artifacts) await writeFile(join(input, name), name);
  const trustStates = {
    windows: 'unsigned_community',
    macos: 'adhoc_non_notarized_community',
    linux: 'repository_attested',
    android: 'stable_project_key',
  };
  const manifestNames = {
    windows: 'windows-package-manifest.json',
    macos: 'macos-package-manifest.json',
    linux: 'linux-package-manifest.json',
    android: 'android-package-manifest.json',
  };
  for (const platform of Object.keys(manifestNames)) {
    const directory = join(input, platform);
    await mkdir(directory);
    const identity =
      platform === 'android'
        ? { authority: 'official', publication_status: 'eligible_official' }
        : { official: true, gate_status: 'official_valid' };
    await writeFile(
      join(directory, manifestNames[platform]),
      JSON.stringify({ source_commit: 'a'.repeat(40), ...identity }),
    );
    if (platform !== 'android')
      await writeFile(
        join(directory, 'community-trust-evidence.json'),
        JSON.stringify({
          source_commit: 'a'.repeat(40),
          trust_state: trustStates[platform],
        }),
      );
  }
  const contractPath = join(root, 'contract.json');
  await writeFile(
    contractPath,
    JSON.stringify({
      version: '0.1.1',
      tag: 'v0.1.1',
      repository: 'shruggietech/glitchpad',
      artifacts,
      trust_states: trustStates,
    }),
  );
  const manifest = await assembleCommunityRelease({
    input,
    output,
    sourceCommit: 'a'.repeat(40),
    contractPath,
  });
  assert.equal(manifest.artifacts.length, 8);
  assert.match(
    await readFile(join(output, 'SHA256SUMS'), 'utf8'),
    /glitchpad-0\.1\.1-7\.bin/u,
  );
});
