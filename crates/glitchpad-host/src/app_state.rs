//! Application-private, category-isolated state persistence.

use std::{
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};

use atomic_write_file::AtomicWriteFile;
use glitchpad_core::{
    contracts::{CoreError, CoreErrorCategory},
    persistence::{
        APPLICATION_STATE_SCHEMA_VERSION, AppStateCategory, DiagnosticBundle,
        DiagnosticEnvironment, DiagnosticEvent, DiagnosticLedger, MAX_DIAGNOSTIC_BYTES,
        MAX_PREFERENCE_BYTES, MAX_SESSION_STATE_BYTES, PreferenceState, SessionState, StateLoad,
        StateLoadStatus,
    },
};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::Value;

const PREFERENCES_FILE: &str = "preferences.json";
const SESSION_FILE: &str = "session.json";
const DIAGNOSTICS_FILE: &str = "diagnostics.json";

pub struct ApplicationStateStore {
    root: PathBuf,
    lock: Mutex<()>,
}

impl ApplicationStateStore {
    /// Opens a state root owned by the application.
    ///
    /// # Errors
    ///
    /// Returns a safe unavailable error when the root cannot be prepared.
    pub fn open(root: impl Into<PathBuf>) -> Result<Self, CoreError> {
        let root = root.into();
        prepare_root(&root)?;
        Ok(Self {
            root,
            lock: Mutex::new(()),
        })
    }

    /// Loads preferences, defaulting optional invalid fields independently.
    ///
    /// # Errors
    ///
    /// Returns only when the store lock or root itself is unavailable.
    pub fn load_preferences(&self) -> Result<StateLoad<PreferenceState>, CoreError> {
        let _guard = self.guard()?;
        Ok(self.load_preferences_locked())
    }

    /// Atomically commits validated preferences.
    ///
    /// # Errors
    ///
    /// Rejects invalid input, future-schema overwrite, and storage failures.
    pub fn persist_preferences(&self, state: &PreferenceState) -> Result<(), CoreError> {
        let _guard = self.guard()?;
        if !state.is_valid() {
            return Err(safe_error(
                CoreErrorCategory::InvalidInput,
                "preferences_invalid",
                false,
            ));
        }
        let path = self.root.join(PREFERENCES_FILE);
        refuse_future_overwrite(&path, MAX_PREFERENCE_BYTES)?;
        atomic_json(&self.root, &path, state, MAX_PREFERENCE_BYTES)
    }

    /// Loads a bounded session projection containing no document payload.
    ///
    /// # Errors
    ///
    /// Returns only when the store lock or root itself is unavailable.
    pub fn load_session(&self) -> Result<StateLoad<SessionState>, CoreError> {
        let _guard = self.guard()?;
        let loaded = self.load_current::<SessionState>(
            SESSION_FILE,
            MAX_SESSION_STATE_BYTES,
            SessionState::default(),
        );
        Ok(StateLoad {
            status: loaded.status,
            value: loaded.value.normalized(),
            warning_code: loaded.warning_code,
        })
    }

    /// Atomically commits a normalized session projection.
    ///
    /// # Errors
    ///
    /// Rejects future-schema overwrite and storage failures.
    pub fn persist_session(&self, state: SessionState) -> Result<(), CoreError> {
        let _guard = self.guard()?;
        let state = state.normalized();
        let path = self.root.join(SESSION_FILE);
        refuse_future_overwrite(&path, MAX_SESSION_STATE_BYTES)?;
        atomic_json(&self.root, &path, &state, MAX_SESSION_STATE_BYTES)
    }

    /// Appends one typed event and reapplies deterministic retention.
    ///
    /// # Errors
    ///
    /// Rejects invalid events, future-schema overwrite, and storage failures.
    pub fn append_diagnostic(
        &self,
        event: DiagnosticEvent,
        now_unix_ms: u64,
    ) -> Result<(), CoreError> {
        let _guard = self.guard()?;
        if !event.is_valid() {
            return Err(safe_error(
                CoreErrorCategory::InvalidInput,
                "diagnostic_invalid",
                false,
            ));
        }
        let path = self.root.join(DIAGNOSTICS_FILE);
        refuse_future_overwrite(&path, MAX_DIAGNOSTIC_BYTES)?;
        let mut ledger = self
            .load_current::<DiagnosticLedger>(
                DIAGNOSTICS_FILE,
                MAX_DIAGNOSTIC_BYTES,
                DiagnosticLedger::default(),
            )
            .value;
        ledger.events.push(event);
        atomic_json(
            &self.root,
            &path,
            &ledger.retained(now_unix_ms),
            MAX_DIAGNOSTIC_BYTES,
        )
    }

