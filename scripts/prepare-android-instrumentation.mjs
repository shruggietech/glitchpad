import { appendFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const setupPath = process.argv[2];
if (process.argv.length !== 3 || !setupPath) {
  console.error('usage: prepare-android-instrumentation.mjs SETUP_DIAGNOSTIC');
  process.exitCode = 2;
} else {
  const packages = [
    'com.shruggietech.glitchpad',
    'com.shruggietech.glitchpad.test',
  ];
  let phase = 'wait_for_device';
  const record = (line) => appendFileSync(setupPath, line + '\n', 'utf8');
  const enter = (next) => {
    phase = next;
    record('phase=' + phase);
  };
  const adb = (args, timeoutMs, tolerateFailure = false) => {
    try {
      return execFileSync('adb', args, {
        encoding: 'utf8',
        timeout: timeoutMs,
        killSignal: 'SIGKILL',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    } catch (error) {
      record(
        'adb_exit_status=' +
          (Number.isInteger(error.status) ? error.status : 'unavailable'),
      );
      record('adb_timeout=' + (error.code === 'ETIMEDOUT'));
      if (!tolerateFailure) throw new Error('Required adb operation failed.');
      return '';
    }
  };
  writeFileSync(setupPath, '', 'utf8');
  try {
    enter('wait_for_device');
    adb(['wait-for-device'], 60_000);
    enter('wait_for_boot_and_package_manager');
    const deadline = Date.now() + 60_000;
    let ready = false;
    while (Date.now() < deadline) {
      const booted =
        adb(['shell', 'getprop', 'sys.boot_completed'], 5_000, true) === '1';
      const pathsReady =
        booted &&
        packages.every((packageName) =>
          /^package:\/[^\s]+\.apk$/u.test(
            adb(['shell', 'pm', 'path', packageName], 5_000, true),
          ),
        );
      if (pathsReady) {
        ready = true;
        break;
      }
      await delay(1_000);
    }
    if (!ready) throw new Error('Device/package readiness timed out.');
    for (const [index, packageName] of packages.entries()) {
      enter(index === 0 ? 'reset_application' : 'reset_instrumentation');
      if (adb(['shell', 'pm', 'clear', packageName], 30_000) !== 'Success')
        throw new Error('Package reset did not report success.');
    }
    enter('ready');
  } catch {
    record('setup_failure=true');
    console.error(
      'Android instrumentation setup did not complete at ' + phase + '.',
    );
    process.exitCode = 1;
  }
}
