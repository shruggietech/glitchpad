import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function assertVendoredPatches(lock, expected) {
  const packages = [...lock.matchAll(/\[\[package\]\]([\s\S]*?)(?=\n\[\[|$)/g)].map((m) => m[1]);
  for (const [name, version] of Object.entries(expected)) {
    const matches = packages.filter((p) => new RegExp('^name = \"' + name + '\"$', 'm').test(p));
    assert.equal(matches.length, 1, 'Required vendored patch is missing or duplicated: ' + name);
    assert.ok(new RegExp('^version = \"' + version.replaceAll('.', '\\.') + '\"$', 'm').test(matches[0]), 'Required vendored patch version was bypassed: ' + name);
    assert.ok(!/^source = /m.test(matches[0]), 'Registry package bypassed required vendored patch: ' + name);
  }
}

export async function checkVendoredPatches(root = fileURLToPath(new URL('../', import.meta.url))) {
  const manifest = await readFile(resolve(root, 'Cargo.toml'), 'utf8');
  const patchSection = manifest.split('[patch.crates-io]')[1]?.split(/\n\[/)[0];
  assert.ok(patchSection, 'Required vendored patch configuration is missing');
  const expected = {};
  for (const match of patchSection.matchAll(/^([a-z0-9_-]+) = \{ path = \"([^\"]+)\" \}$/gm)) {
    const vendor = await readFile(resolve(root, match[2], 'Cargo.toml'), 'utf8');
    expected[match[1]] = vendor.match(/^version = \"([^\"]+)\"$/m)?.[1];
    assert.ok(expected[match[1]], 'Vendored version is missing: ' + match[1]);
  }
  assert.ok(Object.keys(expected).length > 0, 'No required vendored patches found');
  assertVendoredPatches(await readFile(resolve(root, 'Cargo.lock'), 'utf8'), expected);
  return expected;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkVendoredPatches();
  console.log('All required vendored patches remain selected by the application lock.');
}
