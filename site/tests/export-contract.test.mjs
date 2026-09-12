import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { auditExport, decodeHtmlAttribute } from '../scripts/audit-export.mjs';

test('HTML attribute decoding is single pass with ampersands decoded last', () => {
  assert.equal(decodeHtmlAttribute('&quot;section&quot;'), '"section"');
  assert.equal(
    decodeHtmlAttribute('&amp;quot;section&amp;quot;'),
    '&quot;section&quot;',
  );
});

test('static export has required routes, metadata, and no remote runtime dependencies', async () => {
  assert.deepEqual(await auditExport(), []);
});

test('generated documentation manifest covers the complete ordered route set', async () => {
  const manifest = JSON.parse(
    await readFile('lib/generated/documentation.json', 'utf8'),
  );
  assert.equal(manifest.source, 'docs/glitchpad-technical-specification.md');
  assert.equal(manifest.sections.length, 38);
  assert.deepEqual(
    manifest.sections.map(({ number }) => number),
    Array.from({ length: 38 }, (_, index) => index + 1),
  );
  for (const section of manifest.sections)
    await access(`out${section.route}.html`);
});

test('GitHub Pages markers are complete', async () => {
  await access('out/.nojekyll');
  assert.equal(await readFile('out/CNAME', 'utf8'), 'glitchpad.com\n');
  const deployment = JSON.parse(await readFile('out/deployment.json', 'utf8'));
  assert.equal(deployment.productVersion, '0.1.3');
  assert.match(deployment.sourceRevision, /^(?:local|[0-9a-f]{40})$/);
  assert.equal(
    deployment.releaseUrl,
    'https://github.com/ShruggieTech/glitchpad/releases/tag/v0.1.3',
  );
  assert.ok(Number.isFinite(Date.parse(deployment.builtAt)));
});
