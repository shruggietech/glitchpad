import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const run = promisify(execFile);
const out = join(process.env.RUNNER_TEMP, 's047-handoff-probe');
await mkdir(out, { recursive: true });
const adb = async (args) => (await run(process.execPath, ['scripts/bounded-android-adb.mjs', ...args], { encoding: 'utf8', timeout: 70000, maxBuffer: 1024 * 1024 })).stdout;
const api = Number(process.env.DIAGNOSTIC_API);
for (const path of [process.env.S047_DIAGNOSTIC_APK, join(process.env.RUNNER_TEMP, 's047-observer-diagnostic', 'instrumentation.apk')]) {
  await adb(['install', '-r', '-t', ...(api === 24 ? ['--no-streaming'] : []), path]);
}
await adb(['shell', 'svc', 'power', 'stayon', 'true']);
await adb(['shell', 'input', 'keyevent', '224']);
await adb(['shell', 'wm', 'dismiss-keyguard']);
await adb(['shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1']);
for (const pkg of ['com.google.android.gms', 'com.google.android.googlequicksearchbox']) {
  if ((await adb(['shell', 'pm', 'list', 'packages', pkg])).includes('package:' + pkg)) await adb(['shell', 'pm', 'disable-user', '--user', '0', pkg]);
}
if (api === 36) {
  await adb(['shell', 'svc', 'bluetooth', 'disable']);
  await adb(['shell', 'settings', 'put', 'global', 'hide_error_dialogs', '1']);
  await adb(['shell', 'am', 'broadcast', '-a', 'android.intent.action.CLOSE_SYSTEM_DIALOGS']);
  await adb(['shell', 'cmd', 'overlay', 'enable', '--user', '0', 'com.android.internal.display.cutout.emulation.corner']);
}
const results = [];
for (const phase of ['seed', 'verify']) {
  const method = 'draftRecoveryAcrossProcessBoundary';
  await adb(['shell', 'am', 'force-stop', 'com.shruggietech.glitchpad']);
  await adb(['shell', 'settings', 'put', 'system', 'font_scale', '1.0']);
  try {
    const r = await run('bash', ['scripts/run-android-instrumentation.sh', join(out, method + '-' + phase + '.txt'), 'draft_recovery_' + phase + '=pass', '-e', 's047', 'true', '-e', 'recoveryPhase', phase, '-e', 'waitForActivitiesToComplete', 'false', '-e', 'expectedSource', process.env.GLITCHPAD_BUILD_COMMIT, '-e', 'expectedRole', 'ordinary', '-e', 'class', 'com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest#' + method], { env: { ...process.env, ANDROID_INSTRUMENTATION_RESET_APP_DATA: phase === 'seed' ? 'true' : 'false' }, encoding: 'utf8', timeout: 480000, maxBuffer: 4 * 1024 * 1024 });
    await writeFile(join(out, method + '-' + phase + '-driver.log'), r.stdout + '\n' + r.stderr);
    results.push({ method, phase, status: 'pass' });
  } catch (error) {
    await writeFile(join(out, method + '-' + phase + '-driver.log'), String(error.stdout || '') + '\n' + String(error.stderr || '') + '\n' + String(error));
    results.push({ method, phase, status: 'fail', code: error.code });
    break;
  }
}
await writeFile(join(out, 'result.json'), JSON.stringify({ diagnostic_only: true, candidate_qualified: false, api_level: api, product_source: process.env.GLITCHPAD_BUILD_COMMIT, driver_source: process.env.GITHUB_SHA, results }, null, 2) + '\n');
if (results.some(r => r.status !== 'pass')) process.exitCode = 1;
