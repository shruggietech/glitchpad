import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  verifyBrand,
  verifyIntegratedCopy,
  verifyBrandFreshness,
  verifyPngHeader,
  verifyPublicCopy,
  verifyReadmeBanner,
} from './check-brand.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const canonicalBanner = `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logos/png/glitchpad-horizontal-color-1024.png">
  <img src="brand/logos/png/glitchpad-horizontal-light-1024.png" alt="Glitchpad" width="480">
</picture>`;

function readmeWithCenteredBanner(banner, afterHeading = '') {
  return `<div align="center">
${banner}
# Glitchpad
</div>
${afterHeading}`;
}

test('the imported canon passes deterministic repository checks', async () => {
  assert.deepEqual(await verifyBrand(), []);
});

test('embedded brand guidance retains reachable pinned legal terms', async () => {
  const [readme, integrationSource] = await Promise.all([
    readFile(join(repositoryRoot, 'brand', 'README.md'), 'utf8'),
    readFile(join(repositoryRoot, 'brand', 'INTEGRATION.json'), 'utf8'),
  ]);
  const integration = JSON.parse(integrationSource);
  assert.doesNotMatch(readme, /\.\.\/\.\.\/LICENSE-BRAND\.md/);
  assert.match(
    readme,
    new RegExp(
      `shruggie-brand/${integration.sourceRevision}/LICENSE-BRAND\\.md`,
    ),
  );
});

test('system theme receives light brand tokens under a light OS', async () => {
  const styles = await readFile(
    join(repositoryRoot, 'apps', 'glitchpad', 'src', 'styles.css'),
    'utf8',
  );
  assert.match(styles, /:root\[data-theme='system'\] \{/);
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
      version: '1.1.0',
      canon: '1.2.1',
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
  assert.deepEqual(
    verifyReadmeBanner(readmeWithCenteredBanner(canonicalBanner)),
    [],
  );
});

test('README banner validation ignores unrelated pictures after the heading', () => {
  const readme = readmeWithCenteredBanner(
    canonicalBanner,
    '<picture><img src="docs/example.png" alt="Example"></picture>',
  );

  assert.deepEqual(verifyReadmeBanner(readme), []);
});

test('README banner validation rejects a picture outside the centered introduction', () => {
  const problems = verifyReadmeBanner(`${canonicalBanner}
<div align="center">
# Glitchpad
</div>
`);
  assert.ok(
    problems.some((problem) => problem.includes('centered introduction')),
  );
});

test('README banner validation rejects a picture hidden inside an HTML comment', () => {
  const problems = verifyReadmeBanner(
    readmeWithCenteredBanner(`<!--
${canonicalBanner}
-->`),
  );
  assert.ok(
    problems.some((problem) =>
      problem.includes('must not contain HTML comments'),
    ),
  );
});

for (const openingTag of [
  '<picture hidden>',
  '<picture style="display: none">',
]) {
  test(`README banner validation rejects ${openingTag}`, () => {
    const problems = verifyReadmeBanner(
      readmeWithCenteredBanner(
        canonicalBanner.replace('<picture>', openingTag),
      ),
    );
    assert.ok(
      problems.some((problem) =>
        problem.includes(
          'exactly one <picture> before the # Glitchpad heading',
        ),
      ),
    );
  });
}

test('README banner validation rejects reversed asset mappings', () => {
  const problems = verifyReadmeBanner(
    readmeWithCenteredBanner(`
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logos/png/glitchpad-horizontal-light-1024.png">
  <img src="brand/logos/png/glitchpad-horizontal-color-1024.png" alt="Glitchpad" width="480">
</picture>
`),
  );
  assert.ok(problems.some((problem) => problem.includes('dark source srcset')));
  assert.ok(problems.some((problem) => problem.includes('light fallback src')));
});

test('README banner validation rejects duplicate governed attributes', () => {
  const problems = verifyReadmeBanner(
    readmeWithCenteredBanner(`
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logos/png/glitchpad-horizontal-light-1024.png" srcset="brand/logos/png/glitchpad-horizontal-color-1024.png">
  <img src="brand/logos/png/glitchpad-horizontal-color-1024.png" src="brand/logos/png/glitchpad-horizontal-light-1024.png" alt="Glitchpad" width="480">
</picture>
`),
  );
  assert.ok(
    problems.some((problem) =>
      problem.includes('must not repeat the "srcset"'),
    ),
  );
  assert.ok(
    problems.some((problem) => problem.includes('must not repeat the "src"')),
  );
  assert.ok(problems.some((problem) => problem.includes('dark source srcset')));
  assert.ok(problems.some((problem) => problem.includes('light fallback src')));
});

test('README banner validation detects unquoted duplicate attributes', () => {
  const problems = verifyReadmeBanner(
    readmeWithCenteredBanner(`
