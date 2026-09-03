use std::{fs, path::PathBuf};

use glitchpad_core::persistence::{
    AppStateCategory, DiagnosticComponent, DiagnosticEnvironment, DiagnosticEvent,
    DiagnosticEventId, DiagnosticLevel, DiagnosticPlatform, MAX_PREFERENCE_BYTES,
    MAX_SESSION_PROJECTIONS, PreferenceState, SessionProjection, SessionState, StateLoadStatus,
    ThemePreference, WindowProjection,
};
use glitchpad_lib::app_state::ApplicationStateStore;
use uuid::Uuid;

struct TestRoot(PathBuf);

impl TestRoot {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("glitchpad-state-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).expect("create test root");
        Self(path)
    }

    fn store(&self) -> ApplicationStateStore {
        ApplicationStateStore::open(&self.0).expect("open test store")
    }
}

impl Drop for TestRoot {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).expect("remove test root");
    }
}

fn valid_environment() -> DiagnosticEnvironment {
    DiagnosticEnvironment {
        product_version: "0.0.0".into(),
        specification_version: "0.0.0".into(),
        platform: DiagnosticPlatform::Windows,
        architecture: "x86_64".into(),
        webview_version: None,
        core_version: "0.0.0".into(),
        build_commit: None,
    }
}

#[test]
fn preferences_round_trip_and_invalid_fields_default_independently() {
    let root = TestRoot::new();
    let store = root.store();
    let preferences = PreferenceState {
        theme: ThemePreference::Dark,
        editor_font_size: 20,
        ..PreferenceState::default()
    };
    store
        .persist_preferences(&preferences)
        .expect("persist preferences");
    assert_eq!(
        store.load_preferences().expect("load preferences").value,
        preferences
    );

    fs::write(
        root.0.join("preferences.json"),
        br#"{"schema_version":1,"theme":"light","editor_font_family":"system-ui","editor_font_size":255,"line_wrap":false,"tab_width":2,"markdown_default_mode":"source","language_overrides":{}}"#,
    )
    .expect("write invalid field fixture");
    let loaded = store.load_preferences().expect("load partial fixture");
    assert_eq!(loaded.status, StateLoadStatus::Loaded);
    assert_eq!(loaded.value.theme, ThemePreference::Light);
    assert_eq!(loaded.value.editor_font_size, 14);
    assert_eq!(loaded.value.tab_width, 2);
    assert_eq!(
        loaded.warning_code.as_deref(),
        Some("preferences_fields_defaulted")
    );
}

#[test]
fn corrupt_and_future_preferences_do_not_block_startup_or_destroy_bytes() {
    let root = TestRoot::new();
    let store = root.store();
    fs::write(root.0.join("preferences.json"), b"{broken").expect("write corrupt fixture");
    let corrupt = store.load_preferences().expect("load corrupt fixture");
    assert_eq!(corrupt.status, StateLoadStatus::Corrupt);
    assert_eq!(corrupt.value, PreferenceState::default());

    let future = br#"{"schema_version":99,"private_future_value":"preserve exactly"}"#;
    fs::write(root.0.join("preferences.json"), future).expect("write future fixture");
    let unsupported = store.load_preferences().expect("load future fixture");
    assert_eq!(unsupported.status, StateLoadStatus::Unsupported);
    assert!(
        store
            .persist_preferences(&PreferenceState::default())
            .is_err()
    );
    assert_eq!(
        fs::read(root.0.join("preferences.json")).expect("read future fixture"),
        future
    );
}

