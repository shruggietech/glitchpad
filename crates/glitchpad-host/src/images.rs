//! Narrow native image commands with retained blocking-worker admission.

use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
use glitchpad_core::image_family::{
    AnimationContext, animated_webp, decode_family, decode_ico_entry, ico_inventory,
    image_signature,
};
use glitchpad_core::image_metadata::{ImageMetadataReport, extract_image_metadata};
use glitchpad_core::images::{
    DecodedImage, ImageContainer, ImageFailure, ImageFamilyState, ImageLimits,
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

struct RetainedAnimation {
    source: SourceId,
    revision: ExternalRevision,
    request: String,
    context: AnimationContext,
    metadata: ImageMetadataReport,
}

#[derive(Clone, PartialEq)]
struct SelectedIcon {
    source: SourceId,
    revision: ExternalRevision,
    entry: u32,
}

#[derive(Clone, Default)]
pub struct ImageRenderHost {
    active: Arc<Mutex<Option<ActiveImageRequest>>>,
    pending_cancellations: Arc<Mutex<std::collections::VecDeque<(SourceId, String)>>>,
    retained: Arc<Mutex<Option<RetainedAnimation>>>,
    selected_icon: Arc<Mutex<Option<(SelectedIcon, String)>>>,
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

fn unavailable(message: &str) -> CoreError {
    safe(CoreErrorCategory::Unavailable, message, true)
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
        let mut active = self
            .active
            .lock()
            .map_err(|_| unavailable("Image rendering is unavailable"))?;
        let mut pending = self
            .pending_cancellations
            .lock()
            .map_err(|_| unavailable("Image cancellation is unavailable"))?;
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
        let active = self
            .active
            .lock()
            .map_err(|_| unavailable("Image rendering is unavailable"))?;
        let mut retained = self
            .retained
            .lock()
            .map_err(|_| unavailable("Image retention is unavailable"))?;
        if retained
            .as_ref()
            .is_some_and(|r| r.source == *source && r.request == request)
        {
            *retained = None;
        }
        let mut icon = self
            .selected_icon
            .lock()
            .map_err(|_| unavailable("Image selection is unavailable"))?;
        if icon
            .as_ref()
            .is_some_and(|(icon, id)| icon.source == *source && id == request)
        {
            *icon = None;
        }
        drop(icon);
        drop(retained);
        let Some(current) = active
            .as_ref()
            .filter(|r| r.source == *source && r.request == request)
        else {
            // Cancellation IPC can arrive before the asynchronous render handler.
            // Retain a bounded owner/request tombstone so that late admission stops.
            let mut pending = self
                .pending_cancellations
                .lock()
                .map_err(|_| unavailable("Image cancellation is unavailable"))?;
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
    pub family_state: Option<ImageFamilyState>,
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
) -> Result<Option<ImageContainer>, CoreError> {
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = read_bytes(
            &app,
            &source_id,
            &expected_revision,
            &AtomicBool::new(false),
            true,
        )?;
        Ok(image_signature(&bytes))
    })
    .await
    .map_err(|_| unavailable("Image identification failed safely"))?
}

struct PreviewWork {
    decoded: Result<glitchpad_core::image_family::FamilyPreview, ImageFailure>,
    metadata: ImageMetadataReport,
    context: Option<AnimationContext>,
    container: Option<ImageContainer>,
    selected: u32,
    icon_entries: Option<Vec<glitchpad_core::images::ImageEntry>>,
}

fn prepare_preview(
    app: &tauri::AppHandle,
    permit: &ImagePermit,
    source_id: &SourceId,
    expected_revision: &ExternalRevision,
    selection: Option<u32>,
) -> Result<PreviewWork, CoreError> {
    let started = std::time::Instant::now();
    let limits = if cfg!(target_os = "android") {
        ImageLimits::android()
    } else {
        ImageLimits::desktop()
    };
    let retained = permit
        .host
        .retained
        .lock()
        .map_err(|_| unavailable("Image retention is unavailable"))?
        .take();
    *permit
        .host
        .selected_icon
        .lock()
        .map_err(|_| unavailable("Image selection is unavailable"))? = None;
    let retained = retained.filter(|r| r.source == *source_id && r.revision == *expected_revision);
    let cached_metadata = retained.as_ref().map(|r| r.metadata.clone());
    let mut context = retained.map(|r| r.context);
    if !current_revision(app, source_id, expected_revision)? {
        return Err(safe(
            CoreErrorCategory::Conflict,
            "The image source changed",
            true,
        ));
    }
    let bytes = if context.is_some() {
        Vec::new()
    } else {
        read_bytes(app, source_id, expected_revision, &permit.cancel, false)?
    };
    let container = image_signature(&bytes);
    let icon_entries = if container == Some(ImageContainer::Ico) {
        ico_inventory(&bytes, &permit.cancel).ok()
    } else {
        None
    };
    let mut selected = selection
        .filter(|n| {
            icon_entries
                .as_ref()
                .is_none_or(|entries| (*n as usize) < entries.len())
                && context
                    .as_ref()
                    .is_none_or(|context| *n < context.frame_count())
        })
        .unwrap_or_else(|| {
            icon_entries
                .as_ref()
                .and_then(|entries| {
                    entries
                        .iter()
                        .find(|e| e.failure.is_none())
                        .map(|e| u32::from(e.index))
                })
                .unwrap_or(0)
        });
    let mut decoded = if let Some(context) = context.as_mut() {
        context.frame(selected, &permit.cancel)
    } else if container == Some(ImageContainer::Gif) || animated_webp(&bytes) {
        match AnimationContext::new(&bytes, &limits, &permit.cancel) {
            Ok(mut new_context) => {
                if selected >= new_context.frame_count() {
                    selected = 0;
                }
                let result = new_context.frame(selected, &permit.cancel);
                context = Some(new_context);
                result
            }
            Err(failure) => Err(failure),
        }
    } else if let Some(entries) = icon_entries.as_ref() {
        decode_ico_entry(&bytes, entries.clone(), selected, &limits, &permit.cancel)
    } else {
        decode_family(&bytes, selected, &limits, &permit.cancel)
    };
    let metadata = if permit.cancel.load(Ordering::Acquire) {
        ImageMetadataReport::default()
    } else {
        cached_metadata.unwrap_or_else(|| extract_image_metadata(&bytes))
    };
    if started.elapsed() > std::time::Duration::from_secs(5) {
        decoded = Err(ImageFailure::Deadline);
    }
    Ok(PreviewWork {
        decoded,
        metadata,
        context,
        container,
        selected,
        icon_entries,
    })
}

#[tauri::command]
pub(crate) async fn render_image_source(
    app: tauri::AppHandle,
    source_id: SourceId,
    expected_revision: ExternalRevision,
    request_id: String,
    selection: Option<u32>,
) -> Result<ImageRenderResult, CoreError> {
    let permit = app
        .state::<ImageRenderHost>()
        .begin(&source_id, &request_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let permit = permit;
        let PreviewWork {
            decoded,
            metadata,
            context,
            container,
            selected,
            icon_entries,
        } = prepare_preview(&app, &permit, &source_id, &expected_revision, selection)?;
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
        let (preview, failure, family_state) = match decoded {
            Ok(result) => (Some(result.preview), None, Some(result.state)),
            Err(failure) => (
                None,
                Some(failure),
                icon_entries.map(|mut entries| {
                    if let Some(entry) = entries.get_mut(selected as usize) {
                        entry.failure = Some(failure);
                        entry.preview = glitchpad_core::images::ImagePreviewKind::Unavailable;
                    }
                    ImageFamilyState::Ico {
                        entries,
                        selected_entry: u16::try_from(selected).ok(),
                        selected_entry_export: false,
                    }
                }),
            ),
        };
        let _active_guard = permit
            .host
            .active
            .lock()
            .map_err(|_| unavailable("Image ownership is unavailable"))?;
        if failure.is_none()
            && let Some(context) = context
        {
            let mut retained = permit
                .host
                .retained
                .lock()
                .map_err(|_| unavailable("Image retention is unavailable"))?;
            if !permit.cancel.load(Ordering::Acquire) {
                *retained = Some(RetainedAnimation {
                    source: source_id.clone(),
                    revision: expected_revision.clone(),
                    request: request_id.clone(),
                    context,
                    metadata: metadata.clone(),
                });
            }
        }
        if failure.is_none()
            && !permit.cancel.load(Ordering::Acquire)
            && container == Some(ImageContainer::Ico)
        {
            *permit
                .host
                .selected_icon
                .lock()
                .map_err(|_| unavailable("Image selection is unavailable"))? = Some((
                SelectedIcon {
                    source: source_id.clone(),
                    revision: expected_revision.clone(),
                    entry: selected,
                },
                request_id.clone(),
            ));
        }
        Ok(ImageRenderResult {
            source_id,
            request_id,
            external_revision: expected_revision,
            preview,
            failure,
            metadata,
            family_state,
        })
    })
    .await
    .map_err(|_| unavailable("Image decoding failed safely"))?
}

