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
import { execFileSync } from 'node:child_process';
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
  stdout_byte_count: Buffer.isBuffer(error.stdout) ? error.stdout.length : Buffer.byteLength(String(error.stdout ?? '')),
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
const artifacts = [];
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
      method = 'adb_exec_out_run_as_cat';
      // Read the same PM-reported installed path as the debuggable application.
      // Never substitute build output when the installed file cannot be read.
      try {
        installed = execFileSync('adb', ['exec-out', 'run-as', packageName, 'cat', remotePath], { stdio: 'pipe', timeout: 60_000, maxBuffer: built.length + 1, windowsHide: true });
        capture.attempts.push({ method, status: 0, byte_count: installed.length });
      } catch (error) {
        const failure = failedCapture(method, error);
        capture.attempts.push(failure);
        console.warn('installed_apk_capture_attempt=' + JSON.stringify({ kind, ...failure }));
        throw new Error('Installed APK alternate read failed for ' + kind);
      }
    }
    if (!installed) {
      const information = await stat(installedPath);
      if (information.size !== built.length) {
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
    if (method === 'adb_exec_out_run_as_cat') await writeFile(installedPath, installed);
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
const receipt = { schema_version: 1, evidence_class: 'hosted_debug_instrumentation', capture_boundary: boundary, signed_release_bytes_tested: false, recovery_probe_variant: process.env.GLITCHPAD_RECOVERY_PROBE_VARIANT || 'none', candidate_build_variant: process.env.GLITCHPAD_CANDIDATE_ROLE || 'ordinary', source_commit: source, product_version: product.version, api_level: Number(execFileSync('adb', ['shell', 'getprop', 'ro.build.version.sdk'], { encoding: 'utf8', timeout: 30_000, maxBuffer: 64 * 1024, windowsHide: true }).trim()), android_version: execFileSync('adb', ['shell', 'getprop', 'ro.build.version.release'], { encoding: 'utf8', timeout: 30_000, maxBuffer: 64 * 1024, windowsHide: true }).trim(), artifacts };
await writeFile(join(directory, 'tested-apk-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log('tested_apk_evidence=' + JSON.stringify(receipt));
NODE
}

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
