//! Conformance tests for private, atomic, quota-bound recovery persistence.

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use glitchpad_core::contracts::CoreErrorCategory;
use glitchpad_core::detection::{
    BomIntent, NewlinePattern, Presence, TextEncoding, TextProfile, UndecodableBytes,
};
use glitchpad_core::recovery::{RecoveryInventoryStatus, RecoveryRecord, RecoveryRecordInput};
use glitchpad_lib::recovery::{RecoveryClock, RecoveryRemoval, RecoveryStore};
use uuid::Uuid;

const NOW: u64 = 1_788_044_400_000;

#[derive(Clone)]
struct TestClock(Arc<AtomicU64>);

impl TestClock {
    fn new(now: u64) -> Self {
        Self(Arc::new(AtomicU64::new(now)))
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
        source_identity_evidence: b"private/source/authority",
        base_revision_evidence: b"private/source/revision",
        saved_session_revision: 7,
        snapshot_session_revision: 8,
        text_profile: profile(),
        created_unix_ms: updated,
        updated_unix_ms: updated,
        content: content.into(),
        eviction_eligible: eligible,
    })
    .expect("valid recovery record")
}

#[test]
fn round_trip_accounts_exact_serialized_bytes_and_updates_in_place() {
    let directory = TestDirectory::new();
    let store = RecoveryStore::open_with_clock(&directory.0, 1024 * 1024, TestClock::new(NOW))
        .expect("open store");
    let id = Uuid::new_v4();
    let first = record(id, "first private buffer", NOW, false);
    let entry = store.persist(&first).expect("persist first");
    let path = directory.0.join(format!("{}.json", first.record_id));
    assert_eq!(
        entry.committed_bytes,
        fs::metadata(&path).expect("metadata").len()
    );
    assert_eq!(store.load(&first.record_id).expect("load first"), first);

    let second = record(id, "a longer updated private buffer", NOW, false);
    store.persist(&second).expect("persist update");
    let inventory = store.inventory().expect("inventory");
    assert_eq!(inventory.entries.len(), 1);
    assert_eq!(
        inventory.committed_bytes,
        fs::metadata(path).expect("metadata").len()
    );
    assert_eq!(store.load(&second.record_id).expect("load update"), second);
}

#[test]
fn quota_evicts_only_oldest_eligible_record_and_protects_unresolved_coverage() {
    let directory = TestDirectory::new();
    let clock = TestClock::new(NOW);
    let sizing = RecoveryStore::open_with_clock(&directory.0, 1024 * 1024, clock)
        .expect("open sizing store");
    let protected = record(Uuid::new_v4(), &"p".repeat(128), NOW - 2, false);
    let oldest_eligible = record(Uuid::new_v4(), &"e".repeat(128), NOW - 2, true);
    let newer_eligible = record(Uuid::new_v4(), &"n".repeat(128), NOW - 1, true);
    let candidate = record(Uuid::new_v4(), &"c".repeat(128), NOW, false);
    let protected_size = sizing
        .persist(&protected)
        .expect("protected")
        .committed_bytes;
    let oldest_size = sizing
        .persist(&oldest_eligible)
        .expect("oldest eligible")
        .committed_bytes;
    let newer_size = sizing
        .persist(&newer_eligible)
        .expect("newer eligible")
        .committed_bytes;
    let candidate_size = serde_json::to_vec(&candidate).expect("serialize").len() as u64;
    drop(sizing);

    let quota = protected_size + newer_size + candidate_size;
    assert!(protected_size + oldest_size + newer_size + candidate_size > quota);
    let store = RecoveryStore::open_with_clock(&directory.0, quota, TestClock::new(NOW))
        .expect("open quota store");
    store
        .persist(&candidate)
        .expect("eligible eviction makes space");
    assert!(store.load(&protected.record_id).is_ok());
    assert_eq!(
        store
            .load(&oldest_eligible.record_id)
            .expect_err("oldest eligible evicted")
            .category,
        CoreErrorCategory::NotFound
    );
    assert!(store.load(&newer_eligible.record_id).is_ok());

    let too_large = record(Uuid::new_v4(), &"x".repeat(512), NOW, false);
    let error = store
        .persist(&too_large)
        .expect_err("protected quota refusal");
    assert_eq!(error.category, CoreErrorCategory::StorageFull);
    assert!(store.load(&protected.record_id).is_ok());
    assert!(store.load(&candidate.record_id).is_ok());
}

