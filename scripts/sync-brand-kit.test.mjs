import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { verifySourceInventory } from './sync-brand-kit.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-brand-source-'));
  const asset = Buffer.from('released asset\n');
  await mkdir(join(root, 'icons'), { recursive: true });
  await writeFile(join(root, 'icons', 'mark.txt'), asset);
  const legalDigests = {};
  for (const name of ['LICENSE', 'LICENSE-BRAND.md', 'NOTICE']) {
    const bytes = Buffer.from(`${name}\n`);
    await writeFile(join(root, name), bytes);
    legalDigests[name] = digest(bytes);
  }
  const manifest = {
    files: [{ path: 'icons/mark.txt', bytes: asset.length, sha256: digest(asset) }],
  };
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  return { root, manifest, legalDigests };
}

test('source inventory accepts only complete checksummed release files', async () => {
  const source = await fixture();
  try {
    await assert.doesNotReject(
      verifySourceInventory(source.root, source.manifest, source.legalDigests),
    );
    await rm(join(source.root, 'icons', 'mark.txt'));
    await assert.rejects(
      verifySourceInventory(source.root, source.manifest, source.legalDigests),
      /missing source file/,
    );
  } finally {
    await rm(source.root, { recursive: true, force: true });
  }
});

test('source inventory rejects traversal and duplicate manifest paths', async () => {
  const source = await fixture();
  try {
    const entry = source.manifest.files[0];
    await assert.rejects(
      verifySourceInventory(
        source.root,
        { files: [{ ...entry, path: '../escape' }] },
        source.legalDigests,
      ),
      /unsafe manifest path/,
    );
    await assert.rejects(
      verifySourceInventory(
        source.root,
        { files: [entry, entry] },
        source.legalDigests,
      ),
      /duplicate manifest path/,
    );
  } finally {
    await rm(source.root, { recursive: true, force: true });
  }
});

test('source inventory rejects altered legal files and unlisted extras', async () => {
  const source = await fixture();
  try {
    await writeFile(join(source.root, 'NOTICE'), 'altered\n');
    await assert.rejects(
      verifySourceInventory(source.root, source.manifest, source.legalDigests),
      /legal file digest mismatch/,
    );
    await writeFile(join(source.root, 'NOTICE'), 'NOTICE\n');
    await writeFile(join(source.root, 'unlisted.txt'), 'extra\n');
    await assert.rejects(
      verifySourceInventory(source.root, source.manifest, source.legalDigests),
      /unexpected source file/,
    );
  } finally {
    await rm(source.root, { recursive: true, force: true });
  }
});
