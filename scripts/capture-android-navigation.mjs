import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

if (process.argv.length !== 3)
  throw new Error('A navigation diagnostic output path is required.');
const requests = [
  ['legacy_main_keys', ['shell', 'getprop', 'qemu.hw.mainkeys']],
  ['boot_main_keys', ['shell', 'getprop', 'ro.boot.qemu.hw.mainkeys']],
  ['window_policy', ['shell', 'dumpsys', '-t', '3', 'window']],
  [
    'system_ui',
    [
      'shell',
      'dumpsys',
      '-t',
      '3',
      'activity',
      'service',
      'com.android.systemui/.SystemUIService',
    ],
  ],
];
const observations = requests.map(([name, args]) => {
  try {
    const stdout = execFileSync('adb', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    return { name, status: 0, stdout };
  } catch (error) {
    return {
      name,
      status: Number.isInteger(error.status) ? error.status : null,
      code: error.code ?? null,
      signal: error.signal ?? null,
      stdout: String(error.stdout ?? ''),
      stderr: String(error.stderr ?? ''),
    };
  }
});
await writeFile(
  process.argv[2],
  JSON.stringify(
    { schema_version: 1, observational_only: true, observations },
    null,
    2,
  ) + '\n',
  'utf8',
);
console.log(
  's047_navigation_observation=' +
    JSON.stringify(
      observations.map(({ name, status, code, stdout }) => ({
        name,
        status,
        code: code ?? null,
        value: name.endsWith('main_keys') ? stdout.trim() : undefined,
      })),
    ),
);
