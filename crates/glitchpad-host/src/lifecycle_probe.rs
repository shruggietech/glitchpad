//! Content-free lifecycle acknowledgements for native package validation.

use std::ffi::OsString;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::sync::Mutex;

use crate::desktop_delivery::{DesktopDeliveryResult, DesktopDeliveryStatus};
use crate::source::{DesktopDelivery, DesktopDeliveryKind, DesktopSourceHost};
use glitchpad_core::source::SourceId;
use std::path::{Path, PathBuf};

use glitchpad_core::contracts::{CoreError, CoreErrorCategory};

const PROBE_DIRECTORY_ENVIRONMENT: &str = "GLITCHPAD_LIFECYCLE_PROBE_DIR";
const PROBE_ENABLE_MARKER: &[u8] = b"enabled\n";
const MARKDOWN_FAILURE_REQUEST: &[u8] = b"requested\n";

fn probe_error(category: CoreErrorCategory, summary: &str) -> CoreError {
    CoreError::new(category, summary, false, true)
}

fn marker_name(event: &str, sequence: Option<u64>) -> Result<String, CoreError> {
    match (event, sequence) {
        ("document-workflow-read", None) => Ok("document-workflow-read.marker".into()),
        ("document-workflow-edit", None) => Ok("document-workflow-edit.marker".into()),
        ("document-workflow-save", None) => Ok("document-workflow-save.marker".into()),
        ("document-workflow-metadata", None) => Ok("document-workflow-metadata.marker".into()),
        ("document-workflow-recovery", None) => Ok("document-workflow-recovery.marker".into()),
        ("shell-ready", None) => Ok("shell-ready.marker".into()),
        ("document-workflow-ready", None) => Ok("document-workflow-ready.marker".into()),
        ("document-workflow-failed", None) => Ok("document-workflow-failed.marker".into()),
        ("delivery-ready", Some(sequence)) if sequence > 0 => {
            Ok(format!("delivery-{sequence}.marker"))
        }
        _ => Err(probe_error(
            CoreErrorCategory::InvalidInput,
            "The lifecycle acknowledgement was invalid",
        )),
    }
}

fn device_scale_marker(device_scale: f64) -> Result<&'static str, CoreError> {
    for (scale, marker) in [
        (1.0, "device-scale-100.marker"),
        (1.25, "device-scale-125.marker"),
        (1.5, "device-scale-150.marker"),
        (2.0, "device-scale-200.marker"),
    ] {
        if (device_scale - scale).abs() <= 0.01 {
            return Ok(marker);
        }
    }
    Err(probe_error(
        CoreErrorCategory::InvalidInput,
        "The lifecycle device scale was invalid",
    ))
}

fn probe_root_enabled(root: &Path) -> bool {
    fs::metadata(root).is_ok_and(|metadata| metadata.is_dir())
        && fs::read(root.join("enabled.marker")).ok().as_deref() == Some(PROBE_ENABLE_MARKER)
}

fn record_marker(root: &Path, event: &str, sequence: Option<u64>) -> Result<bool, CoreError> {
    if !probe_root_enabled(root) {
        return Err(probe_error(
            CoreErrorCategory::Unavailable,
            "Lifecycle acknowledgement storage is unavailable",
        ));
    }
    record_fixed_marker(root, &marker_name(event, sequence)?)
}

fn record_fixed_marker(root: &Path, name: &str) -> Result<bool, CoreError> {
    let path = root.join(name);
    match OpenOptions::new().write(true).create_new(true).open(path) {
        Ok(mut marker) => {
            marker.write_all(b"ready\n").map_err(|_| {
                probe_error(
                    CoreErrorCategory::Unavailable,
                    "The lifecycle acknowledgement could not be recorded",
                )
            })?;
            marker.sync_all().map_err(|_| {
                probe_error(
                    CoreErrorCategory::Unavailable,
                    "The lifecycle acknowledgement could not be committed",
                )
            })?;
            Ok(true)
        }
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => Ok(true),
        Err(_) => Err(probe_error(
            CoreErrorCategory::Unavailable,
            "The lifecycle acknowledgement could not be recorded",
        )),
    }
}

const PROBE_ARGUMENT_PREFIX: &str = "--glitchpad-lifecycle-probe=";

/// Process-local lifecycle acknowledgement state for native package validation.
#[derive(Default)]
pub struct LifecycleProbeState {
    root: Option<PathBuf>,
    workflow_source: Mutex<Option<SourceId>>,
}

