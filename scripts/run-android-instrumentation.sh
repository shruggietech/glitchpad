#!/usr/bin/env bash

set -u

if (( $# < 3 )); then
  echo "usage: run-android-instrumentation.sh OUTPUT MARKER INSTRUMENTATION_ARGS..." >&2
  exit 2
fi

output="$1"
marker="$2"
shift 2


screenshot=""
case "$*" in
  *#standaloneAuthoringAndDiagnosticJourneys*) screenshot="s046-authoring" ;;
  *#s047BackJourney*) screenshot="s046-authoring" ;;
  *#addDocumentAtMaximumFontScale*) screenshot="s046-font-scale" ;;
  *#rootFailureRetainsDraft*) screenshot="s046-root-recovery" ;;
  *#governedMarkdownDeliveryRoutes*) screenshot="s046-markdown-delivery-failure" ;;
  *#resolvedIntentDisplaysColdAndWarmProviderDocuments*) screenshot="s046-markdown-delivery-failure" ;;
esac

capture_png() {
  local remote="$1" screenshot_output="$2"
  local capture_error="${screenshot_output%.png}-capture-error.txt" capture_status=0 signature
  adb exec-out run-as com.shruggietech.glitchpad cat "files/$remote.png" > "$screenshot_output" 2>"$capture_error" || capture_status=$?
  signature=$(od -An -tx1 -N8 "$screenshot_output" | tr -d ' \n')
  if (( capture_status != 0 )) || [[ "$signature" != 89504e470d0a1a0a ]]; then
    mv "$screenshot_output" "${screenshot_output%.png}-capture-output.txt"
    printf 'capture_status=%s; png_signature_valid=false\n' "$capture_status" >> "$capture_error"
  elif [[ ! -s "$capture_error" ]]; then rm -f "$capture_error"; fi
}

prepare_attempt_app_data() {
  node "${BASH_SOURCE[0]%/*}/prepare-android-instrumentation.mjs" "$1"
}

for attempt in 1 2; do
  if [[ "${ANDROID_INSTRUMENTATION_RESET_APP_DATA:-false}" == "true" ]]; then
    prepare_attempt_app_data "${output%.txt}-attempt-${attempt}-setup.txt" || exit 1
  fi
  adb shell am force-stop com.shruggietech.glitchpad || true
  if [[ "${ANDROID_INSTRUMENTATION_PRESERVE_TEST_INPUT_METHOD:-false}" != "true" ]]; then
    adb shell am force-stop com.shruggietech.glitchpad.test || true
  fi
  if [[ -n "$screenshot" ]]; then
    adb shell run-as com.shruggietech.glitchpad rm -f "files/${screenshot}.png" >/dev/null 2>&1 || true
  fi
  if [[ " $* " == *" -e s047 true "* ]]; then for row in {1..10}; do adb shell run-as com.shruggietech.glitchpad rm -f "files/s047-row-$row.png" "files/s047-row-$row.json" >/dev/null 2>&1 || true; done; fi
  adb logcat -c || true
  attempt_output="${output%.txt}-attempt-${attempt}.txt"
  adb_exit_status=0
  adb shell am instrument -w "$@" com.shruggietech.glitchpad.test/androidx.test.runner.AndroidJUnitRunner > "$attempt_output" 2>&1 || adb_exit_status=$?
  cp "$attempt_output" "$output"
  cat "$attempt_output"
  logcat_output="${output%.txt}-attempt-${attempt}-logcat.txt"
  adb logcat -d -t 2000 > "$logcat_output" 2>&1 || true
  if [[ -n "$screenshot" ]]; then capture_png "$screenshot" "${output%.txt}-attempt-${attempt}-$screenshot.png"; fi
  if [[ " $* " == *" -e s047 true "* ]]; then
    for row in {1..10}; do
      capture_png "s047-row-$row" "${output%.txt}-attempt-${attempt}-s047-row-$row.png"
      adb exec-out run-as com.shruggietech.glitchpad cat "files/s047-row-$row.json" > "${output%.txt}-attempt-${attempt}-s047-row-$row.json" 2> "${output%.txt}-attempt-${attempt}-s047-row-$row-json-capture-error.txt" || true
    done
  fi
  # A functional marker before teardown cannot replace a clean runner result.
  marker_present=0
  junit_success=0
  instrumentation_failure=0
  if grep -Fq "$marker" "$output" || grep -Fq "$marker" "$logcat_output"; then marker_present=1; fi
  if grep -Eq '^[[:space:]]*OK \([1-9][0-9]* tests?\)[[:space:]]*$' "$output"; then junit_success=1; fi
  if grep -Eq 'INSTRUMENTATION_(FAILED|ABORTED)|INSTRUMENTATION_RESULT:.*shortMsg=|INSTRUMENTATION_STATUS:[[:space:]]*(Error|stack)=|FAILURES!!!|^[[:space:]]*FAILURE:' "$output"; then instrumentation_failure=1; fi
  if grep -F 'INSTRUMENTATION_CODE:' "$output" | grep -Ev 'INSTRUMENTATION_CODE:[[:space:]]*-1[[:space:]]*$' >/dev/null; then instrumentation_failure=1; fi
  attempt_status="${output%.txt}-attempt-${attempt}-status.txt"
  printf 'adb_exit_status=%s\nmarker_present=%s\njunit_success=%s\ninstrumentation_failure=%s\n' "$adb_exit_status" "$marker_present" "$junit_success" "$instrumentation_failure" > "$attempt_status"
  if (( adb_exit_status == 0 && marker_present == 1 && junit_success == 1 && instrumentation_failure == 0 )); then
    exit 0
  fi
  if (( attempt < 2 )); then
    echo "::warning::Android instrumentation did not satisfy clean completion checks on attempt ${attempt}; resetting the test processes before retrying."
    if [[ "${ANDROID_INSTRUMENTATION_RESET_APP_DATA:-false}" != "true" ]]; then
      adb wait-for-device
      sleep 3
    fi
  fi
done

exit 1
