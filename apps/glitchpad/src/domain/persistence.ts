import type { LanguageId, ShellSession } from './contracts';

export const APPLICATION_STATE_SCHEMA_VERSION = 1 as const;
export const MAX_SESSION_PROJECTIONS = 32;
export const MAX_LANGUAGE_OVERRIDES = 128;

export type ThemePreference = 'system' | 'light' | 'dark';
export type MarkdownDefaultMode = 'rendered' | 'source';
export type StateLoadStatus =
  | 'defaulted'
  | 'loaded'
  | 'migrated'
  | 'corrupt'
  | 'unsupported'
  | 'unavailable';
export type AppStateCategory = 'preferences' | 'session' | 'diagnostics';

export interface PreferenceState {
  schema_version: typeof APPLICATION_STATE_SCHEMA_VERSION;
  theme: ThemePreference;
  editor_font_family: string;
  editor_font_size: number;
  line_wrap: boolean;
  tab_width: number;
  markdown_default_mode: MarkdownDefaultMode;
  language_overrides: Record<string, LanguageId>;
}

export interface WindowProjection {
  active_session_index: number | null;
  inspector: 'closed' | 'metadata' | 'preferences' | 'diagnostics';
}

export interface SessionProjection {
  session_key: string;
  display_hint: string;
  renderer_id: string;
  presentation_mode: string | null;
  source_reference: string | null;
  recovery_record_id: string | null;
}

export interface SessionState {
  schema_version: typeof APPLICATION_STATE_SCHEMA_VERSION;
  window: WindowProjection;
  sessions: SessionProjection[];
}

export interface StateLoad<T> {
  status: StateLoadStatus;
  value: T;
  warning_code: string | null;
}

export type DiagnosticLevel = 'info' | 'warning' | 'error';
export type DiagnosticEventId =
  | 'app_started'
  | 'state_load_failed'
  | 'state_write_failed'
  | 'state_reset'
  | 'source_restore_failed'
  | 'diagnostic_exported';
export type DiagnosticPlatform =
  | 'windows'
  | 'macos'
  | 'linux'
  | 'android'
  | 'unknown';
export type DiagnosticComponent =
  | 'application_state'
  | 'recovery'
  | 'source'
  | 'renderer'
  | 'shell';

export interface DiagnosticEvent {
  occurred_unix_ms: number;
  level: DiagnosticLevel;
  event_id: DiagnosticEventId;
  platform: DiagnosticPlatform;
  component: DiagnosticComponent;
  duration_ms: number | null;
  byte_count: number | null;
  error_code: string | null;
}

export interface DiagnosticEnvironment {
  product_version: string;
  specification_version: string;
  platform: DiagnosticPlatform;
  architecture: string;
  webview_version: string | null;
  core_version: string;
  build_commit: string | null;
}

export interface DiagnosticBundle {
  schema_version: typeof APPLICATION_STATE_SCHEMA_VERSION;
  generated_unix_ms: number;
  environment: DiagnosticEnvironment;
  events: DiagnosticEvent[];
}

export const defaultPreferences = (): PreferenceState => ({
  schema_version: APPLICATION_STATE_SCHEMA_VERSION,
  theme: 'system',
  editor_font_family: 'ui-monospace',
  editor_font_size: 14,
  line_wrap: true,
  tab_width: 4,
  markdown_default_mode: 'rendered',
  language_overrides: {},
});

const languageIds = new Set<LanguageId>([
  'plain_text', 'rust', 'typescript', 'javascript', 'python', 'json', 'toml',
  'yaml', 'css', 'html',
]);

export const normalizeExtension = (value: string): string | null => {
  const normalized = value.trim().replace(/^\.+/u, '').toLocaleLowerCase('en-US');
  return normalized.length > 0 && [...normalized].length <= 32
    && /^[\p{L}\p{N}_+-]+$/u.test(normalized)
    ? normalized
    : null;
};

export const normalizePreferences = (
  input: Partial<PreferenceState>,
): PreferenceState => {
  const defaults = defaultPreferences();
  const family = typeof input.editor_font_family === 'string'
    && [...input.editor_font_family].length > 0
    && [...input.editor_font_family].length <= 128
    && !/[\p{Cc}]/u.test(input.editor_font_family)
    ? input.editor_font_family
    : defaults.editor_font_family;
  const overrides: Record<string, LanguageId> = {};
  if (input.language_overrides && typeof input.language_overrides === 'object') {
    for (const [extension, language] of Object.entries(input.language_overrides)) {
      const normalized = normalizeExtension(extension);
      if (normalized && languageIds.has(language)) overrides[normalized] = language;
      if (Object.keys(overrides).length >= MAX_LANGUAGE_OVERRIDES) break;
    }
  }
  return {
    schema_version: APPLICATION_STATE_SCHEMA_VERSION,
    theme: input.theme === 'light' || input.theme === 'dark' ? input.theme : 'system',
    editor_font_family: family,
    editor_font_size: Number.isInteger(input.editor_font_size)
      && input.editor_font_size! >= 8 && input.editor_font_size! <= 72
      ? input.editor_font_size!
      : defaults.editor_font_size,
    line_wrap: typeof input.line_wrap === 'boolean' ? input.line_wrap : defaults.line_wrap,
    tab_width: Number.isInteger(input.tab_width)
      && input.tab_width! >= 1 && input.tab_width! <= 16
      ? input.tab_width!
      : defaults.tab_width,
    markdown_default_mode: input.markdown_default_mode === 'source' ? 'source' : 'rendered',
    language_overrides: overrides,
  };
};

const presentationMode = (session: ShellSession): string | null =>
  session.markdown_document?.mode ?? session.mermaid_document?.mode ?? null;

export const projectSessionState = (
  sessions: readonly ShellSession[],
  activeId: string | null,
  inspector: WindowProjection['inspector'],
  recoveryRecordIds: ReadonlyMap<string, string> = new Map(),
): SessionState => {
  const eligible = sessions.filter(
    (session) => Boolean(
      session.restoration_reference || recoveryRecordIds.get(session.id),
    ),
  ).slice(0, MAX_SESSION_PROJECTIONS);
  const activeIndex = eligible.findIndex(({ id }) => id === activeId);
  return {
    schema_version: APPLICATION_STATE_SCHEMA_VERSION,
    window: { active_session_index: activeIndex >= 0 ? activeIndex : null, inspector },
    sessions: eligible.map((session) => ({
      session_key: session.id.slice(0, 128),
      display_hint: [...session.source.display_name].slice(0, 255).join(''),
      renderer_id: session.renderer.id.slice(0, 64),
      presentation_mode: presentationMode(session)?.slice(0, 64) ?? null,
      source_reference: session.restoration_reference ?? null,
      recovery_record_id: recoveryRecordIds.get(session.id) ?? null,
    })),
  };
};

export const diagnosticEnvironment = (): DiagnosticEnvironment => ({
  product_version: '0.0.0',
  specification_version: '0.0.0',
  platform: /android/iu.test(navigator.userAgent)
    ? 'android'
    : /windows/iu.test(navigator.userAgent)
      ? 'windows'
      : /mac/iu.test(navigator.userAgent)
        ? 'macos'
        : /linux/iu.test(navigator.userAgent)
          ? 'linux'
          : 'unknown',
  architecture: 'unknown',
  webview_version: null,
  core_version: '0.0.0',
  build_commit: null,
});
