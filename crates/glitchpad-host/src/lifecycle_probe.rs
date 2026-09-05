//! Content-free lifecycle acknowledgements for native package validation.

use std::ffi::OsString;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use glitchpad_core::contracts::{CoreError, CoreErrorCategory};

const PROBE_DIRECTORY_ENVIRONMENT: &str = "GLITCHPAD_LIFECYCLE_PROBE_DIR";
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

#[cfg(any(test, target_os = "macos"))]
fn guarded_probe_root(identifier: &str, architecture: &str) -> PathBuf {
    PathBuf::from("/tmp").join(format!("{identifier}-lifecycle-probes-{architecture}"))
}

#[cfg(any(test, target_os = "macos"))]
fn runtime_architecture() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        std::env::consts::ARCH
    }
}

/// Process-local lifecycle acknowledgement state for native package validation.
#[derive(Default)]
pub struct LifecycleProbeState {
    root: Option<PathBuf>,
}

impl LifecycleProbeState {
    fn configured(environment: Option<OsString>, guarded_root: Option<PathBuf>) -> Self {
        let root = environment
            .map(PathBuf::from)
            .or_else(|| guarded_root.filter(|candidate| probe_root_enabled(candidate)));
        Self { root }
    }

    /// Creates lifecycle state from an explicit environment or the guarded macOS validation root.
    #[must_use]
    pub fn for_application(identifier: &str) -> Self {
        #[cfg(target_os = "macos")]
        let guarded_root = Some(guarded_probe_root(identifier, runtime_architecture()));
        #[cfg(not(target_os = "macos"))]
        let guarded_root = {
            let _ = identifier;
            None
        };
        Self::configured(std::env::var_os(PROBE_DIRECTORY_ENVIRONMENT), guarded_root)
    }

    fn record(&self, event: &str, sequence: Option<u64>) -> Result<bool, CoreError> {
        marker_name(event, sequence)?;
        let Some(root) = self.root.as_deref() else {
            return Ok(false);
        };
        record_marker(root, event, sequence)
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
    fn resolves_the_explicit_environment_before_a_guarded_root() {
        let environment_root = PathBuf::from("/private/tmp/environment-probes");
        let state = LifecycleProbeState::configured(
            Some(environment_root.clone().into_os_string()),
            Some(PathBuf::from("/tmp/guarded-probes")),
        );
        assert_eq!(state.root, Some(environment_root));
    }

    #[test]
    fn guarded_root_requires_exact_opt_in_and_normalizes_apple_silicon() {
        let probe_root = temporary_root();
        fs::create_dir(&probe_root).expect("temporary probe root must be created");
        assert_eq!(
            guarded_probe_root("com.example.app", "arm64"),
            PathBuf::from("/tmp/com.example.app-lifecycle-probes-arm64")
        );
        #[cfg(target_arch = "aarch64")]
        assert_eq!(runtime_architecture(), "arm64");
        #[cfg(not(target_arch = "aarch64"))]
        assert_eq!(runtime_architecture(), std::env::consts::ARCH);
        assert!(
            LifecycleProbeState::configured(None, Some(probe_root.clone()))
                .root
                .is_none()
        );
        fs::write(probe_root.join("enabled.marker"), PROBE_ENABLE_MARKER)
            .expect("probe root must be explicitly enabled");
        assert_eq!(
            LifecycleProbeState::configured(None, Some(probe_root.clone())).root,
            Some(probe_root.clone())
        );

        fs::remove_dir_all(probe_root).expect("temporary probe root must be removed");
    }
}
