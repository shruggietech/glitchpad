import { readFileSync } from 'node:fs';

const payloadSuffixes = [
  'windows-x86_64-setup.exe',
  'windows-x86_64.zip',
  'macos-universal.dmg',
  'linux-x86_64.AppImage',
  'linux-x86_64.deb',
  'android-universal.apk',
  'android-arm64.apk',
  'android-universal.aab',
];

export function targetReleaseIdentity(contract) {
  if (
    contract?.schema_version !== 1 ||
    !/^\d+\.\d+\.\d+$/u.test(contract.version ?? '') ||
    contract.tag !== 'v' + contract.version ||
    contract.repository !== 'shruggietech/glitchpad'
  )
    throw new Error('Target release identity is invalid');
  const expected = payloadSuffixes.map(
    (suffix) => 'glitchpad-' + contract.version + '-' + suffix,
  );
  if (
    !Array.isArray(contract.artifacts) ||
    contract.artifacts.length !== expected.length ||
    new Set(contract.artifacts).size !== expected.length ||
    expected.some((name) => !contract.artifacts.includes(name))
  )
    throw new Error('Target release payload inventory is invalid');
  return Object.freeze({
    version: contract.version,
    tag: contract.tag,
    repository: contract.repository,
    artifacts: Object.freeze([...contract.artifacts]),
  });
}

export const releaseIdentity = targetReleaseIdentity(
  JSON.parse(
    readFileSync(
      new URL('../../packaging/release/package-contract.json', import.meta.url),
      'utf8',
    ),
  ),
);
