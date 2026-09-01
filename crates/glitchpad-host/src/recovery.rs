//! Private, bounded persistence for portable recovery records.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use atomic_write_file::AtomicWriteFile;
use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
use glitchpad_core::recovery::{
    MAX_RECOVERY_CONTENT_BYTES, RECOVERY_SCHEMA_VERSION, RecoveryInventoryEntry,
    RecoveryInventoryStatus, RecoveryRecord, RecoveryValidationError,
};
use serde_json::Value;
use uuid::Uuid;

/// Maximum serialized envelope size accepted before any record allocation.
pub const MAX_RECOVERY_RECORD_BYTES: u64 = MAX_RECOVERY_CONTENT_BYTES as u64 + 64 * 1024;
/// Default desktop recovery budget.
pub const DESKTOP_RECOVERY_QUOTA_BYTES: u64 = 256 * 1024 * 1024;
/// Default Android recovery budget.
pub const ANDROID_RECOVERY_QUOTA_BYTES: u64 = 128 * 1024 * 1024;

/// Injected wall clock used for expiry decisions.
pub trait RecoveryClock: Send + Sync {
    fn now_unix_ms(&self) -> u64;
}

/// Production wall clock. Backward clock movement never extends a record's fixed expiry.
#[derive(Clone, Copy, Debug, Default)]
pub struct SystemRecoveryClock;

impl RecoveryClock for SystemRecoveryClock {
    fn now_unix_ms(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |duration| {
                u64::try_from(duration.as_millis()).unwrap_or(u64::MAX)
            })
    }
}

/// Safe inventory projection plus bounded aggregate counts.
#[derive(Clone, Debug, Eq, PartialEq, serde::Serialize)]
pub struct RecoveryInventory {
    pub entries: Vec<RecoveryInventoryEntry>,
    pub committed_bytes: u64,
    pub removed_invalid_records: u32,
}

/// Result of idempotently removing one record.
#[derive(Clone, Copy, Debug, Eq, PartialEq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RecoveryRemoval {
    Removed,
    AlreadyAbsent,
}

/// Single-process private recovery store.
pub struct RecoveryStore<C = SystemRecoveryClock> {
    root: PathBuf,
    quota_bytes: u64,
    clock: C,
    lock: Mutex<()>,
    #[cfg(test)]
    fail_before_commit: std::sync::atomic::AtomicBool,
}

impl RecoveryStore<SystemRecoveryClock> {
    /// Opens a store rooted at an application-local `recovery-v1` directory.
    ///
    /// # Errors
    ///
    /// Returns a safe error when the quota is invalid or the private root cannot be prepared.
    pub fn open(root: impl Into<PathBuf>, quota_bytes: u64) -> Result<Self, CoreError> {
        Self::open_with_clock(root, quota_bytes, SystemRecoveryClock)
    }
}

impl<C: RecoveryClock> RecoveryStore<C> {
    /// Opens a store with injected root, quota, and clock.
    ///
    /// # Errors
    ///
    /// Returns a safe error when the quota is invalid or the private root cannot be prepared.
    pub fn open_with_clock(
        root: impl Into<PathBuf>,
        quota_bytes: u64,
        clock: C,
    ) -> Result<Self, CoreError> {
        if quota_bytes == 0 {
            return Err(safe_error(
                CoreErrorCategory::InvalidInput,
                "recovery_invalid_quota",
                false,
            ));
        }
        let root = root.into();
        prepare_root(&root)?;
        Ok(Self {
            root,
            quota_bytes,
            clock,
            lock: Mutex::new(()),
            #[cfg(test)]
            fail_before_commit: std::sync::atomic::AtomicBool::new(false),
        })
    }

