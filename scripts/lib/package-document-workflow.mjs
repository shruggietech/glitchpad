import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export const workflowContract = JSON.parse(
  readFileSync(
    new URL(
      '../../packaging/desktop/document-workflow-probe.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
if (
  workflowContract.schema_version !== 1 ||
  workflowContract.method !== 'packaged_js_native_roundtrip' ||
  workflowContract.filename !== 'document-workflow.md' ||
  !isDeepStrictEqual(workflowContract.checks, [
    'read',
    'edit',
    'save',
    'metadata',
    'recovery',
  ])
)
  throw new Error('packaged_document_workflow_contract_invalid');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failure = () => new Error('packaged_document_workflow_evidence_invalid');
const expectedChecks = () =>
  Object.fromEntries(workflowContract.checks.map((key) => [key, 'pass']));
const expectedKeys = [
  'schema_version',
  'method',
  'checks',
  'input_sha256',
  'saved_sha256',
  'original_document_preserved',
  'owned_recovery_removed',
  'source_closed',
  'process_stopped',
  'probe_removed',
];

export function validateDocumentWorkflowProof(proof) {
  if (
    !proof ||
    !isDeepStrictEqual(Object.keys(proof).sort(), [...expectedKeys].sort()) ||
    proof.schema_version !== 1 ||
    proof.method !== workflowContract.method ||
    !isDeepStrictEqual(proof.checks, expectedChecks()) ||
    proof.input_sha256 !== digest(workflowContract.initial_text) ||
    proof.saved_sha256 !== digest(workflowContract.saved_text) ||
    [
      'original_document_preserved',
      'owned_recovery_removed',
      'source_closed',
      'process_stopped',
      'probe_removed',
    ].some((key) => proof[key] !== true)
  )
    throw failure();
  return true;
}

async function regularBytes(path) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 4096)
    throw failure();
  return readFile(path);
}

/** Separate package launch, deliberately excluded from startup samples. */
export async function runPackagedDocumentWorkflow({
  root,
  originalFixture,
  originalBytes,
  launch,
  stop,
  timeoutMs = 30000,
}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000)
    throw failure();
  if (digest(await regularBytes(originalFixture)) !== digest(originalBytes))
    throw failure();
  const probe = await mkdtemp(join(root, 'document-workflow-'));
  let process;
  let passed = false;
  try {
    await writeFile(join(probe, 'enabled.marker'), 'enabled\n');
    await writeFile(
      join(probe, workflowContract.filename),
      workflowContract.initial_text,
    );
    await writeFile(
      join(probe, 'document-workflow-request.marker'),
      'requested\n',
    );
    process = await launch(probe);
    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      const failed = await lstat(
        join(probe, 'document-workflow-failed.marker'),
      ).then(
        () => true,
        () => false,
      );
      if (failed) throw failure();
      const completed = await Promise.all(
        [
          'document-workflow-complete.marker',
          'document-workflow-ready.marker',
          ...workflowContract.checks.map(
            (check) => 'document-workflow-' + check + '.marker',
          ),
        ].map((name) =>
          regularBytes(join(probe, name)).catch((error) => {
            if (error.code === 'ENOENT') return null;
            throw error;
          }),
        ),
      );
      if (completed.every((bytes) => bytes !== null)) {
        if (
          completed.some((bytes) => bytes.toString('utf8') !== 'ready\n') ||
          (await regularBytes(join(probe, workflowContract.filename))).toString(
            'utf8',
          ) !== workflowContract.saved_text ||
          digest(await regularBytes(originalFixture)) !== digest(originalBytes)
        )
          throw failure();
        passed = true;
        break;
      }
      await delay(Math.min(25, timeoutMs));
    }
    if (!passed) throw new Error('packaged_document_workflow_timeout');
  } catch (error) {
    const observed = await Promise.all(
      workflowContract.checks.map(async (check) => ({
        check,
        observed: await regularBytes(
          join(probe, 'document-workflow-' + check + '.marker'),
        ).then(
          (bytes) => bytes.toString('utf8') === 'ready\n',
          () => false,
        ),
      })),
    );
    console.error('packaged_workflow_observations=' + JSON.stringify(observed));
    throw error;
  } finally {
    try {
      await stop(process);
    } finally {
      await rm(probe, { recursive: true, force: true });
    }
  }
  if (digest(await regularBytes(originalFixture)) !== digest(originalBytes))
    throw failure();
  const proof = {
    schema_version: 1,
    method: workflowContract.method,
    checks: expectedChecks(),
    input_sha256: digest(workflowContract.initial_text),
    saved_sha256: digest(workflowContract.saved_text),
    original_document_preserved: true,
    owned_recovery_removed: true,
    source_closed: true,
    process_stopped: true,
    probe_removed: true,
  };
  validateDocumentWorkflowProof(proof);
  return proof;
}
