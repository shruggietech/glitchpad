//! PDF signature and emitted-worker policy. Parsing receives no native authority.
use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
use glitchpad_core::source::{ExternalRevision, SourceId};

pub const WORKER_CSP: &str = "default-src 'none'; connect-src 'none'; script-src 'none'; worker-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'";

pub fn is_pdf_worker_path(path: &str) -> bool {
    let Some(name) = path.strip_prefix("/assets/pdf-worker-").and_then(|p| p.strip_suffix(".js")) else { return false; };
    !name.is_empty() && name.len() <= 64 && name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

#[tauri::command]
pub(crate) async fn identify_pdf_source(
    app: tauri::AppHandle,
    source_id: SourceId,
    expected_revision: ExternalRevision,
) -> Result<bool, CoreError> {
    tauri::async_runtime::spawn_blocking(move || {
        let prefix = crate::images::document_prefix(&app, &source_id, &expected_revision)?;
        Ok(prefix.starts_with(b"%PDF-"))
    }).await.map_err(|_| CoreError::new(CoreErrorCategory::Unavailable, "Document identification is unavailable", true, true))?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn policy_targets_only_the_reviewed_emitted_worker_shape() {
        assert!(is_pdf_worker_path("/assets/pdf-worker-ABC_def-1.js"));
        for path in ["/assets/main.js", "/assets/pdf-worker-.js", "/assets/pdf-worker-a.js/evil", "/assets/pdf-worker-a/b.js", "/assets/pdf-worker-a.js?x", "/pdf-worker-a.js"] { assert!(!is_pdf_worker_path(path)); }
        assert!(WORKER_CSP.contains("connect-src 'none'"));
        assert!(WORKER_CSP.contains("script-src 'none'"));
    }
}
