//! Bounded, typed metadata catalog contracts.

use std::collections::BTreeSet;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Maximum number of facts accepted in one metadata contribution.
pub const MAX_METADATA_FACTS: usize = 256;
/// Maximum length of a catalog key, label key, unit, provenance, or error code.
pub const MAX_METADATA_TOKEN_CHARS: usize = 64;
/// Maximum length of one textual metadata value.
pub const MAX_METADATA_VALUE_CHARS: usize = 1024;

/// Stable inspector group ordering.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetadataGroup {
    Source,
    Content,
    Embedded,
    Derived,
    Renderer,
}

/// Typed value expected by one catalog entry.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetadataValueKind {
    Text,
    Boolean,
    Integer,
    Decimal,
    TimestampUnixNanos,
}

/// One lossless metadata value. Potentially large numbers remain decimal strings on the wire.
#[derive(Clone, Debug, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum MetadataValue {
    Text(String),
    Boolean(bool),
    Integer(String),
    Decimal(String),
    TimestampUnixNanos(String),
}

impl MetadataValue {
    /// Returns the value kind used for catalog validation.
    pub const fn kind(&self) -> MetadataValueKind {
        match self {
            Self::Text(_) => MetadataValueKind::Text,
            Self::Boolean(_) => MetadataValueKind::Boolean,
            Self::Integer(_) => MetadataValueKind::Integer,
            Self::Decimal(_) => MetadataValueKind::Decimal,
            Self::TimestampUnixNanos(_) => MetadataValueKind::TimestampUnixNanos,
        }
    }

    fn is_bounded_and_valid(&self) -> bool {
        match self {
            Self::Text(value) => value.chars().count() <= MAX_METADATA_VALUE_CHARS,
            Self::Boolean(_) => true,
            Self::Integer(value) | Self::TimestampUnixNanos(value) => valid_unsigned_decimal(value),
            Self::Decimal(value) => valid_decimal(value),
        }
    }
}

/// Availability is explicit and non-available facts never carry hidden values.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetadataAvailability {
    Available,
    NotProvided,
    Unsupported,
    Redacted,
    Pending,
    Errored,
}

/// Data-release classification owned by the catalog.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetadataSensitivity {
    Public,
    Sensitive,
    Protected,
}

/// Clipboard policy owned by the catalog.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MetadataCopyPolicy {
    Direct,
    ExplicitConfirmation,
    Denied,
}

/// Immutable policy for one known metadata key.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct MetadataCatalogEntry {
    pub key: String,
    pub group: MetadataGroup,
    pub value_kind: MetadataValueKind,
    pub label_key: String,
    pub sensitivity: MetadataSensitivity,
    pub copy_policy: MetadataCopyPolicy,
}

/// One producer observation before presentation formatting.
#[derive(Clone, Debug, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct MetadataFact {
    pub key: String,
    pub availability: MetadataAvailability,
    pub value: Option<MetadataValue>,
    pub unit: Option<String>,
    pub provenance: String,
    pub error_code: Option<String>,
    pub external_revision: Option<String>,
    pub session_revision: Option<u64>,
    pub renderer_revision: Option<u64>,
}

/// Stable validation failure with no rejected value attached.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MetadataValidationError {
    TooManyCatalogEntries,
    TooManyFacts,
    InvalidCatalogEntry,
    DuplicateKey,
    UnknownKey,
    InvalidFact,
    ValueKindMismatch,
}

/// Validates catalog policy and an atomic producer contribution.
///
/// # Errors
///
/// Returns a stable validation category when either the catalog or any fact is invalid. The
/// contribution must be rejected as a whole.
pub fn validate_metadata_facts(
    catalog: &[MetadataCatalogEntry],
    facts: &[MetadataFact],
) -> Result<(), MetadataValidationError> {
    if catalog.len() > MAX_METADATA_FACTS {
        return Err(MetadataValidationError::TooManyCatalogEntries);
    }
    if facts.len() > MAX_METADATA_FACTS {
        return Err(MetadataValidationError::TooManyFacts);
    }
    let mut catalog_keys = BTreeSet::new();
    for entry in catalog {
        if !valid_key(&entry.key)
            || !valid_token(&entry.label_key)
            || matches!(entry.sensitivity, MetadataSensitivity::Sensitive)
                && entry.copy_policy == MetadataCopyPolicy::Direct
            || matches!(entry.sensitivity, MetadataSensitivity::Protected)
                && entry.copy_policy != MetadataCopyPolicy::Denied
        {
            return Err(MetadataValidationError::InvalidCatalogEntry);
        }
        if !catalog_keys.insert(entry.key.as_str()) {
            return Err(MetadataValidationError::DuplicateKey);
        }
    }

    let mut fact_keys = BTreeSet::new();
    for fact in facts {
        if !fact_keys.insert(fact.key.as_str()) {
            return Err(MetadataValidationError::DuplicateKey);
        }
        let entry = catalog
            .iter()
            .find(|entry| entry.key == fact.key)
            .ok_or(MetadataValidationError::UnknownKey)?;
        if !valid_fact(fact) {
            return Err(MetadataValidationError::InvalidFact);
        }
        if fact
            .value
            .as_ref()
            .is_some_and(|value| value.kind() != entry.value_kind)
        {
            return Err(MetadataValidationError::ValueKindMismatch);
        }
    }
    Ok(())
}

