import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseIdentity } from './lib/release-identity.mjs';

const androidPackageContract = JSON.parse(
  readFileSync(
    new URL('../packaging/android/package-contract.json', import.meta.url),
    'utf8',
  ),
);

export const releaseCaseGroups = Object.freeze({
  delivery: ['delivery'],
  authoring: ['authoring'],
  recovery: ['recovery_seed', 'recovery_verify'],
  back_about: ['back_about'],
  pdf: ['pdf'],
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
  if (['back_about', 'startup'].includes(expected.caseId)) {
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
  if (expected.caseId === 'pdf') {
    const pdf = row.observations ?? {};
    const measured=pdf.measurements;
    required(typeof identity.architecture==='string' && identity.architecture.length>0,'PDF observed architecture missing');
    required(measured?.first_page?.method && measured.first_page.samples_ms?.length>=1 && measured.first_page.samples_ms.every(n=>Number.isFinite(n)&&n>=0),'PDF first-page raw measurement missing');
    required(measured.memory?.method && measured.memory.process_name===identity.package_identifier && measured.memory.scope && measured.memory.samples_bytes?.length>=2 && measured.memory.samples_bytes.every(n=>Number.isFinite(n)&&n>0),'PDF named process memory measurements missing');
    const readings=measured.reading;
    for(const metric of ['navigation','search_complete','first_thumbnail']) required(readings?.samples?.some(s=>s.metric===metric && Number.isFinite(s.milliseconds)&&s.milliseconds>=0),'PDF reading measurement missing: '+metric);
    required(readings.interaction?.scope && readings.interaction.samples_ms?.length>0 && readings.interaction.samples_ms.every(n=>Number.isFinite(n)&&n>=0&&n<=50),'PDF synchronous interaction interval exceeds50ms or is missing');
    required(typeof readings.long_tasks?.supported==='boolean' && readings.long_tasks.scope,'PDF main-realm long-task observer scope missing');
    if(readings.long_tasks.supported) required(Array.isArray(readings.long_tasks.samples_ms)&&readings.long_tasks.samples_ms.every(n=>Number.isFinite(n)&&n>=0&&n<=50),'PDF observed reading task exceeds50ms');
    else required(readings.long_tasks.samples_ms===null,'PDF unsupported task observer must remain unmeasured');
    required(Array.isArray(pdf.resource_phases) && pdf.resource_phases.length>=2 && pdf.resource_phases.every(p=>Number.isFinite(p.peakSurfaceBytes)&&p.peakSurfaceBytes>=0&&p.peakSurfaceBytes<=96*1024*1024&&Number.isFinite(p.range?.maximumRequestBytes)&&p.range.maximumRequestBytes<=262144&&Number.isFinite(p.range.peakConcurrency)&&p.range.peakConcurrency<=2),'PDF actual owned surface/range observations missing or over budget');
    required(
      pdf.fixture_sha256 ===
        digest(
          readFileSync(
            new URL('../fixtures/pdf/s049-compatibility.pdf', import.meta.url),
          ),
        ),
      'PDF fixture identity mismatch',
    );
    required(
      pdf.cold_resolved_view === true && pdf.warm_resolved_send === true,
      'PDF resolved cold/warm acquisition missing',
    );
    required(
      pdf.facts?.worker === 'true' &&
        pdf.facts.engine === '6.5.438' &&
        pdf.facts.ink > 500 &&
        pdf.facts.executed === false &&
        pdf.facts.selected?.includes('Glitchpad PDF compatibility page 1'),
      'PDF actual worker/canvas/selection proof missing',
    );
    for (const key of [
      'outline_named_destination',
      'search',
      'thumbnail',
      'internal_link',
      'external_link_disclosure',
      'rotation',
      'go_to_page',
      'keyboard',
      'metadata',
    ])
      required(
        pdf.reading_journey?.checks?.[key] === true,
        'PDF reading check missing: ' + key,
      );
    required(
      pdf.reading_journey.native_touch_outline === true &&
        pdf.reading_journey.native_keyboard_home === true,
      'PDF native input proof missing',
    );
    required(
      pdf.source_unchanged === true &&
        pdf.stream_rendered === true &&
        pdf.stream_cache_removed === true &&
        pdf.stream_cache_files?.length === 1 &&
        pdf.stream_cache_files[0] > 0,
      'PDF source/private cache proof missing',
    );
    required(
      pdf.disposal?.worker_terminated === true &&
        pdf.disposal.workers === 0 &&
        pdf.disposal.surfaces === 0 &&
        pdf.disposal.surfaceBytes === 0 &&
        Number.isFinite(pdf.disposal.elapsed_ms) &&
        pdf.disposal.elapsed_ms <= 250,
      'PDF worker disposal proof missing',
    );
    for (const [range, pages] of [
      ['selected', 2],
      ['all', 4],
    ]) {
      const print = pdf.print?.[range];
      required(
        print?.output_pages === pages &&
          print.output_ink?.length === pages &&
          print.output_ink.every((n) => Number.isFinite(n) && n > 500) &&
          /^[a-f0-9]{64}$/u.test(print.output_sha256) &&
          Number.isInteger(print.output_bytes) &&
          print.output_bytes > 128 &&
          print.private_spool_cleaned === true &&
          print.physical_output_confirmed === false,
        'PDF actual print proof missing: ' + range,
      );
    }
    if (expected.api === 24)
      required(
        row.identity.webview_version.startsWith('69.'),
        'PDF minimum profile requires actual Chrome69',
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
  if (['delivery', 'startup', 'pdf'].includes(caseId)) {
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
  if (caseId === 'pdf') {
    for (const range of ['selected', 'all']) {
      const bytes = await readFile(
        join(directory, 's049-print-output-' + range + '.pdf'),
      );
      const print = row.observations.print[range];
      required(
        bytes.subarray(0, 5).toString('ascii') === '%PDF-' &&
          bytes.subarray(-64).toString('ascii').trimEnd().endsWith('%%EOF') &&
          bytes.length === print.output_bytes &&
          digest(bytes) === print.output_sha256,
        'PDF captured printed bytes mismatch: ' + range,
      );
    }
  }
  return {
    case_id: caseId,
    receipt_sha256: digest(receipt),
    screenshot_sha256: digest(png),
    identity: row.identity,
    readbacks: row.readbacks,
    observations: row.observations,
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
  required(
    ['full', 'startup', 'pdf'].includes(mode),
    'unknown release campaign mode',
  );
  const groups =
    mode === 'startup'
      ? { startup: ['startup'] }
      : mode === 'pdf'
        ? { pdf: ['pdf'] }
        : releaseCaseGroups;
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
    diagnostic_only: mode !== 'full',
    candidate_qualified: mode === 'full',
    evidence_class: 'hosted_minified_release_instrumentation',
    ...expected,
    signing_certificate_sha256: [...certificates][0],
    selected,
    scope:
      mode === 'startup'
        ? 'Startup/identity/Back/About diagnostic only; no release campaign qualification.'
        : mode === 'pdf'
          ? 'PDF minified-release diagnostic only; no complete release campaign qualification.'
          : 'Six bounded release-runtime cases including actual PDF output. Separate debug ordinary/fault campaigns qualify the S047 ten-journey matrix; physical/manual conformance remains waived under #66.',
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
