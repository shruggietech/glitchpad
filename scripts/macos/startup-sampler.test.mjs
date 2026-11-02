import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sampleStartup,
  pairedOrder,
  summarizeAttempts,
} from './startup-sampler.mjs';

const makeHarness = () => {
  let now = 0;
  const records = [];
  const stopped = [];
  const hooks = {
    launch: async () => {
      now += 100;
    },
    discover: async () => {
      now += 25;
      return 42;
    },
    shell: async () => {
      now += 500;
    },
    document: async () => {
      now += 100;
    },
    verify: async () => {},
    cleanup: async (pid) => {
      stopped.push(pid);
    },
  };
  return {
    hooks,
    records,
    stopped,
    options: {
      identity: 'candidate',
      index: 0,
      sequence: 0,
      clock: () => now,
      persist: async (r) => records.push(structuredClone(r)),
      hooks,
    },
  };
};

test('sampler separates shell and document readiness and cleans the owned process', async () => {
  const h = makeHarness();
  const result = await sampleStartup(h.options);
  assert.equal(result.shell_ready_ms, 625);
  assert.equal(result.phases_ms.document_ready, 725);
  assert.equal(result.launch_category, 'first_launch');
  assert.equal(result.status, 'pass');
  assert.equal(result.cleanup, 'pass');
  assert.deepEqual(h.stopped, [42]);
  assert.equal(h.records.at(-1).cleanup, 'pass');
});

test('a shell timeout retains failure evidence before returning and still cleans PID', async () => {
  const h = makeHarness();
  h.hooks.shell = async () => {
    throw new Error('application_shell_ready_timeout');
  };
  await assert.rejects(sampleStartup(h.options), /startup_attempt_failed/);
  const last = h.records.at(-1);
  assert.equal(last.status, 'failure');
  assert.equal(last.failure_phase, 'shell_wait');
  assert.equal(last.failure_code, 'application_shell_ready_timeout');
  assert.equal(last.cleanup, 'pass');
  assert.equal(last.shell_ready_ms, undefined);
  assert.deepEqual(h.stopped, [42]);
});

test('unobserved launch failure still invokes fallback cleanup and cannot leak error text', async () => {
  const h = makeHarness();
  h.hooks.discover = async () => {
    throw new Error('/Users/private-name/secret.pdf');
  };
  await assert.rejects(sampleStartup(h.options), /startup_attempt_failed/);
  assert.deepEqual(h.stopped, [null]);
  assert.equal(h.records.at(-1).failure_code, 'startup_operation_failed');
  assert.doesNotMatch(JSON.stringify(h.records), /private-name|secret.pdf/);
});

test('cleanup failure is retained and fails the attempt', async () => {
  const h = makeHarness();
  h.hooks.cleanup = async () => {
    throw new Error('private cleanup output');
  };
  await assert.rejects(sampleStartup(h.options), /startup_attempt_failed/);
  assert.equal(h.records.at(-1).cleanup, 'failure');
  assert.equal(h.records.at(-1).status, 'failure');
});

test('comparison interleaves AB/BA pairs and retains first launches', () => {
  const order = pairedOrder(6);
  assert.deepEqual(
    order.slice(0, 4).map((r) => r.identity),
    ['baseline', 'candidate', 'candidate', 'baseline'],
  );
  for (const identity of ['baseline', 'candidate']) {
    const rows = order.filter((r) => r.identity === identity);
    assert.deepEqual(
      rows.map((r) => r.index),
      [0, 1, 2, 3, 4, 5],
    );
  }
  assert.throws(() => pairedOrder(4), /startup_sample_count/);
});

test('summary preserves over-budget samples and independent reference/hosted outcomes', () => {
  const rows = [11000, 1000, 900, 800, 700].map((ms, index) => ({
    status: 'pass',
    cleanup: 'pass',
    shell_ready_ms: ms,
    index,
  }));
  const result = summarizeAttempts(rows);
  assert.deepEqual(result.samples_ms, [11000, 1000, 900, 800, 700]);
  assert.equal(result.p95_ms, 11000);
  assert.equal(result.reference_classification, 'failure');
  assert.equal(result.hosted_smoke, 'failure');
  assert.equal(result.first_launch_ms, 11000);
  assert.equal(result.subsequent_process_starts_p95_ms, 1000);
  assert.equal(
    summarizeAttempts([...rows, { status: 'failure', cleanup: 'pass' }])
      .campaign,
    'failure',
  );
});