fn valid_fact(fact: &MetadataFact) -> bool {
    if !valid_key(&fact.key)
        || !valid_token(&fact.provenance)
        || fact.unit.as_ref().is_some_and(|unit| !valid_token(unit))
        || fact
            .external_revision
            .as_ref()
            .is_some_and(|revision| !valid_token(revision))
        || fact
            .value
            .as_ref()
            .is_some_and(|value| !value.is_bounded_and_valid())
        || fact
            .error_code
            .as_ref()
            .is_some_and(|code| !valid_token(code))
    {
        return false;
    }
    match fact.availability {
        MetadataAvailability::Available => fact.value.is_some() && fact.error_code.is_none(),
        MetadataAvailability::Errored => fact.value.is_none() && fact.error_code.is_some(),
        _ => fact.value.is_none() && fact.error_code.is_none(),
    }
}

fn valid_key(value: &str) -> bool {
    valid_token(value)
        && value.contains('.')
        && value.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'.' | b'_')
        })
}

fn valid_token(value: &str) -> bool {
    !value.is_empty()
        && value.chars().count() <= MAX_METADATA_TOKEN_CHARS
        && !value.chars().any(char::is_control)
}

fn valid_unsigned_decimal(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 20
        && value.bytes().all(|byte| byte.is_ascii_digit())
        && (value == "0" || !value.starts_with('0'))
}

fn valid_decimal(value: &str) -> bool {
    if value.is_empty() || value.len() > 64 || value.starts_with('+') {
        return false;
    }
    let unsigned = value.strip_prefix('-').unwrap_or(value);
    let mut pieces = unsigned.split('.');
    let whole = pieces.next().unwrap_or_default();
    let fraction = pieces.next();
    pieces.next().is_none()
        && !whole.is_empty()
        && whole.bytes().all(|byte| byte.is_ascii_digit())
        && fraction
            .is_none_or(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry() -> MetadataCatalogEntry {
        MetadataCatalogEntry {
            key: "host.byte_length".into(),
            group: MetadataGroup::Source,
            value_kind: MetadataValueKind::Integer,
            label_key: "metadata.byte_length".into(),
            sensitivity: MetadataSensitivity::Public,
            copy_policy: MetadataCopyPolicy::Direct,
        }
    }

    fn fact() -> MetadataFact {
        MetadataFact {
            key: "host.byte_length".into(),
            availability: MetadataAvailability::Available,
            value: Some(MetadataValue::Integer("42".into())),
            unit: Some("bytes".into()),
            provenance: "desktop_filesystem".into(),
            error_code: None,
            external_revision: Some("revision_1".into()),
            session_revision: None,
            renderer_revision: None,
        }
    }

    #[test]
    fn contribution_is_atomic_and_typed() {
        assert_eq!(validate_metadata_facts(&[entry()], &[fact()]), Ok(()));
        let mut wrong = fact();
        wrong.value = Some(MetadataValue::Text("42".into()));
        assert_eq!(
            validate_metadata_facts(&[entry()], &[wrong]),
            Err(MetadataValidationError::ValueKindMismatch)
        );
    }

    #[test]
    fn unavailable_and_errored_facts_cannot_hide_values() {
        let mut unavailable = fact();
        unavailable.availability = MetadataAvailability::Unsupported;
        assert_eq!(
            validate_metadata_facts(&[entry()], &[unavailable]),
            Err(MetadataValidationError::InvalidFact)
        );
        let mut errored = fact();
        errored.availability = MetadataAvailability::Errored;
        errored.value = None;
        errored.error_code = Some("provider_unavailable".into());
        assert_eq!(validate_metadata_facts(&[entry()], &[errored]), Ok(()));
    }

    #[test]
    fn protected_catalog_values_are_never_copyable() {
        let mut protected = entry();
        protected.sensitivity = MetadataSensitivity::Protected;
        assert_eq!(
            validate_metadata_facts(&[protected.clone()], &[]),
            Err(MetadataValidationError::InvalidCatalogEntry)
        );
        protected.copy_policy = MetadataCopyPolicy::Denied;
        assert_eq!(validate_metadata_facts(&[protected], &[]), Ok(()));
    }
}
