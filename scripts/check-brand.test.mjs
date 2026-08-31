import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { verifyBrand } from './check-brand.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the imported canon passes deterministic repository checks', async () => {
  assert.deepEqual(await verifyBrand(), []);
});

test('checksum drift is rejected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-brand-test-'));
  const brandRoot = join(root, 'brand');
  await mkdir(join(brandRoot, 'fonts', 'licenses'), { recursive: true });
  const payload = Buffer.from('canonical\n');
  await writeFile(join(brandRoot, 'asset.txt'), payload);
  await writeFile(
    join(brandRoot, 'fonts', 'licenses', 'OFL-Geist.txt'),
    'license\n',
  );
  await writeFile(
    join(brandRoot, 'fonts', 'licenses', 'OFL-Space-Grotesk.txt'),
    'license\n',
  );
  await writeFile(
    join(brandRoot, 'manifest.json'),
    JSON.stringify({
      name: 'glitchpad-brand-kit',
      version: '1.0.0',
      canon: '1.0.0',
      files: [
        {
          path: 'asset.txt',
          bytes: payload.byteLength,
          sha256: '0'.repeat(64),
        },
      ],
    }),
  );
  const problems = await verifyBrand(brandRoot, root);
  assert.ok(problems.some((problem) => problem.includes('checksum drift')));
  await rm(root, { recursive: true, force: true });
});

test('README uses canonical light and dark banner sources with fallback text', async () => {
  const readme = await readFile(join(repositoryRoot, 'README.md'), 'utf8');
  assert.match(readme, /<picture>/);
  assert.match(readme, /prefers-color-scheme:\s*dark/);
  assert.match(
    readme,
    /brand\/logos\/svg\/glitchpad-horizontal-(?:light|white)\.svg/,
  );
  assert.match(
    readme,
    /brand\/logos\/svg\/glitchpad-horizontal-(?:black|color)\.svg/,
  );
  assert.match(readme, /alt="Glitchpad"/);
  assert.match(readme, /^# Glitchpad$/m);
});
