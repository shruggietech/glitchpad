import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseIdentity, targetReleaseIdentity } from './release-identity.mjs';

const fixture = () => ({
  schema_version: 1,
  version: '0.2.1',
  tag: 'v0.2.1',
  repository: 'shruggietech/glitchpad',
  artifacts: [
    'windows-x86_64-setup.exe',
    'windows-x86_64.zip',
    'macos-universal.dmg',
    'linux-x86_64.AppImage',
    'linux-x86_64.deb',
    'android-universal.apk',
    'android-arm64.apk',
    'android-universal.aab',
  ].map((name) => 'glitchpad-0.2.1-' + name),
});

test('target identity binds version, tag and the complete payload inventory', () => {
  const value = targetReleaseIdentity(fixture());
  assert.equal(value.tag, 'v' + value.version);
  assert.equal(value.artifacts.length, 8);
  assert.throws(() => value.artifacts.push('extra'), TypeError);
  assert.equal(releaseIdentity.tag, 'v' + releaseIdentity.version);
});

test('target identity rejects cross-version, duplicate and missing payloads', () => {
  for (const mutate of [
    (value) => {
      value.tag = 'v9.9.9';
    },
    (value) => {
      value.artifacts[0] = value.artifacts[1];
    },
    (value) => {
      value.artifacts.pop();
    },
    (value) => {
      value.artifacts[0] = value.artifacts[0].replace('0.2.1', '0.2.0');
    },
    (value) => {
      value.version = '../outside';
    },
  ]) {
    const value = fixture();
    mutate(value);
    assert.throws(
      () => targetReleaseIdentity(value),
      /release|payload|version/i,
    );
  }
});