#[derive(Serialize)]
pub struct ImageExportReceipt {
    status: &'static str,
    durability: Option<glitchpad_core::source::DurabilityGuarantee>,
}

#[cfg(not(mobile))]
fn export_desktop(
    app: &tauri::AppHandle,
    source_id: &SourceId,
    expected_revision: &ExternalRevision,
    entry: u32,
    png: &[u8],
    cancel: &AtomicBool,
) -> Result<ImageExportReceipt, CoreError> {
    use tauri_plugin_dialog::DialogExt;
    let Some(destination) = app
        .dialog()
        .file()
        .set_file_name(format!("icon-entry-{}.png", entry + 1))
        .add_filter("PNG image", &["png"])
        .blocking_save_file()
    else {
        return Ok(ImageExportReceipt {
            status: "cancelled",
            durability: None,
        });
    };
    let path = destination.into_path().map_err(|_| {
        safe(
            CoreErrorCategory::InvalidInput,
            "The export destination is unavailable",
            true,
        )
    })?;
    let host = app.state::<crate::source::DesktopSourceHost>();
    let observed = host.prepare_image_export_destination(source_id, expected_revision, &path)?;
    if observed.is_some()
        && !app
            .dialog()
            .message("Replace the existing destination with the selected PNG entry?")
            .title("Confirm PNG export")
            .buttons(tauri_plugin_dialog::MessageDialogButtons::YesNo)
            .blocking_show()
    {
        return Ok(ImageExportReceipt {
            status: "cancelled",
            durability: None,
        });
    }
    let durability = host.export_image_png(
        source_id,
        expected_revision,
        &path,
        observed.as_ref(),
        png,
        cancel,
    )?;
    Ok(ImageExportReceipt {
        status: "exported",
        durability: Some(durability),
    })
}

