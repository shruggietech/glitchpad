import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMermaidTheme } from './useMermaidTheme';

afterEach(() => vi.unstubAllGlobals());

describe('useMermaidTheme', () => {
  it('tracks the system color scheme used by the application CSS', () => {
    let light = true;
    let changeListener: () => void = () => undefined;
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      get matches() { return light; },
      media: '(prefers-color-scheme: light)',
      onchange: null,
      addEventListener: (_type: string, listener: EventListener) => { changeListener = () => listener(new Event('change')); },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    const { result } = renderHook(() => useMermaidTheme());
    expect(result.current).toBe('light');
    act(() => {
      light = false;
      changeListener();
    });
    expect(result.current).toBe('dark');
  });
});
