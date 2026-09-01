//! Portable recovery-record validation and snapshot scheduling policy.

use std::fmt;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::detection::TextProfile;

/// Recovery record schema understood by this release.
pub const RECOVERY_SCHEMA_VERSION: u16 = 1;
/// Maximum UTF-8 payload size accepted by one recovery record.
pub const MAX_RECOVERY_CONTENT_BYTES: usize = 16 * 1024 * 1024;
/// Maximum number of Unicode scalar values in a recovery display hint.
pub const MAX_RECOVERY_DISPLAY_HINT_CHARS: usize = 255;
/// Maximum lifetime of one recovery snapshot.
pub const MAX_RECOVERY_LIFETIME_MS: u64 = 7 * 24 * 60 * 60 * 1_000;
/// Idle interval after which an edited buffer becomes eligible for a snapshot.
pub const RECOVERY_IDLE_INTERVAL_MS: u64 = 2_000;
/// Maximum interval between snapshots while a buffer remains dirty.
pub const RECOVERY_MAX_INTERVAL_MS: u64 = 30_000;

const CONTENT_HASH_DOMAIN: &[u8] = b"glitchpad:recovery:content:v1\0";
const SOURCE_HASH_DOMAIN: &[u8] = b"glitchpad:recovery:source:v1\0";
const REVISION_HASH_DOMAIN: &[u8] = b"glitchpad:recovery:revision:v1\0";

/// Inputs used to construct a validated recovery snapshot.
pub struct RecoveryRecordInput<'a> {
    pub record_id: String,
    pub display_hint: String,
    /// Native source identity evidence. Only its domain-separated digest is retained.
    pub source_identity_evidence: &'a [u8],
    /// External revision evidence. Only its domain-separated digest is retained.
    pub base_revision_evidence: &'a [u8],
    pub saved_session_revision: u64,
    pub snapshot_session_revision: u64,
    pub text_profile: TextProfile,
    pub created_unix_ms: u64,
    pub updated_unix_ms: u64,
    pub content: String,
    pub eviction_eligible: bool,
}

/// Owned command-boundary input used to construct a validated recovery record.
///
/// Source and revision evidence are hashed during construction and never enter
/// the persisted record or safe diagnostics.
#[derive(Clone, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RecoveryRecordDraft {
    pub record_id: String,
    pub display_hint: String,
    pub source_identity_evidence: String,
    pub base_revision_evidence: String,
    pub saved_session_revision: u64,
    pub snapshot_session_revision: u64,
    pub text_profile: TextProfile,
    pub created_unix_ms: u64,
    pub updated_unix_ms: u64,
    pub content: String,
    pub eviction_eligible: bool,
}

impl RecoveryRecordDraft {
    /// Consumes command input and hashes transient evidence into a validated record.
    ///
    /// # Errors
    ///
    /// Returns a bounded, content-free validation classification.
    pub fn into_record(self) -> Result<RecoveryRecord, RecoveryValidationError> {
        let Self {
            record_id,
            display_hint,
            source_identity_evidence,
            base_revision_evidence,
            saved_session_revision,
            snapshot_session_revision,
            text_profile,
            created_unix_ms,
            updated_unix_ms,
            content,
            eviction_eligible,
        } = self;
        RecoveryRecord::new(RecoveryRecordInput {
            record_id,
            display_hint,
            source_identity_evidence: source_identity_evidence.as_bytes(),
            base_revision_evidence: base_revision_evidence.as_bytes(),
            saved_session_revision,
            snapshot_session_revision,
            text_profile,
            created_unix_ms,
            updated_unix_ms,
            content,
            eviction_eligible,
        })
    }
}

/// Versioned, bounded recovery payload containing no native source authority.
#[derive(Clone, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RecoveryRecord {
    pub schema_version: u16,
    pub record_id: String,
    pub display_hint: String,
    pub source_identity_hash: String,
    pub base_revision_hash: String,
    pub saved_session_revision: u64,
    pub snapshot_session_revision: u64,
    pub text_profile: TextProfile,
    pub created_unix_ms: u64,
    pub updated_unix_ms: u64,
    pub expires_unix_ms: u64,
    pub content: String,
    pub content_sha256: String,
    pub eviction_eligible: bool,
}

