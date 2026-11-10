#!/usr/bin/env bash

set -u
set -o pipefail

# The Gradle suite retains its existing two attempts; supporting transport is finite.
adb() {
  node "${BASH_SOURCE[0]%/*}/bounded-android-adb.mjs" "$@"
}

run_connected_suite() {
  ./crates/glitchpad-host/gen/android/gradlew \
    --project-dir crates/glitchpad-host/gen/android \
    :app:connectedUniversalDebugAndroidTest \
    -Pandroid.testInstrumentationRunnerArguments.notClass=com.shruggietech.glitchpad.performance.PerformanceInstrumentedTest,com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest,com.shruggietech.glitchpad.shell.BrandBuilderAppFrameInstrumentedTest \
    -PabiList=x86_64 \
    -ParchList=x86_64 \
    -PtargetList=x86_64 \
    -x :app:rustBuildUniversalDebug \
    -x :app:rustBuildX86_64Debug \
    --no-daemon
}

retain_tested_candidate() {
  export GLITCHPAD_TESTED_CAPTURE_BOUNDARY="${1:-post_connected_suite_reinstall}"
  export GLITCHPAD_TESTED_CANDIDATE_DIR="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/android-tested-candidate"
  node --input-type=module <<'NODE'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync, spawn } from 'node:child_process';
