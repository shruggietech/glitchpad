//! Content-free lifecycle acknowledgements for native package validation.

use std::ffi::OsString;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
use tauri::Manager;

const PROBE_DIRECTORY_ENVIRONMENT: &str = "GLITCHPAD_LIFECYCLE_PROBE_DIR";
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

fn configured_probe_root(
    environment: Option<OsString>,
    application_config_root: Option<PathBuf>,
) -> Option<PathBuf> {
    environment
        .map(PathBuf::from)
        .or_else(|| application_config_root.map(|root| root.join(PROBE_DIRECTORY_NAME)))
}

/// Records a path-private, content-free lifecycle acknowledgement when native package validation opts in.
///
/// # Errors
///
/// Returns a path-free error when the event is invalid or the opted-in probe directory cannot commit the marker.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn record_desktop_lifecycle_probe(
    app: tauri::AppHandle,
    event: String,
    sequence: Option<u64>,
) -> Result<bool, CoreError> {
    let Some(root) = configured_probe_root(
        std::env::var_os(PROBE_DIRECTORY_ENVIRONMENT),
        app.path().app_config_dir().ok(),
    ) else {
        return Ok(false);
    };
    if !probe_root_enabled(&root) {
        return Ok(false);
    }
    record_marker(&root, &event, sequence)
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
    fn resolves_environment_before_the_guarded_application_config_root() {
        let application_config_root = PathBuf::from("/private/tmp/application-config");
        let environment_root = PathBuf::from("/private/tmp/environment-probes");

        assert_eq!(
            configured_probe_root(None, Some(application_config_root.clone())),
            Some(application_config_root.join(PROBE_DIRECTORY_NAME))
        );
        assert_eq!(
            configured_probe_root(
                Some(environment_root.clone().into_os_string()),
                Some(application_config_root),
            ),
            Some(environment_root)
        );
        assert_eq!(configured_probe_root(None, None), None);
    }
}
