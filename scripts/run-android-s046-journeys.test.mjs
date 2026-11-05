import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  chmod,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const source = 'a'.repeat(40);
const posix = {
  skip:
    process.platform === 'win32'
      ? 'Hosted POSIX runner; interactive Windows uses Linux containers.'
      : false,
};

async function campaign(api = '36', failures = '', expectedSource = source) {
  const directory = await mkdtemp(join(tmpdir(), 'glitchpad-s046-campaign-'));
  try {
    await mkdir(join(directory, 'scripts'));
    await mkdir(join(directory, 'bin'));
    await copyFile(
      new URL('./run-android-s046-journeys.sh', import.meta.url),
      join(directory, 'scripts/run-android-s046-journeys.sh'),
    );
    await writeFile(
      join(directory, 'scripts/run-android-instrumentation.sh'),
      [
        '#!/usr/bin/env bash',
        'set -eu',
        'stem="$(basename "$1" .txt)"',
        'printf "%s|%s|%s\\n" "$stem" "$ANDROID_INSTRUMENTATION_RESET_APP_DATA" "$*" >> "$RUNNER_TEMP/calls.txt"',
        'if [[ ",$MOCK_FAILURES," == *",$stem,"* ]]; then exit 1; fi',
        'printf "%s\\n" "$2" > "$1"',
        '',
      ].join('\n'),
    );
    const adb = join(directory, 'bin/adb');
    await writeFile(
      adb,
      '#!/usr/bin/env bash\nprintf "adb:%s\\n" "$*" >> "$RUNNER_TEMP/calls.txt"\n',
    );
    await chmod(adb, 0o755);
    const result = spawnSync(
      'bash',
      ['scripts/run-android-s046-journeys.sh', api, expectedSource],
      {
        cwd: directory,
        env: {
          ...process.env,
          PATH: join(directory, 'bin') + ':' + process.env.PATH,
          RUNNER_TEMP: directory,
          MOCK_FAILURES: failures,
        },
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    let calls = '';
    try {
      calls = await readFile(join(directory, 'calls.txt'), 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return { ...result, calls: calls.trim().split('\n').filter(Boolean) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test(
  'baseline and cold delivery/authoring failures remain failures while later root/font/process observations finish',
  posix,
  async () => {
    const result = await campaign(
      '36',
      'delivery-evidence,markdown-delivery-view-evidence,recovery-evidence',
    );
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /s046_campaign_failures=3/);
    assert.equal(
      result.calls.filter((line) => !line.startsWith('adb:')).length,
      8,
    );
    assert.ok(
      result.calls.some((line) =>
        line.startsWith('root-recovery-evidence|true|'),
      ),
    );
    assert.ok(
      result.calls.some((line) =>
        line.startsWith('draft-recovery-verify|false|'),
      ),
    );
    assert.ok(
      result.calls.some((line) => line.includes('-e expectedSource ' + source)),
    );
  },
);

test(
  'failed font journey still restores scale before process-boundary recovery',
  posix,
  async () => {
    const result = await campaign('36', 'recovery-font-evidence');
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const restore = result.calls.findIndex(
      (line) => line === 'adb:shell settings put system font_scale 1.0',
    );
    const seed = result.calls.findIndex((line) =>
      line.startsWith('draft-recovery-seed|'),
    );
    assert.ok(restore >= 0 && restore < seed, result.calls.join('\n'));
    assert.match(result.stdout, /s046_campaign_failures=1/);
  },
);

test(
  'failed process seed prevents stale verification from qualifying the campaign',
  posix,
  async () => {
    const result = await campaign('36', 'draft-recovery-seed');
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(
      !result.calls.some((line) => line.startsWith('draft-recovery-verify|')),
    );
    assert.match(result.stderr, /seed did not pass/);
  },
);

test(
  'API24 runs every applicable journey without changing font scale',
  posix,
  async () => {
    const result = await campaign('24');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.calls.length, 7);
    assert.ok(
      result.calls.every((line) =>
        line.includes('-e waitForActivitiesToComplete false'),
      ),
      result.calls.join('\n'),
    );
    assert.ok(!result.calls.some((line) => line.startsWith('adb:')));
    assert.match(result.stdout, /s046_campaign_failures=0/);
  },
);

test(
  'API36 succeeds only after all eight journeys succeed',
  posix,
  async () => {
    const result = await campaign();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(
      result.calls
        .filter((line) => !line.startsWith('adb:'))
        .every((line) => line.includes('-e waitForActivitiesToComplete false')),
      result.calls.join('\n'),
    );
    assert.equal(
      result.calls.filter((line) => !line.startsWith('adb:')).length,
      8,
    );
  },
);

test('only dedicated Tauri UI classes bypass runner ActivityFinisher', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/ci.yml', import.meta.url),
    'utf8',
  );
  const invocations = workflow
    .split('\n')
    .filter((line) =>
      line.includes('bash scripts/run-android-instrumentation.sh'),
    );
  let tauriInvocations = 0;
  for (const invocation of invocations) {
    const tauriClass =
      /BrandBuilderAppFrameInstrumentedTest|PerformanceInstrumentedTest|AndroidDeliveryInstrumentedTest/u.test(
        invocation,
      );
    if (tauriClass) {
      tauriInvocations += 1;
      assert.match(invocation, /-e waitForActivitiesToComplete false/u);
    } else {
      assert.doesNotMatch(invocation, /waitForActivitiesToComplete/u);
    }
  }
  assert.equal(
    tauriInvocations,
    3,
    'both AppFrame API paths and Performance must use runner-owned completion',
  );
});

test(
  'invalid API or source identity fails before any instrumentation',
  posix,
  async () => {
    for (const [api, identity] of [
      ['23', source],
      ['36', 'unknown'],
    ]) {
      const result = await campaign(api, '', identity);
      assert.equal(result.status, 2, result.stdout + result.stderr);
      assert.deepEqual(result.calls, []);
    }
  },
);
