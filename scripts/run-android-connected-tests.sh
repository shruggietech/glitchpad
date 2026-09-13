#!/usr/bin/env bash

set -u

run_connected_suite() {
  ./crates/glitchpad-host/gen/android/gradlew \
    --project-dir crates/glitchpad-host/gen/android \
    :app:connectedUniversalDebugAndroidTest \
    -Pandroid.testInstrumentationRunnerArguments.notClass=com.shruggietech.glitchpad.performance.PerformanceInstrumentedTest,com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest \
    -PabiList=x86_64 \
    -ParchList=x86_64 \
    -PtargetList=x86_64 \
    -x :app:rustBuildUniversalDebug \
    -x :app:rustBuildX86_64Debug \
    --no-daemon
}

log_dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"

for attempt in 1 2; do
  adb logcat -c || true
  if run_connected_suite; then
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
