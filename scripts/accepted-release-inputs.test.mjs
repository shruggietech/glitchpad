import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { releaseIdentity } from './lib/release-identity.mjs';
import {
  stagingWorkflows,
  requiredStagingArtifacts,
  validateAcceptedInputs,
  validateAcceptedRun,
  validateAcceptedArtifact,
  validateAcceptedJobs,
  verifyAcceptedPayloads,
} from './accepted-release-inputs.mjs';

const source = 'a'.repeat(40);
const bytes = Buffer.from('independently accepted payload bytes');
const digest = createHash('sha256').update(bytes).digest('hex');
function accepted() {
  let id = 100,
    run = 10;
  return {
    schema: 1,
    version: releaseIdentity.version,
    tag: releaseIdentity.tag,
    repository: releaseIdentity.repository,
    accepted_source_commit: source,
    publication_context: 'qualified_preparation_unpublished',
    documentation_pass:{path:'docs/releases/'+releaseIdentity.tag+'-documentation-pass.json',sha256:digest},
    implementation_pull_request:{number:500,head_sha:source},
    ci: { workflow: 'ci.yml', run_id: 1, run_attempt: 1 },
    platforms: Object.fromEntries(
      Object.entries(stagingWorkflows).map(([platform, workflow]) => [
        platform,
        {
          workflow,
          run_id: run++,
          run_attempt: 1,
          source_ref: 'refs/heads/codex/048-test',
          artifacts: requiredStagingArtifacts(platform).map((name) => ({
            id: id++,
            name,
            size_in_bytes: 123,
            digest: 'sha256:' + digest,
            created_at: '2026-11-08T12:02:00Z',
          })),
        },
      ]),
    ),
    payloads: releaseIdentity.artifacts.map((name) => ({
      name,
      bytes: bytes.length,
      sha256: digest,
      source_commit: source,
    })),
  };
}
test('accepted inputs require all platform runs, immutable artifact sets and eight source-bound payloads', () => {
  validateAcceptedInputs(accepted(), source);
  const mutations = [
    (record) => (record.accepted_source_commit = 'b'.repeat(40)),
    (record) => (record.version = '0.2.0'),
    (record) => delete record.platforms.android,
    (record) =>
      (record.platforms.macos.run_id = record.platforms.windows.run_id),
    (record) => record.platforms.linux.artifacts.pop(),
    (record) =>
      (record.platforms.windows.artifacts[0].id =
        record.platforms.macos.artifacts[0].id),
    (record) => (record.platforms.windows.artifacts[0].digest = 'unhashed'),
    (record) => record.payloads.pop(),
    (record) => (record.payloads[0] = { ...record.payloads[1] }),
    (record) => (record.payloads[0].source_commit = 'b'.repeat(40)),
    (record) => (record.publication_context = 'published'),
    (record) => delete record.ci,
    (record) => delete record.documentation_pass,
    (record) => (record.documentation_pass.sha256="unhashed"),
    (record) => delete record.implementation_pull_request,
    (record) => (record.implementation_pull_request.head_sha="b".repeat(40)),
  ];
  for (const mutate of mutations) {
    const record = accepted();
    mutate(record);
    assert.throws(() => validateAcceptedInputs(record, source));
  }
});
test('a successful older attempt or different source cannot qualify the selected staging run', () => {
  const input = accepted().platforms.windows;
  const run = {
    id: input.run_id,
    run_attempt: 1,
    status: 'completed',
    conclusion: 'success',
    head_sha: source,
    event: 'workflow_dispatch',
    path: '.github/workflows/windows-package.yml',
    head_branch: 'codex/048-test',
  };
  validateAcceptedRun(run, input, source);
  for (const changed of [
    { run_attempt: 2 },
    { conclusion: 'failure' },
    { status: 'in_progress' },
    { head_sha: 'b'.repeat(40) },
    { event: 'push' },
    { path: '.github/workflows/ci.yml' },
    { head_branch: 'main' },
  ])
    assert.throws(() =>
      validateAcceptedRun({ ...run, ...changed }, input, source),
    );
});
test('artifact IDs, archives, source and creation time must match the selected latest attempt', () => {
  const expected = accepted().platforms.windows.artifacts[0];
  const run = {
    id: 10,
    run_started_at: '2026-11-08T12:01:00Z',
    updated_at: '2026-11-08T12:03:00Z',
  };
  const actual = {
    ...expected,
    expired: false,
    workflow_run: { id: 10, head_sha: source },
  };
  validateAcceptedArtifact(actual, expected, run, source);
  for (const changed of [
    { id: 200 },
    { digest: 'sha256:' + 'b'.repeat(64) },
    { size_in_bytes: 124 },
    { created_at: '2026-11-08T12:00:00Z' },
    { expired: true },
    { workflow_run: { id: 11, head_sha: source } },
    { workflow_run: { id: 10, head_sha: 'b'.repeat(40) } },
  ])
    assert.throws(() =>
      validateAcceptedArtifact(
        { ...actual, ...changed },
        expected,
        run,
        source,
      ),
    );
  assert.throws(
    () =>
      validateAcceptedArtifact(
        actual,
        expected,
        { ...run, run_started_at: '2026-11-08T12:02:30Z' },
        source,
      ),
    /outside selected attempt/u,
  );
});
test('the required full CI and both installed release APIs must finish successfully', () => {
  const job = (name) => ({ name, status: 'completed', conclusion: 'success' });
  validateAcceptedJobs([job('ci-ok')], 'ci');
  validateAcceptedJobs(
    [
      job('Signed Android candidate artifacts'),
      job('Installed minified release API 24'),
      job('Installed minified release API 36'),
    ],
    'android',
  );
  assert.throws(
    () => validateAcceptedJobs([job('back_diagnostic-ci')], 'ci'),
    /ci-ok/u,
  );
  assert.throws(
    () =>
      validateAcceptedJobs(
        [
          job('Signed Android candidate artifacts'),
          job('Installed minified release API 24'),
        ],
        'android',
      ),
    /API 36/u,
  );
  assert.throws(
    () =>
      validateAcceptedJobs(
        [job('ci-ok'), { ...job('required'), conclusion: 'failure' }],
        'ci',
      ),
    /failed job/u,
  );
});
test('accepted payloads are independently rehashed and reject missing, duplicate or changed bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 's048-accepted-'));
  try {
    const record = accepted();
    for (const payload of record.payloads)
      await writeFile(join(root, payload.name), bytes);
    await verifyAcceptedPayloads(root, record);
    await writeFile(
      join(root, record.payloads[0].name),
      Buffer.alloc(bytes.length, 0),
    );
    await assert.rejects(
      verifyAcceptedPayloads(root, record),
      /byte readback/u,
    );
    await writeFile(join(root, record.payloads[0].name), bytes);
    await mkdir(join(root, 'duplicate'));
    await copyFile(
      join(root, record.payloads[0].name),
      join(root, 'duplicate', record.payloads[0].name),
    );
    await assert.rejects(verifyAcceptedPayloads(root, record), /duplicated/u);
    await rm(join(root, 'duplicate'), { recursive: true });
    await rm(join(root, record.payloads[0].name));
    await assert.rejects(verifyAcceptedPayloads(root, record), /missing/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
