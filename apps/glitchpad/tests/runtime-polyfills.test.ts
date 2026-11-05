import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'vitest';

describe('Chrome 69 runtime compatibility', () => {
  it('installs required stable built-ins before application startup', () => {
    // Vitest uses Array.prototype.at internally. Remove built-ins in a separate
    // process so the compatibility probe cannot break the test runner itself.
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
      import assert from 'node:assert/strict';

      delete String.prototype.replaceAll;
      delete Array.prototype.at;
      delete Object.hasOwn;
      delete Object.fromEntries;
      delete globalThis.queueMicrotask;
      await import(${JSON.stringify(pathToFileURL(resolve('src/runtime-polyfills.ts')).href)});

      assert.equal('utf_8 utf_8'.replaceAll('_', ' '), 'utf 8 utf 8');
      assert.equal('a.b.a'.replaceAll('.', '$&'), 'a.b.a');
      assert.equal('a_a'.replaceAll('_', (match) => '[' + match + ']'), 'a[_]a');
      assert.equal('a1a2'.replaceAll(/a/g, 'b'), 'b1b2');
      assert.throws(() => 'a'.replaceAll(/a/, 'b'), TypeError);
      assert.equal(['first', 'last'].at(-1), 'last');
      const parent = {inherited: true};
      const child = Object.assign(Object.create(parent), {own: true});
      assert.equal(Object.hasOwn(child, 'own'), true);
      assert.equal(Object.hasOwn(child, 'inherited'), false);
      assert.equal(Object.hasOwn(Object.create(null), 'toString'), false);
      assert.deepEqual(Object.fromEntries(new Map([['field', 3]])), {field: 3});
      let completed = false;
      const queued = new Promise(resolve => queueMicrotask(() => {completed = true; resolve();}));
      assert.equal(completed, false);
      await queued;
      assert.equal(completed, true);
    `,
      ],
      { timeout: 30_000, windowsHide: true },
    );
  }, 30_000);
});
