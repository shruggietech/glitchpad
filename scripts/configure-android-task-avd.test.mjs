import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { configureAndroidTaskAvd } from './configure-android-task-avd.mjs';

async function fixture(input, run) {
  const directory = await mkdtemp(join(tmpdir(), 'glitchpad-avd-'));
  const path = join(directory, 'config.ini');
  try {
    if (input !== null) await writeFile(path, input, 'utf8');
    await run(path);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('adds software navigation hardware without changing display, memory or keyboard choices', async () => {
  const original =
    '# hosted device\nhw.lcd.width=480\nhw.ramSize=2048\nhw.keyboard=no\n';
  await fixture(original, async (path) => {
    const result = await configureAndroidTaskAvd(path);
    assert.equal(await readFile(path, 'utf8'), original + 'hw.mainKeys=no\n');
    assert.equal(result.hardware_main_keys, false);
    assert.match(result.config_sha256, /^[a-f0-9]{64}$/u);
  });
});

test('removes conflicting duplicate hardware-key values while preserving unrelated keys', async () => {
  await fixture(
    'hw.mainKeys=yes\nhw.mainKeysBackup=yes\nhw.keyboard=yes\n  hw.mainKeys = true\n',
    async (path) => {
      await configureAndroidTaskAvd(path);
      assert.equal(
        await readFile(path, 'utf8'),
        'hw.mainKeysBackup=yes\nhw.keyboard=yes\nhw.mainKeys=no\n',
      );
    },
  );
});

test('keeps the configured hardware idempotent and writes UTF-8 without BOM', async () => {
  await fixture('\uFEFFhw.keyboard=no\r\nhw.mainKeys=no\r\n', async (path) => {
    const first = await configureAndroidTaskAvd(path);
    const second = await configureAndroidTaskAvd(path);
    assert.deepEqual(second, first);
    assert.equal(
      await readFile(path, 'utf8'),
      'hw.keyboard=no\nhw.mainKeys=no\n',
    );
  });
});

test('rejects a missing AVD instead of creating an incomplete hardware profile', async () => {
  await fixture(null, async (path) => {
    await assert.rejects(configureAndroidTaskAvd(path), { code: 'ENOENT' });
    await assert.rejects(readFile(path), { code: 'ENOENT' });
  });
});
