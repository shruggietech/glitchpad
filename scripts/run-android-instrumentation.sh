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
  adb shell am force-stop com.shruggietech.glitchpad.test || true
  adb logcat -c || true
  adb shell am instrument -w "$@" com.shruggietech.glitchpad.test/androidx.test.runner.AndroidJUnitRunner > "$output" 2>&1 || true
  cat "$output"
  if grep -Fq "$marker" "$output"; then
    exit 0
  fi
  adb logcat -d -t 2000 > "${output%.txt}-attempt-${attempt}-logcat.txt" 2>&1 || true
  sleep 2
done

exit 1