    /// Produces the exact bounded, redacted diagnostic payload safe for preview and export.
    ///
    /// # Errors
    ///
    /// Returns only when the store lock or root itself is unavailable.
    pub fn preview_diagnostics(
        &self,
        environment: DiagnosticEnvironment,
        now_unix_ms: u64,
    ) -> Result<StateLoad<DiagnosticBundle>, CoreError> {
        let _guard = self.guard()?;
        if !environment.is_valid() {
            return Err(safe_error(
                CoreErrorCategory::InvalidInput,
                "diagnostic_environment_invalid",
                false,
            ));
        }
        let loaded = self.load_current::<DiagnosticLedger>(
            DIAGNOSTICS_FILE,
            MAX_DIAGNOSTIC_BYTES,
            DiagnosticLedger::default(),
        );
        Ok(StateLoad {
            status: loaded.status,
            warning_code: loaded.warning_code,
            value: DiagnosticBundle {
                schema_version: APPLICATION_STATE_SCHEMA_VERSION,
                generated_unix_ms: now_unix_ms,
                environment,
                events: loaded.value.retained(now_unix_ms).events,
            },
        })
    }

    /// Removes exactly one application-state category.
    ///
    /// # Errors
    ///
    /// Returns a safe storage error and never broadens the deletion target.
    pub fn reset(&self, category: AppStateCategory) -> Result<bool, CoreError> {
        let _guard = self.guard()?;
        let path = self.root.join(match category {
            AppStateCategory::Preferences => PREFERENCES_FILE,
            AppStateCategory::Session => SESSION_FILE,
            AppStateCategory::Diagnostics => DIAGNOSTICS_FILE,
        });
        match fs::symlink_metadata(&path) {
            Ok(metadata)
                if metadata.file_type().is_file() && !metadata.file_type().is_symlink() =>
            {
                fs::remove_file(path).map_err(|_| storage_error("state_reset_failed"))?;
                sync_root(&self.root)?;
                Ok(true)
            }
            Ok(_) => Err(storage_error("state_reset_target_invalid")),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(_) => Err(storage_error("state_reset_inspect_failed")),
        }
    }

