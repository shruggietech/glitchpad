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

if run_connected_suite; then
  exit 0
fi

echo "::warning::Android connected suite failed once; resetting the app processes and retrying on the same emulator."
adb shell am force-stop com.shruggietech.glitchpad || true
adb shell am force-stop com.shruggietech.glitchpad.test || true
adb logcat -c || true
sleep 2
run_connected_suite