impl RecoveryRecord {
    /// Constructs a bounded record while discarding raw source and revision evidence.
    ///
    /// # Errors
    ///
    /// Returns a stable validation failure when the identifier, revision, content, or timestamp bounds are invalid.
    pub fn new(input: RecoveryRecordInput<'_>) -> Result<Self, RecoveryValidationError> {
        if !is_lowercase_uuid(&input.record_id) {
            return Err(RecoveryValidationError::InvalidRecordId);
        }
        if input.content.len() > MAX_RECOVERY_CONTENT_BYTES {
            return Err(RecoveryValidationError::ContentTooLarge);
        }
        if input.snapshot_session_revision <= input.saved_session_revision {
            return Err(RecoveryValidationError::InvalidSessionRevision);
        }
        if input.created_unix_ms > input.updated_unix_ms {
            return Err(RecoveryValidationError::InvalidTimestampOrder);
        }
        let expires_unix_ms = input
            .updated_unix_ms
            .checked_add(MAX_RECOVERY_LIFETIME_MS)
            .ok_or(RecoveryValidationError::TimestampOverflow)?;

        let content_sha256 = recovery_content_hash(input.content.as_bytes());
        Ok(Self {
            schema_version: RECOVERY_SCHEMA_VERSION,
            record_id: input.record_id,
            display_hint: sanitize_display_hint(&input.display_hint),
            source_identity_hash: recovery_source_hash(input.source_identity_evidence),
            base_revision_hash: recovery_revision_hash(input.base_revision_evidence),
            saved_session_revision: input.saved_session_revision,
            snapshot_session_revision: input.snapshot_session_revision,
            text_profile: input.text_profile,
            created_unix_ms: input.created_unix_ms,
            updated_unix_ms: input.updated_unix_ms,
            expires_unix_ms,
            content: input.content,
            content_sha256,
            eviction_eligible: input.eviction_eligible,
        })
    }

    /// Validates an independently loaded record at the supplied wall-clock time.
    ///
    /// # Errors
    ///
    /// Returns a deterministic, content-free classification for unsupported, malformed, expired, or corrupt records.
    pub fn validate_at(&self, now_unix_ms: u64) -> Result<(), RecoveryValidationError> {
        if self.schema_version != RECOVERY_SCHEMA_VERSION {
            return Err(RecoveryValidationError::UnsupportedSchema);
        }
        if !is_lowercase_uuid(&self.record_id) {
            return Err(RecoveryValidationError::InvalidRecordId);
        }
        if self.display_hint != sanitize_display_hint(&self.display_hint) {
            return Err(RecoveryValidationError::InvalidDisplayHint);
        }
        if self.content.len() > MAX_RECOVERY_CONTENT_BYTES {
            return Err(RecoveryValidationError::ContentTooLarge);
        }
        if self.snapshot_session_revision <= self.saved_session_revision {
            return Err(RecoveryValidationError::InvalidSessionRevision);
        }
        if self.created_unix_ms > self.updated_unix_ms
            || self.updated_unix_ms > self.expires_unix_ms
        {
            return Err(RecoveryValidationError::InvalidTimestampOrder);
        }
        let maximum_expiry = self
            .updated_unix_ms
            .checked_add(MAX_RECOVERY_LIFETIME_MS)
            .ok_or(RecoveryValidationError::TimestampOverflow)?;
        if self.expires_unix_ms > maximum_expiry {
            return Err(RecoveryValidationError::LifetimeTooLong);
        }
        if self.created_unix_ms > now_unix_ms || self.updated_unix_ms > now_unix_ms {
            return Err(RecoveryValidationError::FutureTimestamp);
        }
        if self.expires_unix_ms <= now_unix_ms {
            return Err(RecoveryValidationError::Expired);
        }
        if !is_sha256_hex(&self.source_identity_hash)
            || !is_sha256_hex(&self.base_revision_hash)
            || !is_sha256_hex(&self.content_sha256)
        {
            return Err(RecoveryValidationError::InvalidHash);
        }
        if self.content_sha256 != recovery_content_hash(self.content.as_bytes()) {
            return Err(RecoveryValidationError::ChecksumMismatch);
        }
        Ok(())
    }
}

impl fmt::Debug for RecoveryRecord {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("RecoveryRecord")
            .field("schema_version", &self.schema_version)
            .field("record_id", &"[redacted]")
            .field("display_hint", &self.display_hint)
            .field("source_identity_hash", &"[redacted]")
            .field("base_revision_hash", &"[redacted]")
            .field("saved_session_revision", &self.saved_session_revision)
            .field("snapshot_session_revision", &self.snapshot_session_revision)
            .field("text_profile", &self.text_profile)
            .field("created_unix_ms", &self.created_unix_ms)
            .field("updated_unix_ms", &self.updated_unix_ms)
            .field("expires_unix_ms", &self.expires_unix_ms)
            .field("content", &"[redacted]")
            .field("content_bytes", &self.content.len())
            .field("content_sha256", &"[redacted]")
            .field("eviction_eligible", &self.eviction_eligible)
            .finish()
    }
}