impl LifecycleProbeState {
    fn configured(
        environment: Option<OsString>,
        arguments: impl IntoIterator<Item = OsString>,
    ) -> Self {
        let root = environment.map(PathBuf::from).or_else(|| {
            arguments.into_iter().find_map(|argument| {
                argument
                    .to_str()?
                    .strip_prefix(PROBE_ARGUMENT_PREFIX)
                    .filter(|value| !value.is_empty())
                    .map(PathBuf::from)
            })
        });
        Self {
            root,
            ..Self::default()
        }
    }

    /// Creates lifecycle state from the explicit validation environment or launch argument.
    #[must_use]
    pub fn from_environment_or_arguments() -> Self {
        Self::configured(
            std::env::var_os(PROBE_DIRECTORY_ENVIRONMENT),
            std::env::args_os(),
        )
    }

    fn record(&self, event: &str, sequence: Option<u64>) -> Result<bool, CoreError> {
        marker_name(event, sequence)?;
        let Some(root) = self.root.as_deref() else {
            return Ok(false);
        };
        record_marker(root, event, sequence)
    }

    fn record_device_scale(&self, device_scale: f64) -> Result<bool, CoreError> {
        let marker = device_scale_marker(device_scale)?;
        let Some(root) = self.root.as_deref() else {
            return Ok(false);
        };
        if !probe_root_enabled(root) {
            return Err(probe_error(
                CoreErrorCategory::Unavailable,
                "Lifecycle acknowledgement storage is unavailable",
            ));
        }
        record_fixed_marker(root, marker)
    }

    fn consume_markdown_failure(&self) -> Result<bool, CoreError> {
        let Some(root) = self.root.as_deref() else {
            return Ok(false);
        };
        if !probe_root_enabled(root) {
            return Err(probe_error(
                CoreErrorCategory::Unavailable,
                "Lifecycle acknowledgement storage is unavailable",
            ));
        }
        let request = root.join("markdown-failure-request.marker");
        match fs::read(&request) {
            Ok(value) if value == MARKDOWN_FAILURE_REQUEST => {
                fs::remove_file(request).map_err(|_| {
                    probe_error(
                        CoreErrorCategory::Unavailable,
                        "The lifecycle Markdown failure request could not be consumed",
                    )
                })?;
                record_fixed_marker(root, "markdown-failure-consumed.marker")?;
                Ok(true)
            }
            Ok(_) => Err(probe_error(
                CoreErrorCategory::InvalidInput,
                "The lifecycle Markdown failure request was invalid",
            )),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(_) => Err(probe_error(
                CoreErrorCategory::Unavailable,
                "The lifecycle Markdown failure request could not be read",
            )),
        }
    }
}

/// Records a path-private, content-free lifecycle acknowledgement when native package validation opts in.
///
/// # Errors
///
/// Returns a path-free error when the event is invalid or the opted-in probe directory cannot commit the marker.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn record_desktop_lifecycle_probe(
    state: tauri::State<'_, LifecycleProbeState>,
    event: String,
    sequence: Option<u64>,
) -> Result<bool, CoreError> {
    state.record(&event, sequence)
}

/// Records an allowlisted, content-free device-scale acknowledgement for Windows package validation.
///
/// # Errors
///
/// Returns a path-free error when the scale is outside the governed matrix or the opted-in probe directory cannot commit the marker.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn record_desktop_device_scale_probe(
    state: tauri::State<'_, LifecycleProbeState>,
    device_scale: f64,
) -> Result<bool, CoreError> {
    state.record_device_scale(device_scale)
}

