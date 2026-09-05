//! Tauri host boundary for desktop and Android builds.

use tauri::{Emitter, Manager};

pub mod app_state;
#[cfg(not(mobile))]
pub mod desktop_delivery;
pub mod external_link;
#[cfg(not(mobile))]
pub mod lifecycle_probe;
pub mod performance;
pub mod recovery;
#[cfg(not(mobile))]
pub mod source;

pub mod android_source;

struct RecoveryHostState {
    store: Result<recovery::RecoveryStore, glitchpad_core::contracts::CoreError>,
}

struct ApplicationStateHost {
    store: Result<app_state::ApplicationStateStore, glitchpad_core::contracts::CoreError>,
}

impl ApplicationStateHost {
    fn store(
        &self,
    ) -> Result<&app_state::ApplicationStateStore, glitchpad_core::contracts::CoreError> {
        self.store.as_ref().map_err(Clone::clone)
    }
}

fn application_state_for(app: &tauri::App) -> ApplicationStateHost {
    let store = app.path().app_config_dir().map_or_else(
        |_| {
            Err(glitchpad_core::contracts::CoreError::new(
                glitchpad_core::contracts::CoreErrorCategory::Unavailable,
                "Application state is unavailable",
                true,
                true,
            ))
        },
        |root| app_state::ApplicationStateStore::open(root.join("state-v1")),
    );
    ApplicationStateHost { store }
}

impl RecoveryHostState {
    fn available(store: recovery::RecoveryStore) -> Self {
        Self { store: Ok(store) }
    }

    fn unavailable(error: glitchpad_core::contracts::CoreError) -> Self {
        Self { store: Err(error) }
    }

    fn store(&self) -> Result<&recovery::RecoveryStore, glitchpad_core::contracts::CoreError> {
        self.store.as_ref().map_err(Clone::clone)
    }
}

fn recovery_unavailable() -> glitchpad_core::contracts::CoreError {
    glitchpad_core::contracts::CoreError::new(
        glitchpad_core::contracts::CoreErrorCategory::Unavailable,
        "Recovery storage is unavailable. Dirty documents remain usable.",
        true,
        true,
    )
}

