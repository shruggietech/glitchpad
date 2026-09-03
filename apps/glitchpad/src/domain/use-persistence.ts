import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ShellSession } from './contracts';
import type { PersistenceGateway } from './persistence-gateway';
import {
  defaultPreferences,
  diagnosticEnvironment,
  normalizePreferences,
  projectSessionState,
  type AppStateCategory,
  type DiagnosticBundle,
  type DiagnosticEvent,
  type PreferenceState,
  type WindowProjection,
} from './persistence';

const WRITE_DELAY_MS = 250;

export interface PersistenceController {
  preferences: PreferenceState;
  restoredSession: import('./persistence').SessionState | null;
  warning: string | null;
  updatePreferences: (next: PreferenceState) => void;
  reset: (category: AppStateCategory) => Promise<void>;
  previewDiagnostics: () => Promise<DiagnosticBundle>;
}

export const usePersistence = (
  sessions: readonly ShellSession[],
  activeId: string | null,
  inspector: WindowProjection['inspector'],
  gateway: PersistenceGateway | null,
  recoveryRecordIds: ReadonlyMap<string, string> = new Map(),
): PersistenceController => {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [restoredSession, setRestoredSession] = useState<import('./persistence').SessionState | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const loaded = useRef(false);
  const userChangedPreferences = useRef(false);
  const preferencesRef = useRef(preferences);
  const sessionSnapshotRef = useRef<import('./persistence').SessionState | null>(null);
  const preferenceWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  preferencesRef.current = preferences;
  const appendDiagnostic = useCallback((event: Omit<DiagnosticEvent, 'occurred_unix_ms' | 'platform'>) => {
    if (!gateway) return;
    const now = Date.now();
    void gateway.appendDiagnostic({
      ...event,
      occurred_unix_ms: now,
      platform: diagnosticEnvironment().platform,
    }, now).catch(() => undefined);
  }, [gateway]);

  useEffect(() => {
    loaded.current = false;
    setRestoredSession(null);
    if (!gateway) {
      loaded.current = true;
      return;
    }
    let active = true;
    void Promise.all([gateway.loadPreferences(), gateway.loadSession()])
      .then(([preferenceResult, sessionResult]) => {
        if (!active) return;
        if (!userChangedPreferences.current)
          setPreferences(normalizePreferences(preferenceResult.value));
        setRestoredSession(sessionResult.value);
        setWarning(preferenceResult.warning_code || sessionResult.warning_code
          ? 'Some local application settings could not be restored. Safe defaults are active.'
          : null);
        loaded.current = true;
        const loadWarning = preferenceResult.warning_code ?? sessionResult.warning_code;
        appendDiagnostic({
          level: loadWarning ? 'warning' : 'info',
          event_id: loadWarning ? 'state_load_failed' : 'app_started',
          component: 'application_state',
          duration_ms: null,
          byte_count: null,
          error_code: loadWarning,
        });
      })
      .catch(() => {
        if (!active) return;
        loaded.current = true;
        setWarning('Local application state is unavailable. Safe defaults are active.');
        appendDiagnostic({
          level: 'warning', event_id: 'state_load_failed', component: 'application_state',
          duration_ms: null, byte_count: null, error_code: 'state_unavailable',
        });
      });
    return () => { active = false; };
  }, [appendDiagnostic, gateway]);

  useEffect(() => () => {
    if (!preferenceWriteTimer.current) return;
    clearTimeout(preferenceWriteTimer.current);
    preferenceWriteTimer.current = null;
    if (gateway)
      void gateway.persistPreferences(preferencesRef.current).catch(() => undefined);
  }, [gateway]);

  useEffect(() => () => {
    if (!sessionWriteTimer.current) return;
    clearTimeout(sessionWriteTimer.current);
    sessionWriteTimer.current = null;
    if (gateway && sessionSnapshotRef.current)
      void gateway.persistSession(sessionSnapshotRef.current).catch(() => undefined);
  }, [gateway]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    root.style.setProperty('--editor-font-family', preferences.editor_font_family);
    root.style.setProperty('--editor-font-size', `${preferences.editor_font_size}px`);
    root.style.setProperty('--editor-tab-width', String(preferences.tab_width));
    root.style.setProperty('--editor-white-space', preferences.line_wrap ? 'pre-wrap' : 'pre');
  }, [preferences]);

  useEffect(() => {
    if (!gateway || !loaded.current) return;
    if (sessionWriteTimer.current) clearTimeout(sessionWriteTimer.current);
    sessionSnapshotRef.current = projectSessionState(
      sessions,
      activeId,
      inspector,
      recoveryRecordIds,
    );
    sessionWriteTimer.current = setTimeout(() => {
      sessionWriteTimer.current = null;
      void gateway.persistSession(sessionSnapshotRef.current!)
        .catch(() => {
          setWarning('Session context could not be saved. Open documents remain available.');
          appendDiagnostic({
            level: 'warning', event_id: 'state_write_failed', component: 'application_state',
            duration_ms: null, byte_count: null, error_code: 'session_write_failed',
          });
        });
    }, WRITE_DELAY_MS);
  }, [activeId, appendDiagnostic, gateway, inspector, recoveryRecordIds, sessions]);

  const updatePreferences = useCallback((next: PreferenceState) => {
    userChangedPreferences.current = true;
    const normalized = normalizePreferences(next);
    setPreferences(normalized);
    if (!gateway) return;
    if (preferenceWriteTimer.current) clearTimeout(preferenceWriteTimer.current);
    preferenceWriteTimer.current = setTimeout(() => {
      preferenceWriteTimer.current = null;
      if (preferencesRef.current !== normalized) return;
      void gateway.persistPreferences(normalized)
        .catch(() => {
          setWarning('Preferences could not be saved. The current document remains available.');
          appendDiagnostic({
            level: 'warning', event_id: 'state_write_failed', component: 'application_state',
            duration_ms: null, byte_count: null, error_code: 'preferences_write_failed',
          });
        });
    }, WRITE_DELAY_MS);
  }, [appendDiagnostic, gateway]);

  const reset = useCallback(async (category: AppStateCategory) => {
    if (category === 'preferences' && preferenceWriteTimer.current) {
      clearTimeout(preferenceWriteTimer.current);
      preferenceWriteTimer.current = null;
    }
    if (category === 'session' && sessionWriteTimer.current) {
      clearTimeout(sessionWriteTimer.current);
      sessionWriteTimer.current = null;
    }
    if (gateway) await gateway.reset(category);
    if (category === 'preferences') {
      const defaults = defaultPreferences();
      preferencesRef.current = defaults;
      setPreferences(defaults);
    }
    if (category === 'session') setRestoredSession(null);
    setWarning(null);
    if (category !== 'diagnostics')
      appendDiagnostic({
        level: 'info', event_id: 'state_reset', component: 'application_state',
        duration_ms: null, byte_count: null, error_code: null,
      });
  }, [appendDiagnostic, gateway]);

  const previewDiagnostics = useCallback(async () => {
    if (!gateway) return {
      schema_version: 1 as const,
      generated_unix_ms: Date.now(),
      environment: diagnosticEnvironment(),
      events: [],
    };
    const result = await gateway.previewDiagnostics(Date.now());
    return result.value;
  }, [gateway]);

  return useMemo(() => ({ preferences, restoredSession, warning, updatePreferences, reset, previewDiagnostics }),
    [preferences, previewDiagnostics, reset, restoredSession, updatePreferences, warning]);
};
