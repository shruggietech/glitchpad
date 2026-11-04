#!/usr/bin/env bash

set -u

if (( $# < 3 )); then
  echo "usage: run-android-instrumentation.sh OUTPUT MARKER INSTRUMENTATION_ARGS..." >&2
  exit 2
fi

output="$1"
marker="$2"
shift 2

if [[ "${ANDROID_INSTRUMENTATION_RESET_APP_DATA:-false}" == "true" ]]; then
  adb shell pm clear com.shruggietech.glitchpad || exit 1
  adb shell pm clear com.shruggietech.glitchpad.test || exit 1
fi

screenshot=""
case "$*" in
  *#standaloneAuthoringAndDiagnosticJourneys*) screenshot="s046-authoring" ;;
  *#addDocumentAtMaximumFontScale*) screenshot="s046-font-scale" ;;
  *#rootFailureRetainsDraft*) screenshot="s046-root-recovery" ;;
  *#governedMarkdownDeliveryRoutes*) screenshot="s046-markdown-delivery-failure" ;;
  *#resolvedIntentDisplaysColdAndWarmProviderDocuments*) screenshot="s046-markdown-delivery-failure" ;;
esac

for attempt in 1 2; do
  adb shell am force-stop com.shruggietech.glitchpad || true
  if [[ "${ANDROID_INSTRUMENTATION_PRESERVE_TEST_INPUT_METHOD:-false}" != "true" ]]; then
    adb shell am force-stop com.shruggietech.glitchpad.test || true
  fi
  if [[ -n "$screenshot" ]]; then
    adb shell run-as com.shruggietech.glitchpad rm -f "files/${screenshot}.png" >/dev/null 2>&1 || true
  fi
  adb logcat -c || true
  attempt_output="${output%.txt}-attempt-${attempt}.txt"
  adb shell am instrument -w "$@" com.shruggietech.glitchpad.test/androidx.test.runner.AndroidJUnitRunner > "$attempt_output" 2>&1 || true
  cp "$attempt_output" "$output"
  cat "$attempt_output"
  logcat_output="${output%.txt}-attempt-${attempt}-logcat.txt"
  adb logcat -d -t 2000 > "$logcat_output" 2>&1 || true
  if [[ -n "$screenshot" ]]; then
    screenshot_output="${output%.txt}-attempt-${attempt}-${screenshot}.png"
    capture_error="${screenshot_output%.png}-capture-error.txt"
    capture_status=0
    adb exec-out run-as com.shruggietech.glitchpad cat "files/${screenshot}.png" > "$screenshot_output" 2>"$capture_error" || capture_status=$?
    signature=$(od -An -tx1 -N8 "$screenshot_output" | tr -d ' \n')
    # Some older adb/run-as combinations return success with a remote cat error
    # on stdout. Such text is diagnostic output, never screenshot evidence.
    if (( capture_status != 0 )) || [[ "$signature" != 89504e470d0a1a0a ]]; then
      mv "$screenshot_output" "${screenshot_output%.png}-capture-output.txt"
      printf 'capture_status=%s; png_signature_valid=false\n' "$capture_status" >> "$capture_error"
    elif [[ ! -s "$capture_error" ]]; then
      rm -f "$capture_error"
    fi
  fi
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