/// Consumes one explicitly enabled, content-free Markdown failure request for packaged lifecycle validation.
///
/// # Errors
///
/// Returns a path-free error when the opt-in probe root or fixed request marker is invalid.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn consume_desktop_markdown_failure_probe(
    state: tauri::State<'_, LifecycleProbeState>,
) -> Result<bool, CoreError> {
    state.consume_markdown_failure()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_root() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock must follow the Unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("glitchpad-lifecycle-probe-{nonce}"))
    }

    #[test]
    fn records_only_fixed_content_free_marker_names() {
        let root = temporary_root();
        fs::create_dir(&root).expect("temporary probe root must be created");
        fs::write(root.join("enabled.marker"), PROBE_ENABLE_MARKER)
            .expect("probe root must be explicitly enabled");

        assert!(record_marker(&root, "shell-ready", None).expect("shell marker must record"));
        assert!(
            record_marker(&root, "delivery-ready", Some(7)).expect("delivery marker must record")
        );
        assert_eq!(
            fs::read(root.join("shell-ready.marker")).expect("shell marker must be readable"),
            b"ready\n"
        );
        assert_eq!(
            fs::read(root.join("delivery-7.marker")).expect("delivery marker must be readable"),
            b"ready\n"
        );
        assert!(record_marker(&root, "../../escape", Some(1)).is_err());
        assert!(record_marker(&root, "delivery-ready", None).is_err());

        let state = LifecycleProbeState {
            root: Some(root.clone()),
            ..LifecycleProbeState::default()
        };
        assert!(
            state
                .record_device_scale(1.25)
                .expect("governed device scale must record")
        );
        assert_eq!(
            fs::read(root.join("device-scale-125.marker"))
                .expect("device-scale marker must be readable"),
            b"ready\n"
        );
        assert!(state.record_device_scale(1.1).is_err());
        fs::write(
            root.join("markdown-failure-request.marker"),
            MARKDOWN_FAILURE_REQUEST,
        )
        .expect("Markdown failure request must be written");
        assert!(
            state
                .consume_markdown_failure()
                .expect("Markdown failure request must be consumed")
        );
        assert!(
            !state
                .consume_markdown_failure()
                .expect("consumed Markdown failure request must be one-shot")
        );
        assert_eq!(
            fs::read(root.join("markdown-failure-consumed.marker"))
                .expect("Markdown failure consumption marker must be readable"),
            b"ready\n"
        );

        fs::remove_dir_all(root).expect("temporary probe root must be removed");
    }

    #[test]
    fn resolves_environment_before_the_single_validation_argument() {
        let environment_root = temporary_root();
        let state = LifecycleProbeState::configured(
            Some(environment_root.clone().into_os_string()),
            [OsString::from(
                "--glitchpad-lifecycle-probe=/private/tmp/argument-probes",
            )],
        );
        assert_eq!(state.root, Some(environment_root));
        assert_eq!(
            LifecycleProbeState::configured(
                None,
                [OsString::from(
                    "--glitchpad-lifecycle-probe=/private/tmp/argument-probes",
                )],
            )
            .root,
            Some(PathBuf::from("/private/tmp/argument-probes"))
        );
        assert!(
            LifecycleProbeState::configured(
                None,
                [
                    OsString::from("--unrelated=value"),
                    OsString::from(PROBE_ARGUMENT_PREFIX),
                ],
            )
            .root
            .is_none()
        );
    }

    fn workflow_state() -> (
        PathBuf,
        LifecycleProbeState,
        crate::source::DesktopSourceHost,
    ) {
        let root = temporary_root();
        fs::create_dir(&root).unwrap();
        fs::create_dir(root.join("recovery")).unwrap();
        fs::write(root.join("enabled.marker"), PROBE_ENABLE_MARKER).unwrap();
        fs::write(
            root.join("document-workflow-request.marker"),
            b"requested\n",
        )
        .unwrap();
        fs::write(
            root.join("document-workflow.md"),
            workflow_contract().unwrap().initial_text,
        )
        .unwrap();
        let state = LifecycleProbeState {
            root: Some(root.clone()),
            ..LifecycleProbeState::default()
        };
        (root, state, crate::source::DesktopSourceHost::new())
    }

    #[test]
    fn document_workflow_requires_opt_in_isolated_recovery_and_observed_saved_bytes() {
        let disabled = LifecycleProbeState::default();
        let host = crate::source::DesktopSourceHost::new();
        assert!(
            disabled
                .begin_document_workflow(&host, None)
                .unwrap()
                .is_none()
        );
        let (root, state, host) = workflow_state();
        assert!(
            state
                .complete_document_workflow(&host, Some(&root))
                .is_err()
        );
        assert!(state.begin_document_workflow(&host, None).is_err());
        assert!(root.join("document-workflow-request.marker").exists());
        assert_eq!(
            state.document_workflow_root().unwrap(),
            Some(fs::canonicalize(&root).unwrap())
        );
        let source = state
            .begin_document_workflow(&host, Some(&root))
            .unwrap()
            .unwrap()
            .source
            .unwrap();
        assert!(
            state
                .begin_document_workflow(&host, Some(&root))
                .unwrap()
                .is_none()
        );
        assert!(
            state
                .complete_document_workflow(&host, Some(&root))
                .is_err()
        );
        host.close(&source.source_id).unwrap();
        assert!(
            state
                .complete_document_workflow(&host, Some(&root))
                .is_err()
        );
        fs::write(
            root.join("document-workflow.md"),
            workflow_contract().unwrap().saved_text,
        )
        .unwrap();
        fs::write(root.join("recovery/owned.json"), b"leftover").unwrap();
        assert!(
            state
                .complete_document_workflow(&host, Some(&root))
                .is_err()
        );
        fs::remove_file(root.join("recovery/owned.json")).unwrap();
        for check in ["read", "edit", "save", "metadata", "recovery"] {
            fs::write(
                root.join(format!("document-workflow-{check}.marker")),
                b"ready\n",
            )
            .unwrap();
        }
        assert!(
            state
                .complete_document_workflow(&host, Some(&root))
                .unwrap()
        );
        assert_eq!(
            fs::read(root.join("document-workflow-complete.marker")).unwrap(),
            b"ready\n"
        );
        assert!(
            state
                .complete_document_workflow(&host, Some(&root))
                .is_err()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn document_workflow_rejects_malformed_oversized_and_stale_inputs() {
        for (name, bytes) in [
            ("enabled.marker", b"wrong".as_slice()),
            ("document-workflow-request.marker", b"wrong".as_slice()),
            ("document-workflow-request.marker", &[0_u8; 256]),
            ("document-workflow.md", b"private user document".as_slice()),
            ("document-workflow-complete.marker", b"ready\n".as_slice()),
        ] {
            let (root, state, host) = workflow_state();
            fs::write(root.join(name), bytes).unwrap();
            assert!(state.begin_document_workflow(&host, Some(&root)).is_err());
            assert_eq!(host.resource_snapshot().unwrap().sources, 0);
            fs::remove_dir_all(root).unwrap();
        }
        let (root, state, host) = workflow_state();
        fs::remove_file(root.join("document-workflow-request.marker")).unwrap();
        assert!(
            state
                .begin_document_workflow(&host, Some(&root))
                .unwrap()
                .is_none()
        );
        fs::create_dir(root.join("document-workflow-request.marker")).unwrap();
        assert!(state.begin_document_workflow(&host, Some(&root)).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn document_workflow_refuses_symlink_substitution() {
        for name in [
            "enabled.marker",
            "document-workflow-request.marker",
            "document-workflow.md",
        ] {
            let (root, state, host) = workflow_state();
            let path = root.join(name);
            let target = root.join("unrelated");
            fs::rename(&path, &target).unwrap();
            std::os::unix::fs::symlink(&target, &path).unwrap();
            assert!(state.begin_document_workflow(&host, Some(&root)).is_err());
            fs::remove_dir_all(root).unwrap();
        }
    }
    #[test]
    fn document_workflow_consumes_once_under_concurrent_calls() {
        let (root, state, host) = workflow_state();
        let state = std::sync::Arc::new(state);
        let host = std::sync::Arc::new(host);
        let threads = (0..2)
            .map(|_| {
                let state = state.clone();
                let host = host.clone();
                let root = root.clone();
                std::thread::spawn(move || {
                    state.begin_document_workflow(&host, Some(&root)).unwrap()
                })
            })
            .collect::<Vec<_>>();
        let deliveries = threads
            .into_iter()
            .filter_map(|t| t.join().unwrap())
            .collect::<Vec<_>>();
        assert_eq!(deliveries.len(), 1);
        assert_eq!(host.resource_snapshot().unwrap().sources, 1);
        host.close(&deliveries[0].source.as_ref().unwrap().source_id)
            .unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn document_workflow_refuses_recovery_and_root_symlinks() {
        let (root, state, host) = workflow_state();
        let other = temporary_root();
        fs::create_dir(&other).unwrap();
        fs::remove_dir(root.join("recovery")).unwrap();
        std::os::unix::fs::symlink(&other, root.join("recovery")).unwrap();
        assert!(state.begin_document_workflow(&host, Some(&root)).is_err());
        fs::remove_file(root.join("recovery")).unwrap();
        fs::remove_dir(other).unwrap();
        let other = temporary_root();
        fs::rename(&root, &other).unwrap();
        std::os::unix::fs::symlink(&other, &root).unwrap();
        assert!(state.begin_document_workflow(&host, Some(&root)).is_err());
        fs::remove_file(root).unwrap();
        fs::remove_dir_all(other).unwrap();
    }
}

#[derive(serde::Deserialize)]
struct WorkflowContract {
    filename: String,
    initial_text: String,
    saved_text: String,
}

fn workflow_contract() -> Result<WorkflowContract, CoreError> {
    let contract: WorkflowContract = serde_json::from_str(include_str!(
        "../../../packaging/desktop/document-workflow-probe.json"
    ))
    .map_err(|_| workflow_error())?;
    if contract.filename != "document-workflow.md"
        || contract.initial_text.len() > 4096
        || contract.saved_text.len() > 4096
    {
        return Err(workflow_error());
    }
    Ok(contract)
}

fn workflow_error() -> CoreError {
    probe_error(
        CoreErrorCategory::InvalidInput,
        "Packaged document workflow evidence is invalid",
    )
}

fn regular_exact(path: &Path, expected: &[u8]) -> Result<(), CoreError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| workflow_error())?;
    if !metadata.is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() != expected.len() as u64
    {
        return Err(workflow_error());
    }
    let mut actual = Vec::with_capacity(expected.len() + 1);
    File::open(path)
        .map_err(|_| workflow_error())?
        .take(expected.len() as u64 + 1)
        .read_to_end(&mut actual)
        .map_err(|_| workflow_error())?;
    if actual != expected {
        return Err(workflow_error());
    }
    Ok(())
}

fn absent(path: &Path) -> Result<bool, CoreError> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(true),
        Ok(_) => Ok(false),
        Err(_) => Err(workflow_error()),
    }
}

