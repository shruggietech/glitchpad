import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseIdentity } from './lib/release-identity.mjs';

const androidPackageContract = JSON.parse(readFileSync(new URL('../packaging/android/package-contract.json', import.meta.url), 'utf8'));

export const releaseCaseGroups = Object.freeze({
  delivery: ['delivery'],
  authoring: ['authoring'],
  recovery: ['recovery_seed', 'recovery_verify'],
  back_about: ['back_about'],
});
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function hashReleaseFile(path) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest('hex');
}
function required(condition, message) {
  if (!condition) throw new Error(message);
}
export function validateReleaseRow(row, expected) {
  required(
    row.schema === 1 && row.status === 'pass',
    'release case is not terminal pass',
  );
  required(row.case_id === expected.caseId, 'release case identity mismatch');
  required(
    row.evidence_class === 'hosted_minified_release_instrumentation',
    'debug evidence cannot qualify release bytes',
  );
  const identity = row.identity ?? {};
  for (const field of [
    'source_commit',
    'native_source_commit',
    'frontend_source_commit',
  ])
    required(
      identity[field] === expected.source,
      'release source mismatch: ' + field,
    );
  required(
    identity.application_sha256 === expected.applicationSha,
    'installed application byte mismatch',
  );
  required(
    identity.instrumentation_sha256 === expected.instrumentationSha,
    'installed instrumentation byte mismatch',
  );
  required(
    identity.version === releaseIdentity.version &&
      identity.version_code === androidPackageContract.version_code,
    'installed release version mismatch',
  );
  required(identity.api_level === expected.api, 'installed API mismatch');
  required(
    identity.build_variant === 'ordinary' &&
      identity.channel === 'release' &&
      identity.application_debuggable === false,
    'release role/debuggable mismatch',
  );
  required(
    identity.instrumentation_debuggable === true,
    'test-owned capture is unavailable',
  );
  required(
    identity.test_kotlin_runtime ===
      'com.shruggietech.glitchpad.testisolated.kotlin.jvm.internal.Intrinsics' &&
      identity.test_tracing_runtime ===
        'com.shruggietech.glitchpad.testisolated.androidx.tracing.Trace',
    'actual test runtime isolation missing',
  );
  required(
    identity.package_identifier === 'com.shruggietech.glitchpad' &&
      identity.instrumentation_package === 'com.shruggietech.glitchpad.test',
    'installed package mismatch',
  );
  required(
    /^[a-f0-9]{64}$/u.test(identity.signing_certificate_sha256) &&
      identity.signing_certificate_sha256 ===
        identity.instrumentation_certificate_sha256,
    'installed signer mismatch',
  );
  required(
    typeof identity.webview_package === 'string' &&
      identity.webview_package.length > 0 &&
      /^\d+\./u.test(identity.webview_version),
    'actual WebView facts missing',
  );
  required(Array.isArray(row.readbacks), 'release readbacks missing');
  for (const readback of row.readbacks)
    required(
      readback.verified === true &&
        /^[a-f0-9]{64}$/u.test(readback.expected_sha256) &&
        readback.expected_sha256 === readback.actual_sha256,
      'release exact readback mismatch',
    );
  if (expected.caseId === 'delivery')
    required(
      row.readbacks.some((entry) => entry.kind === 'png_pixels'),
      'selected ICO export pixel readback missing',
    );
  if (expected.caseId === 'authoring') {
    for (const kind of ['utf8', 'json_save', 'json_receiver'])
      required(
        row.readbacks.some((entry) => entry.kind === kind),
        'required authoring readback missing: ' + kind,
      );
    required(
      row.readbacks.filter((entry) => entry.kind === 'utf8').length >= 3,
      'both new drafts and read-only copy require exact readback',
    );
  }
  if (expected.caseId === 'recovery_verify')
    required(
      row.observations?.exact_text_verified === true &&
        row.observations.recovery_phase === 'verify',
      'process recovery was not verified',
    );
  if (expected.caseId === 'back_about') {
    required(
      row.observations?.back_retained === true &&
        row.readbacks.some((entry) => entry.kind === 'back_retained_utf8'),
      'native Back draft readback missing',
    );
    required(
      row.observations.about?.Build === expected.source &&
        row.observations.about.Channel === 'release',
      'visible About source/channel mismatch',
    );
    required(
      row.observations.offline_notices?.default_network_none === true &&
        row.observations.offline_notices.native_local_notices === true,
      'offline native notices missing',
    );
  }
  return row;
}
export function validateReleaseAttempt(
  status,
  output,
  marker,
  caseId,
  receiptSha,
) {
  required(
    status.pass === true &&
      status.command_exit === 0 &&
      status.logcat_exit === 0 &&
      status.capture_exit === 0,
    'release attempt did not complete cleanly',
  );
  required(
    /^\s*OK \(1 test\)\s*$/mu.test(output),
    'clean JUnit result missing',
  );
  const codes = [...output.matchAll(/^INSTRUMENTATION_CODE:\s*(-?\d+)\s*$/gmu)];
  required(
    codes.length === 1 && codes[0][1] === '-1',
    'clean instrumentation completion missing',
  );
  required(
    !/INSTRUMENTATION_(?:FAILED|ABORTED)|INSTRUMENTATION_RESULT:.*shortMsg=|INSTRUMENTATION_STATUS:\s*(?:Error|stack)=|FAILURES!!!|^\s*FAILURE:/mu.test(
      output,
    ),
    'instrumentation failure cannot be hidden by a marker',
  );
  required(
    marker.case_id === caseId &&
      marker.file === 's048-' + caseId + '.json' &&
      marker.sha256 === receiptSha,
    'release stream marker/readback mismatch',
  );
}
export async function validateReleaseCapture({ directory, caseId, expected }) {
  const receipt = await readFile(join(directory, 's048-' + caseId + '.json'));
  const row = JSON.parse(receipt.toString('utf8'));
  validateReleaseRow(row, { ...expected, caseId });
  const png = await readFile(join(directory, 's048-' + caseId + '.png'));
  required(
    png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
      row.screenshot?.file === 's048-' + caseId + '.png' &&
      row.screenshot.sha256 === digest(png),
    'release screenshot bytes missing/mismatch',
  );
  if (caseId === 'delivery' || caseId === 'startup') {
    required(
      (await hashReleaseFile(
        join(directory, 's048-installed-application.apk'),
      )) === expected.applicationSha,
      'captured installed application differs from canonical package',
    );
    required(
      (await hashReleaseFile(
        join(directory, 's048-installed-instrumentation.apk'),
      )) === expected.instrumentationSha,
      'captured installed instrumentation differs from test input',
    );
  }
  return {
    case_id: caseId,
    receipt_sha256: digest(receipt),
    screenshot_sha256: digest(png),
    identity: row.identity,
    readbacks: row.readbacks,
  };
}

