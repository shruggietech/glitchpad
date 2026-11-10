import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { validateAcceptedRehearsal } from './check-community-release.mjs';
const source = readFileSync(
  new URL('../.github/workflows/release.yml', import.meta.url),
  'utf8',
);
test('actual release rehearsal is manual, read-only and consumes accepted bytes', () =>
  assert.equal(validateAcceptedRehearsal(source), true));
for (const [name, change] of [
  [
    'automatic execution',
    (w) => {
      w.jobs.rehearse.if = 'always()';
    },
  ],
  [
    'write authority',
    (w) => {
      w.jobs.rehearse.permissions.contents = 'write';
    },
  ],
  [
    'publication command',
    (w) => {
      w.jobs.rehearse.steps.push({ run: 'gh release create v9.9.9' });
    },
  ],
  [
    'rebuild command',
    (w) => {
      w.jobs.rehearse.steps.push({ run: 'cargo build --release' });
    },
  ],
]) {
  test('rejects rehearsal ' + name, () => {
    const w = parse(source);
    change(w);
    assert.throws(() => validateAcceptedRehearsal(stringify(w)));
  });
}
