//! Bounded, versioned application-state and diagnostic contracts.

use std::collections::{BTreeMap, BTreeSet};

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::editor::LanguageId;

pub const APPLICATION_STATE_SCHEMA_VERSION: u16 = 1;
pub const MAX_PREFERENCE_BYTES: usize = 64 * 1024;
pub const MAX_SESSION_STATE_BYTES: usize = 256 * 1024;
pub const MAX_DIAGNOSTIC_BYTES: usize = 2 * 1024 * 1024;
pub const MAX_SESSION_PROJECTIONS: usize = 32;
pub const MAX_LANGUAGE_OVERRIDES: usize = 128;
pub const MAX_DIAGNOSTIC_EVENTS: usize = 2_000;
pub const MAX_DIAGNOSTIC_AGE_MS: u64 = 7 * 24 * 60 * 60 * 1_000;

#[derive(Clone, Copy, Debug, Default, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ThemePreference {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Clone, Copy, Debug, Default, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarkdownDefaultMode {
    #[default]
    Rendered,
    Source,
}

#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PreferenceState {
    pub schema_version: u16,
    pub theme: ThemePreference,
    pub editor_font_family: String,
    pub editor_font_size: u8,
    pub line_wrap: bool,
    pub tab_width: u8,
    pub markdown_default_mode: MarkdownDefaultMode,
    pub language_overrides: BTreeMap<String, LanguageId>,
}

impl Default for PreferenceState {
    fn default() -> Self {
        Self {
            schema_version: APPLICATION_STATE_SCHEMA_VERSION,
            theme: ThemePreference::System,
            editor_font_family: "ui-monospace".into(),
            editor_font_size: 14,
            line_wrap: true,
            tab_width: 4,
            markdown_default_mode: MarkdownDefaultMode::Rendered,
            language_overrides: BTreeMap::new(),
        }
    }
}

impl PreferenceState {
    /// Builds the current preference record while defaulting invalid fields independently.
    pub fn from_untrusted_value(value: &Value) -> Self {
        let defaults = Self::default();
        let object = value.as_object();
        let mut result = Self {
            theme: field(object, "theme").unwrap_or(defaults.theme),
            editor_font_family: field::<String>(object, "editor_font_family")
                .filter(|candidate| valid_font_family(candidate))
                .unwrap_or(defaults.editor_font_family),
            editor_font_size: field::<u8>(object, "editor_font_size")
                .filter(|candidate| (8..=72).contains(candidate))
                .unwrap_or(defaults.editor_font_size),
            line_wrap: field(object, "line_wrap").unwrap_or(defaults.line_wrap),
            tab_width: field::<u8>(object, "tab_width")
                .filter(|candidate| (1..=16).contains(candidate))
                .unwrap_or(defaults.tab_width),
            markdown_default_mode: field(object, "markdown_default_mode")
                .unwrap_or(defaults.markdown_default_mode),
            language_overrides: BTreeMap::new(),
            ..defaults
        };
        if let Some(overrides) = object
            .and_then(|candidate| candidate.get("language_overrides"))
            .and_then(Value::as_object)
        {
            for (extension, language) in overrides.iter().take(MAX_LANGUAGE_OVERRIDES) {
                if let (Some(extension), Ok(language)) = (
                    normalize_extension(extension),
                    serde_json::from_value::<LanguageId>(language.clone()),
                ) {
                    result.language_overrides.insert(extension, language);
                }
            }
        }
        result
    }

    #[must_use]
    pub fn is_valid(&self) -> bool {
        self.schema_version == APPLICATION_STATE_SCHEMA_VERSION
            && valid_font_family(&self.editor_font_family)
            && (8..=72).contains(&self.editor_font_size)
            && (1..=16).contains(&self.tab_width)
            && self.language_overrides.len() <= MAX_LANGUAGE_OVERRIDES
            && self
                .language_overrides
                .keys()
                .all(|extension| normalize_extension(extension).as_deref() == Some(extension))
    }
}

fn field<T: for<'de> Deserialize<'de>>(
    object: Option<&serde_json::Map<String, Value>>,
    key: &str,
) -> Option<T> {
    serde_json::from_value(object?.get(key)?.clone()).ok()
}

fn valid_font_family(value: &str) -> bool {
    let length = value.chars().count();
    (1..=128).contains(&length) && !value.chars().any(char::is_control)
}

pub fn normalize_extension(value: &str) -> Option<String> {
    let normalized = value.trim().trim_start_matches('.').to_lowercase();
    let length = normalized.chars().count();
    ((1..=32).contains(&length)
        && normalized
            .chars()
            .all(|character| character.is_alphanumeric() || matches!(character, '_' | '-' | '+')))
    .then_some(normalized)
}

#[derive(Clone, Copy, Debug, Default, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InspectorProjection {
    #[default]
    Closed,
    Metadata,
    Preferences,
    Diagnostics,
}

#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SessionProjection {
    pub session_key: String,
    pub display_hint: String,
    pub renderer_id: String,
    pub presentation_mode: Option<String>,
    pub source_reference: Option<String>,
    pub recovery_record_id: Option<String>,
}

