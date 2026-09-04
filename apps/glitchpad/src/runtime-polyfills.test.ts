import { afterEach, describe, expect, it, vi } from 'vitest';

const nativeReplaceAll = Object.getOwnPropertyDescriptor(String.prototype, 'replaceAll');
const nativeAt = Object.getOwnPropertyDescriptor(Array.prototype, 'at');

afterEach(() => {
  if (nativeReplaceAll) {
    Object.defineProperty(String.prototype, 'replaceAll', nativeReplaceAll);
  } else {
    delete (String.prototype as { replaceAll?: string['replaceAll'] }).replaceAll;
  }
  if (nativeAt) {
    Object.defineProperty(Array.prototype, 'at', nativeAt);
  } else {
    delete (Array.prototype as { at?: unknown[]['at'] }).at;
  }
  vi.resetModules();
});

describe('Chrome 69 runtime compatibility', () => {
  it('installs required stable built-ins before application startup', async () => {
    delete (String.prototype as { replaceAll?: string['replaceAll'] }).replaceAll;
    delete (Array.prototype as { at?: unknown[]['at'] }).at;
    vi.resetModules();

    await import('./runtime-polyfills');

    expect('utf_8 utf_8'.replaceAll('_', ' ')).toBe('utf 8 utf 8');
    expect('a.b.a'.replaceAll('.', '$&')).toBe('a.b.a');
    expect('a_a'.replaceAll('_', (match) => `[${match}]`)).toBe('a[_]a');
    expect('a1a2'.replaceAll(/a/g, 'b')).toBe('b1b2');
    expect(() => 'a'.replaceAll(/a/, 'b')).toThrow(TypeError);
    expect(['first', 'last'].at(-1)).toBe('last');
  }, 30_000);
});
