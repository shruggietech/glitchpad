import { pickerCancelled } from './android-authoring-gateway';
import { recordFailure, collectFailureEvents } from './diagnostic-failures';
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
  appendDiagnostic: (
    event: DiagnosticEvent,
    nowUnixMs: number,
  ) => Promise<void>;
  previewDiagnostics: (
    nowUnixMs: number,
  ) => Promise<StateLoad<DiagnosticBundle>>;
  reset: (category: AppStateCategory) => Promise<boolean>;
}

export type DiagnosticExportResult = {
  status: 'saved' | 'cancelled' | 'handed_off' | 'requested';
};
export interface DiagnosticExportGateway {
  export: (bundle: DiagnosticBundle) => Promise<DiagnosticExportResult | void>;
  share?: (bundle: DiagnosticBundle) => Promise<DiagnosticExportResult>;
}

export const nativePersistenceAvailable = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const nativePersistenceGateway: PersistenceGateway = {
  loadPreferences: () => invoke('load_preferences'),
  persistPreferences: (preferences) =>
    invoke('persist_preferences', { preferences }),
  loadSession: () => invoke('load_session_state'),
  persistSession: (session) => invoke('persist_session_state', { session }),
  appendDiagnostic: (event, nowUnixMs) =>
    invoke('append_diagnostic', { event, nowUnixMs }),
  previewDiagnostics: (nowUnixMs) =>
    invoke('preview_diagnostics', { nowUnixMs }),
  reset: (category) => invoke('reset_application_state', { category }),
};

export const browserDiagnosticExportGateway: DiagnosticExportGateway = {
  export(bundle) {
    const bytes = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
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
    return Promise.resolve({ status: 'requested' as const });
  },
};

export const createAndroidDiagnosticExportGateway = (
  call: typeof invoke = invoke,
): DiagnosticExportGateway => ({
  async export(bundle) {
    const bytes = [
      ...new TextEncoder().encode(JSON.stringify(bundle, null, 2)),
    ];
    try {
      const receipt = await call<
        import('./contracts').AndroidDestinationReceipt
      >('create_android_document', {
        request: {
          bytes,
          suggested_name:
            'glitchpad-diagnostics-' + bundle.generated_unix_ms + '.json',
          media_type: 'application/json',
          session_revision: 0,
        },
      });
      if (
        receipt.byte_count !== bytes.length ||
        receipt.saved_revision !== 0 ||
        !receipt.source?.source_id
      )
        throw new Error('invalid_receipt');
      await call('close_android_source', {
        sourceId: receipt.source.source_id,
      }).catch(() => undefined);
      return { status: 'saved' };
    } catch (error) {
      if (pickerCancelled(error)) return { status: 'cancelled' };
      recordFailure('export', 'write', 'export_write_failed');
      throw error;
    }
  },
  async share(bundle) {
    try {
      return await call<DiagnosticExportResult>('share_diagnostics', {
        json: JSON.stringify(bundle, null, 2),
      });
    } catch (error) {
      if (pickerCancelled(error)) return { status: 'cancelled' };
      recordFailure('export', 'share', 'share_failed');
      throw error;
    }
  },
});
export const nativeAndroidDiagnosticExportGateway =
  createAndroidDiagnosticExportGateway();
export const enrichDiagnosticPreview = async (
  bundle: DiagnosticBundle,
): Promise<DiagnosticBundle> => {
  const events = await collectFailureEvents();
  if (
    !/android/iu.test(navigator.userAgent) ||
    !('__TAURI_INTERNALS__' in window)
  )
    return { ...bundle, events: [...bundle.events, ...events] };
  const runtime = await invoke<
    NonNullable<DiagnosticBundle['native_environment']>
  >('android_diagnostic_environment').catch(() => null);
  return {
    ...bundle,
    environment: {
      ...bundle.environment,
      webview_version:
        runtime?.webview_version ?? bundle.environment.webview_version,
    },
    ...(runtime ? { native_environment: runtime } : {}),
    events: [...bundle.events, ...events],
  };
};