fn checked_workflow_root(root: &Path) -> Result<PathBuf, CoreError> {
    let metadata = fs::symlink_metadata(root).map_err(|_| workflow_error())?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err(workflow_error());
    }
    regular_exact(&root.join("enabled.marker"), PROBE_ENABLE_MARKER)?;
    let root = fs::canonicalize(root).map_err(|_| workflow_error())?;
    let recovery = root.join("recovery");
    if !absent(&recovery)? {
        let metadata = fs::symlink_metadata(&recovery).map_err(|_| workflow_error())?;
        if !metadata.is_dir()
            || metadata.file_type().is_symlink()
            || fs::read_dir(&recovery)
                .map_err(|_| workflow_error())?
                .next()
                .is_some()
        {
            return Err(workflow_error());
        }
    }
    Ok(root)
}

impl LifecycleProbeState {
    /// Opts in only for the fixed local PDF journey fixture and explicit request marker.
    pub(crate) fn pdf_probe_root(&self) -> Result<Option<PathBuf>, CoreError> {
        let Some(root) = self.root.as_deref() else {
            return Ok(None);
        };
        if absent(&root.join("pdf-journey-request.marker"))? {
            return Ok(None);
        }
        regular_exact(&root.join("enabled.marker"), PROBE_ENABLE_MARKER)?;
        regular_exact(&root.join("pdf-journey-request.marker"), b"requested\n")?;
        let metadata = fs::symlink_metadata(root).map_err(|_| workflow_error())?;
        let fixture = fs::symlink_metadata(root.join("s049-compatibility.pdf"))
            .map_err(|_| workflow_error())?;
        if !metadata.is_dir()
            || metadata.file_type().is_symlink()
            || !fixture.is_file()
            || fixture.file_type().is_symlink()
            || fixture.len() > 2 * 1024 * 1024
        {
            return Err(workflow_error());
        }
        Ok(Some(fs::canonicalize(root).map_err(|_| workflow_error())?))
    }
    /// Selects isolated recovery storage only for a fully prepared, native-owned proof request.
    pub(crate) fn document_workflow_root(&self) -> Result<Option<PathBuf>, CoreError> {
        let Some(root) = self.root.as_deref() else {
            return Ok(None);
        };
        if absent(&root.join("document-workflow-request.marker"))? {
            return Ok(None);
        }
        let root = checked_workflow_root(root)?;
        regular_exact(
            &root.join("document-workflow-request.marker"),
            b"requested\n",
        )?;
        regular_exact(
            &root.join("document-workflow.md"),
            workflow_contract()?.initial_text.as_bytes(),
        )?;
        for name in [
            "document-workflow-complete.marker",
            "document-workflow-ready.marker",
            "document-workflow-failed.marker",
            "document-workflow-read.marker",
            "document-workflow-edit.marker",
            "document-workflow-save.marker",
            "document-workflow-metadata.marker",
            "document-workflow-recovery.marker",
        ] {
            if !absent(&root.join(name))? {
                return Err(workflow_error());
            }
        }
        Ok(Some(root))
    }

