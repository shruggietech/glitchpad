#!/usr/bin/env bash
# API36 qualification setup only. Overlay/resource observations are not Back evidence.
# AOSP android-16.0.0_r1 OverlayManagerShellCommand defines enable-exclusive/lookup.
set -uo pipefail
if [[ "$#" != 2 || ( "$1" != setup && "$1" != restore ) || -z "$2" ]]; then
  echo 'Usage: android-navigation-mode.sh setup|restore EVIDENCE_PREFIX' >&2
  exit 2
fi
action="$1"; prefix="$2"
mkdir -p "$(dirname "$prefix")" || exit 1
run_adb() {
  local label="$1" status
  shift
  adb "$@" > "$prefix-$label.txt" 2> "$prefix-$label-stderr.txt"
  status=$?
  printf '%s exit=%s command=' "$label" "$status" >> "$prefix-commands.txt"
  printf ' %q' "$@" >> "$prefix-commands.txt"
  printf '\n' >> "$prefix-commands.txt"
  return "$status"
}
capture_overlays() {
  local stage="$1"
  run_adb "$stage" shell cmd overlay list || return 1
  awk '
    { sub(/\r$/, "") }
    /com[.]android[.]internal[.]systemui[.]navbar[.]/ {
      if ($0 !~ /^\[[x ]\] com[.]android[.]internal[.]systemui[.]navbar[.][A-Za-z0-9_.:-]+$/) { invalid=1; next }
      name=substr($0,5)
      if (seen[name]++) { invalid=1; next }
      count++
      print (substr($0,2,1)=="x" ? "enabled" : "disabled"), name
    }
    END { if (!count || invalid) exit 1 }
  ' "$prefix-$stage.txt" | LC_ALL=C sort > "$prefix-$stage-state.txt"
}
capture_mode() {
  local stage="$1"
  run_adb "$stage-mode" shell cmd overlay lookup android android:integer/config_navBarInteractionMode || return 1
  awk '
    { sub(/\r$/, "") }
    /^[[:space:]]*$/ { next }
    {
      count++
      resolved=$0
      sub(/^@-?[0-9]+ -> /, "", resolved)
      if (resolved ~ /^[012]$/) value=resolved
      else if (resolved ~ /^0x0*[012]$/) value=substr(resolved,length(resolved),1)
      else invalid=1
    }
    END { if (count!=1 || invalid || value=="") exit 1; print value }
  ' "$prefix-$stage-mode.txt" > "$prefix-$stage-mode-value.txt"
}
setup_failure() {
  printf 'setup_failed:%s\n' "$1" > "$prefix-setup-status.txt"
  printf 'S047 navigation setup failed: %s\n' "$1" >&2
  return 1
}
setup_navigation() {
  if [[ -e "$prefix-before.txt" || -e "$prefix-restore-required.txt" ]]; then
    setup_failure baseline_already_exists
    return 1
  fi
  if ! capture_overlays before; then setup_failure baseline_overlay_capture; return 1; fi
  if ! capture_mode before; then setup_failure baseline_resource_lookup; return 1; fi
  if ! grep -Eq '^(enabled|disabled) com\.android\.internal\.systemui\.navbar\.gestural$' "$prefix-before-state.txt"; then
    setup_failure gestural_overlay_unavailable
    return 1
  fi
  # Preserve the baseline before any mutation, including a command that fails partly.
  printf 'overlay_mutation_may_have_occurred\n' > "$prefix-restore-required.txt" || return 1
  if ! run_adb enable-gestural shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.gestural; then
    setup_failure enable_exclusive_command
    return 1
  fi
  if ! capture_overlays gestural; then setup_failure gestural_overlay_capture; return 1; fi
  if ! capture_mode gestural; then setup_failure gestural_resource_lookup; return 1; fi
  if ! grep -Fxq 'enabled com.android.internal.systemui.navbar.gestural' "$prefix-gestural-state.txt" ||
     [[ "$(cat "$prefix-gestural-mode-value.txt")" != 2 ]]; then
    setup_failure gestural_state_not_observed
    return 1
  fi
  printf 'setup_verified:overlay_enabled,resource_mode_2\n' > "$prefix-setup-status.txt"
}
restore_navigation() {
  local failed=0 state overlay index=0
  if [[ ! -e "$prefix-restore-required.txt" ]]; then
    printf 'restore_not_required:no_mutation_requested\n' > "$prefix-restore-status.txt"
    return 0
  fi
  if [[ ! -f "$prefix-before-state.txt" || ! -f "$prefix-before-mode-value.txt" ]]; then
    printf 'restore_failed:baseline_missing\n' > "$prefix-restore-status.txt"
    return 1
  fi
  # Restore the complete saved vector; an all-off base mode has no chosen overlay.
  while read -r state overlay; do
    if [[ "$state" == disabled ]]; then
      index=$((index+1))
      run_adb "restore-disabled-$index" shell cmd overlay disable "$overlay" || failed=1
    fi
  done < "$prefix-before-state.txt"
  while read -r state overlay; do
    if [[ "$state" == enabled ]]; then
      index=$((index+1))
      run_adb "restore-enabled-$index" shell cmd overlay enable "$overlay" || failed=1
    fi
  done < "$prefix-before-state.txt"
  capture_overlays restored || failed=1
  capture_mode restored || failed=1
  cmp -s "$prefix-before-state.txt" "$prefix-restored-state.txt" || failed=1
  cmp -s "$prefix-before-mode-value.txt" "$prefix-restored-mode-value.txt" || failed=1
  if [[ "$failed" != 0 ]]; then
    printf 'restore_failed:command_or_state_verification\n' > "$prefix-restore-status.txt"
    echo 'S047 navigation restoration failed; retained baseline and actual observations.' >&2
    return 1
  fi
  rm -f "$prefix-restore-required.txt" || return 1
  printf 'restored_verified:exact_overlay_vector_and_resource_mode\n' > "$prefix-restore-status.txt"
}
if [[ "$action" == setup ]]; then setup_navigation; else restore_navigation; fi
