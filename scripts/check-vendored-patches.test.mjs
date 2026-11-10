import assert from 'node:assert/strict';
import test from 'node:test';
import { assertVendoredPatches, checkVendoredPatches } from './check-vendored-patches.mjs';

test('the real application graph selects every required vendored patch', async () => {
  await checkVendoredPatches();
});

test('a registry Wry update cannot silently bypass native print completion', () => {
  assert.throws(() => assertVendoredPatches('[[package]]\nname = \"wry\"\nversion = \"0.57.1\"\nsource = \"registry+https://github.com/rust-lang/crates.io-index\"\n\n[[patch.unused]]\nname = \"wry\"\nversion = \"0.55.1\"\n', { wry: '0.55.1' }), /vendored patch version was bypassed/);
});

test('an upstream package with the same version still cannot replace the owned patch', () => {
  assert.throws(() => assertVendoredPatches('[[package]]\nname = \"wry\"\nversion = \"0.55.1\"\nsource = \"registry+https://github.com/rust-lang/crates.io-index\"\n', { wry: '0.55.1' }), /Registry package bypassed/);
});