    /// Atomically publishes one validated snapshot after exact quota accounting.
    ///
    /// # Errors
    ///
    /// Returns a content-free validation, quota, permission, or persistence error.
    pub fn persist(&self, record: &RecoveryRecord) -> Result<RecoveryInventoryEntry, CoreError> {
        let _guard = self.lock.lock().map_err(|_| {
            safe_error(
                CoreErrorCategory::Unavailable,
                "recovery_lock_unavailable",
                true,
            )
        })?;
        validate_root(&self.root)?;
        let now = self.clock.now_unix_ms();
        record.validate_at(now).map_err(validation_error)?;
        let record_id = strict_record_id(&record.record_id)?;
        let encoded = serde_json::to_vec(record).map_err(|_| {
            safe_error(
                CoreErrorCategory::InvalidInput,
                "recovery_serialize_failed",
                false,
            )
        })?;
        let candidate_bytes = u64::try_from(encoded.len()).unwrap_or(u64::MAX);
        if candidate_bytes > MAX_RECOVERY_RECORD_BYTES {
            return Err(safe_error(
                CoreErrorCategory::ResourceLimit,
                "recovery_record_too_large",
                false,
            ));
        }

        let mut scan = scan_records(&self.root, now, Some(record_id))?;
        let mut projected = scan
            .committed_bytes
            .saturating_sub(scan.protected_bytes)
            .saturating_add(candidate_bytes);

        if projected > self.quota_bytes {
            scan.records
                .sort_by_key(|entry| (entry.updated_unix_ms, entry.id));
            for entry in &scan.records {
                if projected <= self.quota_bytes {
                    break;
                }
                if entry.id != record_id
                    && entry.eviction_eligible
                    && remove_regular_file(&entry.path).is_ok()
                {
                    projected = projected.saturating_sub(entry.bytes);
                }
            }
        }
        if projected > self.quota_bytes {
            return Err(safe_error(
                CoreErrorCategory::StorageFull,
                "recovery_quota_exhausted",
                true,
            )
            .with_context("candidate_bytes", candidate_bytes.to_string())
            .with_context("quota_bytes", self.quota_bytes.to_string()));
        }

        let destination = self.root.join(filename(record_id));
        let mut pending = AtomicWriteFile::options()
            .open(&destination)
            .map_err(|_| storage_error("recovery_open_temporary"))?;
        restrict_record_permissions(&mut pending)?;
        pending
            .write_all(&encoded)
            .map_err(|_| storage_error("recovery_write_failed"))?;
        pending
            .flush()
            .map_err(|_| storage_error("recovery_flush_failed"))?;
        pending
            .sync_all()
            .map_err(|_| storage_error("recovery_sync_failed"))?;
        #[cfg(test)]
        if self
            .fail_before_commit
            .swap(false, std::sync::atomic::Ordering::SeqCst)
        {
            return Err(storage_error("recovery_injected_precommit_failure"));
        }
        pending
            .commit()
            .map_err(|_| storage_error("recovery_commit_failed"))?;
        sync_root(&self.root)?;

        Ok(RecoveryInventoryEntry {
            record_id: record.record_id.clone(),
            display_hint: record.display_hint.clone(),
            updated_unix_ms: record.updated_unix_ms,
            expires_unix_ms: record.expires_unix_ms,
            committed_bytes: candidate_bytes,
            status: RecoveryInventoryStatus::Available,
        })
    }

    /// Inventories each strict record independently and removes expired or corrupt supported records.
    ///
    /// # Errors
    ///
    /// Returns a content-free storage error when the private directory cannot be inspected or cleaned.
    pub fn inventory(&self) -> Result<RecoveryInventory, CoreError> {
        let _guard = self.lock.lock().map_err(|_| {
            safe_error(
                CoreErrorCategory::Unavailable,
                "recovery_lock_unavailable",
                true,
            )
        })?;
        validate_root(&self.root)?;
        let scan = scan_records(&self.root, self.clock.now_unix_ms(), None)?;
        Ok(RecoveryInventory {
            entries: scan.entries,
            committed_bytes: scan.committed_bytes,
            removed_invalid_records: scan.removed_invalid_records,
        })
    }

    /// Loads one valid, current record without exposing a filesystem path.
    ///
    /// # Errors
    ///
    /// Returns a content-free not-found, corruption, expiry, or storage error.
    pub fn load(&self, record_id: &str) -> Result<RecoveryRecord, CoreError> {
        let _guard = self.lock.lock().map_err(|_| {
            safe_error(
                CoreErrorCategory::Unavailable,
                "recovery_lock_unavailable",
                true,
            )
        })?;
        validate_root(&self.root)?;
        let id = strict_record_id(record_id)?;
        let path = self.root.join(filename(id));
        let bytes = read_bounded_regular_file(&path)?;
        let record: RecoveryRecord = serde_json::from_slice(&bytes)
            .map_err(|_| corrupt_error("recovery_record_malformed"))?;
        if record.record_id != record_id {
            return Err(corrupt_error("recovery_filename_mismatch"));
        }
        record
            .validate_at(self.clock.now_unix_ms())
            .map_err(validation_error)?;
        Ok(record)
    }

