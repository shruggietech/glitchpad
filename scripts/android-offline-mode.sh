#!/usr/bin/env bash
# Disposable API24/API36 AVD setup. The app still proves actual default-network-none.
set -uo pipefail
if [[ "$#" != 3 || ( "$1" != setup && "$1" != restore ) || -z "$2" || ! "$3" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Usage: android-offline-mode.sh setup|restore EVIDENCE_PREFIX SOURCE_SHA' >&2; exit 2
fi
action="$1"; prefix="$2"; source="$3"
mkdir -p "$(dirname "$prefix")" || exit 1
run_adb() {
  local label="$1" status
  shift
  # Node is available on both macOS and Linux CI hosts; GNU timeout is not.
  node - "$prefix-$label.txt" "$prefix-$label-stderr.txt" "$@" <<'NODE'
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const child = spawnSync('adb', process.argv.slice(4), {
  timeout: 15_000, windowsHide: true, encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024,
});
fs.writeFileSync(process.argv[2], child.stdout ?? '', 'utf8');
fs.writeFileSync(process.argv[3], child.stderr ?? '', 'utf8');
process.exit(child.error?.code === 'ETIMEDOUT' ? 124 : child.status ?? 127);
NODE
  status=$?
  printf '%s exit=%s\n' "$label" "$status" >> "$prefix-commands.txt"
  return "$status"
}
read_value() {
  local label="$1"; shift
  run_adb "$label" "$@" || return 1
  local value
  value=$(tr -d '\r\n' < "$prefix-$label.txt")
  printf '%s' "$value"
}
read_settings() {
  local label="$1" airplane wifi data
  airplane=$(read_value "$label-airplane" shell settings get global airplane_mode_on) || return 1
  wifi=$(read_value "$label-wifi" shell settings get global wifi_on) || return 1
  data=$(read_value "$label-data" shell settings get global mobile_data) || return 1
  [[ "$airplane" =~ ^[01]$ && "$wifi" =~ ^[01]$ && "$data" =~ ^[01]$ ]] || return 1
  printf '%s %s %s\n' "$airplane" "$wifi" "$data"
}
ensure_host_root() {
  local label="$1" uid
  uid=$(read_value "$label-uid" shell id -u) || return 1
  if [[ "$uid" != 0 ]]; then
    [[ "$uid" == 2000 ]] || return 1
    # adbd can close the root request while restarting. Reconnect and require
    # the observed UID below before changing radios; retain the command status.
    run_adb "$label-root" root || true
    run_adb "$label-root-wait" wait-for-device || return 1
  fi
  [[ "$(read_value "$label-root-observed" shell id -u)" == 0 ]]
}
await_settings() {
  local label="$1" wanted="$2" until=$((SECONDS + 20)) actual
  while (( SECONDS < until )); do
    actual=$(read_settings "$label") || return 1
    if [[ "$actual" == "$wanted" ]]; then return 0; fi
    sleep 0.1
  done
  return 1
}
setup_offline() {
  [[ ! -e "$prefix-before-state.txt" && ! -e "$prefix-restore-required.txt" ]] || return 1
  local uid baseline airplane wifi data api
  api=$(read_value before-api shell getprop ro.build.version.sdk) || return 1
  [[ "$api" == 24 || "$api" == 36 ]] || return 1
  [[ "$(read_value before-emulator shell getprop ro.kernel.qemu)" == 1 ]] || return 1
  uid=$(read_value before-uid shell id -u) || return 1
  [[ "$uid" == 0 || "$uid" == 2000 ]] || return 1
  baseline=$(read_settings before) || return 1
  read -r airplane wifi data <<< "$baseline"
  printf '%s %s %s %s %s\n' "$source" "$uid" "$airplane" "$wifi" "$data" > "$prefix-before-state.txt" || return 1
  # Preserve restoration ownership before root or radio operations can partly succeed.
  printf 'root_or_radio_mutation_may_have_occurred\n' > "$prefix-restore-required.txt" || return 1
  ensure_host_root setup || return 1
  run_adb disable-wifi shell svc wifi disable || return 1
  run_adb disable-data shell svc data disable || return 1
  await_settings offline "$airplane 0 0" || return 1
  printf 'setup_verified:source_bound,host_uid_0,wifi_0,mobile_data_0\n' > "$prefix-setup-status.txt"
}
restore_offline() {
  if [[ ! -e "$prefix-restore-required.txt" ]]; then
    printf 'restore_not_required:no_mutation_requested\n' > "$prefix-restore-status.txt"; return 0
  fi
  local saved_source uid airplane wifi data failed=0
  read -r saved_source uid airplane wifi data < "$prefix-before-state.txt" || return 1
  [[ "$saved_source" == "$source" && ( "$uid" == 0 || "$uid" == 2000 ) && "$airplane" =~ ^[01]$ && "$wifi" =~ ^[01]$ && "$data" =~ ^[01]$ ]] || return 1
  ensure_host_root restore || return 1
  run_adb restore-wifi shell svc wifi "$([[ "$wifi" == 1 ]] && echo enable || echo disable)" || failed=1
  run_adb restore-data shell svc data "$([[ "$data" == 1 ]] && echo enable || echo disable)" || failed=1
  await_settings restored "$airplane $wifi $data" || failed=1
  if [[ "$uid" == 2000 ]]; then
    run_adb restore-unroot unroot || failed=1
    run_adb restore-unroot-wait wait-for-device || failed=1
  fi
  [[ "$(read_value restored-uid shell id -u)" == "$uid" ]] || failed=1
  if (( failed != 0 )); then
    printf 'restore_failed:command_or_exact_state\n' > "$prefix-restore-status.txt"; return 1
  fi
  rm -f "$prefix-restore-required.txt" || return 1
  printf 'restored_verified:exact_radio_settings_and_adbd_identity\n' > "$prefix-restore-status.txt"
}
if [[ "$action" == setup ]]; then
  setup_offline || { printf 'setup_failed:retained_actual_observations\n' > "$prefix-setup-status.txt"; exit 1; }
else
  restore_offline
fi
