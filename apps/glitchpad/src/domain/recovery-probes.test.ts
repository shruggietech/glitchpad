import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeRecoveryProbe,
  installRecoveryProbeListener,
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
  it('accepts only four bounded stages and consumes each armed failure once', () => {
    vi.stubEnv('VITE_GLITCHPAD_RECOVERY_PROBES', '1');
    const onProbe = vi.fn();
    const dispose = installRecoveryProbeListener(onProbe);
    for (const stage of [
      'private source',
      'worker',
      'parser',
      'projection',
      'root',
    ])
      window.dispatchEvent(
        new CustomEvent('glitchpad:test-recovery', { detail: { stage } }),
      );
    expect(onProbe.mock.calls).toEqual([
      ['worker'],
      ['parser'],
      ['projection'],
      ['root'],
    ]);
    for (const stage of ['worker', 'parser', 'projection', 'root'] as const) {
      expect(consumeRecoveryProbe(stage)).toBe(true);
      expect(consumeRecoveryProbe(stage)).toBe(false);
    }
    dispose();
  });
});
