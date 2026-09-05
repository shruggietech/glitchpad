//! Content-free lifecycle acknowledgements for native package validation.

use std::ffi::OsString;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
#[cfg(target_os = "macos")]
use tauri::Manager;

const PROBE_DIRECTORY_ENVIRONMENT: &str = "GLITCHPAD_LIFECYCLE_PROBE_DIR";
#[cfg(any(test, target_os = "macos"))]
const PROBE_DIRECTORY_NAME: &str = "lifecycle-probes";
const PROBE_ENABLE_MARKER: &[u8] = b"enabled\n";

fn probe_error(category: CoreErrorCategory, summary: &str) -> CoreError {
    CoreError::new(category, summary, false, true)
}

fn marker_name(event: &str, sequence: Option<u64>) -> Result<String, CoreError> {
    match (event, sequence) {
        ("shell-ready", None) => Ok("shell-ready.marker".into()),
        ("delivery-ready", Some(sequence)) if sequence > 0 => {
            Ok(format!("delivery-{sequence}.marker"))
        }
        _ => Err(probe_error(
            CoreErrorCategory::InvalidInput,
            "The lifecycle acknowledgement was invalid",
        )),
    }
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
    let path = root.join(marker_name(event, sequence)?);
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

#[derive(Default)]
struct ProbeConfiguration {
    root: Option<PathBuf>,
    shell_ready_pending: bool,
}

/// Process-local lifecycle acknowledgement state for native package validation.
#[derive(Default)]
pub struct LifecycleProbeState {
    configuration: Mutex<ProbeConfiguration>,
}

impl LifecycleProbeState {
    fn with_environment(environment: Option<OsString>) -> Self {
        Self {
            configuration: Mutex::new(ProbeConfiguration {
                root: environment.map(PathBuf::from),
                shell_ready_pending: false,
            }),
        }
    }

    /// Creates lifecycle state from the explicitly inherited validation environment, when present.
    #[must_use]
    pub fn from_environment() -> Self {
        Self::with_environment(std::env::var_os(PROBE_DIRECTORY_ENVIRONMENT))
    }

    fn record(&self, event: &str, sequence: Option<u64>) -> Result<bool, CoreError> {
        marker_name(event, sequence)?;
        let root = {
            let mut configuration = self.configuration.lock().map_err(|_| {
                probe_error(
                    CoreErrorCategory::Unavailable,
                    "Lifecycle acknowledgement state is unavailable",
                )
            })?;
            let Some(root) = configuration.root.clone() else {
                if event == "shell-ready" {
                    configuration.shell_ready_pending = true;
                }
                return Ok(false);
            };
            root
        };
        record_marker(&root, event, sequence)
    }

    #[cfg(any(test, target_os = "macos"))]
    fn configure_from_document(&self, document: &Path) -> Result<bool, CoreError> {
        let Some(parent) = document.parent() else {
            return Ok(false);
        };
        let root = parent.join(PROBE_DIRECTORY_NAME);
        if !probe_root_enabled(&root) {
            return Ok(false);
        }
        let shell_ready_pending = {
            let mut configuration = self.configuration.lock().map_err(|_| {
                probe_error(
                    CoreErrorCategory::Unavailable,
                    "Lifecycle acknowledgement state is unavailable",
                )
            })?;
            configuration.root = Some(root.clone());
            std::mem::take(&mut configuration.shell_ready_pending)
        };
        if shell_ready_pending {
            record_marker(&root, "shell-ready", None)?;
        }
        Ok(true)
    }
}

/// Enables the guarded lifecycle probe associated with a native macOS document-open event.
#[cfg(target_os = "macos")]
pub(crate) fn configure_from_opened_urls(app: &tauri::AppHandle, urls: &[tauri::Url]) {
    let state = app.state::<LifecycleProbeState>();
    for url in urls {
        let Ok(document) = url.to_file_path() else {
            continue;
        };
        if state.configure_from_document(&document).unwrap_or(false) {
            break;
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

        fs::remove_dir_all(root).expect("temporary probe root must be removed");
    }

    #[test]
    fn resolves_the_explicit_validation_environment() {
        let environment_root = PathBuf::from("/private/tmp/environment-probes");
        let state =
            LifecycleProbeState::with_environment(Some(environment_root.clone().into_os_string()));
        assert_eq!(
            state
                .configuration
                .lock()
                .expect("probe configuration must be readable")
                .root,
            Some(environment_root)
        );
    }

    #[test]
    fn document_delivery_activates_guarded_probe_and_flushes_early_shell_readiness() {
        let root = temporary_root();
        let probe_root = root.join(PROBE_DIRECTORY_NAME);
        fs::create_dir_all(&probe_root).expect("temporary probe root must be created");
        fs::write(probe_root.join("enabled.marker"), PROBE_ENABLE_MARKER)
            .expect("probe root must be explicitly enabled");
        let state = LifecycleProbeState::default();

        assert!(
            !state
                .record("shell-ready", None)
                .expect("early shell readiness must be buffered")
        );
        assert!(
            state
                .configure_from_document(&root.join("document.md"))
                .expect("document must activate its sibling probe")
        );
        assert_eq!(
            fs::read(probe_root.join("shell-ready.marker"))
                .expect("buffered shell readiness must be flushed"),
            b"ready\n"
        );
        assert!(
            state
                .record("delivery-ready", Some(9))
                .expect("delivery readiness must record")
        );

        fs::remove_dir_all(root).expect("temporary probe root must be removed");
    }
}
