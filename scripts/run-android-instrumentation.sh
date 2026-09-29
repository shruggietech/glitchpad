#!/usr/bin/env bash

set -u

if (( $# < 3 )); then
  echo "usage: run-android-instrumentation.sh OUTPUT MARKER INSTRUMENTATION_ARGS..." >&2
  exit 2
fi

output="$1"
marker="$2"
shift 2

for attempt in 1 2; do
  adb shell am force-stop com.shruggietech.glitchpad || true
  if [[ "${ANDROID_INSTRUMENTATION_PRESERVE_TEST_INPUT_METHOD:-false}" != "true" ]]; then
    adb shell am force-stop com.shruggietech.glitchpad.test || true
  fi
  adb logcat -c || true
  adb shell am instrument -w "$@" com.shruggietech.glitchpad.test/androidx.test.runner.AndroidJUnitRunner > "$output" 2>&1 || true
  cat "$output"
  logcat_output="${output%.txt}-attempt-${attempt}-logcat.txt"
  adb logcat -d -t 2000 > "$logcat_output" 2>&1 || true
  if grep -Fq "$marker" "$output" || grep -Fq "$marker" "$logcat_output"; then
    exit 0
  fi
  if (( attempt < 2 )); then
    echo "::warning::Android instrumentation marker was absent on attempt ${attempt}; resetting the test processes before retrying."
    if [[ "${ANDROID_INSTRUMENTATION_RESET_APP_DATA:-false}" == "true" ]]; then
      adb shell pm clear com.shruggietech.glitchpad || true
      adb shell pm clear com.shruggietech.glitchpad.test || true
    fi
    adb wait-for-device
    sleep 3
  fi
done

exit 1