/// Stable, content-free reason that a recovery record cannot be offered.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecoveryValidationError {
    UnsupportedSchema,
    InvalidRecordId,
    InvalidDisplayHint,
    ContentTooLarge,
    InvalidSessionRevision,
    InvalidTimestampOrder,
    TimestampOverflow,
    LifetimeTooLong,
    FutureTimestamp,
    Expired,
    InvalidHash,
    ChecksumMismatch,
}

impl fmt::Display for RecoveryValidationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::UnsupportedSchema => "unsupported recovery schema",
            Self::InvalidRecordId => "invalid recovery record identifier",
            Self::InvalidDisplayHint => "invalid recovery display hint",
            Self::ContentTooLarge => "recovery content exceeds its bound",
            Self::InvalidSessionRevision => "invalid recovery session revision",
            Self::InvalidTimestampOrder => "invalid recovery timestamp order",
            Self::TimestampOverflow => "recovery timestamp overflow",
            Self::LifetimeTooLong => "recovery lifetime exceeds its bound",
            Self::FutureTimestamp => "recovery timestamp is in the future",
            Self::Expired => "recovery record has expired",
            Self::InvalidHash => "invalid recovery hash",
            Self::ChecksumMismatch => "recovery checksum mismatch",
        })
    }
}

impl std::error::Error for RecoveryValidationError {}

/// Safe status exposed by a native recovery inventory.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecoveryInventoryStatus {
    Available,
    Expired,
    Corrupted,
    Unsupported,
    CoverageAtRisk,
}

/// Bounded, content-free projection of one committed recovery record.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct RecoveryInventoryEntry {
    pub record_id: String,
    pub display_hint: String,
    pub updated_unix_ms: u64,
    pub expires_unix_ms: u64,
    pub committed_bytes: u64,
    pub status: RecoveryInventoryStatus,
}

/// Reason a dirty buffer is eligible for another recovery snapshot.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SnapshotDueReason {
    Idle,
    MaximumInterval,
}

/// Monotonic scheduling state for one dirty editable buffer.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RecoverySnapshotSchedule {
    dirty_since: u64,
    last_edit: u64,
    last_snapshot: Option<u64>,
}

impl RecoverySnapshotSchedule {
    /// Starts recovery scheduling when a buffer first becomes dirty.
    pub const fn dirty_at(now_ms: u64) -> Self {
        Self {
            dirty_since: now_ms,
            last_edit: now_ms,
            last_snapshot: None,
        }
    }

    /// Records an edit without allowing a backward clock sample to postpone recovery.
    pub fn edited_at(&mut self, now_ms: u64) {
        self.last_edit = self.last_edit.max(now_ms);
    }

    /// Records a successful snapshot without allowing a backward clock sample to alter the schedule.
    pub fn snapshot_succeeded_at(&mut self, now_ms: u64) {
        self.last_snapshot = Some(self.last_snapshot.unwrap_or(self.dirty_since).max(now_ms));
    }

    /// Returns why a snapshot is due, using elapsed monotonic time and saturating thresholds.
    pub fn due_reason(&self, now_ms: u64) -> Option<SnapshotDueReason> {
        let interval_base = self.last_snapshot.unwrap_or(self.dirty_since);
        if elapsed_at_least(now_ms, interval_base, RECOVERY_MAX_INTERVAL_MS) {
            return Some(SnapshotDueReason::MaximumInterval);
        }
        elapsed_at_least(now_ms, self.last_edit, RECOVERY_IDLE_INTERVAL_MS)
            .then_some(SnapshotDueReason::Idle)
    }

    /// Returns the earliest due time without overflowing the monotonic counter.
    pub fn next_due_ms(&self) -> u64 {
        let idle_due = self.last_edit.saturating_add(RECOVERY_IDLE_INTERVAL_MS);
        let interval_due = self
            .last_snapshot
            .unwrap_or(self.dirty_since)
            .saturating_add(RECOVERY_MAX_INTERVAL_MS);
        idle_due.min(interval_due)
    }
}

/// Returns domain-separated checksum evidence for recovery content.
pub fn recovery_content_hash(content: &[u8]) -> String {
    domain_hash(CONTENT_HASH_DOMAIN, content)
}

/// Returns domain-separated equality evidence for a native source identity.
pub fn recovery_source_hash(evidence: &[u8]) -> String {
    domain_hash(SOURCE_HASH_DOMAIN, evidence)
}

/// Returns domain-separated equality evidence for an external revision.
pub fn recovery_revision_hash(evidence: &[u8]) -> String {
    domain_hash(REVISION_HASH_DOMAIN, evidence)
}

