//! Narrow native image commands with retained blocking-worker admission.

use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
use glitchpad_core::image_metadata::{ImageMetadataReport, extract_image_metadata};
use glitchpad_core::images::{
    DecodedImage, ImageFailure, ImageLimits, RasterCodec, decode_image, raster_signature,
};
use glitchpad_core::source::{ExternalRevision, SourceId};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[derive(Clone)]
struct ActiveImageRequest {
    source: SourceId,
    request: String,
    cancelled: Arc<AtomicBool>,
}

#[derive(Clone, Default)]
pub struct ImageRenderHost {
    active: Arc<Mutex<Option<ActiveImageRequest>>>,
    pending_cancellations: Arc<Mutex<std::collections::VecDeque<(SourceId, String)>>>,
}

struct ImagePermit {
    host: ImageRenderHost,
    cancel: Arc<AtomicBool>,
}

impl Drop for ImagePermit {
    fn drop(&mut self) {
        if let Ok(mut active) = self.host.active.lock() {
            *active = None;
        }
    }
}

fn safe(category: CoreErrorCategory, message: &str, retry: bool) -> CoreError {
    CoreError::new(category, message, retry, true)
}

impl ImageRenderHost {
    fn begin(&self, source: &SourceId, request: &str) -> Result<ImagePermit, CoreError> {
        if source.0.len() > 64 || request.len() != 36 || uuid::Uuid::parse_str(request).is_err() {
            return Err(safe(
                CoreErrorCategory::InvalidInput,
                "The image request identifier is invalid",
                false,
            ));
        }
        let mut active = self.active.lock().map_err(|_| {
            safe(
                CoreErrorCategory::Unavailable,
                "Image rendering is unavailable",
                true,
            )
        })?;
        let mut pending = self.pending_cancellations.lock().map_err(|_| {
            safe(
                CoreErrorCategory::Unavailable,
                "Image cancellation is unavailable",
                true,
            )
        })?;
        if let Some(index) = pending
            .iter()
            .position(|(owner, id)| owner == source && id == request)
        {
            pending.remove(index);
            return Err(safe(
                CoreErrorCategory::StaleSession,
                "Image work was cancelled before admission",
                true,
            ));
        }
        if active.is_some() {
            return Err(safe(
                CoreErrorCategory::ResourceLimit,
                "Another image decode is still finishing",
                true,
            )
            .with_context("image_failure", "busy"));
        }
        let cancel = Arc::new(AtomicBool::new(false));
        *active = Some(ActiveImageRequest {
            source: source.clone(),
            request: request.into(),
            cancelled: cancel.clone(),
        });
        Ok(ImagePermit {
            host: self.clone(),
            cancel,
        })
    }

    fn cancel(&self, source: &SourceId, request: &str) -> Result<bool, CoreError> {
        if source.0.len() > 64 || request.len() != 36 || uuid::Uuid::parse_str(request).is_err() {
            return Err(safe(
                CoreErrorCategory::InvalidInput,
                "The image cancellation identifier is invalid",
                false,
            ));
        }
        let active = self.active.lock().map_err(|_| {
            safe(
                CoreErrorCategory::Unavailable,
                "Image rendering is unavailable",
                true,
            )
        })?;
        let Some(current) = active
            .as_ref()
            .filter(|r| r.source == *source && r.request == request)
        else {
            // Cancellation IPC can arrive before the asynchronous render handler.
            // Retain a bounded owner/request tombstone so that late admission stops.
            let mut pending = self.pending_cancellations.lock().map_err(|_| {
                safe(
                    CoreErrorCategory::Unavailable,
                    "Image cancellation is unavailable",
                    true,
                )
            })?;
            if !pending
                .iter()
                .any(|(owner, id)| owner == source && id == request)
            {
                if pending.len() == 64 {
                    pending.pop_front();
                }
                pending.push_back((source.clone(), request.into()));
            }
            return Ok(false);
        };
        current.cancelled.store(true, Ordering::Release);
        Ok(true)
    }
}

#[derive(Serialize)]
pub struct ImageRenderResult {
    pub source_id: SourceId,
    pub request_id: String,
    pub external_revision: ExternalRevision,
    pub preview: Option<DecodedImage>,
    pub failure: Option<ImageFailure>,
    pub metadata: ImageMetadataReport,
}

fn read_bytes(
    app: &tauri::AppHandle,
    source: &SourceId,
    revision: &ExternalRevision,
    cancel: &AtomicBool,
    probe: bool,
) -> Result<Vec<u8>, CoreError> {
    #[cfg(not(mobile))]
    {
        app.state::<crate::source::DesktopSourceHost>()
            .read_image_bytes(source, revision, cancel, probe)
    }
    #[cfg(target_os = "android")]
    {
        app.state::<crate::android_source::AndroidSourceHost>()
            .read_image_bytes(source, revision, cancel, probe)
    }
    #[cfg(all(mobile, not(target_os = "android")))]
    {
        let _ = (app, source, revision, cancel, probe);
        Err(safe(
            CoreErrorCategory::Unavailable,
            "Image source is unavailable",
            false,
        ))
    }
}

