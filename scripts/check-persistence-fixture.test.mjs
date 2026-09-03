import assert from 'node:assert/strict';
import test from 'node:test';

import { validatePersistenceCorpus, verifyPersistenceFixture } from './check-persistence-fixture.mjs';

test('repository persistence corpus and provenance pass', async () => {
  assert.deepEqual(await verifyPersistenceFixture(), []);
});

test('missing bounds and hostile cases fail closed', () => {
  const problems = validatePersistenceCorpus({ schema_version: 1, preference_cases: [], limits: {}, hostile_diagnostic_sentinels: [] });
  assert.ok(problems.some((problem) => problem.includes('status')));
  assert.ok(problems.some((problem) => problem.includes('hostile')));
  assert.ok(problems.some((problem) => problem.includes('failure case')));
  assert.ok(problems.some((problem) => problem.includes('lifecycle')));
  assert.ok(problems.some((problem) => problem.includes('limits')));
});

test('session projections cannot declare document payload fields', () => {
  const problems = validatePersistenceCorpus({
    schema_version: 1,
    preference_cases: ['loaded', 'migrated', 'unsupported'].map((expected_status) => ({ expected_status })),
    hostile_diagnostic_sentinels: Array.from({ length: 7 }, (_, index) => `hostile-${index}`),
    limits: { sessions: 32, language_overrides: 128, diagnostic_events: 2000, diagnostic_bytes: 2097152, diagnostic_age_ms: 604800000 },
    session_case: { content: 'forbidden' },
  });
  assert.ok(problems.some((problem) => problem.includes('forbidden field')));
});
