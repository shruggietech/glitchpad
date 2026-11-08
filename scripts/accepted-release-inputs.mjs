import { verifyRepositoryAttestations } from './check-linux-package.mjs';
import assert from 'node:assert/strict';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { releaseIdentity } from './lib/release-identity.mjs';
import {
  hashReleaseFile,
  validateReleaseDirectory,
} from './validate-android-release-evidence.mjs';

export const stagingWorkflows = Object.freeze({
  windows: 'windows-package.yml',
  macos: 'macos-package.yml',
  linux: 'linux-package.yml',
  android: 'android-package.yml',
});
export function requiredStagingArtifacts(platform) {
  const prefix = 'glitchpad-' + releaseIdentity.version + '-';
  return {
    windows: [prefix + 'windows-x86_64-community-release'],
    macos: [
      prefix + 'macos-universal-community-release',
      'glitchpad-macos-clean-host-arm64',
      'glitchpad-macos-clean-host-x86_64',
    ],
    linux: [
      prefix + 'linux-x86_64-community-release',
      ...['22.04', '24.04'].flatMap((version) =>
        ['appimage', 'deb'].map(
          (form) => 'glitchpad-linux-clean-ubuntu-' + version + '-' + form,
        ),
      ),
    ],
    android: [
      prefix + 'android-community-release',
      'android-minified-release-inputs',
      'android-minified-release-runtime-api-24',
      'android-minified-release-runtime-api-36',
    ],
  }[platform];
}
function required(condition, message) {
  if (!condition) throw new Error(message);
}
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const fullSha = (value) =>
  typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