<picture>
  <source media="(prefers-color-scheme: dark)" srcset=brand/logos/png/glitchpad-horizontal-light-1024.png srcset="brand/logos/png/glitchpad-horizontal-color-1024.png">
  <img src=brand/logos/png/glitchpad-horizontal-color-1024.png src="brand/logos/png/glitchpad-horizontal-light-1024.png" alt="Glitchpad" width="480">
</picture>
`),
  );
  assert.ok(
    problems.some((problem) =>
      problem.includes('must not repeat the "srcset"'),
    ),
  );
  assert.ok(
    problems.some((problem) => problem.includes('must not repeat the "src"')),
  );
  assert.ok(problems.some((problem) => problem.includes('dark source srcset')));
  assert.ok(problems.some((problem) => problem.includes('light fallback src')));
});

test('README banner validation detects valueless duplicate attributes', () => {
  const problems = verifyReadmeBanner(
    readmeWithCenteredBanner(`
<picture>
  <source media="(prefers-color-scheme: dark)" srcset srcset="brand/logos/png/glitchpad-horizontal-color-1024.png">
  <img src src="brand/logos/png/glitchpad-horizontal-light-1024.png" alt="Glitchpad" width="480">
</picture>
`),
  );
  assert.ok(
    problems.some((problem) =>
      problem.includes('must not repeat the "srcset"'),
    ),
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
    '<picture><img src="brand/logos/png/glitchpad-horizontal-light-1024.png" alt="Glitchpad" width="480"></picture>',
  ],
  [
    'duplicated',
    '<picture><source media="(prefers-color-scheme: dark)" srcset="brand/logos/png/glitchpad-horizontal-color-1024.png"><source media="(prefers-color-scheme: dark)" srcset="brand/logos/png/glitchpad-horizontal-color-1024.png"><img src="brand/logos/png/glitchpad-horizontal-light-1024.png" alt="Glitchpad" width="480"></picture>',
  ],
  [
    'detached',
    '<source media="(prefers-color-scheme: dark)" srcset="brand/logos/png/glitchpad-horizontal-color-1024.png"><picture><img src="brand/logos/png/glitchpad-horizontal-light-1024.png" alt="Glitchpad" width="480"></picture>',
  ],
]) {
  test(`README banner validation rejects ${name} direct children`, () => {
    const problems = verifyReadmeBanner(readmeWithCenteredBanner(markup));
    assert.ok(
      problems.some((problem) => problem.includes('one direct <source>')),
    );
  });
}

test('README banner validation rejects missing fallback semantics', () => {
  const problems = verifyReadmeBanner(
    readmeWithCenteredBanner(`
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logos/png/glitchpad-horizontal-color-1024.png">
  <img src="brand/logos/png/glitchpad-horizontal-light-1024.png" alt="" width="480">
</picture>
`),
  );
  assert.ok(
    problems.some((problem) => problem.includes('fallback alternative text')),
  );
});

test('README raster geometry rejects clipped or invalid assets', () => {
  const png = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(1024, 16);
  png.writeUInt32BE(259, 20);
  assert.deepEqual(verifyPngHeader(png, 'lockup.png'), []);
  png.writeUInt32BE(40, 16);
  assert.match(verifyPngHeader(png, 'lockup.png')[0], /unexpected 40x259/);
});

test('online freshness rejects same-version derivative drift', async () => {
  const payload = Buffer.from('current');
  const receipt = {
    publicComparisons: [
      {
        path: 'logos/provenance.json',
        url: 'https://brand.example/provenance.json',
        sha256: '0'.repeat(64),
      },
    ],
  };
  const problems = await verifyBrandFreshness(
    receipt,
    async () => new Response(payload, { status: 200 }),
  );
  assert.deepEqual(problems, ['upstream brand drift: logos/provenance.json']);
});

test('public copy validation accepts equality and rejects drift or absence', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-copy-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const canonical = join(root, 'canonical.svg');
  const integrated = join(root, 'integrated.svg');
  const label = 'site/public/logos/integrated.svg';
  await writeFile(canonical, '<svg>canonical</svg>\n');
  await writeFile(integrated, '<svg>canonical</svg>\n');
  assert.equal(verifyPublicCopy, verifyIntegratedCopy);
  assert.deepEqual(
    await verifyIntegratedCopy(canonical, integrated, label),
    [],
  );

  await writeFile(integrated, '<svg>drifted</svg>\n');
  assert.deepEqual(await verifyIntegratedCopy(canonical, integrated, label), [
    `integrated asset drift: ${label}`,
  ]);

  await rm(integrated);
  assert.deepEqual(await verifyIntegratedCopy(canonical, integrated, label), [
    `missing integrated asset copy: ${label}`,
  ]);
});
