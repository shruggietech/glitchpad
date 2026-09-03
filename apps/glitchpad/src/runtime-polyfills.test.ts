import { afterEach, describe, expect, it } from 'vitest';

import { installRuntimePolyfills } from './runtime-polyfills';

const nativeReplaceAll = Object.getOwnPropertyDescriptor(String.prototype, 'replaceAll');

afterEach(() => {
  if (nativeReplaceAll) {
    Object.defineProperty(String.prototype, 'replaceAll', nativeReplaceAll);
  } else {
    delete (String.prototype as { replaceAll?: string['replaceAll'] }).replaceAll;
  }
});

describe('legacy WebView runtime polyfills', () => {
  it('provides literal replacement when replaceAll is unavailable', () => {
    delete (String.prototype as { replaceAll?: string['replaceAll'] }).replaceAll;

    installRuntimePolyfills();

    expect('utf_8 utf_8'.replaceAll('_', ' ')).toBe('utf 8 utf 8');
    expect('a.b.a'.replaceAll('.', '$&')).toBe('a.b.a');
    expect('a_a'.replaceAll('_', (match) => `[${match}]`)).toBe('a[_]a');
  });

  it('preserves the global regular-expression contract', () => {
    delete (String.prototype as { replaceAll?: string['replaceAll'] }).replaceAll;
    installRuntimePolyfills();

    expect('a1a2'.replaceAll(/a/g, 'b')).toBe('b1b2');
    expect(() => 'a'.replaceAll(/a/, 'b')).toThrow(TypeError);
  });
});
