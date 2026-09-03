//! Portable contracts for bounded desktop source operations.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::contracts::{DocumentIdentity, SourceDescriptor};

/// Largest byte range or stream chunk accepted by one host operation.
pub const MAX_SOURCE_CHUNK_BYTES: u64 = 1024 * 1024;

/// Largest in-memory save payload accepted by the initial desktop host.
pub const MAX_SAVE_BYTES: u64 = 16 * 1024 * 1024;

/// Largest source for which the host will calculate an integrity digest.
pub const MAX_INTEGRITY_SOURCE_BYTES: u64 = 256 * 1024 * 1024;

/// Maximum number of source bytes processed by one integrity advance.
pub const MAX_INTEGRITY_STEP_BYTES: u64 = MAX_SOURCE_CHUNK_BYTES;

mod optional_u64_decimal {
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    #[allow(clippy::ref_option)]
    pub fn serialize<S>(value: &Option<u64>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        value.as_ref().map(u64::to_string).serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<u64>, D::Error>
    where
        D: Deserializer<'de>,
    {
        Option::<String>::deserialize(deserializer)?
            .map(|value| value.parse().map_err(serde::de::Error::custom))
            .transpose()
    }
}

mod u64_decimal {
    use serde::{Deserialize, Deserializer, Serializer};

    #[allow(clippy::trivially_copy_pass_by_ref)]
    pub fn serialize<S>(value: &u64, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&value.to_string())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<u64, D::Error>
    where
        D: Deserializer<'de>,
    {
        String::deserialize(deserializer)?
            .parse()
            .map_err(serde::de::Error::custom)
    }
}

/// Opaque process-local authorization for one acquired source.
#[derive(
    Clone, Debug, Eq, Hash, JsonSchema, Ord, PartialEq, PartialOrd, Serialize, Deserialize,
)]
#[serde(transparent)]
pub struct SourceId(pub String);

/// Opaque authorization for one bounded stream.
#[derive(
    Clone, Debug, Eq, Hash, JsonSchema, Ord, PartialEq, PartialOrd, Serialize, Deserialize,
)]
#[serde(transparent)]
pub struct StreamId(pub String);

/// Opaque proof that native interface code observed an explicit user action.
#[derive(
    Clone, Debug, Eq, Hash, JsonSchema, Ord, PartialEq, PartialOrd, Serialize, Deserialize,
)]
#[serde(transparent)]
pub struct UserActivationId(pub String);

/// One-use authorization for a validated external link.
#[derive(
    Clone, Debug, Eq, Hash, JsonSchema, Ord, PartialEq, PartialOrd, Serialize, Deserialize,
)]
#[serde(transparent)]
pub struct LinkAuthorizationId(pub String);

/// One-use identifier binding a save request to its durable receipt.
#[derive(
    Clone, Copy, Debug, Eq, Hash, JsonSchema, Ord, PartialEq, PartialOrd, Serialize, Deserialize,
)]
#[serde(transparent)]
pub struct SaveOperationId(
    #[schemars(with = "String")]
    #[serde(with = "u64_decimal")]
    pub u64,
);

/// Comparable host facts observed for one source version.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct ExternalRevision {
    pub identity: DocumentIdentity,
    pub byte_length: Option<u64>,
    #[schemars(with = "Option<String>")]
    #[serde(with = "optional_u64_decimal")]
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

/// Derives a path-free stable UUID used to match a source delivered again by its native owner.
#[must_use]
pub fn opaque_restoration_reference(identity: &DocumentIdentity) -> Option<String> {
    if identity.strength != crate::contracts::IdentityStrength::Strong {
        return None;
    }
    let authority = match identity.authority {
        crate::contracts::IdentityAuthority::Filesystem => b"filesystem".as_slice(),
        crate::contracts::IdentityAuthority::AndroidDocument => b"android_document".as_slice(),
        crate::contracts::IdentityAuthority::Synthetic => b"synthetic".as_slice(),
        crate::contracts::IdentityAuthority::Unknown => b"unknown".as_slice(),
    };
    let mut hasher = Sha256::new();
    hasher.update(b"glitchpad-restoration-reference-v1");
    for value in [
        authority,
        identity.scope.as_bytes(),
        identity.token.as_bytes(),
    ] {
        let value_length = u64::try_from(value.len()).ok()?;
        hasher.update(value_length.to_le_bytes());
        hasher.update(value);
    }
    let digest = hasher.finalize();
    let mut bytes = [0_u8; 16];
    bytes.copy_from_slice(&digest[..16]);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    Some(format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0],
        bytes[1],
        bytes[2],
        bytes[3],
        bytes[4],
        bytes[5],
        bytes[6],
        bytes[7],
        bytes[8],
        bytes[9],
        bytes[10],
        bytes[11],
        bytes[12],
        bytes[13],
        bytes[14],
        bytes[15]
    ))
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
    pub byte_length: Option<u64>,
    #[schemars(with = "Option<String>")]
    #[serde(with = "optional_u64_decimal")]
    pub modified_unix_nanos: Option<u64>,
    pub read_only: bool,
}