    fn guard(&self) -> Result<std::sync::MutexGuard<'_, ()>, CoreError> {
        self.lock.lock().map_err(|_| {
            safe_error(
                CoreErrorCategory::Unavailable,
                "state_lock_unavailable",
                true,
            )
        })
    }

    fn load_preferences_locked(&self) -> StateLoad<PreferenceState> {
        let path = self.root.join(PREFERENCES_FILE);
        let bytes = match read_bounded(&path, MAX_PREFERENCE_BYTES) {
            Ok(Some(bytes)) => bytes,
            Ok(None) => return defaulted(PreferenceState::default()),
            Err(ReadFailure::Oversized) => {
                return fallback(
                    StateLoadStatus::Corrupt,
                    PreferenceState::default(),
                    "preferences_oversized",
                );
            }
            Err(ReadFailure::Unavailable) => {
                return fallback(
                    StateLoadStatus::Unavailable,
                    PreferenceState::default(),
                    "preferences_unavailable",
                );
            }
        };
        let value: Value = match serde_json::from_slice(&bytes) {
            Ok(value) => value,
            Err(_) => {
                return fallback(
                    StateLoadStatus::Corrupt,
                    PreferenceState::default(),
                    "preferences_corrupt",
                );
            }
        };
        let Some(version) = value.get("schema_version").and_then(Value::as_u64) else {
            return fallback(
                StateLoadStatus::Corrupt,
                PreferenceState::default(),
                "preferences_schema_missing",
            );
        };
        if version > u64::from(APPLICATION_STATE_SCHEMA_VERSION) {
            return fallback(
                StateLoadStatus::Unsupported,
                PreferenceState::default(),
                "preferences_schema_future",
            );
        }
        let preferences = PreferenceState::from_untrusted_value(&value);
        let valid_current = version == u64::from(APPLICATION_STATE_SCHEMA_VERSION)
            && serde_json::from_value::<PreferenceState>(value)
                .is_ok_and(|candidate| candidate.is_valid());
        StateLoad {
            status: if version < u64::from(APPLICATION_STATE_SCHEMA_VERSION) {
                StateLoadStatus::Migrated
            } else {
                StateLoadStatus::Loaded
            },
            value: preferences,
            warning_code: (!valid_current
                && version == u64::from(APPLICATION_STATE_SCHEMA_VERSION))
            .then(|| "preferences_fields_defaulted".into()),
        }
    }

    fn load_current<T: DeserializeOwned>(
        &self,
        filename: &str,
        maximum_bytes: usize,
        defaults: T,
    ) -> StateLoad<T> {
        let path = self.root.join(filename);
        let bytes = match read_bounded(&path, maximum_bytes) {
            Ok(Some(bytes)) => bytes,
            Ok(None) => return defaulted(defaults),
            Err(ReadFailure::Oversized) => {
                return fallback(StateLoadStatus::Corrupt, defaults, "state_oversized");
            }
            Err(ReadFailure::Unavailable) => {
                return fallback(StateLoadStatus::Unavailable, defaults, "state_unavailable");
            }
        };
        let value: Value = match serde_json::from_slice(&bytes) {
            Ok(value) => value,
            Err(_) => return fallback(StateLoadStatus::Corrupt, defaults, "state_corrupt"),
        };
        let Some(version) = value.get("schema_version").and_then(Value::as_u64) else {
            return fallback(StateLoadStatus::Corrupt, defaults, "state_schema_missing");
        };
        if version > u64::from(APPLICATION_STATE_SCHEMA_VERSION) {
            return fallback(
                StateLoadStatus::Unsupported,
                defaults,
                "state_schema_future",
            );
        }
        match serde_json::from_value(value) {
            Ok(value) => StateLoad {
                status: if version < u64::from(APPLICATION_STATE_SCHEMA_VERSION) {
                    StateLoadStatus::Migrated
                } else {
                    StateLoadStatus::Loaded
                },
                value,
                warning_code: None,
            },
            Err(_) => fallback(StateLoadStatus::Corrupt, defaults, "state_invalid"),
        }
    }
}

fn defaulted<T>(value: T) -> StateLoad<T> {
    StateLoad {
        status: StateLoadStatus::Defaulted,
        value,
        warning_code: None,
    }
}

fn fallback<T>(status: StateLoadStatus, value: T, code: &str) -> StateLoad<T> {
    StateLoad {
        status,
        value,
        warning_code: Some(code.into()),
    }
}

enum ReadFailure {
    Oversized,
    Unavailable,
}

fn read_bounded(path: &Path, maximum_bytes: usize) -> Result<Option<Vec<u8>>, ReadFailure> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_file() && !metadata.file_type().is_symlink() => {
            metadata
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Ok(_) | Err(_) => return Err(ReadFailure::Unavailable),
    };
    if metadata.len() > u64::try_from(maximum_bytes).unwrap_or(u64::MAX) {
        return Err(ReadFailure::Oversized);
    }
    let mut bytes = Vec::with_capacity(usize::try_from(metadata.len()).unwrap_or(maximum_bytes));
    File::open(path)
        .and_then(|file| {
            file.take(u64::try_from(maximum_bytes + 1).unwrap_or(u64::MAX))
                .read_to_end(&mut bytes)
        })
        .map_err(|_| ReadFailure::Unavailable)?;
    (bytes.len() <= maximum_bytes)
        .then_some(Some(bytes))
        .ok_or(ReadFailure::Oversized)
}