    /// Removes exactly one matching record. Repeated removal is successful and has no side effects.
    ///
    /// # Errors
    ///
    /// Returns a content-free error for an invalid identifier or a failed exact-record cleanup.
    pub fn remove(&self, record_id: &str) -> Result<RecoveryRemoval, CoreError> {
        let _guard = self.lock.lock().map_err(|_| {
            safe_error(
                CoreErrorCategory::Unavailable,
                "recovery_lock_unavailable",
                true,
            )
        })?;
        validate_root(&self.root)?;
        let id = strict_record_id(record_id)?;
        let path = self.root.join(filename(id));
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.file_type().is_file() => {
                remove_regular_file(&path)?;
                sync_root(&self.root)?;
                Ok(RecoveryRemoval::Removed)
            }
            Ok(_) => Err(corrupt_error("recovery_entry_not_regular")),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                Ok(RecoveryRemoval::AlreadyAbsent)
            }
            Err(_) => Err(storage_error("recovery_metadata_failed")),
        }
    }

    #[cfg(test)]
    fn inject_precommit_failure(&self) {
        self.fail_before_commit
            .store(true, std::sync::atomic::Ordering::SeqCst);
    }
}

struct ScannedRecord {
    id: Uuid,
    path: PathBuf,
    bytes: u64,
    updated_unix_ms: u64,
    eviction_eligible: bool,
}

struct ScanResult {
    records: Vec<ScannedRecord>,
    entries: Vec<RecoveryInventoryEntry>,
    committed_bytes: u64,
    removed_invalid_records: u32,
    protected_bytes: u64,
}

#[allow(clippy::too_many_lines)]
fn scan_records(
    root: &Path,
    now_unix_ms: u64,
    protected_id: Option<Uuid>,
) -> Result<ScanResult, CoreError> {
    scan_records_with_reader(root, now_unix_ms, protected_id, read_exact_file)
}

#[allow(clippy::too_many_lines)]
fn scan_records_with_reader(
    root: &Path,
    now_unix_ms: u64,
    protected_id: Option<Uuid>,
    read_record: impl Fn(&Path, u64) -> Result<Vec<u8>, CoreError>,
) -> Result<ScanResult, CoreError> {
    let mut result = ScanResult {
        records: Vec::new(),
        entries: Vec::new(),
        committed_bytes: 0,
        removed_invalid_records: 0,
        protected_bytes: 0,
    };
    let directory = fs::read_dir(root).map_err(|_| storage_error("recovery_read_directory"))?;
    for item in directory {
        let item = item.map_err(|_| storage_error("recovery_read_entry"))?;
        let Some(id) = strict_filename(&item.file_name()) else {
            continue;
        };
        let path = item.path();
        let metadata =
            fs::symlink_metadata(&path).map_err(|_| storage_error("recovery_entry_metadata"))?;
        if !metadata.file_type().is_file() {
            continue;
        }
        let bytes = metadata.len();
        result.committed_bytes = result.committed_bytes.saturating_add(bytes);
        if Some(id) == protected_id {
            result.protected_bytes = bytes;
        }
        if bytes > MAX_RECOVERY_RECORD_BYTES {
            if Some(id) != protected_id {
                clean_invalid(&path, id, protected_id, bytes, &mut result);
            }
            result
                .entries
                .push(invalid_entry(id, bytes, RecoveryInventoryStatus::Corrupted));
            continue;
        }
        let payload = read_record(&path, bytes)?;
        let value: Value = if let Ok(value) = serde_json::from_slice(&payload) {
            value
        } else {
            clean_invalid(&path, id, protected_id, bytes, &mut result);
            result
                .entries
                .push(invalid_entry(id, bytes, RecoveryInventoryStatus::Corrupted));
            continue;
        };
        let schema = value.get("schema_version").and_then(Value::as_u64);
        if schema.is_some_and(|version| version > u64::from(RECOVERY_SCHEMA_VERSION)) {
            result.entries.push(invalid_entry(
                id,
                bytes,
                RecoveryInventoryStatus::Unsupported,
            ));
            continue;
        }
        let record: RecoveryRecord = if let Ok(record) = serde_json::from_value(value) {
            record
        } else {
            clean_invalid(&path, id, protected_id, bytes, &mut result);
            result
                .entries
                .push(invalid_entry(id, bytes, RecoveryInventoryStatus::Corrupted));
            continue;
        };
        if record.record_id != id.hyphenated().to_string() {
            clean_invalid(&path, id, protected_id, bytes, &mut result);
            result
                .entries
                .push(invalid_entry(id, bytes, RecoveryInventoryStatus::Corrupted));
            continue;
        }
        match record.validate_at(now_unix_ms) {
            Ok(()) => {
                result.records.push(ScannedRecord {
                    id,
                    path,
                    bytes,
                    updated_unix_ms: record.updated_unix_ms,
                    eviction_eligible: record.eviction_eligible,
                });
                result.entries.push(RecoveryInventoryEntry {
                    record_id: record.record_id,
                    display_hint: record.display_hint,
                    updated_unix_ms: record.updated_unix_ms,
                    expires_unix_ms: record.expires_unix_ms,
                    committed_bytes: bytes,
                    status: RecoveryInventoryStatus::Available,
                });
            }
            Err(RecoveryValidationError::Expired) => {
                clean_invalid(&path, id, protected_id, bytes, &mut result);
                result.entries.push(RecoveryInventoryEntry {
                    record_id: record.record_id,
                    display_hint: record.display_hint,
                    updated_unix_ms: record.updated_unix_ms,
                    expires_unix_ms: record.expires_unix_ms,
                    committed_bytes: bytes,
                    status: RecoveryInventoryStatus::Expired,
                });
            }
            Err(RecoveryValidationError::UnsupportedSchema) => {
                result.entries.push(invalid_entry(
                    id,
                    bytes,
                    RecoveryInventoryStatus::Unsupported,
                ));
            }
            Err(_) => {
                clean_invalid(&path, id, protected_id, bytes, &mut result);
                result
                    .entries
                    .push(invalid_entry(id, bytes, RecoveryInventoryStatus::Corrupted));
            }
        }
    }
    result.entries.sort_by(|left, right| {
        left.updated_unix_ms
            .cmp(&right.updated_unix_ms)
            .then_with(|| left.record_id.cmp(&right.record_id))
    });
    Ok(result)
}