#[test]
fn expiry_and_corruption_are_isolated_without_blocking_valid_records() {
    let directory = TestDirectory::new();
    let clock = TestClock::new(NOW + 1);
    let store = RecoveryStore::open_with_clock(&directory.0, 1024 * 1024, clock.clone())
        .expect("open store");
    let valid = record(Uuid::new_v4(), "valid private content", NOW + 1, false);
    let expired = record(Uuid::new_v4(), "expired private content", NOW, false);
    let corrupt_id = Uuid::new_v4();
    store.persist(&valid).expect("persist valid");
    store.persist(&expired).expect("persist expiring");
    fs::write(
        directory.0.join(format!("{corrupt_id}.json")),
        b"{malformed private payload",
    )
    .expect("write corrupt fixture");
    clock.set(expired.expires_unix_ms);

    let inventory = store
        .inventory()
        .expect("inventory survives invalid records");
    assert!(
        inventory
            .entries
            .iter()
            .any(|entry| entry.record_id == expired.record_id
                && entry.status == RecoveryInventoryStatus::Expired)
    );
    assert!(
        inventory
            .entries
            .iter()
            .any(|entry| entry.record_id == corrupt_id.to_string()
                && entry.status == RecoveryInventoryStatus::Corrupted)
    );
    assert_eq!(inventory.removed_invalid_records, 2);
    assert!(store.load(&valid.record_id).is_ok());
    assert!(
        !directory
            .0
            .join(format!("{}.json", expired.record_id))
            .exists()
    );
    assert!(!directory.0.join(format!("{corrupt_id}.json")).exists());
}

#[test]
fn future_schema_is_preserved_and_counted_against_quota() {
    let directory = TestDirectory::new();
    let store = RecoveryStore::open_with_clock(&directory.0, 1024 * 1024, TestClock::new(NOW))
        .expect("open store");
    let id = Uuid::new_v4();
    let bytes = format!(r#"{{"schema_version":2,"record_id":"{id}","future_payload":"private"}}"#)
        .into_bytes();
    let path = directory.0.join(format!("{id}.json"));
    fs::write(&path, &bytes).expect("write future fixture");

    let inventory = store.inventory().expect("inventory");
    assert_eq!(inventory.committed_bytes, bytes.len() as u64);
    assert_eq!(
        inventory.entries[0].status,
        RecoveryInventoryStatus::Unsupported
    );
    assert_eq!(fs::read(path).expect("future record preserved"), bytes);
}

#[test]
fn cleanup_is_idempotent_and_leaves_unrelated_entries_byte_identical() {
    let directory = TestDirectory::new();
    let store = RecoveryStore::open_with_clock(&directory.0, 1024 * 1024, TestClock::new(NOW))
        .expect("open store");
    let target = record(Uuid::new_v4(), "target private content", NOW, false);
    let unrelated = record(Uuid::new_v4(), "unrelated private content", NOW, false);
    store.persist(&target).expect("target");
    store.persist(&unrelated).expect("unrelated");
    let unrelated_path = directory.0.join(format!("{}.json", unrelated.record_id));
    let before = fs::read(&unrelated_path).expect("read unrelated");

    assert_eq!(
        store.remove(&target.record_id).expect("remove"),
        RecoveryRemoval::Removed
    );
    assert_eq!(
        store.remove(&target.record_id).expect("repeat"),
        RecoveryRemoval::AlreadyAbsent
    );
    assert_eq!(
        fs::read(unrelated_path).expect("read unrelated after"),
        before
    );
}

#[test]
fn filenames_are_strict_and_errors_never_expose_content_or_paths() {
    let directory = TestDirectory::new();
    let store =
        RecoveryStore::open_with_clock(&directory.0, 64, TestClock::new(NOW)).expect("open store");
    let secret = "UNIQUE-RECOVERY-CONTENT";
    let candidate = record(Uuid::new_v4(), secret, NOW, false);
    let error = store.persist(&candidate).expect_err("quota failure");
    let rendered = format!("{error:?}");
    assert!(!rendered.contains(secret));
    assert!(!rendered.contains(&directory.0.to_string_lossy().to_string()));
    assert!(store.load("../../escape").is_err());

    fs::write(directory.0.join("NOT-A-UUID.json"), b"unrelated").expect("unrelated");
    fs::write(
        directory.0.join(format!("{}.JSON", Uuid::new_v4())),
        b"unrelated",
    )
    .expect("unrelated");
    assert!(store.inventory().expect("inventory").entries.is_empty());
    assert_eq!(fs::read_dir(&directory.0).expect("read root").count(), 2);
}

#[cfg(unix)]
#[test]
fn symbolic_link_root_is_rejected() {
    use std::os::unix::fs::symlink;

    let parent = TestDirectory::new();
    let actual = parent.0.join("actual");
    let linked = parent.0.join("linked");
    fs::create_dir(&actual).expect("actual");
    symlink(&actual, &linked).expect("symlink");
    let error = RecoveryStore::open_with_clock(linked, 1024, TestClock::new(NOW))
        .expect_err("symlink rejected");
    assert_eq!(error.category, CoreErrorCategory::InvalidInput);
}