fn domain_hash(domain: &[u8], evidence: &[u8]) -> String {
    let mut digest = Sha256::new();
    digest.update(domain);
    digest.update(evidence);
    format!("{:x}", digest.finalize())
}

fn sanitize_display_hint(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|character| {
            if character.is_control() {
                ' '
            } else {
                character
            }
        })
        .collect();
    let trimmed = sanitized.trim();
    if trimmed.is_empty() {
        "Recovered document".into()
    } else {
        trimmed
            .chars()
            .take(MAX_RECOVERY_DISPLAY_HINT_CHARS)
            .collect()
    }
}

fn is_lowercase_uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| match index {
            8 | 13 | 18 | 23 => byte == b'-',
            _ => byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte),
        })
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn elapsed_at_least(now_ms: u64, since_ms: u64, interval_ms: u64) -> bool {
    now_ms
        .checked_sub(since_ms)
        .is_some_and(|elapsed| elapsed >= interval_ms)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detection::{BomIntent, NewlinePattern, Presence, TextEncoding, UndecodableBytes};

    const RECORD_ID: &str = "4c0e9425-8088-48e5-929b-654a28f9c5e4";
    const NOW: u64 = 1_788_044_400_000;

    fn profile() -> TextProfile {
        TextProfile {
            encoding: TextEncoding::Utf8,
            bom: BomIntent::Absent,
            newlines: NewlinePattern::Lf,
            terminal_newline: Presence::Present,
            undecodable_bytes: UndecodableBytes::None,
        }
    }

    fn record(content: &str) -> RecoveryRecord {
        RecoveryRecord::new(RecoveryRecordInput {
            record_id: RECORD_ID.into(),
            display_hint: "notes.md".into(),
            source_identity_evidence: b"private/native/source",
            base_revision_evidence: b"private/native/revision",
            saved_session_revision: 4,
            snapshot_session_revision: 5,
            text_profile: profile(),
            created_unix_ms: NOW - 1_000,
            updated_unix_ms: NOW,
            content: content.into(),
            eviction_eligible: false,
        })
        .expect("valid recovery record")
    }

    #[test]
    fn construction_hashes_authority_and_bounds_display_context() {
        let result = RecoveryRecord::new(RecoveryRecordInput {
            record_id: RECORD_ID.into(),
            display_hint: format!("  secret\n{}", "x".repeat(300)),
            source_identity_evidence: b"private/native/source",
            base_revision_evidence: b"private/native/revision",
            saved_session_revision: 7,
            snapshot_session_revision: 8,
            text_profile: profile(),
            created_unix_ms: NOW,
            updated_unix_ms: NOW,
            content: "private content".into(),
            eviction_eligible: false,
        })
        .expect("construct record");

        assert_eq!(result.schema_version, RECOVERY_SCHEMA_VERSION);
        assert_eq!(result.display_hint.chars().count(), 255);
        assert!(!result.display_hint.contains('\n'));
        assert_eq!(result.source_identity_hash.len(), 64);
        assert_eq!(result.base_revision_hash.len(), 64);
        assert_eq!(result.expires_unix_ms, NOW + MAX_RECOVERY_LIFETIME_MS);
        let serialized = serde_json::to_string(&result).expect("serialize record");
        assert!(!serialized.contains("private/native/source"));
        assert!(!serialized.contains("private/native/revision"));
    }

    #[test]
    fn hashes_are_deterministic_and_domain_separated() {
        let evidence = b"same evidence";
        assert_eq!(
            recovery_content_hash(evidence),
            recovery_content_hash(evidence)
        );
        assert_ne!(
            recovery_content_hash(evidence),
            recovery_source_hash(evidence)
        );
        assert_ne!(
            recovery_source_hash(evidence),
            recovery_revision_hash(evidence)
        );
        assert_ne!(
            recovery_content_hash(evidence),
            recovery_content_hash(b"changed")
        );
    }

    #[test]
    fn validation_detects_corruption_without_disclosing_content() {
        let mut candidate = record("uniquely secret recovery text");
        candidate.content.push('!');
        let error = candidate
            .validate_at(NOW + 1)
            .expect_err("checksum mismatch");
        assert_eq!(error, RecoveryValidationError::ChecksumMismatch);
        assert!(!error.to_string().contains("uniquely secret"));
        let debug = format!("{candidate:?}");
        assert!(!debug.contains("uniquely secret"));
        assert!(!debug.contains(&candidate.content_sha256));
        assert!(!debug.contains(RECORD_ID));
    }

    #[test]
    fn content_bound_is_exact_and_measured_as_utf8_bytes() {
        assert!(
            record(&"x".repeat(MAX_RECOVERY_CONTENT_BYTES))
                .validate_at(NOW + 1)
                .is_ok()
        );
        let error = RecoveryRecord::new(RecoveryRecordInput {
            record_id: RECORD_ID.into(),
            display_hint: "large".into(),
            source_identity_evidence: b"source",
            base_revision_evidence: b"revision",
            saved_session_revision: 1,
            snapshot_session_revision: 2,
            text_profile: profile(),
            created_unix_ms: NOW,
            updated_unix_ms: NOW,
            content: format!("{}é", "x".repeat(MAX_RECOVERY_CONTENT_BYTES - 1)),
            eviction_eligible: false,
        })
        .expect_err("UTF-8 byte bound");
        assert_eq!(error, RecoveryValidationError::ContentTooLarge);
    }

    #[test]
    fn validation_enforces_timestamps_lifetime_and_expiry() {
        let valid = record("content");
        assert_eq!(valid.validate_at(NOW), Ok(()));
        assert_eq!(
            valid.validate_at(valid.expires_unix_ms),
            Err(RecoveryValidationError::Expired)
        );

        let mut future = valid.clone();
        future.created_unix_ms = NOW + 1;
        future.updated_unix_ms = NOW + 1;
        assert_eq!(
            future.validate_at(NOW),
            Err(RecoveryValidationError::FutureTimestamp)
        );

        let mut excessive = valid;
        excessive.expires_unix_ms += 1;
        assert_eq!(
            excessive.validate_at(NOW),
            Err(RecoveryValidationError::LifetimeTooLong)
        );
    }

    #[test]
    fn construction_rejects_timestamp_overflow_and_non_dirty_revision() {
        let input = |updated_unix_ms, saved_session_revision, snapshot_session_revision| {
            RecoveryRecordInput {
                record_id: RECORD_ID.into(),
                display_hint: "notes".into(),
                source_identity_evidence: b"source",
                base_revision_evidence: b"revision",
                saved_session_revision,
                snapshot_session_revision,
                text_profile: profile(),
                created_unix_ms: updated_unix_ms,
                updated_unix_ms,
                content: "content".into(),
                eviction_eligible: false,
            }
        };
        assert_eq!(
            RecoveryRecord::new(input(u64::MAX, 1, 2)).expect_err("overflow"),
            RecoveryValidationError::TimestampOverflow
        );
        assert_eq!(
            RecoveryRecord::new(input(NOW, 2, 2)).expect_err("not dirty"),
            RecoveryValidationError::InvalidSessionRevision
        );
    }

    #[test]
    fn scheduling_honors_idle_and_maximum_intervals() {
        let mut schedule = RecoverySnapshotSchedule::dirty_at(100);
        assert_eq!(schedule.due_reason(2_099), None);
        assert_eq!(schedule.due_reason(2_100), Some(SnapshotDueReason::Idle));

        schedule.edited_at(29_000);
        assert_eq!(schedule.due_reason(30_099), None);
        assert_eq!(
            schedule.due_reason(30_100),
            Some(SnapshotDueReason::MaximumInterval)
        );
        schedule.snapshot_succeeded_at(30_100);
        schedule.edited_at(31_000);
        assert_eq!(schedule.due_reason(32_999), None);
        assert_eq!(schedule.due_reason(33_000), Some(SnapshotDueReason::Idle));
    }

    #[test]
    fn scheduling_is_defensive_about_clock_rollback_and_overflow() {
        let mut schedule = RecoverySnapshotSchedule::dirty_at(10_000);
        schedule.edited_at(11_000);
        schedule.edited_at(9_000);
        assert_eq!(schedule.due_reason(9_500), None);
        assert_eq!(schedule.due_reason(13_000), Some(SnapshotDueReason::Idle));

        let near_limit = RecoverySnapshotSchedule::dirty_at(u64::MAX - 1);
        assert_eq!(near_limit.next_due_ms(), u64::MAX);
        assert_eq!(near_limit.due_reason(u64::MAX), None);
    }

    #[test]
    fn malformed_identifiers_and_hashes_are_rejected() {
        let mut candidate = record("content");
        candidate.record_id = RECORD_ID.to_uppercase();
        assert_eq!(
            candidate.validate_at(NOW),
            Err(RecoveryValidationError::InvalidRecordId)
        );
        candidate.record_id = RECORD_ID.into();
        candidate.source_identity_hash = "not-a-hash".into();
        assert_eq!(
            candidate.validate_at(NOW),
            Err(RecoveryValidationError::InvalidHash)
        );
    }
}
