//! Tauri host boundary for desktop and Android builds.

use tauri::Manager;

pub mod external_link;
pub mod recovery;
#[cfg(not(mobile))]
pub mod source;

pub mod android_source;

struct RecoveryHostState {
    store: Result<recovery::RecoveryStore, glitchpad_core::contracts::CoreError>,
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
pub fn run() {
    let product = glitchpad_core::product_info();

    let builder = tauri::Builder::default().plugin(
        tauri_plugin_opener::Builder::new()
            .open_js_links_on_click(false)
            .build(),
    );
    #[cfg(target_os = "android")]
    let builder = builder.plugin(glitchpad_android_source::init());
    #[cfg(not(mobile))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        inventory_recovery,
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
    ]);
    #[cfg(target_os = "android")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        inventory_recovery,
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

    builder
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
            #[cfg(not(mobile))]
            app.manage(source::DesktopSourceHost::new());
            #[cfg(target_os = "android")]
            {
                use glitchpad_android_source::AndroidSourceExt;
                app.manage(android_source::AndroidSourceHost::new(
                    app.android_source().inner().clone(),
                ));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Glitchpad host failed while processing a runtime event");
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