    fn begin_document_workflow(
        &self,
        host: &DesktopSourceHost,
        recovery_root: Option<&Path>,
    ) -> Result<Option<DesktopDeliveryResult>, CoreError> {
        let mut active = self.workflow_source.lock().map_err(|_| workflow_error())?;
        if active.is_some() {
            return Ok(None);
        }
        let Some(root) = self.document_workflow_root()? else {
            return Ok(None);
        };
        if recovery_root
            .and_then(|p| fs::canonicalize(p).ok())
            .as_ref()
            != Some(&root)
        {
            return Err(workflow_error());
        }
        fs::remove_file(root.join("document-workflow-request.marker"))
            .map_err(|_| workflow_error())?;
        let source = host.acquire(DesktopDelivery::command_line(
            root.join("document-workflow.md"),
        ))?;
        *active = Some(source.source_id.clone());
        Ok(Some(DesktopDeliveryResult {
            sequence: 1,
            kind: DesktopDeliveryKind::CommandLine,
            status: DesktopDeliveryStatus::Opened,
            source: Some(source),
            error: None,
        }))
    }

    fn complete_document_workflow(
        &self,
        host: &DesktopSourceHost,
        recovery_root: Option<&Path>,
    ) -> Result<bool, CoreError> {
        let mut active = self.workflow_source.lock().map_err(|_| workflow_error())?;
        let source_id = active.as_ref().ok_or_else(workflow_error)?;
        let root = checked_workflow_root(self.root.as_deref().ok_or_else(workflow_error)?)?;
        if recovery_root
            .and_then(|p| fs::canonicalize(p).ok())
            .as_ref()
            != Some(&root)
            || host.contains_source(source_id)?
        {
            return Err(workflow_error());
        }
        regular_exact(
            &root.join("document-workflow.md"),
            workflow_contract()?.saved_text.as_bytes(),
        )?;
        for check in ["read", "edit", "save", "metadata", "recovery"] {
            regular_exact(
                &root.join(format!("document-workflow-{check}.marker")),
                b"ready\n",
            )?;
        }
        let mut marker = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(root.join("document-workflow-complete.marker"))
            .map_err(|_| workflow_error())?;
        marker.write_all(b"ready\n").map_err(|_| workflow_error())?;
        marker.sync_all().map_err(|_| workflow_error())?;
        *active = None;
        Ok(true)
    }
}