export async function validateReleaseDirectory({
  directory,
  source,
  api,
  application,
  instrumentation,
  mode = 'full',
}) {
  required(['full', 'startup'].includes(mode), 'unknown release campaign mode');
  const groups =
    mode === 'startup' ? { startup: ['startup'] } : releaseCaseGroups;
  required(
    /^[0-9a-f]{40}$/u.test(source) && [24, 36].includes(api),
    'exact release source/API required',
  );
  const expected = {
    source,
    api,
    applicationSha: await hashReleaseFile(application),
    instrumentationSha: await hashReleaseFile(instrumentation),
  };
  const names = await readdir(directory);
  for (const name of names.filter((entry) => entry.includes('-attempt-')))
    required(
      Object.keys(groups).some((group) =>
        new RegExp('^' + group + '-attempt-[12]$', 'u').test(name),
      ),
      'unexpected/unbounded release attempt: ' + name,
    );
  const selected = [];
  for (const [group, cases] of Object.entries(groups)) {
    const attempts = names
      .filter((name) =>
        new RegExp('^' + group + '-attempt-[12]$', 'u').test(name),
      )
      .sort();
    required(
      attempts.length >= 1 &&
        attempts[0] === group + '-attempt-1' &&
        attempts.length <= 2,
      'missing/noncontiguous bounded release attempts: ' + group,
    );
    // The latest attempt is authoritative. Never fall back behind a newer failure.
    const name = attempts.at(-1);
    const retained = {
      group,
      attempt: Number(name.at(-1)),
      prior_attempts: attempts.slice(0, -1),
      cases: [],
    };
    for (const caseId of cases) {
      const path = join(directory, name);
      const capture = await validateReleaseCapture({
        directory: path,
        caseId,
        expected,
      });
      const status = JSON.parse(
        await readFile(join(path, caseId + '-status.json'), 'utf8'),
      );
      const output = await readFile(
        join(path, caseId + '-instrumentation.txt'),
        'utf8',
      );
      const markers = [
        ...output.matchAll(/s048_release_evidence=(\{[^\r\n]+\})/gu),
      ].map((match) => JSON.parse(match[1]));
      required(
        markers.length >= 1 &&
          markers.every((marker) => marker.case_id === caseId),
        'release completion marker missing/wrong case',
      );
      validateReleaseAttempt(
        status,
        output,
        markers.at(-1),
        caseId,
        capture.receipt_sha256,
      );
      retained.cases.push(capture);
    }
    selected.push(retained);
  }
  const certificates = new Set(
    selected.flatMap((entry) =>
      entry.cases.map((row) => row.identity.signing_certificate_sha256),
    ),
  );
  required(certificates.size === 1, 'release signer changed across cases');
  return {
    schema: 1,
    status: 'pass',
    diagnostic_only: mode === 'startup',
    candidate_qualified: mode === 'full',
    evidence_class: 'hosted_minified_release_instrumentation',
    ...expected,
    signing_certificate_sha256: [...certificates][0],
    selected,
    scope:
      mode === 'startup'
        ? 'Startup/identity diagnostic only; no release campaign qualification.'
        : 'Five bounded release-runtime cases. Separate debug ordinary/fault campaigns qualify the S047 ten-journey matrix; physical/manual conformance remains waived under #66.',
  };
}
async function main() {
  const args = process.argv.slice(2);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    required(
      args[index]?.startsWith('--') && args[index + 1],
      'missing release evidence argument',
    );
    values[args[index].slice(2)] = args[index + 1];
  }
  if (values['capture-case']) {
    const expected = {
      source: values.source,
      api: Number(values.api),
      applicationSha: await hashReleaseFile(values.application),
      instrumentationSha: await hashReleaseFile(values.instrumentation),
    };
    await validateReleaseCapture({
      directory: values.directory,
      caseId: values['capture-case'],
      expected,
    });
    console.log('Captured release bytes verified.');
    return;
  }
  const result = await validateReleaseDirectory({
    ...values,
    api: Number(values.api),
  });
  await writeFile(
    values.output,
    JSON.stringify(result, null, 2) + '\n',
    'utf8',
  );
  console.log(
    'Installed minified release evidence passed on API ' + result.api + '.',
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
