#!/usr/bin/env bash
# Finish independent S046 observations before failing the campaign. Each journey
# retains its strict assertions and its own attempt evidence in RUNNER_TEMP.
set -uo pipefail
api_level="${1:-}"
source_commit="${2:-}"
if [[ "$api_level" != 24 && "$api_level" != 36 ]] || [[ ! "$source_commit" =~ ^[0-9a-f]{40}$ ]] || [[ -z "${RUNNER_TEMP:-}" ]]; then
  echo 'S046 journeys require API 24 or 36, a full source commit, and RUNNER_TEMP.' >&2
  exit 2
fi
runner="${BASH_SOURCE[0]%/*}/run-android-instrumentation.sh"
failures=0
record_failure() {
  echo "S046 journey failed: $1" >&2
  failures=$((failures + 1))
}
run_journey() {
  local stem="$1" marker="$2" method="$3" reset="$4"
  shift 4
  if ANDROID_INSTRUMENTATION_RESET_APP_DATA="$reset" bash "$runner" "$RUNNER_TEMP/$stem.txt" "$marker" -e class "com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest#$method" "$@"; then
    return 0
  fi
  record_failure "$stem"
  return 1
}
for delivery_action in view send; do
  run_journey "markdown-delivery-$delivery_action-evidence" 'markdown_delivery_evidence=' governedMarkdownDeliveryRoutes true -e deliveryAction "$delivery_action" -e expectedSource "$source_commit" || true
done
run_journey recovery-evidence 'recovery_evidence=' standaloneAuthoringAndDiagnosticJourneys true -e expectedSource "$source_commit" || true
run_journey root-recovery-evidence 'root_recovery_evidence=' rootFailureRetainsDraft true -e expectedSource "$source_commit" || true
if [[ "$api_level" = 36 ]]; then
  if adb shell settings put system font_scale 2.0; then
    run_journey recovery-font-evidence 'recovery_font_evidence=' addDocumentAtMaximumFontScale true || true
  else
    record_failure font-scale-setup
  fi
  # Restore the emulator before later journeys, including after a failed test.
  adb shell settings put system font_scale 1.0 || record_failure font-scale-restore
fi
if run_journey draft-recovery-seed 'draft_recovery_seed=pass' draftRecoveryAcrossProcessBoundary true -e recoveryPhase seed; then
  run_journey draft-recovery-verify 'draft_recovery_verify=pass' draftRecoveryAcrossProcessBoundary false -e recoveryPhase verify || true
else
  echo 'S046 draft verification omitted because its seed did not pass.' >&2
fi
echo "s046_campaign_failures=$failures"
[[ "$failures" = 0 ]]
