#!/usr/bin/env bash

set -u
set -o pipefail

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
  export GLITCHPAD_TESTED_CANDIDATE_DIR="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/android-tested-candidate"
  node --input-type=module <<'NODE'
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const directory = process.env.GLITCHPAD_TESTED_CANDIDATE_DIR;
await mkdir(directory, { recursive: true });
const variants = [
  ['application', 'com.shruggietech.glitchpad', 'crates/glitchpad-host/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk'],
  ['instrumentation', 'com.shruggietech.glitchpad.test', 'crates/glitchpad-host/gen/android/app/build/outputs/apk/androidTest/universal/debug/app-universal-debug-androidTest.apk'],
];
const artifacts = [];
for (const [kind, packageName, builtPath] of variants) {
  const paths = execFileSync('adb', ['shell', 'pm', 'path', packageName], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/).filter(Boolean);
  if (paths.length !== 1 || !paths[0].startsWith('package:')) throw new Error('Expected one installed universal APK for ' + kind);
  const installedPath = join(directory, kind + '.apk');
  execFileSync('adb', ['pull', paths[0].slice('package:'.length), installedPath], { stdio: 'pipe', windowsHide: true });
  const installed = await readFile(installedPath);
  const built = await readFile(builtPath);
  if (!installed.equals(built)) throw new Error('Installed APK differs from built candidate for ' + kind);
  artifacts.push({ kind, package: packageName, filename: kind + '.apk', sha256: createHash('sha256').update(installed).digest('hex'), byte_count: installed.length });
}
const product = JSON.parse(await readFile('apps/glitchpad/package.json', 'utf8'));
const source = process.env.GITHUB_SHA || process.env.GLITCHPAD_BUILD_COMMIT || null;
if (!source || !/^[0-9a-f]{40}$/u.test(source)) throw new Error('A full source commit is required for tested APK evidence');
const receipt = { schema_version: 1, evidence_class: 'hosted_debug_instrumentation', signed_release_bytes_tested: false, recovery_probe_variant: process.env.GLITCHPAD_RECOVERY_PROBE_VARIANT || 'none', source_commit: source, product_version: product.version, api_level: Number(execFileSync('adb', ['shell', 'getprop', 'ro.build.version.sdk'], { encoding: 'utf8', windowsHide: true }).trim()), android_version: execFileSync('adb', ['shell', 'getprop', 'ro.build.version.release'], { encoding: 'utf8', windowsHide: true }).trim(), artifacts };
await writeFile(join(directory, 'tested-apk-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log('tested_apk_evidence=' + JSON.stringify(receipt));
NODE
}

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
