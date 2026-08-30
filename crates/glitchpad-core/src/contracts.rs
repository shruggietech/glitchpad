//! Portable document, renderer, and error contracts.

use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Current native-to-interface contract version.
pub const CONTRACT_VERSION: u16 = 1;

/// Versioned wire envelope for every top-level contract payload.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct ContractEnvelope<T> {
    /// Wire contract version interpreted before the payload.
    pub contract_version: u16,
    /// Version-specific payload.
    pub payload: T,
}

impl<T> ContractEnvelope<T> {
    /// Wraps a payload in the current wire contract version.
    pub const fn current(payload: T) -> Self {
        Self {
            contract_version: CONTRACT_VERSION,
            payload,
        }
    }
}

/// Authority that issued an opaque document identity.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IdentityAuthority {
    /// Desktop filesystem identity.
    Filesystem,
    /// Android Storage Access Framework document identity.
    AndroidDocument,
    /// In-memory or fixture identity.
    Synthetic,
    /// Authority unavailable to the caller.
    Unknown,
}

/// Strength of identity evidence.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IdentityStrength {
    /// Authority guarantees token stability within the declared scope.
    Strong,
    /// Token is useful for display or hints but cannot prove equality.
    Weak,
    /// No usable identity token exists.
    Unavailable,
}

/// Platform-independent document identity.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct DocumentIdentity {
    /// Identity issuer.
    pub authority: IdentityAuthority,
    /// Issuer-defined comparison domain.
    pub scope: String,
    /// Opaque issuer-defined token.
    pub token: String,
    /// Strength of the evidence represented by the token.
    pub strength: IdentityStrength,
}

/// Three-valued identity comparison result.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IdentityMatch {
    /// Comparable strong identities have equal tokens.
    Same,
    /// Comparable strong identities have different tokens.
    Different,
    /// The identities cannot safely prove sameness or difference.
    Uncertain,
}

/// Compares only identities whose strong authority and scope semantics agree.
pub fn compare_identity(left: &DocumentIdentity, right: &DocumentIdentity) -> IdentityMatch {
    if left.strength != IdentityStrength::Strong || right.strength != IdentityStrength::Strong {
        return IdentityMatch::Uncertain;
    }

    if left.authority != right.authority
        || left.authority == IdentityAuthority::Unknown
        || left.scope != right.scope
    {
        return IdentityMatch::Uncertain;
    }

    if left.token == right.token {
        IdentityMatch::Same
    } else {
        IdentityMatch::Different
    }
}

/// Host representation for a source without assuming path semantics.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceKind {
    /// Desktop-like filesystem source.
    File,
    /// Provider or document URI source.
    DocumentUri,
    /// In-memory source used by fixtures or generated content.
    Memory,
}

/// Independently advertised source operations.
#[allow(clippy::struct_excessive_bools)]
#[derive(Clone, Copy, Debug, Default, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct SourceCapabilities {
    pub read: bool,
    pub seek: bool,
    pub stream: bool,
    pub metadata: bool,
    pub observe_revision: bool,
    pub revalidate: bool,
    pub write: bool,
    pub replace_atomically: bool,
    pub reopen: bool,
    pub reveal_location: bool,
}

/// Safe host facts and operations for one document source.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct SourceDescriptor {
    pub identity: DocumentIdentity,
    pub display_name: String,
    pub claimed_media_type: Option<String>,
    pub byte_length: Option<u64>,
    pub modified_unix_ms: Option<i64>,
    pub kind: SourceKind,
    pub capabilities: SourceCapabilities,
}

/// Independently advertised renderer operations.
#[allow(clippy::struct_excessive_bools)]
#[derive(Clone, Copy, Debug, Default, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct RendererCapabilities {
    pub view: bool,
    pub edit: bool,
    pub navigate: bool,
    pub search: bool,
    pub zoom: bool,
    pub copy: bool,
    pub save: bool,
    pub inspect_metadata: bool,
}

/// Renderer identity and supported operations.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct RendererDescriptor {
    pub id: String,
    pub label: String,
    pub capabilities: RendererCapabilities,
}

/// Stable core error category.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CoreErrorCategory {
    InvalidInput,
    UnsupportedInput,
    ResourceLimit,
    CapabilityDenied,
    StaleSession,
    NotFound,
    Conflict,
    InternalInvariant,
}

/// Safe error contract that never carries source bytes or unrestricted native errors.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct CoreError {
    pub category: CoreErrorCategory,
    pub summary: String,
    pub retryable: bool,
    pub recoverable: bool,
    pub context: BTreeMap<String, String>,
}

impl CoreError {
    /// Creates a safe error without diagnostic context.
    pub fn new(
        category: CoreErrorCategory,
        summary: impl Into<String>,
        retryable: bool,
        recoverable: bool,
    ) -> Self {
        Self {
            category,
            summary: truncate(summary.into(), 256),
            retryable,
            recoverable,
            context: BTreeMap::new(),
        }
    }

    /// Adds a bounded safe diagnostic fact.
    #[must_use]
    pub fn with_context(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        let key = truncate(key.into(), 64);
        if !matches!(key.as_str(), "content" | "source_bytes" | "native_error")
            && self.context.len() < 16
        {
            self.context.insert(key, truncate(value.into(), 256));
        }
        self
    }
}

fn truncate(mut value: String, max_chars: usize) -> String {
    if let Some((byte_index, _)) = value.char_indices().nth(max_chars) {
        value.truncate(byte_index);
    }
    value
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identity(strength: IdentityStrength, token: &str) -> DocumentIdentity {
        DocumentIdentity {
            authority: IdentityAuthority::Filesystem,
            scope: "volume-a".into(),
            token: token.into(),
            strength,
        }
    }

    #[test]
    fn only_comparable_strong_identity_proves_a_match() {
        assert_eq!(
            compare_identity(
                &identity(IdentityStrength::Strong, "42"),
                &identity(IdentityStrength::Strong, "42")
            ),
            IdentityMatch::Same
        );
        assert_eq!(
            compare_identity(
                &identity(IdentityStrength::Strong, "42"),
                &identity(IdentityStrength::Strong, "43")
            ),
            IdentityMatch::Different
        );
        assert_eq!(
            compare_identity(
                &identity(IdentityStrength::Weak, "42"),
                &identity(IdentityStrength::Weak, "42")
            ),
            IdentityMatch::Uncertain
        );
    }

    #[test]
    fn capabilities_are_independent_on_the_wire() {
        let capabilities = SourceCapabilities {
            read: true,
            metadata: true,
            ..SourceCapabilities::default()
        };
        let value = serde_json::to_value(capabilities).expect("serialize capabilities");

        assert_eq!(value["read"], true);
        assert_eq!(value["metadata"], true);
        assert_eq!(value["write"], false);
        assert_eq!(value["seek"], false);
    }

    #[test]
    fn error_context_rejects_content_and_bounds_safe_values() {
        let error = CoreError::new(CoreErrorCategory::InvalidInput, "Bad source", false, true)
            .with_context("content", "secret document")
            .with_context("source_bytes", "secret bytes")
            .with_context("display_name", "x".repeat(300));

        assert!(!error.context.contains_key("content"));
        assert!(!error.context.contains_key("source_bytes"));
        assert_eq!(error.context["display_name"].chars().count(), 256);
    }

    #[test]
    fn current_envelope_uses_version_one() {
        let envelope = ContractEnvelope::current("payload");
        assert_eq!(envelope.contract_version, CONTRACT_VERSION);
    }
}