impl SessionProjection {
    #[must_use]
    pub fn is_valid(&self) -> bool {
        bounded_safe(&self.session_key, 128)
            && bounded_safe(&self.display_hint, 255)
            && bounded_token(&self.renderer_id, 64)
            && self
                .presentation_mode
                .as_deref()
                .is_none_or(|value| bounded_token(value, 64))
            && self
                .source_reference
                .as_deref()
                .is_none_or(is_lowercase_uuid)
            && self
                .recovery_record_id
                .as_deref()
                .is_none_or(is_lowercase_uuid)
            && (self.source_reference.is_some() || self.recovery_record_id.is_some())
    }
}

#[derive(Clone, Debug, Default, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WindowProjection {
    pub active_session_index: Option<u8>,
    pub inspector: InspectorProjection,
}

#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SessionState {
    pub schema_version: u16,
    pub window: WindowProjection,
    pub sessions: Vec<SessionProjection>,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            schema_version: APPLICATION_STATE_SCHEMA_VERSION,
            window: WindowProjection::default(),
            sessions: Vec::new(),
        }
    }
}

impl SessionState {
    #[must_use]
    pub fn normalized(mut self) -> Self {
        self.schema_version = APPLICATION_STATE_SCHEMA_VERSION;
        let mut seen = BTreeSet::new();
        self.sessions
            .retain(|session| session.is_valid() && seen.insert(session.session_key.clone()));
        self.sessions.truncate(MAX_SESSION_PROJECTIONS);
        self.window.active_session_index = self
            .window
            .active_session_index
            .filter(|index| usize::from(*index) < self.sessions.len());
        self
    }
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticLevel {
    Info,
    Warning,
    Error,
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticEventId {
    AppStarted,
    StateLoadFailed,
    StateWriteFailed,
    StateReset,
    SourceRestoreFailed,
    DiagnosticExported,
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticPlatform {
    Windows,
    Macos,
    Linux,
    Android,
    Unknown,
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticComponent {
    ApplicationState,
    Recovery,
    Source,
    Renderer,
    Shell,
}

#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DiagnosticEvent {
    pub occurred_unix_ms: u64,
    pub level: DiagnosticLevel,
    pub event_id: DiagnosticEventId,
    pub platform: DiagnosticPlatform,
    pub component: DiagnosticComponent,
    pub duration_ms: Option<u64>,
    pub byte_count: Option<u64>,
    pub error_code: Option<String>,
}

impl DiagnosticEvent {
    #[must_use]
    pub fn is_valid(&self) -> bool {
        self.duration_ms.is_none_or(|value| value <= 86_400_000)
            && self.byte_count.is_none_or(|value| value <= 1_u64 << 40)
            && self
                .error_code
                .as_deref()
                .is_none_or(|value| bounded_token(value, 64))
    }
}

#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DiagnosticLedger {
    pub schema_version: u16,
    pub events: Vec<DiagnosticEvent>,
}

impl Default for DiagnosticLedger {
    fn default() -> Self {
        Self {
            schema_version: APPLICATION_STATE_SCHEMA_VERSION,
            events: Vec::new(),
        }
    }
}

impl DiagnosticLedger {
    #[must_use]
    pub fn retained(mut self, now_unix_ms: u64) -> Self {
        let cutoff = now_unix_ms.saturating_sub(MAX_DIAGNOSTIC_AGE_MS);
        self.schema_version = APPLICATION_STATE_SCHEMA_VERSION;
        self.events.retain(|event| {
            event.is_valid()
                && event.occurred_unix_ms >= cutoff
                && event.occurred_unix_ms <= now_unix_ms
        });
        self.events.sort_by_key(|event| event.occurred_unix_ms);
        if self.events.len() > MAX_DIAGNOSTIC_EVENTS {
            self.events
                .drain(..self.events.len() - MAX_DIAGNOSTIC_EVENTS);
        }
        while self.events.len() > 1
            && serde_json::to_vec(&self).map_or(true, |bytes| bytes.len() > MAX_DIAGNOSTIC_BYTES)
        {
            self.events.remove(0);
        }
        self
    }
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StateLoadStatus {
    Defaulted,
    Loaded,
    Migrated,
    Corrupt,
    Unsupported,
    Unavailable,
}

#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StateLoad<T> {
    pub status: StateLoadStatus,
    pub value: T,
    pub warning_code: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AppStateCategory {
    Preferences,
    Session,
    Diagnostics,
}

#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DiagnosticEnvironment {
    pub product_version: String,
    pub specification_version: String,
    pub platform: DiagnosticPlatform,
    pub architecture: String,
    pub webview_version: Option<String>,
    pub core_version: String,
    pub build_commit: Option<String>,
}

impl DiagnosticEnvironment {
    #[must_use]
    pub fn is_valid(&self) -> bool {
        bounded_token(&self.product_version, 64)
            && bounded_token(&self.specification_version, 64)
            && bounded_token(&self.architecture, 32)
            && bounded_token(&self.core_version, 64)
            && self
                .webview_version
                .as_deref()
                .is_none_or(|value| bounded_safe(value, 128))
            && self.build_commit.as_deref().is_none_or(|value| {
                (7..=64).contains(&value.len())
                    && value.bytes().all(|byte| byte.is_ascii_hexdigit())
            })
    }
}

#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DiagnosticBundle {
    pub schema_version: u16,
    pub generated_unix_ms: u64,
    pub environment: DiagnosticEnvironment,
    pub events: Vec<DiagnosticEvent>,
}

fn bounded_safe(value: &str, maximum: usize) -> bool {
    let length = value.chars().count();
    (1..=maximum).contains(&length) && !value.chars().any(char::is_control)
}

fn bounded_token(value: &str, maximum: usize) -> bool {
    let length = value.len();
    (1..=maximum).contains(&length)
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.'))
}

fn is_lowercase_uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| match index {
            8 | 13 | 18 | 23 => byte == b'-',
            _ => byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte),
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_preference_fields_default_independently() {
        let value = serde_json::json!({
            "schema_version": 1,
            "theme": "dark",
            "editor_font_family": "\u{0}secret",
            "editor_font_size": 20,
            "line_wrap": false,
            "tab_width": 99,
            "markdown_default_mode": "source",
            "language_overrides": {".RS": "rust", "../../secret": "python"}
        });
        let preferences = PreferenceState::from_untrusted_value(&value);
        assert_eq!(preferences.theme, ThemePreference::Dark);
        assert_eq!(preferences.editor_font_family, "ui-monospace");
        assert_eq!(preferences.editor_font_size, 20);
        assert!(!preferences.line_wrap);
        assert_eq!(preferences.tab_width, 4);
        assert_eq!(
            preferences.markdown_default_mode,
            MarkdownDefaultMode::Source
        );
        assert_eq!(
            preferences.language_overrides.get("rs"),
            Some(&LanguageId::Rust)
        );
        assert_eq!(preferences.language_overrides.len(), 1);
    }