/// Starts the Glitchpad host shell.
///
/// # Panics
///
/// Panics when the host cannot initialize or process a runtime event.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(clippy::too_many_lines)]
pub fn run() {
    let product = glitchpad_core::product_info();

    let builder = tauri::Builder::default();
    #[cfg(not(mobile))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, arguments, cwd| {
        let host = app.state::<source::DesktopSourceHost>();
        let queue = app.state::<desktop_delivery::DesktopDeliveryQueue>();
        let _ = queue.enqueue_arguments(
            &host,
            source::DesktopDeliveryKind::CommandLine,
            arguments.into_iter().map(std::ffi::OsString::from),
            std::path::Path::new(&cwd),
        );
        let _ = app.emit("desktop-deliveries-ready", ());
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }));
    #[cfg(not(mobile))]
    let builder = builder.plugin(tauri_plugin_dialog::init());
    let builder = builder.plugin(
        tauri_plugin_opener::Builder::new()
            .open_js_links_on_click(false)
            .build(),
    );
    #[cfg(target_os = "android")]
    let builder = builder.plugin(glitchpad_android_source::init());
    #[cfg(not(mobile))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        inventory_recovery,
        load_preferences,
        persist_preferences,
        load_session_state,
        persist_session_state,
        append_diagnostic,
        preview_diagnostics,
        reset_application_state,
        persist_recovery,
        load_recovery,
        remove_recovery,
        external_link::open_external_link,
        source::read_source_range,
        source::open_source_stream,
        source::read_source_stream,
        source::query_source_metadata,
        source::start_source_integrity,
        source::advance_source_integrity,
        source::cancel_source_integrity,
        source::start_source_watch,
        source::drain_source_events,
        source::revalidate_source,
        source::save_source,
        source::close_source,
        desktop_delivery::close_desktop_source,
        desktop_delivery::choose_desktop_sources,
        desktop_delivery::drain_desktop_deliveries,
        desktop_delivery::save_desktop_source_as,
        lifecycle_probe::record_desktop_lifecycle_probe,
    ]);
    #[cfg(target_os = "android")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        inventory_recovery,
        load_preferences,
        persist_preferences,
        load_session_state,
        persist_session_state,
        append_diagnostic,
        preview_diagnostics,
        reset_application_state,
        persist_recovery,
        load_recovery,
        remove_recovery,
        external_link::open_external_link,
        drain_android_deliveries,
        open_android_document,
        read_android_range,
        open_android_stream,
        read_android_stream,
        query_android_metadata,
        start_android_integrity,
        advance_android_integrity,
        cancel_android_integrity,
        revalidate_android_source,
        restore_android_sources,
        save_android_source_as,
        close_android_source,
    ]);

    #[cfg(not(mobile))]
    let builder = builder.on_window_event(|window, event| {
        if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
            let host = window.state::<source::DesktopSourceHost>();
            let queue = window.state::<desktop_delivery::DesktopDeliveryQueue>();
            let _ = queue.enqueue_paths(&host, source::DesktopDeliveryKind::Drop, paths.clone());
            let _ = window.emit("desktop-deliveries-ready", ());
        }
    });

    let application = builder
        .setup(move |app| {
            app.manage(product);
            let recovery_quota = if cfg!(target_os = "android") {
                recovery::ANDROID_RECOVERY_QUOTA_BYTES
            } else {
                recovery::DESKTOP_RECOVERY_QUOTA_BYTES
            };
            let recovery_state = match app.path().app_local_data_dir() {
                Ok(root) => recovery::RecoveryStore::open(root.join("recovery-v1"), recovery_quota)
                    .map_or_else(RecoveryHostState::unavailable, RecoveryHostState::available),
                Err(_) => RecoveryHostState::unavailable(recovery_unavailable()),
            };
            app.manage(recovery_state);
            app.manage(application_state_for(app));
            #[cfg(not(mobile))]
            {
                app.manage(lifecycle_probe::LifecycleProbeState::for_application(
                    &app.config().identifier,
                ));
                let host = source::DesktopSourceHost::new();
                let queue = desktop_delivery::DesktopDeliveryQueue::new();
                if let Ok(working_directory) = std::env::current_dir() {
                    let _ = queue.enqueue_arguments(
                        &host,
                        source::DesktopDeliveryKind::CommandLine,
                        std::env::args_os(),
                        &working_directory,
                    );
                }
                app.manage(host);
                app.manage(queue);
            }
            #[cfg(target_os = "android")]
            {
                use glitchpad_android_source::AndroidSourceExt;
                app.manage(android_source::AndroidSourceHost::new(
                    app.android_source().inner().clone(),
                ));
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Glitchpad host failed to initialize");
    application.run(|app, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            desktop_delivery::enqueue_opened_urls(app, urls);
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app, event);
    });
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn load_preferences(
    state: tauri::State<'_, ApplicationStateHost>,
) -> Result<
    glitchpad_core::persistence::StateLoad<glitchpad_core::persistence::PreferenceState>,
    glitchpad_core::contracts::CoreError,
> {
    state.store()?.load_preferences()
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn persist_preferences(
    state: tauri::State<'_, ApplicationStateHost>,
    preferences: glitchpad_core::persistence::PreferenceState,
) -> Result<(), glitchpad_core::contracts::CoreError> {
    state.store()?.persist_preferences(&preferences)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn load_session_state(
    state: tauri::State<'_, ApplicationStateHost>,
) -> Result<
    glitchpad_core::persistence::StateLoad<glitchpad_core::persistence::SessionState>,
    glitchpad_core::contracts::CoreError,
> {
    state.store()?.load_session()
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn persist_session_state(
    state: tauri::State<'_, ApplicationStateHost>,
    session: glitchpad_core::persistence::SessionState,
) -> Result<(), glitchpad_core::contracts::CoreError> {
    state.store()?.persist_session(session)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn append_diagnostic(
    state: tauri::State<'_, ApplicationStateHost>,
    event: glitchpad_core::persistence::DiagnosticEvent,
    now_unix_ms: u64,
) -> Result<(), glitchpad_core::contracts::CoreError> {
    state.store()?.append_diagnostic(event, now_unix_ms)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn preview_diagnostics(
    state: tauri::State<'_, ApplicationStateHost>,
    now_unix_ms: u64,
) -> Result<
    glitchpad_core::persistence::StateLoad<glitchpad_core::persistence::DiagnosticBundle>,
    glitchpad_core::contracts::CoreError,
> {
    state
        .store()?
        .preview_diagnostics(diagnostic_environment(), now_unix_ms)
}

fn diagnostic_environment() -> glitchpad_core::persistence::DiagnosticEnvironment {
    glitchpad_core::persistence::DiagnosticEnvironment {
        product_version: glitchpad_core::VERSION.into(),
        specification_version: glitchpad_core::VERSION.into(),
        platform: if cfg!(target_os = "windows") {
            glitchpad_core::persistence::DiagnosticPlatform::Windows
        } else if cfg!(target_os = "macos") {
            glitchpad_core::persistence::DiagnosticPlatform::Macos
        } else if cfg!(target_os = "linux") {
            glitchpad_core::persistence::DiagnosticPlatform::Linux
        } else if cfg!(target_os = "android") {
            glitchpad_core::persistence::DiagnosticPlatform::Android
        } else {
            glitchpad_core::persistence::DiagnosticPlatform::Unknown
        },
        architecture: std::env::consts::ARCH.into(),
        webview_version: None,
        core_version: glitchpad_core::VERSION.into(),
        build_commit: option_env!("GLITCHPAD_BUILD_COMMIT").map(str::to_owned),
    }
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn reset_application_state(
    state: tauri::State<'_, ApplicationStateHost>,
    category: glitchpad_core::persistence::AppStateCategory,
) -> Result<bool, glitchpad_core::contracts::CoreError> {
    state.store()?.reset(category)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn inventory_recovery(
    state: tauri::State<'_, RecoveryHostState>,
) -> Result<
    (
        Vec<glitchpad_core::recovery::RecoveryInventoryEntry>,
        u64,
        u32,
    ),
    glitchpad_core::contracts::CoreError,
> {
    let inventory = state.store()?.inventory()?;
    Ok((
        inventory.entries,
        inventory.committed_bytes,
        inventory.removed_invalid_records,
    ))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn persist_recovery(
    state: tauri::State<'_, RecoveryHostState>,
    record: glitchpad_core::recovery::RecoveryRecordDraft,
) -> Result<glitchpad_core::recovery::RecoveryInventoryEntry, glitchpad_core::contracts::CoreError>
{
    let record = record.into_record().map_err(|_| {
        glitchpad_core::contracts::CoreError::new(
            glitchpad_core::contracts::CoreErrorCategory::InvalidInput,
            "The recovery snapshot did not satisfy the bounded record contract",
            false,
            true,
        )
    })?;
    state.store()?.persist(&record)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn load_recovery(
    state: tauri::State<'_, RecoveryHostState>,
    record_id: String,
) -> Result<glitchpad_core::recovery::RecoveryRecord, glitchpad_core::contracts::CoreError> {
    state.store()?.load(&record_id)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn remove_recovery(
    state: tauri::State<'_, RecoveryHostState>,
    record_id: String,
) -> Result<bool, glitchpad_core::contracts::CoreError> {
    Ok(matches!(
        state.store()?.remove(&record_id)?,
        recovery::RecoveryRemoval::Removed
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unavailable_recovery_storage_degrades_to_a_safe_command_error() {
        let state = RecoveryHostState::unavailable(recovery_unavailable());
        let Err(error) = state.store() else {
            panic!("unavailable recovery must not expose a store");
        };

        assert_eq!(
            error.category,
            glitchpad_core::contracts::CoreErrorCategory::Unavailable
        );
        assert!(error.retryable);
        assert!(error.recoverable);
        assert!(error.context.is_empty());
        assert!(!error.summary.contains(['/', '\\']));
    }
}

#[cfg(target_os = "android")]
#[tauri::command]
fn drain_android_deliveries(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    maximum: usize,
) -> Result<glitchpad_core::source::AndroidDeliveryDrain, glitchpad_core::contracts::CoreError> {
    host.drain_deliveries(maximum)
}

#[cfg(target_os = "android")]
#[tauri::command]
fn open_android_document(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    media_type: Option<String>,
) -> Result<glitchpad_core::source::AndroidSourceSummary, glitchpad_core::contracts::CoreError> {
    host.open_document(media_type.as_deref())
}

#[cfg(target_os = "android")]
#[tauri::command]
fn read_android_range(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    source_id: glitchpad_core::source::SourceId,
    offset: u64,
    length: u64,
    operation_budget: u64,
) -> Result<glitchpad_core::source::ReadRangeResult, glitchpad_core::contracts::CoreError> {
    host.read_range(&source_id, offset, length, operation_budget)
}

#[cfg(target_os = "android")]
#[tauri::command]
fn open_android_stream(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    source_id: glitchpad_core::source::SourceId,
    offset: u64,
    total_budget: u64,
) -> Result<glitchpad_core::source::StreamLease, glitchpad_core::contracts::CoreError> {
    host.open_stream(&source_id, offset, total_budget)
}

#[cfg(target_os = "android")]
#[tauri::command]
fn read_android_stream(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    stream_id: glitchpad_core::source::StreamId,
    length: u64,
) -> Result<glitchpad_core::source::ReadRangeResult, glitchpad_core::contracts::CoreError> {
    host.read_stream(&stream_id, length)
}

#[cfg(target_os = "android")]
#[tauri::command]
fn query_android_metadata(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    source_id: glitchpad_core::source::SourceId,
) -> Result<glitchpad_core::source::SourceMetadataSnapshot, glitchpad_core::contracts::CoreError> {
    host.query_metadata_snapshot(&source_id)
}

#[cfg(target_os = "android")]
#[tauri::command]
fn start_android_integrity(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    source_id: glitchpad_core::source::SourceId,
    expected_revision: glitchpad_core::source::ExternalRevision,
    request_id: String,
) -> Result<glitchpad_core::source::IntegrityProgress, glitchpad_core::contracts::CoreError> {
    host.start_integrity(glitchpad_core::source::IntegrityStartRequest {
        request_id: glitchpad_core::source::IntegrityRequestId(request_id),
        source_id,
        expected_external_revision: expected_revision,
    })
}

#[cfg(target_os = "android")]
#[tauri::command]
fn advance_android_integrity(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    request_id: String,
) -> Result<glitchpad_core::source::IntegrityProgress, glitchpad_core::contracts::CoreError> {
    host.advance_integrity(&glitchpad_core::source::IntegrityRequestId(request_id))
}

#[cfg(target_os = "android")]
#[tauri::command]
fn cancel_android_integrity(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    request_id: String,
) -> Result<bool, glitchpad_core::contracts::CoreError> {
    host.cancel_integrity(&glitchpad_core::source::IntegrityRequestId(request_id))
}

#[cfg(target_os = "android")]
#[tauri::command]
fn revalidate_android_source(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    source_id: glitchpad_core::source::SourceId,
    expected: glitchpad_core::source::ExternalRevision,
) -> Result<glitchpad_core::source::RevalidationResult, glitchpad_core::contracts::CoreError> {
    host.revalidate(&source_id, &expected)
}

#[cfg(target_os = "android")]
#[tauri::command]
fn restore_android_sources(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
) -> Result<
    Vec<glitchpad_core::source::AndroidRestorationResult>,
    glitchpad_core::contracts::CoreError,
> {
    host.restore()
}

#[cfg(target_os = "android")]
#[tauri::command]
fn save_android_source_as(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    request: glitchpad_core::source::AndroidSaveAsRequest,
) -> Result<glitchpad_core::source::AndroidSaveAsReceipt, glitchpad_core::contracts::CoreError> {
    host.save_as(request)
}

#[cfg(target_os = "android")]
#[tauri::command]
fn close_android_source(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    source_id: glitchpad_core::source::SourceId,
) -> Result<(), glitchpad_core::contracts::CoreError> {
    host.close(&source_id)
}
