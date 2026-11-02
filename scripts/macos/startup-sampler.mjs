import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const knownFailures = new Set([
  'application_launch_timeout',
  'application_shell_ready_timeout',
  'application_interactive_ready_timeout',
  'delivery_acknowledgement_duplicate',
  'delivery_acknowledgement_timeout',
  'application_cleanup_failed',
]);

export async function sampleStartup({
  identity,
  index,
  sequence,
  hooks,
  persist,
  clock = () => performance.now(),
}) {
  if (
    !['baseline', 'candidate'].includes(identity) ||
    !Number.isSafeInteger(index) ||
    index < 0 ||
    !Number.isSafeInteger(sequence) ||
    sequence < 0
  )
    throw new Error('startup_identity_invalid');
  const started = clock();
  const attempt = {
    identity,
    index,
    sequence,
    launch_category:
      index === 0 ? 'first_launch' : 'process_restart_warm_os_caches',
    status: 'running',
    cleanup: 'pending',
    phases_ms: {},
  };
  let pid = null;
  let phase = 'launch_requested';
  const record = async (next) => {
    phase = next;
    attempt.phases_ms[next] = Math.round(clock() - started);
    await persist(structuredClone(attempt));
  };
  try {
    await record('launch_requested');
    await hooks.launch();
    await record('launch_command_exited');
    phase = 'process_wait';
    pid = await hooks.discover();
    await record('process_observed');
    phase = 'shell_wait';
    await hooks.shell();
    attempt.shell_ready_ms = Math.round(clock() - started);
    await record('shell_ready');
    phase = 'document_wait';
    await hooks.document();
    await record('document_ready');
    phase = 'delivery_verification';
    await hooks.verify();
    await record('delivery_verified');
    attempt.status = 'pass';
  } catch (error) {
    attempt.status = 'failure';
    attempt.failure_phase = phase;
    attempt.failure_code = knownFailures.has(error?.message)
      ? error.message
      : 'startup_operation_failed';
  } finally {
    try {
      await hooks.cleanup(pid);
      attempt.cleanup = 'pass';
    } catch {
      attempt.cleanup = 'failure';
      attempt.status = 'failure';
      attempt.failure_phase ??= 'cleanup';
      attempt.failure_code ??= 'application_cleanup_failed';
    }
    attempt.phases_ms.cleanup_completed = Math.round(clock() - started);
    await persist(structuredClone(attempt));
  }
  if (attempt.status !== 'pass') throw new Error('startup_attempt_failed');
  return attempt;
}

export function pairedOrder(count = 6) {
  if (!Number.isSafeInteger(count) || count < 5 || count > 20)
    throw new Error('startup_sample_count');
  const indices = { baseline: 0, candidate: 0 };
  const order = [];
  for (let pair = 0; pair < count; pair += 1) {
    for (const identity of pair % 2 === 0
      ? ['baseline', 'candidate']
      : ['candidate', 'baseline'])
      order.push({
        identity,
        index: indices[identity]++,
        sequence: order.length,
      });
  }
  return order;
}

const p95 = (values) => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(ordered.length * 0.95) - 1];
};
export function summarizeAttempts(attempts, hardLimit = 10000) {
  const successful = attempts.filter(
    (r) =>
      r.status === 'pass' &&
      r.cleanup === 'pass' &&
      Number.isFinite(r.shell_ready_ms) &&
      r.shell_ready_ms >= 0,
  );
  const samples = successful.map((r) => r.shell_ready_ms);
  const percentile = p95(samples);
  const complete = successful.length === attempts.length && samples.length >= 5;
  const hosted = complete && percentile <= hardLimit ? 'pass' : 'failure';
  return {
    campaign: hosted,
    attempted: attempts.length,
    successful: successful.length,
    samples_ms: samples,
    p95_ms: percentile,
    reference_classification:
      !complete || percentile === null
        ? 'unavailable'
        : percentile <= 1500
          ? 'pass'
          : percentile <= 2500
            ? 'warning'
            : 'failure',
    hosted_smoke: hosted,
    hosted_smoke_hard_limit_ms: hardLimit,
    first_launch_ms:
      successful.find((r) => r.index === 0)?.shell_ready_ms ?? null,
    subsequent_process_starts_p95_ms: p95(
      successful.filter((r) => r.index > 0).map((r) => r.shell_ready_ms),
    ),
  };
}

export async function createStartupJournal(receiptPath, context) {
  const attempts = [];
  const persist = async (attempt) => {
    const index = attempts.findIndex((r) => r.sequence === attempt.sequence);
    if (index < 0) attempts.push(attempt);
    else attempts[index] = attempt;
    attempts.sort((a, b) => a.sequence - b.sequence);
    await mkdir(dirname(receiptPath), { recursive: true });
    await writeFile(
      receiptPath + '.tmp',
      JSON.stringify({ schema_version: 1, ...context, attempts }, null, 2) +
        '\n',
      'utf8',
    );
    await rename(receiptPath + '.tmp', receiptPath);
  };
  return { attempts, persist };
}