#[test]
fn corrupt_categories_self_heal_on_the_next_valid_write() {
    let root = TestRoot::new();
    let store = root.store();
    for filename in ["preferences.json", "session.json", "diagnostics.json"] {
        fs::write(root.0.join(filename), b"{truncated").expect("write corrupt category");
    }
    let preferences = PreferenceState {
        theme: ThemePreference::Dark,
        ..PreferenceState::default()
    };
    store
        .persist_preferences(&preferences)
        .expect("replace corrupt preferences");
    store
        .persist_session(SessionState::default())
        .expect("replace corrupt session");
    store
        .append_diagnostic(
            DiagnosticEvent {
                occurred_unix_ms: 10,
                level: DiagnosticLevel::Info,
                event_id: DiagnosticEventId::AppStarted,
                platform: DiagnosticPlatform::Android,
                component: DiagnosticComponent::ApplicationState,
                duration_ms: None,
                byte_count: None,
                error_code: None,
            },
            10,
        )
        .expect("replace corrupt diagnostics");
    assert_eq!(
        store
            .load_preferences()
            .expect("load healed preferences")
            .value,
        preferences
    );
    assert_eq!(
        store.load_session().expect("load healed session").status,
        StateLoadStatus::Loaded
    );
    assert_eq!(
        store
            .preview_diagnostics(valid_environment(), 10)
            .expect("load healed diagnostics")
            .value
            .events
            .len(),
        1
    );
}

#[test]
fn oversized_state_defaults_and_legacy_migration_is_deterministic() {
    let root = TestRoot::new();
    let store = root.store();
    fs::write(
        root.0.join("preferences.json"),
        vec![b'x'; MAX_PREFERENCE_BYTES + 1],
    )
    .expect("write oversized fixture");
    let oversized = store.load_preferences().expect("load oversized fixture");
    assert_eq!(oversized.status, StateLoadStatus::Corrupt);
    assert_eq!(oversized.value, PreferenceState::default());

    let legacy = br#"{"schema_version":0,"theme":"dark","editor_font_family":"system-ui","editor_font_size":18,"line_wrap":false,"tab_width":2,"markdown_default_mode":"source","language_overrides":{"rs":"rust"}}"#;
    fs::write(root.0.join("preferences.json"), legacy).expect("write legacy fixture");
    let expected = store.load_preferences().expect("first migration");
    assert_eq!(expected.status, StateLoadStatus::Migrated);
    let expected_bytes = serde_json::to_vec(&expected.value).expect("serialize migrated state");
    for _ in 0..100 {
        let migrated = store.load_preferences().expect("repeat migration");
        assert_eq!(migrated.status, StateLoadStatus::Migrated);
        assert_eq!(
            serde_json::to_vec(&migrated.value).expect("serialize repeated migration"),
            expected_bytes
        );
    }
}

#[test]
fn future_schema_survives_repeated_launch_and_write_attempts() {
    let root = TestRoot::new();
    let store = root.store();
    let future = br#"{"schema_version":99,"private_future_value":"preserve exactly"}"#;
    fs::write(root.0.join("preferences.json"), future).expect("write future fixture");
    for _ in 0..100 {
        assert_eq!(
            store.load_preferences().expect("load future state").status,
            StateLoadStatus::Unsupported
        );
        assert!(
            store
                .persist_preferences(&PreferenceState::default())
                .is_err()
        );
        assert_eq!(
            fs::read(root.0.join("preferences.json")).expect("read future bytes"),
            future
        );
    }
}

#[test]
fn category_reset_is_exact_and_idempotent() {
    let root = TestRoot::new();
    let store = root.store();
    store
        .persist_preferences(&PreferenceState::default())
        .expect("persist preferences");
    store
        .persist_session(SessionState::default())
        .expect("persist session");
    fs::write(root.0.join("recovery-sentinel.json"), b"never remove").expect("write sentinel");

    assert!(
        store
            .reset(AppStateCategory::Preferences)
            .expect("reset preferences")
    );
    assert!(
        !store
            .reset(AppStateCategory::Preferences)
            .expect("repeat reset")
    );
    assert!(root.0.join("session.json").exists());
    assert_eq!(
        fs::read(root.0.join("recovery-sentinel.json")).expect("read sentinel"),
        b"never remove"
    );
}