/// Safe write authority shown by the metadata inspector.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceWriteState {
    Writable,
    ReadOnly,
    SaveAsOnly,
    Unavailable,
}

/// Path-free native metadata observation tied to one external revision.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct SourceMetadataSnapshot {
    pub source_id: SourceId,
    pub external_revision: ExternalRevision,
    pub display_name: String,
    pub source_kind: crate::contracts::SourceKind,
    #[schemars(with = "Option<String>")]
    #[serde(with = "optional_u64_decimal")]
    pub byte_length: Option<u64>,
    #[schemars(with = "Option<String>")]
    #[serde(with = "optional_u64_decimal")]
    pub modified_unix_nanos: Option<u64>,
    #[schemars(with = "Option<String>")]
    #[serde(with = "optional_u64_decimal")]
    pub created_unix_nanos: Option<u64>,
    #[schemars(with = "Option<String>")]
    #[serde(with = "optional_u64_decimal")]
    pub accessed_unix_nanos: Option<u64>,
    pub write_state: SourceWriteState,
    pub identity_confidence: crate::contracts::IdentityStrength,
}

/// Unguessable caller-supplied identifier for one integrity operation.
#[derive(
    Clone, Debug, Eq, Hash, JsonSchema, Ord, PartialEq, PartialOrd, Serialize, Deserialize,
)]
#[serde(transparent)]
pub struct IntegrityRequestId(pub String);

/// Starts SHA-256 work only for the exact expected external revision.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct IntegrityStartRequest {
    pub request_id: IntegrityRequestId,
    pub source_id: SourceId,
    pub expected_external_revision: ExternalRevision,
}

/// Public state of one bounded integrity operation.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntegrityState {
    Pending,
    Ready,
    Cancelled,
    Stale,
    Limited,
    Failed,
}

/// Bounded progress. Only `ready` may contain a digest.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct IntegrityProgress {
    pub request_id: IntegrityRequestId,
    pub source_id: SourceId,
    pub external_revision: ExternalRevision,
    #[schemars(with = "String")]
    #[serde(with = "u64_decimal")]
    pub processed_bytes: u64,
    #[schemars(with = "Option<String>")]
    #[serde(with = "optional_u64_decimal")]
    pub total_bytes: Option<u64>,
    pub state: IntegrityState,
    pub sha256: Option<String>,
    pub error_code: Option<String>,
}

/// Private incremental SHA-256 state shared by native adapters.
#[derive(Clone, Debug)]
pub struct IntegrityHasher(Sha256);

impl Default for IntegrityHasher {
    fn default() -> Self {
        Self(Sha256::new())
    }
}

impl IntegrityHasher {
    /// Adds one already-bounded source chunk.
    pub fn update(&mut self, bytes: &[u8]) {
        self.0.update(bytes);
    }

    /// Returns the lowercase SHA-256 digest.
    pub fn finalize(self) -> String {
        format!("{:x}", self.0.finalize())
    }
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

/// Explicit second confirmation for overwriting one reviewed external revision.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct OverwriteAuthorization {
    pub source_id: SourceId,
    pub reviewed_external_revision: ExternalRevision,
    pub session_revision: u64,
    pub durability: DurabilityGuarantee,
}

/// Save input after session policy has selected its current revision.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct SaveRequest {
    pub operation_id: SaveOperationId,
    pub source_id: SourceId,
    pub expected_external_revision: ExternalRevision,
    pub expected_session_revision: u64,
    pub bytes: Vec<u8>,
    pub durability_acknowledgement: Option<DurabilityAcknowledgement>,
    pub overwrite_authorization: Option<OverwriteAuthorization>,
}

/// Durable evidence returned only after replacement succeeds.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct SaveReceipt {
    pub operation_id: SaveOperationId,
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

/// Android platform flow that supplied one provider-backed source.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AndroidDeliveryKind {
    View,
    Share,
    OpenResult,
    CreateResult,
}

