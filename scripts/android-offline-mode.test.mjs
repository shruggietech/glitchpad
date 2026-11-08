import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const source = '7a7600e3424650cd8d9aa7af528e11d1353002aa';
const script = resolve('scripts/android-offline-mode.sh');
const skip =
  process.platform === 'win32'
    ? 'Android AVD controller runs on hosted macOS or Linux.'
    : false;
const mock = String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const file = process.env.OFFLINE_TEST_STATE;
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
const args = process.argv.slice(2);
state.calls.push(args);
const save = () => fs.writeFileSync(file, JSON.stringify(state));
const fail = () => { save(); process.exit(1); };
if (args[0] === 'root') { if (state.rootDenied) fail(); state.uid = 0; }
else if (args[0] === 'unroot') { state.uid = 2000; }
else if (args[0] === 'wait-for-device') {}
else if (args.join(' ') === 'shell id -u') console.log(state.uid);
else if (args.join(' ') === 'shell getprop ro.build.version.sdk') console.log(state.api ?? 24);
else if (args.join(' ') === 'shell getprop ro.kernel.qemu') console.log(state.qemu ?? 1);
else if (args.slice(0,4).join(' ') === 'shell settings get global') console.log(state[args[4]]);
else if (args.slice(0,2).join(' ') === 'shell svc') {
 const key = args[2] === 'wifi' ? 'wifi_on' : args[2] === 'data' ? 'mobile_data' : null;
 if (!key) fail();
 if (state.uid !== 0) fail();
 if (state.failWifiOnce && key === 'wifi_on' && args[3] === 'disable') { state.failWifiOnce = false; fail(); }
 if (state.failRestore && key === 'wifi_on' && args[3] === 'enable') fail();
 state[key] = args[3] === 'enable' ? 1 : 0;
} else fail();
save();
`;

async function fixture(initial = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'glitchpad-offline-'));
  const stateFile = join(dir, 'state.json');
  await writeFile(
    stateFile,
    JSON.stringify({
      uid: 2000,
      airplane_mode_on: 0,
      wifi_on: 1,
      mobile_data: 1,
      calls: [],
      ...initial,
    }),
  );
  await writeFile(join(dir, 'adb'), mock);
  await chmod(join(dir, 'adb'), 0o755);
  const prefix = join(dir, 'evidence', 'offline');
  const run = (action, sha = source) =>
    spawnSync('bash', [script, action, prefix, sha], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 45_000,
      env: {
        ...process.env,
        PATH: dir + ':' + process.env.PATH,
        OFFLINE_TEST_STATE: stateFile,
      },
    });
  return {
    dir,
    prefix,
    run,
    state: async () => JSON.parse(await readFile(stateFile, 'utf8')),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
test(
  'host setup proves root and disables radios, then restores exact radio and adbd identity',
  { skip },
  async () => {
    const f = await fixture();
    try {
      assert.equal(f.run('setup').status, 0);
      const offline = await f.state();
      assert.deepEqual(
        [offline.uid, offline.wifi_on, offline.mobile_data],
        [0, 0, 0],
      );
      assert.match(
        await readFile(f.prefix + '-before-state.txt', 'utf8'),
        new RegExp('^' + source + ' 2000 0 1 1'),
      );
      assert.equal(f.run('restore').status, 0);
      const restored = await f.state();
      assert.deepEqual(
        [
          restored.uid,
          restored.airplane_mode_on,
          restored.wifi_on,
          restored.mobile_data,
        ],
        [2000, 0, 1, 1],
      );
      assert.match(
        await readFile(f.prefix + '-restore-status.txt', 'utf8'),
        /^restored_verified:/,
      );
    } finally {
      await f.cleanup();
    }
  },
);
test(
  'initial root authority remains root after restoration',
  { skip },
  async () => {
    const f = await fixture({ uid: 0, airplane_mode_on: 1, wifi_on: 0 });
    try {
      assert.equal(f.run('setup').status, 0);
      assert.equal(f.run('restore').status, 0);
      const state = await f.state();
      assert.equal(state.uid, 0);
      assert.equal(state.airplane_mode_on, 1);
      assert.equal(state.wifi_on, 0);
      assert.ok(!state.calls.some((args) => args[0] === 'unroot'));
    } finally {
      await f.cleanup();
    }
  },
);
test(
  'a partial setup failure retains its baseline and still restores the original identity',
  { skip },
  async () => {
    const f = await fixture({ failWifiOnce: true });
    try {
      assert.equal(f.run('setup').status, 1);
      assert.match(
        await readFile(f.prefix + '-setup-status.txt', 'utf8'),
        /^setup_failed:/,
      );
      assert.equal(f.run('restore').status, 0);
      const state = await f.state();
      assert.deepEqual(
        [state.uid, state.wifi_on, state.mobile_data],
        [2000, 1, 1],
      );
    } finally {
      await f.cleanup();
    }
  },
);
test(
  'denied root authority cannot emit a successful setup receipt',
  { skip },
  async () => {
    const f = await fixture({ rootDenied: true });
    try {
      assert.equal(f.run('setup').status, 1);
      assert.match(
        await readFile(f.prefix + '-setup-status.txt', 'utf8'),
        /^setup_failed:/,
      );
      assert.equal((await f.state()).wifi_on, 1);
    } finally {
      await f.cleanup();
    }
  },
);
test(
  'unknown settings are rejected before any root or radio mutation',
  { skip },
  async () => {
    const f = await fixture({ wifi_on: 'null' });
    try {
      assert.equal(f.run('setup').status, 1);
      assert.ok(
        !(await f.state()).calls.some(
          (args) => args[0] === 'root' || args[1] === 'svc',
        ),
      );
      assert.equal(f.run('restore').status, 0);
    } finally {
      await f.cleanup();
    }
  },
);
test(
  'restore rejects a stale source identity before touching radios',
  { skip },
  async () => {
    const f = await fixture();
    try {
      assert.equal(f.run('setup').status, 0);
      assert.equal(f.run('restore', 'f'.repeat(40)).status, 1);
      const state = await f.state();
      assert.deepEqual(
        [state.uid, state.wifi_on, state.mobile_data],
        [0, 0, 0],
      );
      assert.equal(f.run('restore').status, 0);
    } finally {
      await f.cleanup();
    }
  },
);
test(
  'restore command failure remains a failure and restores the original adbd identity',
  { skip },
  async () => {
    const f = await fixture({ failRestore: true });
    try {
      assert.equal(f.run('setup').status, 0);
      assert.equal(f.run('restore').status, 1);
      assert.match(
        await readFile(f.prefix + '-restore-status.txt', 'utf8'),
        /^restore_failed:/,
      );
      assert.equal((await f.state()).uid, 2000);
    } finally {
      await f.cleanup();
    }
  },
);
test(
  'invalid source is rejected before contacting the emulator',
  { skip },
  async () => {
    const f = await fixture();
    try {
      assert.equal(f.run('setup', 'invalid').status, 2);
      assert.equal((await f.state()).calls.length, 0);
    } finally {
      await f.cleanup();
    }
  },
);

test(
  'wrong API or non-emulator target is rejected before root or radio mutation',
  { skip },
  async () => {
    for (const initial of [{ api: 35 }, { qemu: 0 }]) {
      const f = await fixture(initial);
      try {
        assert.equal(f.run('setup').status, 1);
        assert.ok(
          !(await f.state()).calls.some(
            (args) => args[0] === 'root' || args[1] === 'svc',
          ),
        );
      } finally {
        await f.cleanup();
      }
    }
  },
);

test(
  'setup and exact restoration do not require GNU timeout',
  { skip },
  async () => {
    const f = await fixture();
    try {
      const marker = join(f.dir, 'gnu-timeout-was-called');
      await writeFile(
        join(f.dir, 'timeout'),
        '#!/usr/bin/env bash\nprintf called > "' + marker + '"\nexit 127\n',
      );
      await chmod(join(f.dir, 'timeout'), 0o755);
      assert.equal(f.run('setup').status, 0);
      assert.equal(f.run('restore').status, 0);
      await assert.rejects(readFile(marker), { code: 'ENOENT' });
      const state = await f.state();
      assert.deepEqual(
        [state.uid, state.wifi_on, state.mobile_data],
        [2000, 1, 1],
      );
    } finally {
      await f.cleanup();
    }
  },
);

test(
  'API36 offline setup uses host root and restores the exact source-bound radios and original adbd identity',
  { skip },
  async () => {
    const f = await fixture({ api: 36 });
    try {
      assert.equal(f.run('setup').status, 0);
      const offline = await f.state();
      assert.deepEqual(
        [
          offline.uid,
          offline.airplane_mode_on,
          offline.wifi_on,
          offline.mobile_data,
        ],
        [0, 0, 0, 0],
      );
      assert.match(
        await readFile(f.prefix + '-before-state.txt', 'utf8'),
        new RegExp('^' + source + ' 2000 0 1 1'),
      );
      assert.equal(f.run('restore').status, 0);
      const restored = await f.state();
      assert.deepEqual(
        [
          restored.uid,
          restored.airplane_mode_on,
          restored.wifi_on,
          restored.mobile_data,
        ],
        [2000, 0, 1, 1],
      );
      assert.match(
        await readFile(f.prefix + '-restore-status.txt', 'utf8'),
        /^restored_verified:/,
      );
    } finally {
      await f.cleanup();
    }
  },
);
