//! Portable contracts for bounded desktop source operations.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::contracts::{DocumentIdentity, SourceDescriptor};

/// Largest byte range or stream chunk accepted by one host operation.
pub const MAX_SOURCE_CHUNK_BYTES: u64 = 1024 * 1024;

/// Largest in-memory save payload accepted by the initial desktop host.
pub const MAX_SAVE_BYTES: u64 = 16 * 1024 * 1024;

/// Opaque process-local authorization for one acquired source.
#[derive(Clone, Debug, Eq, Hash, JsonSchema, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SourceId(pub String);

/// Opaque authorization for one bounded stream.
#[derive(Clone, Debug, Eq, Hash, JsonSchema, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(transparent)]
pub struct StreamId(pub String);

/// Opaque proof that native interface code observed an explicit user action.
#[derive(Clone, Debug, Eq, Hash, JsonSchema, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(transparent)]
pub struct UserActivationId(pub String);

/// One-use authorization for a validated external link.
#[derive(Clone, Debug, Eq, Hash, JsonSchema, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(transparent)]
pub struct LinkAuthorizationId(pub String);

/// Comparable host facts observed for one source version.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct ExternalRevision {
    pub identity: DocumentIdentity,
    pub byte_length: u64,
    pub modified_unix_nanos: Option<u64>,
    pub change_token: Option<String>,
}

/// Safe result returned from trusted desktop acquisition.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct DesktopSourceSummary {
    pub source_id: SourceId,
    pub descriptor: SourceDescriptor,
    pub external_revision: ExternalRevision,
}

/// Stable source availability and observation state.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceState {
    Available,
    Changed,
    Renamed,
    Deleted,
    PermissionRevoked,
    WatcherOverflow,
    Unavailable,
    Closed,
}

impl SourceState {
    /// Returns whether the state invalidates the last observed revision.
    pub const fn requires_revalidation(self) -> bool {
        matches!(
            self,
            Self::Changed | Self::Renamed | Self::WatcherOverflow | Self::Unavailable
        )
    }
}

/// One ordered, path-free source observation.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct SourceEvent {
    pub source_id: SourceId,
    pub sequence: u64,
    pub state: SourceState,
    pub display_name: Option<String>,
    pub revalidation_required: bool,
}

/// Classification returned by authoritative revalidation.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RevalidationStatus {
    Match,
    Changed,
    Deleted,
    PermissionRevoked,
    Unavailable,
}

/// Revalidation result that never treats I/O failure as equality.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct RevalidationResult {
    pub source_id: SourceId,
    pub expected: ExternalRevision,
    pub current: Option<ExternalRevision>,
    pub status: RevalidationStatus,
}

/// Safe metadata facts available to interface code.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct SourceMetadata {
    pub display_name: String,
    pub byte_length: u64,
    pub modified_unix_nanos: Option<u64>,
    pub read_only: bool,
}

/// Result of one bounded random-access read.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct ReadRangeResult {
    pub source_id: SourceId,
    pub offset: u64,
    pub bytes: Vec<u8>,
    pub end_of_source: bool,
}

/// Public facts for one bounded stream lease.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct StreamLease {
    pub stream_id: StreamId,
    pub source_id: SourceId,
    pub offset: u64,
    pub total_budget: u64,
    pub consumed: u64,
    pub external_revision: ExternalRevision,
}

/// Durability actually supplied by a completed save.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DurabilityGuarantee {
    AtomicFileAndDirectory,
    AtomicFile,
    RecoverableNonAtomic,
}

impl DurabilityGuarantee {
    /// Returns whether this guarantee requires advance user acknowledgement.
    pub const fn requires_acknowledgement(self) -> bool {
        matches!(self, Self::RecoverableNonAtomic)
    }
}

/// Explicit acknowledgement of one classified weaker save.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct DurabilityAcknowledgement {
    pub source_id: SourceId,
    pub expected_external_revision: ExternalRevision,
    pub guarantee: DurabilityGuarantee,
}

/// Save input after session policy has selected its current revision.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct SaveRequest {
    pub source_id: SourceId,
    pub expected_external_revision: ExternalRevision,
    pub expected_session_revision: u64,
    pub bytes: Vec<u8>,
    pub durability_acknowledgement: Option<DurabilityAcknowledgement>,
}

/// Durable evidence returned only after replacement succeeds.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct SaveReceipt {
    pub source_id: SourceId,
    pub accepted_session_revision: u64,
    pub previous_external_revision: ExternalRevision,
    pub new_external_revision: ExternalRevision,
    pub byte_count: u64,
    pub durability: DurabilityGuarantee,
}

/// Native proof passed into external-link policy.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct UserActivationProof {
    pub id: UserActivationId,
}

/// One-use permission for one normalized external target.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct LinkAuthorization {
    pub id: LinkAuthorizationId,
    pub normalized_target: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contracts::{IdentityAuthority, IdentityStrength};

    fn revision(token: &str, length: u64) -> ExternalRevision {
        ExternalRevision {
            identity: DocumentIdentity {
                authority: IdentityAuthority::Filesystem,
                scope: "test-volume".into(),
                token: token.into(),
                strength: IdentityStrength::Strong,
            },
            byte_length: length,
            modified_unix_nanos: Some(42),
            change_token: None,
        }
    }

    #[test]
    fn revision_equality_requires_every_observed_fact() {
        let original = revision("file-a", 12);
        assert_eq!(original, original.clone());
        assert_ne!(original, revision("file-a", 13));
        assert_ne!(original, revision("file-b", 12));
    }

    #[test]
    fn only_recoverable_non_atomic_save_requires_acknowledgement() {
        assert!(!DurabilityGuarantee::AtomicFileAndDirectory.requires_acknowledgement());
        assert!(!DurabilityGuarantee::AtomicFile.requires_acknowledgement());
        assert!(DurabilityGuarantee::RecoverableNonAtomic.requires_acknowledgement());
    }

    #[test]
    fn source_states_expose_revision_uncertainty() {
        assert!(SourceState::Changed.requires_revalidation());
        assert!(SourceState::Renamed.requires_revalidation());
        assert!(SourceState::WatcherOverflow.requires_revalidation());
        assert!(SourceState::Unavailable.requires_revalidation());
        assert!(!SourceState::Deleted.requires_revalidation());
        assert!(!SourceState::PermissionRevoked.requires_revalidation());
    }

    #[test]
    fn source_ids_serialize_without_native_authority() {
        let source_id = SourceId("1c437647-132b-4bed-8f6e-620893e825ce".into());
        let value = serde_json::to_value(source_id).expect("serialize source id");
        assert_eq!(value, "1c437647-132b-4bed-8f6e-620893e825ce");
    }
}
