#!/usr/bin/env bash
# Independent observations retain the original two-attempt clean-completion gate.
set -uo pipefail
api="${1:-}"; source="${2:-}"; role="${3:-}"
if [[ "$api" != 24 && "$api" != 36 ]] || [[ ! "$source" =~ ^[0-9a-f]{40}$ ]] || [[ "$role" != ordinary && "$role" != fault_probe ]] || [[ -z "${RUNNER_TEMP:-}" ]]; then
  echo 'S047 requires API24/36, full source, ordinary/fault_probe and RUNNER_TEMP.' >&2; exit 2
fi
runner="${BASH_SOURCE[0]%/*}/run-android-instrumentation.sh"
navigation="${BASH_SOURCE[0]%/*}/android-navigation-mode.sh"
navigation_restore_pending=false
failures=0
run_task() {
  local name="$1" method="$2" marker="s047_journey_evidence="
  shift 2
  if ! ANDROID_INSTRUMENTATION_RESET_APP_DATA=true bash "$runner" "$RUNNER_TEMP/s047-$name.txt" "$marker" -e waitForActivitiesToComplete false -e s047 true -e expectedSource "$source" -e expectedRole "$role" -e class "com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest#$method" "$@"; then failures=$((failures+1)); fi
}
restore_navigation() {
  if [[ "$navigation_restore_pending" == true ]]; then
    navigation_restore_pending=false
    bash "$navigation" restore "$RUNNER_TEMP/s047-navigation" || failures=$((failures+1))
  fi
}
cleanup() {
  local status=$?
  trap - EXIT
  restore_navigation
  adb shell settings put system font_scale 1.0 || failures=$((failures+1))
  adb shell wm size reset || failures=$((failures+1))
  if (( status != 0 || failures != 0 )); then exit 1; fi
}
trap cleanup EXIT
if [[ "$role" == ordinary ]]; then
  run_task cold s047ColdAddJourney
  run_task markdown s047MarkdownJourney -e deliveryAction view
  run_task source-failure s047SourceFailureJourney
  run_task authoring standaloneAuthoringAndDiagnosticJourneys
  run_task images s047ImageJourney
  run_task layout s047LayoutJourney
  if [[ "$api" = 36 ]]; then
    navigation_restore_pending=true
    if bash "$navigation" setup "$RUNNER_TEMP/s047-navigation"; then
      run_task back s047BackJourney
    else
      echo 'S047 actual gesture-navigation setup failed.' >&2
      failures=$((failures+1))
    fi
    restore_navigation
  else run_task back s047BackJourney; fi
  run_task about s047AboutJourney
  if ANDROID_INSTRUMENTATION_RESET_APP_DATA=true bash "$runner" "$RUNNER_TEMP/s047-draft-seed.txt" 'draft_recovery_seed=pass' -e waitForActivitiesToComplete false -e expectedSource "$source" -e expectedRole "$role" -e class com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest#draftRecoveryAcrossProcessBoundary -e recoveryPhase seed; then
    ANDROID_INSTRUMENTATION_RESET_APP_DATA=false bash "$runner" "$RUNNER_TEMP/s047-draft-verify.txt" 'draft_recovery_verify=pass' -e waitForActivitiesToComplete false -e expectedSource "$source" -e expectedRole "$role" -e class com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest#draftRecoveryAcrossProcessBoundary -e recoveryPhase verify || failures=$((failures+1))
  else failures=$((failures+1)); fi
else run_task faults s047FaultJourney; fi
node scripts/validate-android-recovery-evidence.mjs --directory "$RUNNER_TEMP" --source "$source" --role "$role" --api "$api" --output "$RUNNER_TEMP/s047-recovery-evidence.json" || failures=$((failures+1))
echo "s047_campaign_failures=$failures"
[[ "$failures" = 0 ]]
