import assert from 'node:assert/strict';
import test from 'node:test';

import { validateMetadataCorpus, verifyMetadataFixture } from './check-metadata-fixture.mjs';

test('repository metadata corpus and provenance pass', async () => {
  assert.deepEqual(await verifyMetadataFixture(), []);
});

test('missing state and unsafe declarations fail closed', () => {
  const problems = validateMetadataCorpus({schema_version: 1, cases: [], hostile_values: [], expected: {}});
  assert.ok(problems.some((problem) => problem.includes('availability state')));
  assert.ok(problems.some((problem) => problem.includes('native locator')));
});

test('unknown catalog keys fail closed', () => {
  const corpus = {
    schema_version: 1,
    cases: [
      ...['available', 'not_provided', 'unsupported', 'redacted', 'pending', 'errored'].map((availability) => ({
        key: availability === 'available' ? 'unknown.fact' : 'host.display_name',
        availability,
        copy_policy: availability === 'redacted' ? 'denied' : availability === 'pending' ? 'explicit_confirmation' : 'direct',
      })),
    ],
    hostile_values: ['1', '2', '3', '4', '5', '6'],
    expected: { hostile_values_render_as_text: true, native_locators_are_never_catalog_values: true },
  };
  expectProblems(validateMetadataCorpus(corpus, new Set(['host.display_name'])), 'unknown catalog key');
});

function expectProblems(problems, fragment) {
  assert.ok(problems.some((problem) => problem.includes(fragment)));
}