fn current_revision(
    app: &tauri::AppHandle,
    source: &SourceId,
    revision: &ExternalRevision,
) -> Result<bool, CoreError> {
    #[cfg(not(mobile))]
    {
        app.state::<crate::source::DesktopSourceHost>()
            .image_revision_matches(source, revision)
    }
    #[cfg(target_os = "android")]
    {
        app.state::<crate::android_source::AndroidSourceHost>()
            .image_revision_matches(source, revision)
    }
    #[cfg(all(mobile, not(target_os = "android")))]
    {
        let _ = (app, source, revision);
        Ok(false)
    }
}

#[tauri::command]
pub(crate) async fn identify_image_source(
    app: tauri::AppHandle,
    source_id: SourceId,
    expected_revision: ExternalRevision,
) -> Result<Option<RasterCodec>, CoreError> {
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = read_bytes(
            &app,
            &source_id,
            &expected_revision,
            &AtomicBool::new(false),
            true,
        )?;
        Ok(raster_signature(&bytes))
    })
    .await
    .map_err(|_| {
        safe(
            CoreErrorCategory::Unavailable,
            "Image identification failed safely",
            true,
        )
    })?
}

#[tauri::command]
pub(crate) async fn render_image_source(
    app: tauri::AppHandle,
    source_id: SourceId,
    expected_revision: ExternalRevision,
    request_id: String,
) -> Result<ImageRenderResult, CoreError> {
    let permit = app
        .state::<ImageRenderHost>()
        .begin(&source_id, &request_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let permit = permit;
        let bytes = read_bytes(&app, &source_id, &expected_revision, &permit.cancel, false)?;
        let limits = if cfg!(target_os = "android") {
            ImageLimits::android()
        } else {
            ImageLimits::desktop()
        };
        let decoded = decode_image(&bytes, &limits, &permit.cancel);
        let metadata = if permit.cancel.load(Ordering::Acquire) {
            ImageMetadataReport::default()
        } else {
            extract_image_metadata(&bytes)
        };
        if permit.cancel.load(Ordering::Acquire) {
            return Err(safe(
                CoreErrorCategory::StaleSession,
                "Image work was cancelled",
                true,
            ));
        }
        if !current_revision(&app, &source_id, &expected_revision)? {
            return Err(safe(
                CoreErrorCategory::Conflict,
                "The image source changed",
                true,
            ));
        }
        let (preview, failure) = match decoded {
            Ok(preview) => (Some(preview), None),
            Err(failure) => (None, Some(failure)),
        };
        Ok(ImageRenderResult {
            source_id,
            request_id,
            external_revision: expected_revision,
            preview,
            failure,
            metadata,
        })
    })
    .await
    .map_err(|_| {
        safe(
            CoreErrorCategory::Unavailable,
            "Image decoding failed safely",
            true,
        )
    })?
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)] // Tauri deserializes owned command arguments.
pub(crate) fn cancel_image_render(
    renders: tauri::State<'_, ImageRenderHost>,
    source_id: SourceId,
    request_id: String,
) -> Result<bool, CoreError> {
    renders.cancel(&source_id, &request_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancellation_before_render_admission_is_owner_scoped_and_bounded() {
        let host = ImageRenderHost::default();
        let source = SourceId("opaque-source".into());
        let request = uuid::Uuid::new_v4().to_string();
        assert!(!host.cancel(&source, &request).unwrap());
        assert!(host.begin(&source, &request).is_err());
        assert!(
            host.begin(&source, &uuid::Uuid::new_v4().to_string())
                .is_ok()
        );
        for _ in 0..1000 {
            host.cancel(&source, &uuid::Uuid::new_v4().to_string())
                .unwrap();
        }
        assert_eq!(host.pending_cancellations.lock().unwrap().len(), 64);
    }

    #[test]
    fn cancellation_retains_admission_until_actual_completion() {
        let host = ImageRenderHost::default();
        let source = SourceId("opaque-source".into());
        let request = uuid::Uuid::new_v4().to_string();
        let permit = host.begin(&source, &request).unwrap();
        assert!(host.cancel(&source, &request).unwrap());
        assert!(permit.cancel.load(Ordering::Acquire));
        assert!(
            host.begin(&source, &uuid::Uuid::new_v4().to_string())
                .is_err()
        );
        drop(permit);
        assert!(
            host.begin(&source, &uuid::Uuid::new_v4().to_string())
                .is_ok()
        );
    }

    #[test]
    fn cancellation_is_owner_scoped_and_idempotent() {
        let host = ImageRenderHost::default();
        let source = SourceId("opaque-source".into());
        assert!(host.begin(&source, "invalid").is_err());
        let request = uuid::Uuid::new_v4().to_string();
        let permit = host.begin(&source, &request).unwrap();
        assert!(
            !host
                .cancel(&SourceId("other-source".into()), &request)
                .unwrap()
        );
        assert!(!permit.cancel.load(Ordering::Acquire));
        assert!(host.cancel(&source, &request).unwrap());
        assert!(host.cancel(&source, &request).unwrap());
        drop(permit);
        assert!(!host.cancel(&source, &request).unwrap());
    }
}