/// Android URI authority actually held after acquisition.
#[derive(Clone, Copy, Debug, Default, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[allow(clippy::struct_excessive_bools)]
pub struct AndroidGrantState {
    pub read: bool,
    pub write: bool,
    pub persisted_read: bool,
    pub persisted_write: bool,
    pub restorable: bool,
}

/// Safe Android acquisition result with no URI or native bridge token.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct AndroidSourceSummary {
    pub source_id: SourceId,
    pub descriptor: SourceDescriptor,
    pub external_revision: ExternalRevision,
    pub delivery_kind: AndroidDeliveryKind,
    pub grant: AndroidGrantState,
}

/// Stable rejection returned while draining Android system deliveries.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct AndroidDeliveryRejection {
    pub code: String,
    pub retryable: bool,
}

/// Bounded Android delivery drain preserving accepted and rejected items.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct AndroidDeliveryDrain {
    pub sources: Vec<AndroidSourceSummary>,
    pub rejections: Vec<AndroidDeliveryRejection>,
}

/// Result of restoring one native-private Android source record.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AndroidRestorationStatus {
    Restored,
    NeedsRedelivery,
    PermissionRevoked,
    Unavailable,
}

/// Safe restoration outcome; restored sources receive new process-local IDs.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct AndroidRestorationResult {
    pub source: Option<AndroidSourceSummary>,
    pub status: AndroidRestorationStatus,
    pub display_name: Option<String>,
}

/// Complete bounded payload staged before launching Android Save As.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct AndroidSaveAsRequest {
    pub operation_id: SaveOperationId,
    pub source_id: SourceId,
    pub expected_external_revision: ExternalRevision,
    pub suggested_name: String,
    pub media_type: Option<String>,
    pub bytes: Vec<u8>,
}

/// Verified result of writing a new provider destination.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct AndroidSaveAsReceipt {
    pub operation_id: SaveOperationId,
    pub previous_source_id: SourceId,
    pub new_source: AndroidSourceSummary,
    pub byte_count: u64,
    pub durability: DurabilityGuarantee,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restoration_reference_is_stable_path_free_and_requires_strong_identity() {
        let identity = DocumentIdentity {
            authority: crate::contracts::IdentityAuthority::AndroidDocument,
            scope: "provider-scope".into(),
            token: "opaque-token".into(),
            strength: crate::contracts::IdentityStrength::Strong,
        };
        let reference = opaque_restoration_reference(&identity).expect("strong reference");
        assert_eq!(reference.len(), 36);
        assert_eq!(opaque_restoration_reference(&identity), Some(reference));
        assert_eq!(
            opaque_restoration_reference(&DocumentIdentity {
                strength: crate::contracts::IdentityStrength::Weak,
                ..identity
            }),
            None
        );
    }
    use crate::contracts::{IdentityAuthority, IdentityStrength};

    fn revision(token: &str, length: u64) -> ExternalRevision {
        ExternalRevision {
            identity: DocumentIdentity {
                authority: IdentityAuthority::Filesystem,
                scope: "test-volume".into(),
                token: token.into(),
                strength: IdentityStrength::Strong,
            },
            byte_length: Some(length),
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
    fn android_grants_do_not_infer_restoration() {
        let temporary = AndroidGrantState {
            read: true,
            ..AndroidGrantState::default()
        };
        assert!(!temporary.restorable);
        assert!(!temporary.persisted_read);
    }

    #[test]
    fn provider_revision_preserves_unknown_length() {
        let mut provider = revision("document", 12);
        provider.byte_length = None;
        let encoded = serde_json::to_value(&provider).expect("serialize provider revision");
        assert!(encoded["byte_length"].is_null());
        let decoded: ExternalRevision =
            serde_json::from_value(encoded).expect("deserialize provider revision");
        assert_eq!(decoded.byte_length, None);
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

    #[test]
    fn revision_nanoseconds_round_trip_as_lossless_decimal_strings() {
        let mut original = revision("file-a", 12);
        original.modified_unix_nanos = Some(1_788_044_400_000_000_123);
        let value = serde_json::to_value(&original).expect("serialize revision");
        assert_eq!(value["modified_unix_nanos"], "1788044400000000123");
        let decoded: ExternalRevision =
            serde_json::from_value(value).expect("deserialize revision");
        assert_eq!(decoded, original);
    }

    #[test]
    fn save_operation_ids_round_trip_as_lossless_decimal_strings() {
        let original = SaveOperationId(u64::MAX);
        let value = serde_json::to_value(original).expect("serialize operation id");
        assert_eq!(value, u64::MAX.to_string());
        let decoded: SaveOperationId =
            serde_json::from_value(value).expect("deserialize operation id");
        assert_eq!(decoded, original);
    }
}