#[test]
fn session_state_is_bounded_deduplicated_and_contains_no_document_bytes() {
    let root = TestRoot::new();
    let store = root.store();
    let projection = SessionProjection {
        session_key: "session-one".into(),
        display_hint: "notes.md".into(),
        renderer_id: "markdown".into(),
        presentation_mode: Some("rendered".into()),
        source_reference: Some("37d21d4b-674d-41fa-b792-29b7c2012ed3".into()),
        recovery_record_id: None,
    };
    store
        .persist_session(SessionState {
            schema_version: 1,
            window: WindowProjection::default(),
            sessions: vec![projection.clone(), projection],
        })
        .expect("persist session projection");
    let encoded = fs::read_to_string(root.0.join("session.json")).expect("read session state");
    assert_eq!(
        store
            .load_session()
            .expect("load session")
            .value
            .sessions
            .len(),
        1
    );
    assert!(!encoded.contains("document content sentinel"));
    assert!(!encoded.contains("raw_text"));
    assert!(!encoded.contains("content\""));
}

#[test]
fn session_state_caps_platform_references_and_keeps_recovery_separate() {
    let root = TestRoot::new();
    let store = root.store();
    let sessions = (0..MAX_SESSION_PROJECTIONS + 8)
        .map(|index| SessionProjection {
            session_key: format!("session-{index}"),
            display_hint: format!("document-{index}.txt"),
            renderer_id: "text".into(),
            presentation_mode: None,
            source_reference: Some(Uuid::new_v4().to_string()),
            recovery_record_id: (index == 0).then(|| Uuid::new_v4().to_string()),
        })
        .collect();
    store
        .persist_session(SessionState {
            schema_version: 1,
            window: WindowProjection::default(),
            sessions,
        })
        .expect("persist bounded platform projection");
    let loaded = store.load_session().expect("load bounded projection");
    assert_eq!(loaded.value.sessions.len(), MAX_SESSION_PROJECTIONS);
    assert!(loaded.value.sessions[0].recovery_record_id.is_some());
    assert!(!root.0.join("recovery-sentinel.json").exists());
}

#[test]
fn diagnostics_are_allowlisted_retained_and_previewed_without_hostile_strings() {
    let root = TestRoot::new();
    let store = root.store();
    let now = 1_800_000_000_000;
    let valid = DiagnosticEvent {
        occurred_unix_ms: now,
        level: DiagnosticLevel::Warning,
        event_id: DiagnosticEventId::StateLoadFailed,
        platform: DiagnosticPlatform::Windows,
        component: DiagnosticComponent::ApplicationState,
        duration_ms: Some(4),
        byte_count: Some(128),
        error_code: Some("state_corrupt".into()),
    };
    store
        .append_diagnostic(valid.clone(), now)
        .expect("append diagnostic");
    let hostile = DiagnosticEvent {
        error_code: Some("C:\\Users\\private\\secret.txt".into()),
        ..valid
    };
    assert!(store.append_diagnostic(hostile, now).is_err());

    let preview = store
        .preview_diagnostics(valid_environment(), now)
        .expect("preview diagnostics");
    let encoded = serde_json::to_string(&preview.value).expect("serialize preview");
    assert_eq!(preview.value.events.len(), 1);
    assert!(!encoded.contains("Users"));
    assert!(!encoded.contains("secret.txt"));
}

#[test]
fn diagnostic_environment_rejects_arbitrary_locator_fields() {
    let root = TestRoot::new();
    let store = root.store();
    let environment = DiagnosticEnvironment {
        product_version: "0.0.0".into(),
        specification_version: "0.0.0".into(),
        platform: DiagnosticPlatform::Windows,
        architecture: "C:\\private\\notes.txt".into(),
        webview_version: None,
        core_version: "0.0.0".into(),
        build_commit: None,
    };
    assert!(store.preview_diagnostics(environment, 1).is_err());
}