fn refuse_future_overwrite(path: &Path, maximum_bytes: usize) -> Result<(), CoreError> {
    let Some(bytes) = read_bounded(path, maximum_bytes).map_err(|failure| match failure {
        ReadFailure::Oversized => storage_error("state_existing_oversized"),
        ReadFailure::Unavailable => storage_error("state_existing_unavailable"),
    })?
    else {
        return Ok(());
    };
    let value: Value =
        serde_json::from_slice(&bytes).map_err(|_| storage_error("state_existing_corrupt"))?;
    if value
        .get("schema_version")
        .and_then(Value::as_u64)
        .is_some_and(|version| version > u64::from(APPLICATION_STATE_SCHEMA_VERSION))
    {
        return Err(safe_error(
            CoreErrorCategory::UnsupportedInput,
            "state_schema_future",
            false,
        ));
    }
    Ok(())
}

fn atomic_json<T: Serialize>(
    root: &Path,
    destination: &Path,
    value: &T,
    maximum_bytes: usize,
) -> Result<(), CoreError> {
    let encoded = serde_json::to_vec(value).map_err(|_| {
        safe_error(
            CoreErrorCategory::InvalidInput,
            "state_serialize_failed",
            false,
        )
    })?;
    if encoded.len() > maximum_bytes {
        return Err(safe_error(
            CoreErrorCategory::ResourceLimit,
            "state_serialized_oversized",
            false,
        ));
    }
    let mut pending = AtomicWriteFile::options()
        .open(destination)
        .map_err(|_| storage_error("state_open_temporary_failed"))?;
    restrict_file_permissions(&mut pending)?;
    pending
        .write_all(&encoded)
        .map_err(|_| storage_error("state_write_failed"))?;
    pending
        .flush()
        .map_err(|_| storage_error("state_flush_failed"))?;
    pending
        .sync_all()
        .map_err(|_| storage_error("state_sync_failed"))?;
    pending
        .commit()
        .map_err(|_| storage_error("state_commit_failed"))?;
    sync_root(root)
}

fn prepare_root(root: &Path) -> Result<(), CoreError> {
    match fs::symlink_metadata(root) {
        Ok(metadata) if metadata.file_type().is_dir() && !metadata.file_type().is_symlink() => {}
        Ok(_) => return Err(storage_error("state_root_invalid")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir_all(root).map_err(|_| storage_error("state_root_create_failed"))?;
        }
        Err(_) => return Err(storage_error("state_root_inspect_failed")),
    }
    restrict_directory_permissions(root)
}

fn safe_error(category: CoreErrorCategory, code: &'static str, retryable: bool) -> CoreError {
    CoreError::new(
        category,
        "Application state is unavailable",
        retryable,
        true,
    )
    .with_context("code", code)
}

fn storage_error(code: &'static str) -> CoreError {
    safe_error(CoreErrorCategory::Unavailable, code, true)
}

#[cfg(unix)]
fn restrict_directory_permissions(root: &Path) -> Result<(), CoreError> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(root, fs::Permissions::from_mode(0o700))
        .map_err(|_| storage_error("state_directory_permissions"))
}

#[cfg(not(unix))]
#[allow(clippy::unnecessary_wraps)]
fn restrict_directory_permissions(_root: &Path) -> Result<(), CoreError> {
    Ok(())
}

#[cfg(unix)]
fn restrict_file_permissions(file: &mut AtomicWriteFile) -> Result<(), CoreError> {
    use std::os::unix::fs::PermissionsExt;
    file.set_permissions(fs::Permissions::from_mode(0o600))
        .map_err(|_| storage_error("state_file_permissions"))
}

#[cfg(not(unix))]
#[allow(clippy::unnecessary_wraps)]
fn restrict_file_permissions(_file: &mut AtomicWriteFile) -> Result<(), CoreError> {
    Ok(())
}

#[cfg(unix)]
fn sync_root(root: &Path) -> Result<(), CoreError> {
    File::open(root)
        .and_then(|directory| directory.sync_all())
        .map_err(|_| storage_error("state_sync_directory_failed"))
}

#[cfg(not(unix))]
#[allow(clippy::unnecessary_wraps)]
fn sync_root(_root: &Path) -> Result<(), CoreError> {
    Ok(())
}
