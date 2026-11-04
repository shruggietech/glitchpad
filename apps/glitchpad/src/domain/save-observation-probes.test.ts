import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveObservationSnapshot } from './save-observation-probes';

const key = '__GLITCHPAD_SAVE_OBSERVATION__';
const snapshot = (): SaveObservationSnapshot | null =>
  Reflect.get(window, key) as SaveObservationSnapshot | null;
const installRegistry = (callbacks: Map<unknown, unknown>) =>
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: { callbacks },
  });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_GLITCHPAD_RECOVERY_PROBES', '1');
  Reflect.deleteProperty(window, key);
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});
afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(window, key);
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});

describe('compiled save observations', () => {
  it('returns the identical native promise, reads the callback pair without changing it, and does not claim entry from removal', async () => {
    const { observeCreateInvoke } = await import('./save-observation-probes');
    const callbacks = new Map<unknown, unknown>();
    installRegistry(callbacks);
    const success = () => undefined;
    const error = () => undefined;
    const promise = Promise.resolve('native result');
    const invoke = vi.fn(() => {
      callbacks.set(11, success);
      callbacks.set(12, error);
      return promise;
    });
    expect(observeCreateInvoke({}, invoke)).toBe(promise);
    expect(invoke).toHaveBeenCalledOnce();
    expect([...callbacks]).toEqual([
      [11, success],
      [12, error],
    ]);
    expect(snapshot()).toMatchObject({
      sdk_pair_available: true,
      sdk_same_registry: true,
      success_entry_still_registered: true,
      error_entry_still_registered: true,
      sdk_callback_entry_observed: false,
    });
    callbacks.delete(12);
    expect(snapshot()).toMatchObject({
      error_entry_still_registered: false,
      sdk_callback_entry_observed: false,
    });
    callbacks.set(11, () => undefined);
    expect(snapshot()?.success_entry_still_registered).toBe(false);
    installRegistry(new Map());
    expect(snapshot()).toMatchObject({
      sdk_same_registry: false,
      success_entry_still_registered: null,
      error_entry_still_registered: null,
    });
    await expect(promise).resolves.toBe('native result');
  });

  it('keeps only one current record and accepts App and gateway stages only for its exact owner reference', async () => {
    const { observeCreateInvoke, markSaveObservation } =
      await import('./save-observation-probes');
    const first = {};
    const second = {};
    void observeCreateInvoke(first, () => Promise.resolve());
    markSaveObservation({}, 'save_session_finally');
    expect(snapshot()?.save_session_finally).toBe(false);
    markSaveObservation(first, 'create_gateway_catch');
    markSaveObservation(first, 'picker_cancelled_classified');
    markSaveObservation(first, 'save_session_finally');
    expect(snapshot()).toMatchObject({
      generation: 1,
      create_gateway_catch: true,
      picker_cancelled_classified: true,
      save_session_finally: true,
    });
    void observeCreateInvoke(second, () => Promise.resolve());
    markSaveObservation(first, 'save_session_catch');
    expect(snapshot()).toMatchObject({
      generation: 2,
      create_gateway_catch: false,
      picker_cancelled_classified: false,
      save_session_catch: false,
      save_session_finally: false,
    });
  });

  it.each(['missing', 'ambiguous', 'not_callable', 'throws'] as const)(
    'leaves actual invocation unchanged when the SDK observation is %s',
    async (mode) => {
      const { observeCreateInvoke } = await import('./save-observation-probes');
      const callbacks = new Map<unknown, unknown>();
      if (mode !== 'missing') installRegistry(callbacks);
      if (mode === 'throws')
        Object.defineProperty(callbacks, 'keys', {
          value: () => {
            throw new Error('private SDK failure');
          },
        });
      const promise = Promise.resolve('private native result');
      const invoke = vi.fn(() => {
        if (mode === 'ambiguous') {
          callbacks.set(1, () => undefined);
          callbacks.set(2, () => undefined);
          callbacks.set(3, () => undefined);
        }
        if (mode === 'not_callable') {
          callbacks.set(1, () => undefined);
          callbacks.set(2, 'private callback value');
        }
        return promise;
      });
      expect(observeCreateInvoke({}, invoke)).toBe(promise);
      expect(invoke).toHaveBeenCalledOnce();
      expect(snapshot()?.sdk_pair_available).toBe(false);
      expect(JSON.stringify(snapshot())).not.toMatch(/private/u);
      await expect(promise).resolves.toBe('private native result');
    },
  );

  it('preserves the exact synchronous invocation exception despite a hostile observation surface', async () => {
    const { observeCreateInvoke } = await import('./save-observation-probes');
    Object.defineProperty(window, key, {
      configurable: true,
      get: () => {
        throw new Error('observer getter refused');
      },
    });
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      get: () => {
        throw new Error('SDK getter refused');
      },
    });
    const failure = new Error('actual native failure');
    const invoke = vi.fn(() => {
      throw failure;
    });
    expect(() => observeCreateInvoke({}, invoke)).toThrow(failure);
    expect(invoke).toHaveBeenCalledOnce();
  });

  it('exposes no observation getter or activation when the compile flag is absent', async () => {
    vi.stubEnv('VITE_GLITCHPAD_RECOVERY_PROBES', undefined);
    const { observeCreateInvoke, markSaveObservation } =
      await import('./save-observation-probes');
    const promise = Promise.resolve();
    const invoke = vi.fn(() => promise);
    const owner = {};
    expect(observeCreateInvoke(owner, invoke)).toBe(promise);
    markSaveObservation(owner, 'save_session_finally');
    expect(invoke).toHaveBeenCalledOnce();
    expect(Reflect.has(window, key)).toBe(false);
  });
});
