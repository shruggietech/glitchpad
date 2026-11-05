import { invoke } from '@tauri-apps/api/core';

import { defaultPreferences } from './persistence';
import {
  enrichDiagnosticPreview,
  nativePersistenceAvailable,
  nativePersistenceGateway,
} from './persistence-gateway';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('native persistence gateway', () => {
  it('is absent when the native bridge is unavailable', () => {
    expect(nativePersistenceAvailable()).toBe(false);
  });

  it('uses closed command arguments without arbitrary context', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const preferences = defaultPreferences();
    await nativePersistenceGateway.persistPreferences(preferences);
    await nativePersistenceGateway.reset('preferences');
    expect(invoke).toHaveBeenNthCalledWith(1, 'persist_preferences', {
      preferences,
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'reset_application_state', {
      category: 'preferences',
    });
  });
});

it('keeps live viewport geometry outside the frozen diagnostic identity export', async () => {
  const userAgent = vi
    .spyOn(navigator, 'userAgent', 'get')
    .mockReturnValue('Android');
  vi.stubGlobal('__TAURI_INTERNALS__', {});
  const native = {
    android_version: '16',
    api_level: 36,
    webview_version: '131',
    webview_package: 'com.android.webview',
  };
  vi.mocked(invoke)
    .mockClear()
    .mockResolvedValue({
      ...native,
      viewport: { private_layout: 'must not be exported' },
    });
  try {
    const bundle = await enrichDiagnosticPreview({
      schema_version: 1,
      generated_unix_ms: 1,
      environment: {
        product_version: '0.2.0',
        specification_version: '1',
        platform: 'android',
        architecture: 'x86_64',
        webview_version: null,
        core_version: '0.2.0',
        build_commit: null,
      },
      events: [],
    });
    expect(bundle.native_environment).toEqual(native);
    expect(JSON.stringify(bundle)).not.toContain('private_layout');
    expect(invoke).toHaveBeenCalledWith('android_diagnostic_environment');
  } finally {
    userAgent.mockRestore();
    vi.unstubAllGlobals();
  }
});
