import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { assembleLinuxCandidate } from './assemble-package.mjs';

const contract = JSON.parse(
  await readFile(new URL('../../packaging/linux/package-contract.json', import.meta.url), 'utf8'),
);

test('assembly renames and binds both final artifacts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-linux-assembly-'));
  try {
    const appImage = join(root, 'upstream.AppImage');
    const deb = join(root, 'upstream.deb');
    await writeFile(appImage, 'appimage-bytes');
    await writeFile(deb, 'deb-bytes');
    const result = await assembleLinuxCandidate({
      appImagePath: appImage,
      debPath: deb,
      outputRoot: join(root, 'out'),
      sourceCommit: 'a'.repeat(40),
      workflowIdentity:
        'shruggietech/glitchpad/.github/workflows/linux-package.yml@refs/pull/122/merge',
      buildBaseline: {
        distribution: 'ubuntu',
        release: '22.04',
        architecture: 'x86_64',
        container_target: 'linux-package',
        glibc_version: '2.35',
        maximum_imported_glibc: '2.34',
        webkitgtk_api: '4.1',
      },
      inventories: {
        appimage: contract.required_content.appimage.map((path) => ({ path })),
        deb: contract.required_content.deb.map((path) => ({ path })),
      },
    });
    assert.deepEqual(result.manifest.artifacts.map(({ name }) => name), [
      'glitchpad-0.1.3-linux-x86_64.AppImage',
      'glitchpad-0.1.3-linux-x86_64.deb',
    ]);
    assert.match(await readFile(result.checksumsPath, 'utf8'), /^[a-f0-9]{64}  glitchpad-/mu);
    assert.equal(result.manifest.official, false);
    assert.equal(result.manifest.repository_attestation_status, 'not_generated_candidate');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('assembly rejects missing artifacts and invalid source authority', async () => {
  await assert.rejects(
    assembleLinuxCandidate({
      appImagePath: 'missing.AppImage',
      debPath: 'missing.deb',
      outputRoot: 'unused',
      sourceCommit: 'main',
      workflowIdentity: '',
      buildBaseline: {},
      inventories: {},
    }),
    /exact source commit/u,
  );
});
