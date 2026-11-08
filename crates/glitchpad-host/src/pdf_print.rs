//! PDF-only print handoff. No path, output destination or source mutation is accepted.
use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
use glitchpad_core::source::{ExternalRevision, SourceId};

fn unavailable() -> CoreError {
    CoreError::new(
        CoreErrorCategory::Unavailable,
        "PDF printing is unavailable",
        true,
        true,
    )
}
#[tauri::command]
pub(crate) fn pdf_print_available() -> bool {
    cfg!(any(
        target_os = "android",
        target_os = "windows",
        target_os = "macos",
        target_os = "linux"
    ))
}

#[cfg(not(mobile))]
#[tauri::command]
pub(crate) async fn request_pdf_desktop_print(
    app: tauri::AppHandle,
    source_id: SourceId,
    expected_revision: ExternalRevision,
) -> Result<(), CoreError> {
    use tauri::Manager;
    let verified = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let prefix = crate::images::document_prefix(&verified, &source_id, &expected_revision)?;
        if !prefix.starts_with(b"%PDF-") {
            return Err(unavailable());
        }
        Ok(())
    })
    .await
    .map_err(|_| unavailable())??;
    app.get_webview_window("main")
        .ok_or_else(unavailable)?
        .print()
        .map_err(|_| unavailable())
}

#[cfg(target_os = "android")]
#[tauri::command]
pub(crate) async fn pdf_print_operation(
    app: tauri::AppHandle,
    source_id: SourceId,
    expected_revision: ExternalRevision,
    mut request: glitchpad_android_source::models::PdfPrintRequest,
) -> Result<glitchpad_android_source::models::PdfPrintResponse, CoreError> {
    use glitchpad_android_source::AndroidSourceExt;
    use sha2::{Digest, Sha256};
    if uuid::Uuid::parse_str(&request.request_id).is_err()
        || !["begin", "append", "seal", "handoff", "inspect", "cancel"]
            .contains(&request.operation.as_str())
        || request.bytes.len() > 262144
        || request.sha256.len() > 64
    {
        return Err(unavailable());
    }
    request.owner = format!(
        "{:x}",
        Sha256::digest(
            serde_json::to_vec(&(&source_id, &expected_revision)).map_err(|_| unavailable())?
        )
    );
    crate::android_interactive::run(move || {
        if request.operation == "begin" || request.operation == "handoff" {
            let prefix = crate::images::document_prefix(&app, &source_id, &expected_revision)?;
            if !prefix.starts_with(b"%PDF-") {
                return Err(unavailable());
            }
        }
        app.android_source()
            .pdf_print(request)
            .map_err(|_| unavailable())
    })
    .await
}
