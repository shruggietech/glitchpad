import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  verifyBrand,
  verifyPublicCopy,
  verifyReadmeBanner,
} from './check-brand.mjs';

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

test('README binds the canonical dark and light surface banners', async () => {
  const readme = await readFile(join(repositoryRoot, 'README.md'), 'utf8');
  assert.deepEqual(verifyReadmeBanner(readme), []);
  assert.match(readme, /^# Glitchpad$/m);
});

test('the exact README banner contract accepts one canonical picture', () => {
  const readme = `
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logos/svg/glitchpad-horizontal-white.svg">
  <img src="brand/logos/svg/glitchpad-horizontal-black.svg" alt="Glitchpad" width="480">
</picture>

# Glitchpad
`;

  assert.deepEqual(verifyReadmeBanner(readme), []);
});

test('README banner validation ignores unrelated pictures after the heading', () => {
  const readme = `
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logos/svg/glitchpad-horizontal-white.svg">
  <img src="brand/logos/svg/glitchpad-horizontal-black.svg" alt="Glitchpad" width="480">
</picture>

# Glitchpad

<picture><img src="docs/example.png" alt="Example"></picture>
`;

  assert.deepEqual(verifyReadmeBanner(readme), []);
});

test('README banner validation rejects reversed asset mappings', () => {
  const problems = verifyReadmeBanner(`
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logos/svg/glitchpad-horizontal-black.svg">
  <img src="brand/logos/svg/glitchpad-horizontal-white.svg" alt="Glitchpad" width="480">
</picture>
# Glitchpad
`);
  assert.ok(problems.some((problem) => problem.includes('dark source srcset')));
  assert.ok(problems.some((problem) => problem.includes('light fallback src')));
});

test('README banner validation rejects duplicate governed attributes', () => {
  const problems = verifyReadmeBanner(`
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logos/svg/glitchpad-horizontal-black.svg" srcset="brand/logos/svg/glitchpad-horizontal-white.svg">
  <img src="brand/logos/svg/glitchpad-horizontal-white.svg" src="brand/logos/svg/glitchpad-horizontal-black.svg" alt="Glitchpad" width="480">
</picture>
# Glitchpad
`);
  assert.ok(
    problems.some((problem) => problem.includes('must not repeat the "srcset"')),
  );
  assert.ok(
    problems.some((problem) => problem.includes('must not repeat the "src"')),
  );
  assert.ok(problems.some((problem) => problem.includes('dark source srcset')));
  assert.ok(problems.some((problem) => problem.includes('light fallback src')));
});

test('README banner validation detects unquoted duplicate attributes', () => {
  const problems = verifyReadmeBanner(`
<picture>
  <source media="(prefers-color-scheme: dark)" srcset=brand/logos/svg/glitchpad-horizontal-black.svg srcset="brand/logos/svg/glitchpad-horizontal-white.svg">
  <img src=brand/logos/svg/glitchpad-horizontal-white.svg src="brand/logos/svg/glitchpad-horizontal-black.svg" alt="Glitchpad" width="480">
</picture>
# Glitchpad
`);
  assert.ok(
    problems.some((problem) => problem.includes('must not repeat the "srcset"')),
  );
  assert.ok(
    problems.some((problem) => problem.includes('must not repeat the "src"')),
  );
  assert.ok(problems.some((problem) => problem.includes('dark source srcset')));
  assert.ok(problems.some((problem) => problem.includes('light fallback src')));
});

for (const [name, markup] of [
  [
    'missing',
    '<picture><img src="brand/logos/svg/glitchpad-horizontal-black.svg" alt="Glitchpad" width="480"></picture>',
  ],
  [
    'duplicated',
    '<picture><source media="(prefers-color-scheme: dark)" srcset="brand/logos/svg/glitchpad-horizontal-white.svg"><source media="(prefers-color-scheme: dark)" srcset="brand/logos/svg/glitchpad-horizontal-white.svg"><img src="brand/logos/svg/glitchpad-horizontal-black.svg" alt="Glitchpad" width="480"></picture>',
  ],
  [
    'detached',
    '<source media="(prefers-color-scheme: dark)" srcset="brand/logos/svg/glitchpad-horizontal-white.svg"><picture><img src="brand/logos/svg/glitchpad-horizontal-black.svg" alt="Glitchpad" width="480"></picture>',
  ],
]) {
  test(`README banner validation rejects ${name} direct children`, () => {
    const problems = verifyReadmeBanner(`${markup}\n# Glitchpad\n`);
    assert.ok(
      problems.some((problem) => problem.includes('one direct <source>')),
    );
  });
}

test('README banner validation rejects missing fallback semantics', () => {
  const problems = verifyReadmeBanner(`
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logos/svg/glitchpad-horizontal-white.svg">
  <img src="brand/logos/svg/glitchpad-horizontal-black.svg" alt="" width="480">
</picture>
# Glitchpad
`);
  assert.ok(
    problems.some((problem) => problem.includes('fallback alternative text')),
  );
});

test('public copy validation accepts equality and rejects drift or absence', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-copy-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const canonical = join(root, 'canonical.svg');
  const integrated = join(root, 'integrated.svg');
  const label = 'site/public/logos/integrated.svg';
  await writeFile(canonical, '<svg>canonical</svg>\n');
  await writeFile(integrated, '<svg>canonical</svg>\n');
  assert.deepEqual(await verifyPublicCopy(canonical, integrated, label), []);

  await writeFile(integrated, '<svg>drifted</svg>\n');
  assert.deepEqual(await verifyPublicCopy(canonical, integrated, label), [
    `site asset drift: ${label}`,
  ]);

  await rm(integrated);
  assert.deepEqual(await verifyPublicCopy(canonical, integrated, label), [
    `missing site asset copy: ${label}`,
  ]);
});
