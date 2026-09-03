import { invoke } from '@tauri-apps/api/core';

import { defaultPreferences } from './persistence';
import { nativePersistenceAvailable, nativePersistenceGateway } from './persistence-gateway';

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
    expect(invoke).toHaveBeenNthCalledWith(1, 'persist_preferences', { preferences });
    expect(invoke).toHaveBeenNthCalledWith(2, 'reset_application_state', { category: 'preferences' });
  });
});
