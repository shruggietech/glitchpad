import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedRuntimeRequest } from './check-mermaid-runtime.mjs';

test('runtime request policy permits only the application origin and inert schemes', () => {
  const origin = 'http://127.0.0.1:1420';
  assert.equal(isAllowedRuntimeRequest('/assets/app.js', origin), true);
  assert.equal(isAllowedRuntimeRequest('blob:https://opaque.invalid/id', origin), true);
  assert.equal(isAllowedRuntimeRequest('data:image/svg+xml,x', origin), true);
  assert.equal(isAllowedRuntimeRequest('https://example.com/steal', origin), false);
  assert.equal(isAllowedRuntimeRequest('file:///secret', origin), false);
});
