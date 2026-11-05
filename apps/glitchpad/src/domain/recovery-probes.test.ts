import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeRecoveryProbe,
  installRecoveryProbeListener,
  loadApplicationWithRecoveryProbe,
} from './recovery-probes';

afterEach(() => vi.unstubAllEnvs());
describe('compiled-only recovery probes', () => {
  it('ignores probe events entirely in the ordinary build configuration', () => {
    vi.stubEnv('VITE_GLITCHPAD_RECOVERY_PROBES', '0');
    const onProbe = vi.fn();
    const dispose = installRecoveryProbeListener(onProbe);
    window.dispatchEvent(
      new CustomEvent('glitchpad:test-recovery', {
        detail: { stage: 'worker' },
      }),
    );
    expect(onProbe).not.toHaveBeenCalled();
    expect(consumeRecoveryProbe('worker')).toBe(false);
    dispose();
  });
  it('accepts only bounded stages and consumes each armed failure once', () => {
    vi.stubEnv('VITE_GLITCHPAD_RECOVERY_PROBES', '1');
    const onProbe = vi.fn();
    const dispose = installRecoveryProbeListener(onProbe);
    for (const stage of [
      'private source',
      'worker',
      'parser',
      'projection',
      'root',
      'host',
    ])
      window.dispatchEvent(
        new CustomEvent('glitchpad:test-recovery', { detail: { stage } }),
      );
    expect(onProbe.mock.calls).toEqual([
      ['worker'],
      ['parser'],
      ['projection'],
      ['root'],
      ['host'],
    ]);
    for (const stage of [
      'worker',
      'parser',
      'projection',
      'root',
      'host',
    ] as const) {
      expect(consumeRecoveryProbe(stage)).toBe(true);
      expect(consumeRecoveryProbe(stage)).toBe(false);
    }
    dispose();
  });
});

describe('genuine startup import probe', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));
  it('ordinary loader ignores a probe query and never invokes the missing importer', async () => {
    vi.stubEnv('VITE_GLITCHPAD_RECOVERY_PROBES', '0');
    window.history.replaceState(null, '', '/?glitchpad_probe=module-load');
    const normal = vi.fn().mockResolvedValue({ mount() {} }),
      missing = vi.fn();
    await expect(
      loadApplicationWithRecoveryProbe(normal, missing),
    ).resolves.toHaveProperty('mount');
    expect(normal).toHaveBeenCalledOnce();
    expect(missing).not.toHaveBeenCalled();
  });
  it('consumes the fixed query before a real importer rejection, then uses the normal loader on reload', async () => {
    vi.stubEnv('VITE_GLITCHPAD_RECOVERY_PROBES', '1');
    window.history.replaceState(
      null,
      '',
      '/?keep=1&glitchpad_probe=module-load',
    );
    const normal = vi.fn().mockResolvedValue({ mount() {} });
    const missing = vi.fn((url: string) => {
      expect(location.search).toBe('?keep=1');
      expect(new URL(url).origin).toBe(location.origin);
      expect(new URL(url).pathname).toBe(
        '/__glitchpad_s047_missing_module__.mjs',
      );
      return Promise.reject(new TypeError('module not found'));
    });
    await expect(
      loadApplicationWithRecoveryProbe(normal, missing),
    ).rejects.toThrow('module not found');
    expect(normal).not.toHaveBeenCalled();
    await expect(
      loadApplicationWithRecoveryProbe(normal, missing),
    ).resolves.toHaveProperty('mount');
    expect(normal).toHaveBeenCalledOnce();
    expect(missing).toHaveBeenCalledOnce();
  });
  it('refuses arbitrary query module paths', async () => {
    vi.stubEnv('VITE_GLITCHPAD_RECOVERY_PROBES', '1');
    window.history.replaceState(
      null,
      '',
      '/?glitchpad_probe=https://example.invalid/private.js',
    );
    const normal = vi.fn().mockResolvedValue(1),
      missing = vi.fn();
    expect(await loadApplicationWithRecoveryProbe(normal, missing)).toBe(1);
    expect(missing).not.toHaveBeenCalled();
  });
});
