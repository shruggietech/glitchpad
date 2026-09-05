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

#[cfg(any(test, target_os = "macos"))]
fn guarded_probe_roots(identifier: &str, application_config_root: Option<PathBuf>) -> Vec<PathBuf> {
    let mut roots = vec![PathBuf::from("/tmp").join(format!("{identifier}-lifecycle-probes"))];
    if let Some(root) = application_config_root {
        roots.push(root.join("lifecycle-probes"));
    }
    roots.push(PathBuf::from("/Users/Shared").join(format!("{identifier}-lifecycle-probes")));
    roots
}

/// Process-local lifecycle acknowledgement state for native package validation.
#[derive(Default)]
pub struct LifecycleProbeState {
    root: Option<PathBuf>,
}

impl LifecycleProbeState {
    fn configured(
        environment: Option<OsString>,
        guarded_roots: impl IntoIterator<Item = PathBuf>,
    ) -> Self {
        let root = environment
            .map(PathBuf::from)
            .into_iter()
            .chain(guarded_roots)
            .find(|candidate| {
                probe_root_enabled(candidate)
                    && record_fixed_marker(candidate, "host-ready.marker").unwrap_or(false)
            });
        Self { root }
    }

    /// Creates lifecycle state from an explicit environment or the guarded macOS validation root.
    #[must_use]
    pub fn for_application(identifier: &str, application_config_root: Option<PathBuf>) -> Self {
        #[cfg(target_os = "macos")]
        let guarded_roots = guarded_probe_roots(identifier, application_config_root);
        #[cfg(not(target_os = "macos"))]
        let guarded_roots = {
            let _ = (identifier, application_config_root);
            Vec::new()
        };
        Self::configured(std::env::var_os(PROBE_DIRECTORY_ENVIRONMENT), guarded_roots)
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
        let environment_root = temporary_root();
        let guarded_root = temporary_root().with_extension("guarded");
        for root in [&environment_root, &guarded_root] {
            fs::create_dir(root).expect("temporary probe root must be created");
            fs::write(root.join("enabled.marker"), PROBE_ENABLE_MARKER)
                .expect("probe root must be explicitly enabled");
        }
        let state = LifecycleProbeState::configured(
            Some(environment_root.clone().into_os_string()),
            [guarded_root.clone()],
        );
        assert_eq!(state.root, Some(environment_root.clone()));
        assert!(environment_root.join("host-ready.marker").is_file());
        assert!(!guarded_root.join("host-ready.marker").exists());

        fs::remove_dir_all(environment_root).expect("environment root must be removed");
        fs::remove_dir_all(guarded_root).expect("guarded root must be removed");
    }

    #[test]
    fn guarded_roots_are_exact_and_require_opt_in() {
        let probe_root = temporary_root();
        fs::create_dir(&probe_root).expect("temporary probe root must be created");
        assert_eq!(
            guarded_probe_roots(
                "com.example.app",
                Some(PathBuf::from(
                    "/Users/runner/Library/Application Support/com.example.app"
                )),
            ),
            vec![
                PathBuf::from("/tmp/com.example.app-lifecycle-probes"),
                PathBuf::from(
                    "/Users/runner/Library/Application Support/com.example.app/lifecycle-probes",
                ),
                PathBuf::from("/Users/Shared/com.example.app-lifecycle-probes"),
            ]
        );
        assert!(
            LifecycleProbeState::configured(None, [probe_root.clone()])
                .root
                .is_none()
        );
        fs::write(probe_root.join("enabled.marker"), PROBE_ENABLE_MARKER)
            .expect("probe root must be explicitly enabled");
        assert_eq!(
            LifecycleProbeState::configured(None, [probe_root.clone()]).root,
            Some(probe_root.clone())
        );
        assert!(probe_root.join("host-ready.marker").is_file());

        fs::remove_dir_all(probe_root).expect("temporary probe root must be removed");
    }
}
