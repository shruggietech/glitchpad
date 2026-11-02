import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const packages = (text) =>
  [
    ...text.matchAll(
      /\[\[package\]\]\s+name = "([^"]+)"\s+version = "([^"]+)"/g,
    ),
  ].map((m) => [m[1], m[2]]);
const application = packages(
  await readFile(new URL('../Cargo.lock', import.meta.url), 'utf8'),
);
const fuzz = packages(
  await readFile(new URL('../fuzz/Cargo.lock', import.meta.url), 'utf8'),
);
for (const [name, version] of fuzz) {
  if (
    ['glitchpad-fuzz', 'libfuzzer-sys', 'arbitrary', 'jobserver'].includes(name)
  )
    continue;
  assert.ok(
    application.some(([n, v]) => n === name && v === version),
    'Fuzz dependency differs from application lock: ' + name + '@' + version,
  );
}
console.log('Fuzz shared dependency versions match the application lock.');
