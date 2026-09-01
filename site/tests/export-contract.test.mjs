import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { auditExport } from '../scripts/audit-export.mjs';

test('static export has required routes, metadata, and no remote runtime dependencies', async () => {
  assert.deepEqual(await auditExport(), []);
});

test('GitHub Pages markers are complete', async () => {
  await access('out/.nojekyll');
  assert.equal(await readFile('out/CNAME', 'utf8'), 'glitchpad.com\n');
});