const hash = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
function sameSet(actual, expected) {
  return (
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    expected.every((value) => actual.includes(value))
  );
}
export function validateAcceptedInputs(record, source) {
  required(
    record?.schema === 1 &&
      record.version === releaseIdentity.version &&
      record.tag === releaseIdentity.tag &&
      record.repository?.toLowerCase() ===
        releaseIdentity.repository.toLowerCase(),
    'accepted release identity mismatch',
  );
  required(
    fullSha(source) && record.accepted_source_commit === source,
    'accepted source does not match the tag checkout',
  );
  required(
    record.publication_context === 'qualified_preparation_unpublished',
    'accepted inputs must describe qualified unpublished preparation',
  );
  required(
    record.ci?.workflow === 'ci.yml' &&
      positive(record.ci.run_id) &&
      positive(record.ci.run_attempt),
    'accepted exact-source CI input missing',
  );
  required(
    record.platforms &&
      sameSet(Object.keys(record.platforms), Object.keys(stagingWorkflows)),
    'complete unique platform inputs required',
  );
  const ids = new Set();
  const runs = new Set([record.ci.run_id]);
  for (const [platform, workflow] of Object.entries(stagingWorkflows)) {
    const input = record.platforms[platform];
    required(
      input.workflow === workflow &&
        positive(input.run_id) &&
        positive(input.run_attempt) &&
        /^refs\/heads\/[A-Za-z0-9_./-]+$/u.test(input.source_ref ?? ''),
      'invalid accepted platform run: ' + platform,
    );
    required(!runs.has(input.run_id), 'duplicate accepted run');
    runs.add(input.run_id);
    required(
      Array.isArray(input.artifacts) &&
        sameSet(
          input.artifacts.map((row) => row.name),
          requiredStagingArtifacts(platform),
        ),
      'accepted artifact set incomplete/duplicate: ' + platform,
    );
    for (const artifact of input.artifacts) {
      required(
        positive(artifact.id) &&
          !ids.has(artifact.id) &&
          positive(artifact.size_in_bytes) &&
          /^sha256:[a-f0-9]{64}$/u.test(artifact.digest ?? '') &&
          typeof artifact.created_at === 'string' &&
          Number.isFinite(Date.parse(artifact.created_at)),
        'invalid accepted artifact identity: ' + platform,
      );
      ids.add(artifact.id);
    }
  }
  required(
    Array.isArray(record.payloads) &&
      sameSet(
        record.payloads.map((row) => row.name),
        releaseIdentity.artifacts,
      ),
    'all eight unique accepted payloads required',
  );
  for (const payload of record.payloads)
    required(
      positive(payload.bytes) &&
        hash(payload.sha256) &&
        payload.source_commit === source,
      'invalid accepted payload bytes/source',
    );
  return record;
}
export function validateAcceptedRun(run, input, source, { ci = false } = {}) {
  required(
    run.id === input.run_id &&
      run.run_attempt === input.run_attempt &&
      run.status === 'completed' &&
      run.conclusion === 'success' &&
      run.head_sha === source &&
      run.event === 'workflow_dispatch' &&
      run.path === '.github/workflows/' + input.workflow,
    'accepted run/source/latest-attempt mismatch',
  );
  if (!ci)
    required(
      'refs/heads/' + run.head_branch === input.source_ref,
      'accepted staging branch mismatch',
    );
}
export function validateAcceptedArtifact(actual, expected, run, source) {
  for (const key of ['id', 'name', 'size_in_bytes', 'digest', 'created_at'])
    required(
      actual[key] === expected[key],
      'accepted artifact metadata mismatch: ' + key,
    );
  required(
    actual.expired === false &&
      actual.workflow_run?.id === run.id &&
      actual.workflow_run.head_sha === source,
    'accepted artifact run/source/expiration mismatch',
  );
  required(
    Date.parse(actual.created_at) >= Date.parse(run.run_started_at) &&
      Date.parse(actual.created_at) <= Date.parse(run.updated_at),
    'accepted artifact is outside selected attempt',
  );
}
export function validateAcceptedJobs(jobs, platform) {
  const requiredNames = {
    ci: ['ci-ok'],
    windows: ['Windows 11 x86_64 candidate'],
    macos: [
      'macOS universal candidate',
      'Native lifecycle (arm64)',
      'Native lifecycle (x86_64)',
    ],
    linux: [
      'Ubuntu 22.04 x86_64 candidate',
      ...['22.04', '24.04'].flatMap((version) =>
        ['appimage', 'deb'].map(
          (form) => 'Clean Ubuntu ' + version + ' ' + form + ' lifecycle',
        ),
      ),
    ],
    android: [
      'Signed Android candidate artifacts',
      'Installed minified release API 24',
      'Installed minified release API 36',
    ],
  }[platform];
  for (const name of requiredNames)
    required(
      jobs.filter(
        (job) =>
          job.name === name &&
          job.status === 'completed' &&
          job.conclusion === 'success',
      ).length === 1,
      'required exact-source job did not pass: ' + name,
    );
  required(
    jobs.every(
      (job) =>
        job.status === 'completed' &&
        ['success', 'skipped'].includes(job.conclusion),
    ),
    'accepted run contains an unfinished or failed job',
  );
}
async function allFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    required(
      !entry.isSymbolicLink(),
      'accepted evidence must use regular files/directories',
    );
    if (entry.isDirectory()) result.push(...(await allFiles(path)));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}
