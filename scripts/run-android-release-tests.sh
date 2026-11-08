#!/usr/bin/env bash
# Linux-hosted installed release qualification. Keep every bounded attempt.
set -euo pipefail
api="${1:-}"; source="${2:-}"; app="${3:-}"; test_apk="${4:-}"; evidence="${5:-}"; mode="${6:-full}"
if [[ "$api" != 24 && "$api" != 36 ]] || [[ ! "$source" =~ ^[0-9a-f]{40}$ ]] || [[ ! -f "$app" || ! -f "$test_apk" || -z "$evidence" ]]; then
  echo 'usage: run-android-release-tests.sh API24_OR_36 SOURCE APPLICATION_APK TEST_APK EVIDENCE_DIRECTORY' >&2
  exit 2
fi
[[ "$mode" == full || "$mode" == startup ]] || exit 2
mkdir -p "$evidence"
scripts="$(cd "$(dirname "$0")" && pwd)"
app_sha="$(sha256sum "$app" | cut -d' ' -f1)"
test_sha="$(sha256sum "$test_apk" | cut -d' ' -f1)"
adb_bounded() { timeout --signal=KILL 90s adb "$@"; }
adb_bounded install -r "$app" > "$evidence/install-application.txt"
adb_bounded install -r -t "$test_apk" > "$evidence/install-instrumentation.txt"
grep -Fxq Success "$evidence/install-application.txt"
grep -Fxq Success "$evidence/install-instrumentation.txt"
offline_pending=false
cleanup() {
  local status=$?
  trap - EXIT
  if [[ "$offline_pending" == true ]]; then
    bash "$scripts/android-offline-mode.sh" restore "$evidence/offline" "$source" || status=1
  fi
  exit "$status"
}
trap cleanup EXIT
run_phase() {
  local directory="$1" case_id="$2" method="$3"
  shift 3
  local command_exit=0 logcat_exit=0 capture_exit=0 pass=false
  if {
    adb_bounded shell am force-stop com.shruggietech.glitchpad &&
    adb_bounded shell am force-stop com.shruggietech.glitchpad.test &&
    adb_bounded logcat -c
  } > "$directory/$case_id-support.txt" 2>&1; then
    :
  else
    local support_exit=$?
    printf '{"command_exit":%s,"logcat_exit":null,"capture_exit":null,"pass":false,"phase":"supporting_setup"}\n' "$support_exit" > "$directory/$case_id-status.json"
    return 1
  fi
  timeout --signal=KILL 360s adb shell am instrument -w -r \
    -e waitForActivitiesToComplete false -e releaseRuntime true \
    -e expectedSource "$source" -e expectedRole ordinary \
    -e expectedApplicationSha "$app_sha" -e expectedInstrumentationSha "$test_sha" \
    -e class "com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest#$method" \
    "$@" com.shruggietech.glitchpad.test/androidx.test.runner.AndroidJUnitRunner \
    > "$directory/$case_id-instrumentation.txt" 2>&1 || command_exit=$?
  adb_bounded logcat -d -t 2000 > "$directory/$case_id-logcat.txt" 2>&1 || logcat_exit=$?
  for extension in json png; do
    adb_bounded exec-out run-as com.shruggietech.glitchpad.test cat \
      "files/document-provider-fixtures/s048-$case_id.$extension" \
      > "$directory/s048-$case_id.$extension" 2> "$directory/$case_id-$extension-capture-error.txt" || capture_exit=$?
  done
  if [[ "$case_id" == delivery || "$case_id" == startup ]]; then
    for package in application instrumentation; do
      adb_bounded exec-out run-as com.shruggietech.glitchpad.test cat \
        "files/document-provider-fixtures/s048-installed-$package.apk" \
        > "$directory/s048-installed-$package.apk" 2> "$directory/$package-capture-error.txt" || capture_exit=$?
    done
  fi
  if (( command_exit == 0 && logcat_exit == 0 && capture_exit == 0 )); then
    node "$scripts/validate-android-release-evidence.mjs" --capture-case "$case_id" --directory "$directory" --source "$source" --api "$api" --application "$app" --instrumentation "$test_apk" > "$directory/$case_id-capture-validation.txt" 2>&1 || capture_exit=$?
  fi
  if (( command_exit == 0 && logcat_exit == 0 && capture_exit == 0 )) &&
    grep -Eq '^[[:space:]]*OK \(1 test\)[[:space:]]*$' "$directory/$case_id-instrumentation.txt" &&
    grep -Eq '^INSTRUMENTATION_CODE:[[:space:]]*-1[[:space:]]*$' "$directory/$case_id-instrumentation.txt" &&
    grep -Fq 's048_release_evidence=' "$directory/$case_id-instrumentation.txt" &&
    ! grep -Eq 'INSTRUMENTATION_(FAILED|ABORTED)|INSTRUMENTATION_RESULT:.*shortMsg=|INSTRUMENTATION_STATUS:[[:space:]]*(Error|stack)=|FAILURES!!!|^[[:space:]]*FAILURE:' "$directory/$case_id-instrumentation.txt"; then
    pass=true
  fi
  printf '{"command_exit":%s,"logcat_exit":%s,"capture_exit":%s,"pass":%s}\n' \
    "$command_exit" "$logcat_exit" "$capture_exit" "$pass" > "$directory/$case_id-status.json"
  [[ "$pass" == true ]]
}
groups=(delivery authoring recovery back_about)
if [[ "$mode" == startup ]]; then groups=(startup); fi
for group in "${groups[@]}"; do
  completed=false
  if [[ "$group" == back_about || "$group" == startup ]]; then
    offline_pending=true
    bash "$scripts/android-offline-mode.sh" setup "$evidence/offline" "$source"
  fi
  for attempt in 1 2; do
    directory="$evidence/$group-attempt-$attempt"
    mkdir "$directory"
    node "$scripts/prepare-android-instrumentation.mjs" "$directory/setup.txt"
    case "$group" in
      startup) if run_phase "$directory" startup releaseStartupIdentityAndCapture -e offlineSetup hosted_controller; then completed=true; fi ;;
      delivery) if run_phase "$directory" delivery resolvedIntentDisplaysColdAndWarmProviderDocuments; then completed=true; fi ;;
      authoring) if run_phase "$directory" authoring standaloneAuthoringAndDiagnosticJourneys; then completed=true; fi ;;
      recovery)
        if run_phase "$directory" recovery_seed draftRecoveryAcrossProcessBoundary -e recoveryPhase seed &&
          run_phase "$directory" recovery_verify draftRecoveryAcrossProcessBoundary -e recoveryPhase verify; then completed=true; fi ;;
      back_about) if run_phase "$directory" back_about releaseBackAboutAndCapture -e offlineSetup hosted_controller; then completed=true; fi ;;
    esac
    if [[ "$completed" == true ]]; then break; fi
  done
  if [[ "$group" == back_about || "$group" == startup ]]; then
    bash "$scripts/android-offline-mode.sh" restore "$evidence/offline" "$source"
    offline_pending=false
  fi
  [[ "$completed" == true ]] || exit 1
done
node "$scripts/validate-android-release-evidence.mjs" \
  --directory "$evidence" --source "$source" --api "$api" \
  --application "$app" --instrumentation "$test_apk" --mode "$mode" --output "$evidence/release-runtime.json"