    #[test]
    fn session_projection_deduplicates_bounds_and_clamps_active_index() {
        let valid = SessionProjection {
            session_key: "one".into(),
            display_hint: "notes.md".into(),
            renderer_id: "markdown".into(),
            presentation_mode: Some("rendered".into()),
            source_reference: Some("37d21d4b-674d-41fa-b792-29b7c2012ed3".into()),
            recovery_record_id: None,
        };
        let state = SessionState {
            schema_version: 9,
            window: WindowProjection {
                active_session_index: Some(31),
                inspector: InspectorProjection::Closed,
            },
            sessions: vec![valid.clone(), valid],
        }
        .normalized();
        assert_eq!(state.schema_version, APPLICATION_STATE_SCHEMA_VERSION);
        assert_eq!(state.sessions.len(), 1);
        assert_eq!(state.window.active_session_index, None);
    }

    #[test]
    fn diagnostic_retention_is_deterministic_and_rejects_hostile_codes() {
        let now = MAX_DIAGNOSTIC_AGE_MS + 100;
        let event = |occurred_unix_ms, error_code: Option<&str>| DiagnosticEvent {
            occurred_unix_ms,
            level: DiagnosticLevel::Info,
            event_id: DiagnosticEventId::AppStarted,
            platform: DiagnosticPlatform::Unknown,
            component: DiagnosticComponent::Shell,
            duration_ms: None,
            byte_count: None,
            error_code: error_code.map(str::to_owned),
        };
        let retained = DiagnosticLedger {
            schema_version: 1,
            events: vec![
                event(99, None),
                event(101, Some("safe_code")),
                event(102, Some("C:\\private\\notes.txt")),
            ],
        }
        .retained(now);
        assert_eq!(retained.events, vec![event(101, Some("safe_code"))]);
    }

    #[test]
    fn diagnostic_retention_enforces_count_age_and_stable_order() {
        let now = MAX_DIAGNOSTIC_AGE_MS + 10_000;
        let event = |occurred_unix_ms| DiagnosticEvent {
            occurred_unix_ms,
            level: DiagnosticLevel::Info,
            event_id: DiagnosticEventId::AppStarted,
            platform: DiagnosticPlatform::Android,
            component: DiagnosticComponent::ApplicationState,
            duration_ms: None,
            byte_count: None,
            error_code: None,
        };
        let mut events = (0..=MAX_DIAGNOSTIC_EVENTS)
            .map(|offset| event(now - u64::try_from(offset).expect("bounded offset")))
            .collect::<Vec<_>>();
        events.push(event(now - MAX_DIAGNOSTIC_AGE_MS - 1));
        let retained = DiagnosticLedger {
            schema_version: APPLICATION_STATE_SCHEMA_VERSION,
            events,
        }
        .retained(now);
        assert_eq!(retained.events.len(), MAX_DIAGNOSTIC_EVENTS);
        assert!(
            retained
                .events
                .windows(2)
                .all(|pair| { pair[0].occurred_unix_ms <= pair[1].occurred_unix_ms })
        );
        assert!(
            retained
                .events
                .iter()
                .all(|candidate| { candidate.occurred_unix_ms >= now - MAX_DIAGNOSTIC_AGE_MS })
        );
    }
}
