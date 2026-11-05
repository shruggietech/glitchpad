export type RecoveryProbeStage = 'worker' | 'parser' | 'projection' | 'root';
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
      stage !== 'root'
    )
      return;
    pending.add(stage);
    onProbe(stage);
  };
  window.addEventListener('glitchpad:test-recovery', listener);
  return () => window.removeEventListener('glitchpad:test-recovery', listener);
};
