import { invoke } from '@tauri-apps/api/core';
import {
  clipboardTextAvailable,
  writeClipboardText,
} from './clipboard-gateway';

vi.mock('@tauri-apps/api/core', async (original) => ({
  ...(await original<typeof import('@tauri-apps/api/core')>()),
  invoke: vi.fn(),
}));

const environment = (
  android: boolean,
  native: boolean,
  writeText?: ReturnType<typeof vi.fn>,
) => {
  vi.stubGlobal('navigator', {
    userAgent: android ? 'Android 7.0 WebView' : 'Desktop browser',
    clipboard: writeText ? { writeText } : undefined,
  });
  vi.stubGlobal(
    'window',
    native ? { __TAURI_INTERNALS__: { invoke: vi.fn() } } : {},
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(invoke).mockReset();
});

describe('clipboard platform routing', () => {
  it('waits for the Android write and preserves exact Unicode and line endings', async () => {
    const browser = vi
      .fn()
      .mockRejectedValue(new Error('WebView clipboard denied'));
    environment(true, true, browser);
    let complete!: () => void;
    vi.mocked(invoke).mockReturnValue(
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
    );
    const text = 'copy \u{1f680} e\u0301\r\nsecond line';
    expect(clipboardTextAvailable()).toBe(true);
    let completed = false;
    const pending = writeClipboardText(text).then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(invoke).toHaveBeenCalledWith('write_android_clipboard', { text });
    expect(browser).not.toHaveBeenCalled();
    complete();
    await pending;
    expect(completed).toBe(true);
  });

  it('copies empty text through Android even when the browser API is absent', async () => {
    environment(true, true);
    vi.mocked(invoke).mockResolvedValue(undefined);
    expect(clipboardTextAvailable()).toBe(true);
    await writeClipboardText('');
    expect(invoke).toHaveBeenCalledWith('write_android_clipboard', {
      text: '',
    });
  });

  it('propagates native failure without a second browser write', async () => {
    const browser = vi.fn().mockResolvedValue(undefined);
    environment(true, true, browser);
    const failure = new Error('native write rejected');
    vi.mocked(invoke).mockRejectedValue(failure);
    await expect(writeClipboardText('selected')).rejects.toBe(failure);
    expect(browser).not.toHaveBeenCalled();
  });

  it.each([
    [false, true],
    [true, false],
  ])(
    'retains browser copy for android=%s native=%s',
    async (android, native) => {
      const browser = vi.fn().mockResolvedValue(undefined);
      environment(android, native, browser);
      expect(clipboardTextAvailable()).toBe(true);
      await writeClipboardText('unchanged selection');
      expect(browser).toHaveBeenCalledWith('unchanged selection');
      expect(invoke).not.toHaveBeenCalled();
    },
  );

  it('reports an absent browser API and preserves a browser permission rejection', async () => {
    environment(false, false);
    expect(clipboardTextAvailable()).toBe(false);
    await expect(writeClipboardText('text')).rejects.toThrow(
      'clipboard_unavailable',
    );
    const failure = new Error('clipboard denied');
    environment(false, false, vi.fn().mockRejectedValue(failure));
    await expect(writeClipboardText('text')).rejects.toBe(failure);
  });
});