import { join } from 'node:path';
const directory = process.env.GLITCHPAD_TESTED_CANDIDATE_DIR;
const boundary = process.env.GLITCHPAD_TESTED_CAPTURE_BOUNDARY;
if (!['post_connected_suite_reinstall', 'post_direct_suite_existing_install'].includes(boundary)) throw new Error('Unknown tested capture boundary');
await mkdir(directory, { recursive: true });
await rm(join(directory, 'tested-apk-receipt.json'), { force: true });
const variants = [
  ['application', 'com.shruggietech.glitchpad', 'crates/glitchpad-host/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk'],
  ['instrumentation', 'com.shruggietech.glitchpad.test', 'crates/glitchpad-host/gen/android/app/build/outputs/apk/androidTest/universal/debug/app-universal-debug-androidTest.apk'],
];
// Connected Gradle tests remove their packages during cleanup. Install the built
// candidate again for byte-verified capture and the governed UI journeys in CI.
const failedCapture = (method, error) => ({
  method,
  status: Number.isInteger(error.status) ? error.status : null,
  code: typeof error.code === 'string' ? error.code : null,
  signal: error.signal ?? null,
  stderr: String(error.stderr ?? '').slice(0, 8192),
  stderr_truncated: (error.stderr?.length ?? 0) > 8192,
  stdout_byte_count: error.stdout_byte_count ?? (Buffer.isBuffer(error.stdout) ? error.stdout.length : Buffer.byteLength(String(error.stdout ?? ''))),
  error_message: String(error.message ?? '').slice(0, 1024),
  cause: 'unknown',
});
const setup = { schema_version: 1, timeout_ms: 60_000, current_phase: null, state: 'pending', commands: [] };
const setupPath = join(directory, 'candidate-setup.json');
const setupCommand = async (phase, packageName, args) => {
  setup.current_phase = phase;
  setup.state = 'running';
  await writeFile(setupPath, JSON.stringify(setup, null, 2) + '\n', 'utf8');
  try {
    const output = execFileSync('adb', args, { encoding: 'utf8', stdio: 'pipe', timeout: 60_000, maxBuffer: 64 * 1024, windowsHide: true });
    setup.commands.push({ phase, package: packageName, status: 0, stdout_byte_count: Buffer.byteLength(output) });
    setup.state = 'completed';
    return output;
  } catch (error) {
    setup.commands.push({ phase, package: packageName, ...failedCapture('adb_' + phase, error) });
    setup.state = 'failed';
    throw new Error('Installed candidate setup failed during ' + phase + ' for ' + packageName, { cause: error });
  } finally {
    await writeFile(setupPath, JSON.stringify(setup, null, 2) + '\n', 'utf8');
  }
};
if (boundary === 'post_connected_suite_reinstall') {
  for (const [, packageName, builtPath] of variants) {
    await setupCommand('install', packageName, ['install', '-r', '-t', builtPath]);
  }
}
const captureFramedApk = async (args, path, byteLimit) => {
  let byteCount = 0;
  let stderr = Buffer.alloc(0);
  let failure;
  const child = spawn('adb', args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const stopped = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (status, signal) => resolve({ status, signal }));
  });
  const stop = (error) => { failure ??= error; child.kill('SIGKILL'); };
  const timeout = setTimeout(() => stop(Object.assign(new Error('Installed APK capture timed out'), { code: 'ETIMEDOUT' })), 60_000);
  child.stderr.on('data', (chunk) => {
    const remaining = 64 * 1024 - stderr.length;
    stderr = Buffer.concat([stderr, chunk.subarray(0, Math.max(0, remaining))]);
    if (chunk.length > remaining) stop(Object.assign(new Error('Installed APK stderr exceeds its bound'), { code: 'ENOBUFS' }));
  });
  const bounded = new Transform({ transform(chunk, encoding, callback) {
    byteCount += chunk.length;
    if (byteCount > byteLimit) {
      const error = Object.assign(new Error('Installed APK output exceeds its bound'), { code: 'ENOBUFS' });
      stop(error);
      callback(error);
    } else callback(null, chunk);
  } });
  const copied = pipeline(child.stdout, bounded, createWriteStream(path, { flags: 'wx' })).catch(stop);
  try {
    const [, result] = await Promise.all([copied, stopped]);
    if (failure || result.status !== 0) throw Object.assign(failure ?? new Error('Installed APK remote read failed'), { status: result.status, signal: result.signal, stderr, stdout_byte_count: byteCount });
    return byteCount;
  } finally { clearTimeout(timeout); }
};
const artifacts = [];
let shellV2Verified = false;
for (const [kind, packageName, builtPath] of variants) {
  const paths = (await setupCommand('package_path', packageName, ['shell', 'pm', 'path', packageName])).trim().split(/\r?\n/).filter(Boolean);
  if (paths.length !== 1 || !paths[0].startsWith('package:')) throw new Error('Expected one installed universal APK for ' + kind);
  const remotePath = paths[0].slice('package:'.length);
  if (remotePath.length > 4096 || !/^\/[a-zA-Z0-9_./+=~:@%-]+$/u.test(remotePath)) throw new Error('Invalid installed APK path for ' + kind);
  const installedPath = join(directory, kind + '.apk');
  const diagnosticFilename = kind + '-capture.json';
  const built = await readFile(builtPath);
  const capture = { package: packageName, installed_path: remotePath, expected_byte_count: built.length, expected_sha256: createHash('sha256').update(built).digest('hex'), attempts: [], validation: 'not_completed' };
  let installed;
  let method = 'adb_pull';
  let matched = false;
  await rm(installedPath, { force: true });
  try {
    try {
      execFileSync('adb', ['pull', remotePath, installedPath], { stdio: 'pipe', timeout: 60_000, maxBuffer: 64 * 1024, windowsHide: true });
      capture.attempts.push({ method, status: 0 });
    } catch (error) {
      const failure = failedCapture(method, error);
      capture.attempts.push(failure);
      console.warn('installed_apk_capture_attempt=' + JSON.stringify({ kind, ...failure }));
      await rm(installedPath, { force: true });
      method = 'adb_shell_v2_run_as_cat';
      // Read the same PM-reported path without a PTY and preserve remote errors.
      // Never substitute build output when the installed file cannot be read.
      try {
        if (!shellV2Verified) {
          const features = (await setupCommand('shell_features', packageName, ['features'])).trim().split(/[\s,]+/u).filter(Boolean);
          capture.shell_features = features;
          if (!features.includes('shell_v2')) {
            capture.validation = 'required_shell_protocol_unavailable';
            throw new Error('Installed capture requires the connected shell_v2 feature');
          }
          shellV2Verified = true;
        }
        const byteCount = await captureFramedApk(['shell', '-T', '-n', 'run-as', packageName, 'cat', remotePath], installedPath, built.length + 1);
        capture.attempts.push({ method, status: 0, byte_count: byteCount });
      } catch (error) {
        const failure = failedCapture(method, error);
        capture.attempts.push(failure);
        console.warn('installed_apk_capture_attempt=' + JSON.stringify({ kind, ...failure }));
        throw new Error('Installed APK alternate read failed for ' + kind);
      }
    }
    if (!installed) {
      const information = await stat(installedPath);
      if (information.size > built.length + 1) {
        capture.validation = 'installed_length_differs';
        capture.observed_byte_count = information.size;
        capture.mismatch_filename = kind + '-capture-mismatch.apk';
        await rename(installedPath, join(directory, capture.mismatch_filename));
        throw new Error('Installed APK length differs from built candidate for ' + kind);
      }
      installed = await readFile(installedPath);
    }
    if (!installed.equals(built)) {
      capture.validation = 'installed_bytes_differ';
      capture.observed_byte_count = installed.length;
      capture.observed_sha256 = createHash('sha256').update(installed).digest('hex');
      capture.first_different_byte = installed.findIndex((byte, index) => byte !== built[index]);
      if (capture.first_different_byte < 0) capture.first_different_byte = Math.min(installed.length, built.length);
      capture.mismatch_filename = kind + '-capture-mismatch.apk';
      await writeFile(join(directory, capture.mismatch_filename), installed, { flag: 'wx' });
      throw new Error('Installed APK differs from built candidate for ' + kind);
    }
    capture.validation = 'matched_built_candidate';
    matched = true;
    artifacts.push({ kind, package: packageName, filename: kind + '.apk', sha256: createHash('sha256').update(installed).digest('hex'), byte_count: installed.length, capture_method: method, capture_diagnostics: diagnosticFilename });
  } finally {
    if (!matched) await rm(installedPath, { force: true });
    await writeFile(join(directory, diagnosticFilename), JSON.stringify(capture, null, 2) + '\n', 'utf8');
  }
}
const product = JSON.parse(await readFile('apps/glitchpad/package.json', 'utf8'));
const source = process.env.GLITCHPAD_BUILD_COMMIT || process.env.GITHUB_SHA || null;
if (!source || !/^[0-9a-f]{40}$/u.test(source)) throw new Error('A full source commit is required for tested APK evidence');
const receipt = { schema_version: 1, evidence_class: 'hosted_debug_instrumentation', capture_boundary: boundary, signed_release_bytes_tested: false, recovery_probe_variant: process.env.GLITCHPAD_RECOVERY_PROBE_VARIANT || 'none', candidate_build_variant: process.env.GLITCHPAD_CANDIDATE_ROLE || 'ordinary', source_commit: source, product_version: product.version, api_level: Number((await setupCommand('api_level', 'device', ['shell', '-T', '-n', 'getprop', 'ro.build.version.sdk'])).trim()), android_version: (await setupCommand('android_version', 'device', ['shell', '-T', '-n', 'getprop', 'ro.build.version.release'])).trim(), artifacts };
await writeFile(join(directory, 'tested-apk-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log('tested_apk_evidence=' + JSON.stringify(receipt));
NODE
}

# A focused ordinary PDF diagnostic reuses the same installed-byte readback.
if [[ "${GLITCHPAD_ANDROID_PDF_PREFLIGHT:-false}" == "true" ]]; then
  [[ "${GLITCHPAD_BUILD_COMMIT:-}" =~ ^[0-9a-f]{40}$ ]] || exit 2
  adb install --no-streaming -r -t crates/glitchpad-host/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk || exit 1
  adb install --no-streaming -r -t crates/glitchpad-host/gen/android/app/build/outputs/apk/androidTest/universal/debug/app-universal-debug-androidTest.apk || exit 1
  preflight_output="${RUNNER_TEMP:-/tmp}/s049-pdf-compatibility.txt"
  status=0
  ANDROID_INSTRUMENTATION_RESET_APP_DATA=true bash scripts/run-android-instrumentation.sh "$preflight_output" 's049_pdf_compatibility=' -e waitForActivitiesToComplete false -e expectedSource "$GLITCHPAD_BUILD_COMMIT" -e expectedRole ordinary -e class com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest#pdfCompatibility || status=$?
  retain_tested_candidate post_direct_suite_existing_install || exit 1
  adb shell -T -n run-as com.shruggietech.glitchpad cat files/s049-pdf-native-print-failure.json > "${RUNNER_TEMP:-/tmp}/s049-pdf-native-print-failure.json" || true
  adb shell -T -n run-as com.shruggietech.glitchpad cat files/s049-pdf-compatibility.json > "${RUNNER_TEMP:-/tmp}/s049-pdf-compatibility.json" || status=1
  for print_range in selected all; do
    adb shell -T -n run-as com.shruggietech.glitchpad cat "files/s049-print-output-${print_range}.pdf" > "${RUNNER_TEMP:-/tmp}/s049-pdf-print-output-${print_range}.pdf" || status=1
  done
  exit "$status"
fi

# AGP 8.11 ddmlib repeatedly stalls install-write on API24.
# Run the identical selected JUnit suite through the strict two-attempt runner.
api_level=$(adb shell getprop ro.build.version.sdk | tr -d '\r') || exit 1
[[ "$api_level" =~ ^[0-9]+$ ]] || exit 1
if [[ "$api_level" == "24" ]]; then
  app_apk="crates/glitchpad-host/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk"
  test_apk="crates/glitchpad-host/gen/android/app/build/outputs/apk/androidTest/universal/debug/app-universal-debug-androidTest.apk"
  adb install --no-streaming -r -t "$app_apk" || exit 1
  adb install --no-streaming -r -t "$test_apk" || exit 1
  connected_output="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/connected-suite-api24.txt"
  ANDROID_INSTRUMENTATION_RESET_APP_DATA=true bash scripts/run-android-instrumentation.sh "$connected_output" "OK (9 tests)" \
    -e notClass com.shruggietech.glitchpad.performance.PerformanceInstrumentedTest,com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest,com.shruggietech.glitchpad.shell.BrandBuilderAppFrameInstrumentedTest || exit 1
  # Direct instrumentation leaves these same tested packages installed.
  retain_tested_candidate post_direct_suite_existing_install || exit 1
  cp "$connected_output" "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/android-tested-candidate/connected-suite-native-junit.txt"
  exit 0
fi

log_dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"

for attempt in 1 2; do
  adb logcat -c || true
  attempt_output="${log_dir}/connected-suite-attempt-${attempt}.txt"
  if run_connected_suite 2>&1 | tee "$attempt_output"; then
    retain_tested_candidate || exit 1
    exit 0
  fi

  logcat_output="${log_dir}/connected-suite-attempt-${attempt}-logcat.txt"
  adb logcat -d -t 4000 > "$logcat_output" 2>&1 || true

  if (( attempt < 2 )); then
    echo "::warning::Android connected suite failed once; clearing app state before retrying on the same emulator."
    adb shell am force-stop com.shruggietech.glitchpad || true
    adb shell am force-stop com.shruggietech.glitchpad.test || true
    adb shell pm clear com.shruggietech.glitchpad || true
    adb shell pm clear com.shruggietech.glitchpad.test || true
    adb wait-for-device
    sleep 3
  fi
done

exit 1