/// Begins one opt-in packaged workflow on a fixed synthetic source, with isolated recovery storage.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn begin_desktop_document_workflow_probe(
    state: tauri::State<'_, LifecycleProbeState>,
    host: tauri::State<'_, DesktopSourceHost>,
    recovery: tauri::State<'_, crate::RecoveryHostState>,
) -> Result<Option<DesktopDeliveryResult>, CoreError> {
    state.begin_document_workflow(&host, recovery.probe_root.as_deref())
}

/// Records a fresh completion only after the fixed saved bytes, recovery cleanup and source closure are observed.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn complete_desktop_document_workflow_probe(
    state: tauri::State<'_, LifecycleProbeState>,
    host: tauri::State<'_, DesktopSourceHost>,
    recovery: tauri::State<'_, crate::RecoveryHostState>,
) -> Result<bool, CoreError> {
    state.complete_document_workflow(&host, recovery.probe_root.as_deref())
}

/// Captures the opted-in native process baseline before creating its `WebView`.
pub(crate) fn begin_desktop_pdf_memory(state: &LifecycleProbeState) -> Result<(), CoreError> {
    use std::io::Write;
    let root = state.pdf_probe_root()?.ok_or_else(workflow_error)?;
    let bytes = crate::performance::current_working_set_bytes().map_err(|_| workflow_error())?;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(root.join("pdf-memory-before.json"))
        .map_err(|_| workflow_error())?;
    file.write_all(bytes.to_string().as_bytes())
        .map_err(|_| workflow_error())
}

/// Samples only the named native process for an explicitly enabled PDF probe.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn sample_desktop_pdf_memory(
    state: tauri::State<'_, LifecycleProbeState>,
) -> Result<u64, CoreError> {
    state.pdf_probe_root()?.ok_or_else(workflow_error)?;
    crate::performance::current_working_set_bytes().map_err(|_| workflow_error())
}