#[tauri::command]
pub(crate) async fn export_image_entry(
    app: tauri::AppHandle,
    source_id: SourceId,
    expected_revision: ExternalRevision,
    request_id: String,
    entry: u32,
) -> Result<ImageExportReceipt, CoreError> {
    let permit = app
        .state::<ImageRenderHost>()
        .begin(&source_id, &request_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let permit = permit;
        let selected = SelectedIcon {
            source: source_id.clone(),
            revision: expected_revision.clone(),
            entry,
        };
        if permit
            .host
            .selected_icon
            .lock()
            .map_err(|_| unavailable("Image selection is unavailable"))?
            .as_ref()
            .map(|(icon, _)| icon)
            != Some(&selected)
        {
            return Err(safe(
                CoreErrorCategory::StaleSession,
                "Select a current decoded icon entry before exporting",
                true,
            ));
        }
        *permit
            .host
            .retained
            .lock()
            .map_err(|_| unavailable("Image retention is unavailable"))? = None;
        let bytes = read_bytes(&app, &source_id, &expected_revision, &permit.cancel, false)?;
        if image_signature(&bytes) != Some(ImageContainer::Ico) {
            return Err(safe(
                CoreErrorCategory::UnsupportedInput,
                "Only selected icon entries can be exported",
                false,
            ));
        }
        let limits = if cfg!(target_os = "android") {
            ImageLimits::android()
        } else {
            ImageLimits::desktop()
        };
        let result = decode_family(&bytes, entry, &limits, &permit.cancel).map_err(|_| {
            safe(
                CoreErrorCategory::UnsupportedInput,
                "The icon entry could not be regenerated safely",
                true,
            )
        })?;
        if permit.cancel.load(Ordering::Acquire) {
            return Ok(ImageExportReceipt {
                status: "cancelled",
                durability: None,
            });
        }
        #[cfg(not(mobile))]
        {
            export_desktop(
                &app,
                &source_id,
                &expected_revision,
                entry,
                &result.preview.png_bytes,
                &permit.cancel,
            )
        }
        #[cfg(target_os = "android")]
        {
            let exported = app
                .state::<crate::android_source::AndroidSourceHost>()
                .export_image_entry(
                    &source_id,
                    &expected_revision,
                    &request_id,
                    &bytes,
                    &result.preview.png_bytes,
                )?;
            Ok(ImageExportReceipt {
                status: if exported { "exported" } else { "cancelled" },
                durability: exported
                    .then_some(glitchpad_core::source::DurabilityGuarantee::RecoverableNonAtomic),
            })
        }
        #[cfg(all(mobile, not(target_os = "android")))]
        {
            let _ = result;
            Err(safe(
                CoreErrorCategory::Unavailable,
                "Image export is unavailable",
                false,
            ))
        }
    })
    .await
    .map_err(|_| unavailable("Image export failed safely"))?
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)] // Tauri deserializes owned command arguments.
pub(crate) fn cancel_image_render(
    app: tauri::AppHandle,
    renders: tauri::State<'_, ImageRenderHost>,
    source_id: SourceId,
    request_id: String,
) -> Result<bool, CoreError> {
    let result = renders.cancel(&source_id, &request_id);
    #[cfg(target_os = "android")]
    app.state::<crate::android_source::AndroidSourceHost>()
        .cancel_image_export(&request_id);
    #[cfg(not(target_os = "android"))]
    let _ = app;
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn idle_decoder_and_icon_selection_eviction_reject_stale_owners() {
        let bytes = include_bytes!("../../../fixtures/images/original.gif");
        let file = crate::source::tests::TemporarySource::new(bytes);
        let sources = crate::source::DesktopSourceHost::new();
        let source = sources
            .acquire(crate::source::DesktopDelivery::dialog(file.path()))
            .unwrap();
        let host = ImageRenderHost::default();
        let current = uuid::Uuid::new_v4().to_string();
        let old = uuid::Uuid::new_v4().to_string();
        let context =
            AnimationContext::new(bytes, &ImageLimits::desktop(), &AtomicBool::new(false)).unwrap();
        *host.retained.lock().unwrap() = Some(RetainedAnimation {
            source: source.source_id.clone(),
            revision: source.external_revision.clone(),
            request: current.clone(),
            context,
            metadata: ImageMetadataReport::default(),
        });
        *host.selected_icon.lock().unwrap() = Some((
            SelectedIcon {
                source: source.source_id.clone(),
                revision: source.external_revision,
                entry: 0,
            },
            current.clone(),
        ));
        host.cancel(&source.source_id, &old).unwrap();
        host.cancel(&SourceId("other-source".into()), &current)
            .unwrap();
        assert!(host.retained.lock().unwrap().is_some());
        assert!(host.selected_icon.lock().unwrap().is_some());
        host.cancel(&source.source_id, &current).unwrap();
        assert!(host.retained.lock().unwrap().is_none());
        assert!(host.selected_icon.lock().unwrap().is_none());
    }

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