fn clean_invalid(
    path: &Path,
    id: Uuid,
    protected_id: Option<Uuid>,
    bytes: u64,
    result: &mut ScanResult,
) {
    if Some(id) != protected_id && remove_regular_file(path).is_ok() {
        result.committed_bytes = result.committed_bytes.saturating_sub(bytes);
        result.removed_invalid_records = result.removed_invalid_records.saturating_add(1);
    }
}

fn invalid_entry(id: Uuid, bytes: u64, status: RecoveryInventoryStatus) -> RecoveryInventoryEntry {
    RecoveryInventoryEntry {
        record_id: id.hyphenated().to_string(),
        display_hint: "Recovered document".into(),
        updated_unix_ms: 0,
        expires_unix_ms: 0,
        committed_bytes: bytes,
        status,
    }
}

fn prepare_root(root: &Path) -> Result<(), CoreError> {
    match fs::symlink_metadata(root) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Err(corrupt_error("recovery_root_not_private_directory"));
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir_all(root).map_err(|_| storage_error("recovery_create_directory"))?;
        }
        Err(_) => return Err(storage_error("recovery_root_metadata")),
    }
    validate_root(root)?;
    restrict_directory_permissions(root)
}

fn validate_root(root: &Path) -> Result<(), CoreError> {
    let metadata =
        fs::symlink_metadata(root).map_err(|_| storage_error("recovery_root_metadata"))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(corrupt_error("recovery_root_not_private_directory"));
    }
    Ok(())
}

fn read_bounded_regular_file(path: &Path) -> Result<Vec<u8>, CoreError> {
    let metadata = fs::symlink_metadata(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            safe_error(
                CoreErrorCategory::NotFound,
                "recovery_record_not_found",
                false,
            )
        } else {
            storage_error("recovery_entry_metadata")
        }
    })?;
    if !metadata.file_type().is_file() {
        return Err(corrupt_error("recovery_entry_not_regular"));
    }
    if metadata.len() > MAX_RECOVERY_RECORD_BYTES {
        return Err(corrupt_error("recovery_record_too_large"));
    }
    read_exact_file(path, metadata.len())
}

