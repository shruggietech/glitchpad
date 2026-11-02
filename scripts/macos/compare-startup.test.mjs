import assert from 'node:assert/strict';
import test from 'node:test';
import {
  baselineIdentity,
  validateBaselineIdentity,
  compareCampaign,
} from './compare-startup.mjs';
import { pairedOrder } from './startup-sampler.mjs';

test('historical package identity refuses different bytes or source', () => {
  const manifest = {
    version: '0.1.4',
    source_commit: baselineIdentity.source_commit,
    artifact: { sha256: baselineIdentity.dmg_sha256 },
  };
  validateBaselineIdentity(manifest);
  assert.throws(
    () =>
      validateBaselineIdentity({ ...manifest, source_commit: 'a'.repeat(40) }),
    /baseline_identity_mismatch/,
  );
  assert.throws(
    () =>
      validateBaselineIdentity({
        ...manifest,
        artifact: { sha256: 'b'.repeat(64) },
      }),
    /baseline_identity_mismatch/,
  );
});

test('an incomplete planned campaign cannot pass with five earlier samples', async () => {
  const journal = {
    attempts: [],
    persist: async function (row) {
      this.attempts.push(row);
    },
  };
  const measure = async (row) => {
    if (row.sequence === 11) throw Error('failure before first record');
    journal.attempts.push({
      ...row,
      status: 'pass',
      cleanup: 'pass',
      shell_ready_ms: 900,
    });
  };
  const result = await compareCampaign({
    order: pairedOrder(6),
    packages: { baseline: {}, candidate: {} },
    journal,
    measure,
  });
  assert.equal(result.baseline.planned, 6);
  assert.equal(result.baseline.campaign, 'failure');
});

test('a failed attempt with successful cleanup is retained and later attempts still run', async () => {
  const journal = { attempts: [], persist: async () => {} };
  const measure = async (row) => {
    const failed = row.sequence === 0;
    journal.attempts.push({
      identity: row.identity,
      index: row.index,
      sequence: row.sequence,
      status: failed ? 'failure' : 'pass',
      cleanup: 'pass',
      ...(failed ? {} : { shell_ready_ms: 900 }),
    });
    if (failed) throw Error('startup_attempt_failed');
  };
  const result = await compareCampaign({
    order: pairedOrder(6),
    packages: { baseline: {}, candidate: {} },
    journal,
    measure,
  });
  assert.equal(journal.attempts.length, 12);
  assert.equal(result.baseline.campaign, 'failure');
  assert.equal(result.baseline.reference_classification, 'unavailable');
  assert.equal(result.candidate.campaign, 'pass');
});
