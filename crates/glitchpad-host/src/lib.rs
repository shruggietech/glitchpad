//! Tauri host boundary for desktop and Android builds.

use tauri::Manager;

#[cfg(not(mobile))]
pub mod source;

pub mod android_source;

/// Starts the Glitchpad host shell.
///
/// # Panics
///
/// Panics when the host cannot initialize or process a runtime event.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let product = glitchpad_core::product_info();

    let builder = tauri::Builder::default();
    #[cfg(target_os = "android")]
    let builder = builder.plugin(glitchpad_android_source::init());
    #[cfg(not(mobile))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        source::read_source_range,
        source::open_source_stream,
        source::read_source_stream,
        source::query_source_metadata,
        source::start_source_watch,
        source::drain_source_events,
        source::revalidate_source,
        source::save_source,
        source::close_source,
    ]);
    #[cfg(target_os = "android")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        drain_android_deliveries,
        open_android_document,
        read_android_range,
        open_android_stream,
        read_android_stream,
        query_android_metadata,
        revalidate_android_source,
        restore_android_sources,
        save_android_source_as,
        close_android_source,
    ]);

    builder
        .setup(move |app| {
            app.manage(product);
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

#[cfg(target_os = "android")]
#[tauri::command]
fn drain_android_deliveries(
    host: tauri::State<'_, android_source::AndroidSourceHost>,
    maximum: usize,
) -> Result<Vec<glitchpad_core::source::AndroidSourceSummary>, glitchpad_core::contracts::CoreError>
{
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
) -> Result<glitchpad_core::source::SourceMetadata, glitchpad_core::contracts::CoreError> {
    host.query_metadata(&source_id)
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
