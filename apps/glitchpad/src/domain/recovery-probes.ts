export const RECOVERY_PROBES_COMPILED =
  import.meta.env.VITE_GLITCHPAD_RECOVERY_PROBES === '1';
export const RECOVERY_BUILD_VARIANT = RECOVERY_PROBES_COMPILED
  ? 'fault_probe'
  : 'ordinary';
const configuredBuildCommit: unknown = import.meta.env
  .VITE_GLITCHPAD_BUILD_COMMIT;
export const FRONTEND_BUILD_COMMIT: string | null =
  typeof configuredBuildCommit === 'string' ? configuredBuildCommit : null;

export type RecoveryProbeStage =
  'worker' | 'parser' | 'projection' | 'root' | 'host';
const pending = new Set<RecoveryProbeStage>();

export const consumeRecoveryProbe = (stage: RecoveryProbeStage): boolean => {
  if (import.meta.env.VITE_GLITCHPAD_RECOVERY_PROBES !== '1') return false;
  return pending.delete(stage);
};

export const installRecoveryProbeListener = (
  onProbe: (stage: RecoveryProbeStage) => void,
): (() => void) => {
  if (import.meta.env.VITE_GLITCHPAD_RECOVERY_PROBES !== '1')
    return () => undefined;
  const listener = (event: Event) => {
    const detail: unknown = (event as CustomEvent<unknown>).detail;
    if (!detail || typeof detail !== 'object' || !('stage' in detail)) return;
    const stage = (detail as { stage?: unknown }).stage;
    if (
      stage !== 'worker' &&
      stage !== 'parser' &&
      stage !== 'projection' &&
      stage !== 'root' &&
      stage !== 'host'
    )
      return;
    pending.add(stage);
    onProbe(stage);
  };
  window.addEventListener('glitchpad:test-recovery', listener);
  return () => window.removeEventListener('glitchpad:test-recovery', listener);
};

/** This branch resolves a genuinely absent local module only in the compiled fault APK. */
export const loadApplicationWithRecoveryProbe = <T>(
  loadApplication: () => Promise<T>,
  loadMissing: (url: string) => Promise<T> = (url) =>
    import(/* @vite-ignore */ url),
): Promise<T> => {
  if (import.meta.env.VITE_GLITCHPAD_RECOVERY_PROBES === '1') {
    const current = new URL(window.location.href);
    if (current.searchParams.get('glitchpad_probe') === 'module-load') {
      current.searchParams.delete('glitchpad_probe');
      window.history.replaceState(window.history.state, '', current.href);
      return loadMissing(
        new URL('/__glitchpad_s047_missing_module__.mjs', current.href).href,
      );
    }
  }
  return loadApplication();
};
