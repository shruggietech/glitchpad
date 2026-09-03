import { invoke } from '@tauri-apps/api/core';

import type {
  AppStateCategory,
  DiagnosticBundle,
  DiagnosticEvent,
  PreferenceState,
  SessionState,
  StateLoad,
} from './persistence';

export interface PersistenceGateway {
  loadPreferences: () => Promise<StateLoad<PreferenceState>>;
  persistPreferences: (preferences: PreferenceState) => Promise<void>;
  loadSession: () => Promise<StateLoad<SessionState>>;
  persistSession: (session: SessionState) => Promise<void>;
  appendDiagnostic: (event: DiagnosticEvent, nowUnixMs: number) => Promise<void>;
  previewDiagnostics: (nowUnixMs: number) => Promise<StateLoad<DiagnosticBundle>>;
  reset: (category: AppStateCategory) => Promise<boolean>;
}

export interface DiagnosticExportGateway {
  export: (bundle: DiagnosticBundle) => Promise<void>;
}

export const nativePersistenceAvailable = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const nativePersistenceGateway: PersistenceGateway = {
  loadPreferences: () => invoke('load_preferences'),
  persistPreferences: (preferences) => invoke('persist_preferences', { preferences }),
  loadSession: () => invoke('load_session_state'),
  persistSession: (session) => invoke('persist_session_state', { session }),
  appendDiagnostic: (event, nowUnixMs) => invoke('append_diagnostic', { event, nowUnixMs }),
  previewDiagnostics: (nowUnixMs) =>
    invoke('preview_diagnostics', { nowUnixMs }),
  reset: (category) => invoke('reset_application_state', { category }),
};

export const browserDiagnosticExportGateway: DiagnosticExportGateway = {
  export(bundle) {
    const bytes = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(bytes);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = `glitchpad-diagnostics-${bundle.generated_unix_ms}.json`;
      link.rel = 'noopener';
      link.click();
    } finally {
      URL.revokeObjectURL(url);
    }
    return Promise.resolve();
  },
};
