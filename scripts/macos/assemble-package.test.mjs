import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  assertSafeOutputRoot,
  collectApplicationInventory,
  normalizeArchitectures,
} from './assemble-package.mjs';

test('architecture normalization requires exactly the universal slices', () => {
  assert.deepEqual(normalizeArchitectures('x86_64 arm64'), ['arm64', 'x86_64']);
  assert.throws(() => normalizeArchitectures('arm64'), /universal executable/u);
  assert.throws(
    () => normalizeArchitectures('arm64 x86_64 i386'),
    /universal executable/u,
  );
});

test('output staging rejects reuse and broad destructive targets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-macos-staging-'));
  try {
    await assert.rejects(assertSafeOutputRoot(root), /already exists/u);
    await assert.rejects(assertSafeOutputRoot('/'), /unsafe output root/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('application inventory is stable, path-safe, and detects executable content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-app-inventory-'));
  try {
    await mkdir(join(root, 'Contents', 'MacOS'), { recursive: true });
    await mkdir(join(root, 'Contents', 'Resources'), { recursive: true });
    await writeFile(
      join(root, 'Contents', 'MacOS', 'glitchpad-host'),
      'binary',
      { mode: 0o755 },
    );
    await writeFile(join(root, 'Contents', 'Resources', 'NOTICE'), 'notice');
    const inventory = await collectApplicationInventory(root);
    assert.deepEqual(
      inventory.map(({ relative_path }) => relative_path),
      ['Contents/MacOS/glitchpad-host', 'Contents/Resources/NOTICE'],
    );
    assert.equal(inventory[0].executable, true);
    assert.equal(inventory[0].role, 'executable');
    assert.equal(inventory[1].executable, false);
    assert.equal(inventory[1].role, 'resource');
    assert.match(inventory[0].sha256, /^[a-f0-9]{64}$/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