/// Records the fixed opt-in PDF journey and independently re-reads its native source bytes.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn record_desktop_pdf_probe(
    state: tauri::State<'_, LifecycleProbeState>,
    host: tauri::State<'_, DesktopSourceHost>,
    owner: String,
    proof: serde_json::Value,
) -> Result<(), CoreError> {
    use sha2::{Digest, Sha256};
    let root = state.pdf_probe_root()?.ok_or_else(workflow_error)?;
    if serde_json::to_vec(&proof)
        .map_err(|_| workflow_error())?
        .len()
        > 32_768
    {
        return Err(workflow_error());
    }
    let path = root.join("pdf-journey-result.json");
    let mut output = serde_json::json!({"schema_version":1,"source_commit":option_env!("GLITCHPAD_BUILD_COMMIT"),"platform":std::env::consts::OS,"architecture":std::env::consts::ARCH,"evidence_class":"actual_built_webview","journey":proof});
    if proof.get("error").is_none() {
        let before: u64 = serde_json::from_slice(
            &fs::read(root.join("pdf-memory-before.json")).map_err(|_| workflow_error())?,
        )
        .map_err(|_| workflow_error())?;
        let rows = proof
            .get("memory_samples")
            .and_then(serde_json::Value::as_array)
            .ok_or_else(workflow_error)?;
        if rows.is_empty()
            || rows.len() > crate::performance::MAX_MEMORY_SAMPLES.saturating_sub(2)
            || rows
                .iter()
                .any(|row| row.as_u64().is_none_or(|value| value == 0))
        {
            return Err(workflow_error());
        }
        let after =
            crate::performance::current_working_set_bytes().map_err(|_| workflow_error())?;
        let mut samples = vec![serde_json::json!(before)];
        samples.extend(rows.iter().cloned());
        samples.push(serde_json::json!(after));
        let executable = std::env::current_exe().map_err(|_| workflow_error())?;
        let name = executable
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(workflow_error)?;
        output["native_memory"] = serde_json::json!({"method":"sysinfo_named_process_rss_before_1000ms_peak_after","scope":"Named application process only; excludes separate WebView processes and worker heap attribution","process_name":name,"pid":std::process::id(),"samples_bytes":samples,"before_bytes":before,"after_bytes":after,"interval_ms":1000});

        let source = SourceId(
            owner
                .strip_prefix("desktop-")
                .ok_or_else(workflow_error)?
                .to_owned(),
        );
        let expected =
            fs::read(root.join("s049-compatibility.pdf")).map_err(|_| workflow_error())?;
        let length = host
            .query_metadata(&source)?
            .byte_length
            .ok_or_else(workflow_error)?;
        if length != expected.len() as u64 {
            return Err(workflow_error());
        }
        let mut actual = Sha256::new();
        let mut offset = 0;
        while offset < length {
            let size = (length - offset).min(262_144);
            let chunk = host.read_range(&source, offset, size, 262_144)?;
            if chunk.bytes.len() as u64 != size {
                return Err(workflow_error());
            }
            actual.update(&chunk.bytes);
            offset += size;
        }
        let expected_hash = format!("{:x}", Sha256::digest(&expected));
        let actual_hash = format!("{:x}", actual.finalize());
        if expected_hash != actual_hash {
            return Err(workflow_error());
        }
        output["source_sha256"] = serde_json::json!(actual_hash);
        output["source_unchanged"] = serde_json::json!(true);
    }
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|_| workflow_error())?;
    file.write_all(&serde_json::to_vec_pretty(&output).map_err(|_| workflow_error())?)
        .map_err(|_| workflow_error())?;
    file.sync_all().map_err(|_| workflow_error())?;
    Ok(())
}

/// Requests actual running-instance delivery of the fixed second PDF fixture.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn request_desktop_pdf_probe_switch(state: tauri::State<'_, LifecycleProbeState>) -> Result<(), CoreError> {
    let root = state.pdf_probe_root()?.ok_or_else(workflow_error)?;
    let mut file=OpenOptions::new().write(true).create_new(true).open(root.join("pdf-switch-request.marker")).map_err(|_|workflow_error())?;
    file.write_all(b"requested\n").map_err(|_|workflow_error())?;
    file.sync_all().map_err(|_|workflow_error())
}