fn read_exact_file(path: &Path, length: u64) -> Result<Vec<u8>, CoreError> {
    let capacity =
        usize::try_from(length).map_err(|_| corrupt_error("recovery_record_too_large"))?;
    let file = File::open(path).map_err(|_| storage_error("recovery_open_record"))?;
    let mut bytes = Vec::with_capacity(capacity);
    file.take(MAX_RECOVERY_RECORD_BYTES.saturating_add(1))
        .read_to_end(&mut bytes)
        .map_err(|_| storage_error("recovery_read_record"))?;
    if bytes.len() != capacity {
        return Err(corrupt_error("recovery_record_size_changed"));
    }
    Ok(bytes)
}

fn strict_record_id(value: &str) -> Result<Uuid, CoreError> {
    let id = Uuid::parse_str(value).map_err(|_| {
        safe_error(
            CoreErrorCategory::InvalidInput,
            "recovery_invalid_id",
            false,
        )
    })?;
    if id.hyphenated().to_string() != value {
        return Err(safe_error(
            CoreErrorCategory::InvalidInput,
            "recovery_invalid_id",
            false,
        ));
    }
    Ok(id)
}

fn strict_filename(value: &std::ffi::OsStr) -> Option<Uuid> {
    let name = value.to_str()?;
    let stem = name.strip_suffix(".json")?;
    let id = Uuid::parse_str(stem).ok()?;
    (name == filename(id)).then_some(id)
}

fn filename(id: Uuid) -> String {
    format!("{}.json", id.hyphenated())
}

fn remove_regular_file(path: &Path) -> Result<(), CoreError> {
    fs::remove_file(path).map_err(|_| storage_error("recovery_remove_failed"))
}

fn validation_error(error: RecoveryValidationError) -> CoreError {
    let (category, code) = match error {
        RecoveryValidationError::UnsupportedSchema => (
            CoreErrorCategory::UnsupportedInput,
            "recovery_unsupported_schema",
        ),
        RecoveryValidationError::ContentTooLarge => (
            CoreErrorCategory::ResourceLimit,
            "recovery_content_too_large",
        ),
        RecoveryValidationError::Expired => {
            (CoreErrorCategory::NotFound, "recovery_record_expired")
        }
        _ => (CoreErrorCategory::InvalidInput, "recovery_record_invalid"),
    };
    safe_error(category, code, false)
}

fn corrupt_error(code: &'static str) -> CoreError {
    safe_error(CoreErrorCategory::InvalidInput, code, false)
}

fn storage_error(code: &'static str) -> CoreError {
    safe_error(CoreErrorCategory::Unavailable, code, true)
}

fn safe_error(category: CoreErrorCategory, code: &'static str, retryable: bool) -> CoreError {
    CoreError::new(category, "Recovery storage is unavailable", retryable, true)
        .with_context("code", code)
}

#[cfg(unix)]
fn restrict_directory_permissions(root: &Path) -> Result<(), CoreError> {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(root, fs::Permissions::from_mode(0o700))
        .map_err(|_| storage_error("recovery_directory_permissions"))
}

#[cfg(not(unix))]
#[allow(clippy::unnecessary_wraps)]
fn restrict_directory_permissions(_root: &Path) -> Result<(), CoreError> {
    Ok(())
}

#[cfg(unix)]
fn restrict_record_permissions(file: &mut AtomicWriteFile) -> Result<(), CoreError> {
    use std::os::unix::fs::PermissionsExt;

    file.set_permissions(fs::Permissions::from_mode(0o600))
        .map_err(|_| storage_error("recovery_record_permissions"))
}

#[cfg(not(unix))]
#[allow(clippy::unnecessary_wraps)]
fn restrict_record_permissions(_file: &mut AtomicWriteFile) -> Result<(), CoreError> {
    Ok(())
}

#[cfg(unix)]
fn sync_root(root: &Path) -> Result<(), CoreError> {
    File::open(root)
        .and_then(|directory| directory.sync_all())
        .map_err(|_| storage_error("recovery_sync_directory"))
}