export async function verifyAcceptedPayloads(directory, record) {
  const files = await allFiles(directory);
  for (const payload of record.payloads) {
    const matches = files.filter(
      (path) => path.split(/[\\/]/u).at(-1) === payload.name,
    );
    required(
      matches.length === 1,
      'accepted payload missing/duplicated: ' + payload.name,
    );
    required(
      (await stat(matches[0])).size === payload.bytes &&
        (await hashReleaseFile(matches[0])) === payload.sha256,
      'accepted payload byte readback mismatch: ' + payload.name,
    );
  }
  return files;
}
async function verifyAndroidRuntime(files, record) {
  const name =
    'glitchpad-' + releaseIdentity.version + '-android-universal.apk';
  const application = files.find(
    (path) => path.split(/[\\/]/u).at(-1) === name,
  );
  const tests = files.filter(
    (path) => path.split(/[\\/]/u).at(-1) === 'instrumentation.apk',
  );
  required(
    tests.length === 1,
    'accepted release instrumentation missing/duplicated',
  );
  execFileSync(
    'python3',
    [
      fileURLToPath(
        new URL('./android/check-release-test-notices.py', import.meta.url),
      ),
      '--apk',
      tests[0],
    ],
    { stdio: 'pipe', windowsHide: true, timeout: 30000 },
  );
  const summaries = files.filter(
    (path) => path.split(/[\\/]/u).at(-1) === 'release-runtime.json',
  );
  required(summaries.length === 2, 'both installed release APIs required');
  const apis = new Set();
  const configured = (process.env.ANDROID_SIGNING_CERT_SHA256 ?? '')
    .replaceAll(':', '')
    .toLowerCase();
  required(
    hash(configured),
    'configured stable certificate fingerprint required',
  );
  for (const path of summaries) {
    const claimed = JSON.parse(await readFile(path, 'utf8'));
    required(
      [24, 36].includes(claimed.api) && !apis.has(claimed.api),
      'duplicate/wrong installed release API',
    );
    apis.add(claimed.api);
    const observed = await validateReleaseDirectory({
      directory: dirname(path),
      source: record.accepted_source_commit,
      api: claimed.api,
      application,
      instrumentation: tests[0],
    });
    assert.deepEqual(
      observed,
      claimed,
      'retained runtime summary must match independent capture readback',
    );
    required(
      observed.signing_certificate_sha256 === configured,
      'installed release signer differs from configured stable authority',
    );
  }
}
async function api(path, token) {
  const response = await fetch(
    'https://api.github.com/repos/shruggietech/glitchpad/' + path,
    {
      headers: {
        authorization: 'Bearer ' + token,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
      signal: AbortSignal.timeout(path.endsWith('/zip') ? 180000 : 30000),
    },
  );
  required(
    response.ok,
    'GitHub accepted-input lookup failed: HTTP ' + response.status,
  );
  return response;
}
async function pages(path, key, token) {
  const rows = [];
  for (let page = 1; page <= 20; page++) {
    const result = await (
      await api(
        path + (path.includes('?') ? '&' : '?') + 'per_page=100&page=' + page,
        token,
      )
    ).json();
    rows.push(...result[key]);
    if (result[key].length < 100) return rows;
  }
  throw new Error('accepted-input pagination exceeded its bound');
}
const extractionProgram = [
  'import pathlib, shutil, stat, sys, zipfile',
  'archive, destination = sys.argv[1:]',
  'root=pathlib.Path(destination)',
  'root.mkdir(parents=True, exist_ok=False)',
  'with zipfile.ZipFile(archive) as source:',
  '    for entry in source.infolist():',
  '        path=pathlib.PurePosixPath(entry.filename)',
  "        if path.is_absolute() or '..' in path.parts or '\\\\' in entry.filename or stat.S_ISLNK(entry.external_attr >> 16):",
  "            raise ValueError('invalid accepted artifact path')",
  '        target=root.joinpath(*path.parts)',
  '        if entry.is_dir():',
  '            target.mkdir(parents=True, exist_ok=True)',
  '        else:',
  '            target.parent.mkdir(parents=True, exist_ok=True)',
  "            with source.open(entry) as input, target.open('xb') as output:",
  '                shutil.copyfileobj(input, output, 1024 * 1024)',
].join('\n');
export async function consumeAcceptedInputs({
  record,
  source,
  directory,
  token,
}) {
  validateAcceptedInputs(record, source);
  required(
    typeof token === 'string' && token.length > 0,
    'GitHub read token required',
  );
  await mkdir(directory, { recursive: true });
  for (const [platform, input] of Object.entries({
    ci: record.ci,
    ...record.platforms,
  })) {
    const run = await (await api('actions/runs/' + input.run_id, token)).json();
    validateAcceptedRun(run, input, source, { ci: platform === 'ci' });
    const jobs = await pages(
      'actions/runs/' +
        input.run_id +
        '/attempts/' +
        input.run_attempt +
        '/jobs',
      'jobs',
      token,
    );
    validateAcceptedJobs(jobs, platform);
    if (platform === 'ci') continue;
    const listed = await pages(
      'actions/runs/' + input.run_id + '/artifacts',
      'artifacts',
      token,
    );
    // A latest successful attempt cannot silently fall back to older or unselected artifacts.
    const available = listed.filter(
      (artifact) =>
        !artifact.expired &&
        Date.parse(artifact.created_at) >= Date.parse(run.run_started_at),
    );
    required(
      sameSet(
        available.map((artifact) => artifact.name),
        requiredStagingArtifacts(platform),
      ),
      'latest staging attempt artifact inventory changed: ' + platform,
    );
    for (const expected of input.artifacts) {
      const actual = await (
        await api('actions/artifacts/' + expected.id, token)
      ).json();
      validateAcceptedArtifact(actual, expected, run, source);
      const archive = join(directory, platform + '-' + expected.id + '.zip');
      const response = await api(
        'actions/artifacts/' + expected.id + '/zip',
        token,
      );
      await pipeline(
        Readable.fromWeb(response.body),
        createWriteStream(archive, { flags: 'wx' }),
      );
      required(
        (await stat(archive)).size === expected.size_in_bytes &&
          'sha256:' + (await hashReleaseFile(archive)) === expected.digest,
        'accepted archive byte readback mismatch',
      );
      const destination = join(directory, platform, String(expected.id));
      // Artifact directories remain separate, preserving captures without overwriting either API.
      execFileSync('python3', ['-c', extractionProgram, archive, destination], {
        stdio: 'pipe',
        windowsHide: true,
        timeout: 120000,
      });
    }
  }
  const files = await verifyAcceptedPayloads(directory, record);
  await verifyAndroidRuntime(files, record);
  const linuxManifests = files.filter(
    (path) => path.split(/[\\/]/u).at(-1) === 'linux-package-manifest.json',
  );
  required(
    linuxManifests.length === 1,
    'accepted Linux manifest missing/duplicated',
  );
  const linuxEvidence = JSON.parse(await readFile(linuxManifests[0], 'utf8'));
  const linuxContract = JSON.parse(
    await readFile(
      new URL('../packaging/linux/package-contract.json', import.meta.url),
      'utf8',
    ),
  );
  const linuxAttestation = await verifyRepositoryAttestations(
    linuxEvidence,
    linuxContract,
    dirname(linuxManifests[0]),
  );
  return {
    schema: 1,
    status: 'accepted_bytes_verified',
    source_commit: source,
    version: releaseIdentity.version,
    tag: releaseIdentity.tag,
    linux_attestation_verification: linuxAttestation,
    platform_runs: Object.fromEntries(
      Object.entries(record.platforms).map(([platform, input]) => [
        platform,
        {
          run_id: input.run_id,
          run_attempt: input.run_attempt,
          artifact_ids: input.artifacts.map((row) => row.id),
        },
      ]),
    ),
    payloads: record.payloads,
  };
}
async function main() {
  const args = process.argv.slice(2);
  const value = (name) => {
    const index = args.indexOf(name);
    required(index >= 0 && args[index + 1], 'missing ' + name);
    return args[index + 1];
  };
  const record = JSON.parse(await readFile(value('--accepted'), 'utf8'));
  const source = value('--source');
  const result = await consumeAcceptedInputs({
    record,
    source,
    directory: resolve(value('--directory')),
    token: process.env.GH_TOKEN,
  });
  await writeFile(
    value('--receipt'),
    JSON.stringify(result, null, 2) + '\n',
    'utf8',
  );
  console.log(
    'Accepted staged bytes verified for ' +
      source +
      '. No product build was performed.',
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
