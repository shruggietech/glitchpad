import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runPackagedDocumentWorkflow,
  validateDocumentWorkflowProof,
  workflowContract,
} from './package-document-workflow.mjs';

async function scenario(mutate = async () => {}, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-workflow-test-'));
  const original = join(root, 'startup.md');
  const originalBytes = Buffer.from('original startup document\n');
  await writeFile(original, originalBytes);
  let stopped = false;
  let probe;
  try {
    const proof = await runPackagedDocumentWorkflow({
      root,
      originalFixture: original,
      originalBytes,
      timeoutMs: 25,
      launch: async (p) => {
        probe = p;
        assert.equal(
          await readFile(join(p, 'document-workflow-request.marker'), 'utf8'),
          'requested\n',
        );
        await writeFile(
          join(p, workflowContract.filename),
          workflowContract.saved_text,
        );
        await writeFile(
          join(p, 'document-workflow-complete.marker'),
          'ready\n',
        );
        await writeFile(join(p, 'document-workflow-ready.marker'), 'ready\n');
        for (const check of workflowContract.checks)
          await writeFile(
            join(p, 'document-workflow-' + check + '.marker'),
            'ready\n',
          );
        await mutate(p, original);
        return 7;
      },
      stop: async () => {
        stopped = true;
        if (options.stopFails) throw new Error('cleanup_failure');
      },
    });
    assert.equal(stopped, true);
    await assert.rejects(readFile(join(probe, workflowContract.filename)));
    assert.equal(await readFile(original, 'utf8'), originalBytes.toString());
    return proof;
  } finally {
    assert.equal(stopped, true);
    await rm(root, { recursive: true, force: true });
  }
}

test('observed packaged workflow binds exact synthetic bytes and cleanup outside startup samples', async () => {
  const proof = await scenario();
  assert.equal(validateDocumentWorkflowProof(proof), true);
  assert.equal(proof.method, 'packaged_js_native_roundtrip');
});

for (const [name, mutate] of [
  [
    'missing native completion',
    async (p) => rm(join(p, 'document-workflow-complete.marker')),
  ],
  [
    'missing observed read operation',
    async (p) => rm(join(p, 'document-workflow-read.marker')),
  ],
  [
    'missing completed callback',
    async (p) => rm(join(p, 'document-workflow-ready.marker')),
  ],
  [
    'incorrect marker bytes',
    async (p) =>
      writeFile(join(p, 'document-workflow-complete.marker'), 'wrong'),
  ],
  [
    'saved-byte mismatch',
    async (p) => writeFile(join(p, workflowContract.filename), 'wrong'),
  ],
  [
    'startup document mutation',
    async (_p, original) => writeFile(original, 'changed'),
  ],
  [
    'reported native failure',
    async (p) =>
      writeFile(join(p, 'document-workflow-failed.marker'), 'ready\n'),
  ],
])
  test('rejects ' + name + ' and stops the owned process', async () => {
    await assert.rejects(scenario(mutate));
  });

test('cleanup failure cannot produce a passing proof', async () => {
  await assert.rejects(scenario(undefined, { stopFails: true }));
});

test('receipt proof rejects missing/forged results and unrelated bytes', async () => {
  const proof = await scenario();
  assert.throws(() => validateDocumentWorkflowProof(null));
  assert.throws(() =>
    validateDocumentWorkflowProof({ ...proof, method: 'source_unit_tests' }),
  );
  assert.throws(() =>
    validateDocumentWorkflowProof({ ...proof, saved_sha256: 'a'.repeat(64) }),
  );
  assert.throws(() =>
    validateDocumentWorkflowProof({ ...proof, source_closed: false }),
  );
  for (const key of workflowContract.checks)
    assert.throws(() =>
      validateDocumentWorkflowProof({
        ...proof,
        checks: { ...proof.checks, [key]: 'not_run_candidate' },
      }),
    );
});