#[cfg(not(unix))]
#[allow(clippy::unnecessary_wraps)]
fn sync_root(_root: &Path) -> Result<(), CoreError> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU64, Ordering};

    use glitchpad_core::detection::{
        BomIntent, NewlinePattern, Presence, TextEncoding, TextProfile, UndecodableBytes,
    };
    use glitchpad_core::recovery::RecoveryRecordInput;

    use super::*;

    const NOW: u64 = 1_788_044_400_000;

    struct TestClock(AtomicU64);

    impl TestClock {
        fn new(now: u64) -> Self {
            Self(AtomicU64::new(now))
        }

        fn set(&self, now: u64) {
            self.0.store(now, Ordering::SeqCst);
        }
    }

    impl RecoveryClock for TestClock {
        fn now_unix_ms(&self) -> u64 {
            self.0.load(Ordering::SeqCst)
        }
    }

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("glitchpad-recovery-{}", Uuid::new_v4()));
            fs::create_dir(&path).expect("create test directory");
            Self(path)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn profile() -> TextProfile {
        TextProfile {
            encoding: TextEncoding::Utf8,
            bom: BomIntent::Absent,
            newlines: NewlinePattern::Lf,
            terminal_newline: Presence::Present,
            undecodable_bytes: UndecodableBytes::None,
        }
    }

    fn record(id: Uuid, content: &str, updated: u64, eligible: bool) -> RecoveryRecord {
        RecoveryRecord::new(RecoveryRecordInput {
            record_id: id.hyphenated().to_string(),
            display_hint: "notes.md".into(),
            source_identity_evidence: b"native-source",
            base_revision_evidence: b"native-revision",
            saved_session_revision: 1,
            snapshot_session_revision: 2,
            text_profile: profile(),
            created_unix_ms: updated,
            updated_unix_ms: updated,
            content: content.into(),
            eviction_eligible: eligible,
        })
        .expect("valid record")
    }

    #[test]
    fn injected_precommit_failure_preserves_previous_committed_record() {
        let directory = TestDirectory::new();
        let store = RecoveryStore::open_with_clock(&directory.0, 1024 * 1024, TestClock::new(NOW))
            .expect("open store");
        let id = Uuid::new_v4();
        let original = record(id, "original private text", NOW, false);
        store.persist(&original).expect("persist original");
        let updated = record(id, "updated private text", NOW, false);
        store.inject_precommit_failure();
        let error = store.persist(&updated).expect_err("inject failure");
        assert_eq!(error.context["code"], "recovery_injected_precommit_failure");
        assert_eq!(
            store.load(&original.record_id).expect("load original"),
            original
        );
    }

    #[test]
    fn transient_inventory_read_failure_preserves_the_committed_record() {
        let directory = TestDirectory::new();
        let store = RecoveryStore::open_with_clock(&directory.0, 1024 * 1024, TestClock::new(NOW))
            .expect("open store");
        let record = record(Uuid::new_v4(), "only recovery copy", NOW, false);
        store.persist(&record).expect("persist record");
        let path = directory.0.join(format!("{}.json", record.record_id));
        let original = fs::read(&path).expect("read committed bytes");

        let result = scan_records_with_reader(&directory.0, NOW, None, |_path, _length| {
            Err(storage_error("recovery_injected_read_failure"))
        });
        let Err(error) = result else {
            panic!("transient read failure must be surfaced");
        };

        assert_eq!(error.context["code"], "recovery_injected_read_failure");
        assert_eq!(fs::read(path).expect("record remains present"), original);
    }

    #[test]
    fn wall_clock_rollback_preserves_and_loads_a_valid_record() {
        let directory = TestDirectory::new();
        let store = RecoveryStore::open_with_clock(&directory.0, 1024 * 1024, TestClock::new(NOW))
            .expect("open store");
        let record = record(Uuid::new_v4(), "recovery after clock rollback", NOW, false);
        store.persist(&record).expect("persist record");

        store.clock.set(NOW.saturating_sub(60_000));

        let inventory = store.inventory().expect("inventory after rollback");
        assert_eq!(inventory.entries.len(), 1);
        assert_eq!(
            inventory.entries[0].status,
            RecoveryInventoryStatus::Available
        );
        assert_eq!(
            store.load(&record.record_id).expect("load after rollback"),
            record
        );
    }

    #[cfg(unix)]
    #[test]
    fn unix_store_and_records_are_owner_only() {
        use std::os::unix::fs::PermissionsExt;

        let directory = TestDirectory::new();
        let store = RecoveryStore::open_with_clock(&directory.0, 1024 * 1024, TestClock::new(NOW))
            .expect("open store");
        let record = record(Uuid::new_v4(), "private text", NOW, false);
        store.persist(&record).expect("persist");
        assert_eq!(
            fs::metadata(&directory.0)
                .expect("root metadata")
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
        let path = directory.0.join(format!("{}.json", record.record_id));
        assert_eq!(
            fs::metadata(path)
                .expect("record metadata")
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
    }
}
