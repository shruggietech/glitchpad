//! Android provider-backed source policy and opaque registry.

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};

use glitchpad_android_source::models::{BridgeDelivery, DeliveryBatch};
use glitchpad_core::contracts::{
    CoreError, CoreErrorCategory, DocumentIdentity, IdentityAuthority, IdentityMatch,
    IdentityStrength, SourceCapabilities, SourceDescriptor, SourceKind, compare_identity,
};
use glitchpad_core::source::{
    AndroidDeliveryKind, AndroidGrantState, AndroidSourceSummary, ExternalRevision, SourceId,
    SourceMetadata,
};
#[cfg(target_os = "android")]
use glitchpad_core::source::{StreamId, StreamLease};
use uuid::Uuid;

#[cfg(target_os = "android")]
use glitchpad_android_source::AndroidSource;

#[cfg(target_os = "android")]
use glitchpad_core::source::{
    AndroidRestorationResult, AndroidRestorationStatus, AndroidSaveAsReceipt, AndroidSaveAsRequest,
    DurabilityGuarantee, MAX_SAVE_BYTES, MAX_SOURCE_CHUNK_BYTES, ReadRangeResult,
    RevalidationResult, RevalidationStatus,
};

#[derive(Clone)]
struct AndroidSourceRecord {
    #[cfg(target_os = "android")]
    bridge_token: String,
    summary: AndroidSourceSummary,
}

#[cfg(target_os = "android")]
#[derive(Clone)]
struct AndroidStreamRecord {
    bridge_token: String,
    lease: StreamLease,
}

#[derive(Default)]
struct Registry {
    sources: HashMap<SourceId, AndroidSourceRecord>,
    #[cfg(target_os = "android")]
    streams: HashMap<StreamId, AndroidStreamRecord>,
}

/// Shared Rust policy around the private Kotlin provider bridge.
pub struct AndroidSourceHost {
    registry: Mutex<Registry>,
    #[cfg(target_os = "android")]
    plugin: AndroidSource<tauri::Wry>,
}

impl AndroidSourceHost {
    #[cfg(target_os = "android")]
    pub fn new(plugin: AndroidSource<tauri::Wry>) -> Self {
        Self {
            registry: Mutex::new(Registry::default()),
            plugin,
        }
    }

    #[cfg(not(target_os = "android"))]
    pub fn new_for_tests() -> Self {
        Self {
            registry: Mutex::new(Registry::default()),
        }
    }

    /// Registers one URI-free delivery from the private bridge.
    ///
    /// # Errors
    ///
    /// Returns a safe contract error when bridge values are invalid or the registry is unavailable.
    pub fn accept_delivery(
        &self,
        delivery: &BridgeDelivery,
    ) -> Result<AndroidSourceSummary, CoreError> {
        let candidate = summary_from_delivery(delivery)?;
        let mut registry = self.lock_registry()?;
        if let Some(existing) = registry.sources.values().find(|record| {
            compare_identity(
                &record.summary.descriptor.identity,
                &candidate.descriptor.identity,
            ) == IdentityMatch::Same
        }) {
            return Ok(existing.summary.clone());
        }
        registry.sources.insert(
            candidate.source_id.clone(),
            AndroidSourceRecord {
                #[cfg(target_os = "android")]
                bridge_token: delivery.bridge_token.clone(),
                summary: candidate.clone(),
            },
        );
        Ok(candidate)
    }

    /// Registers one bounded bridge delivery batch.
    ///
    /// # Errors
    ///
    /// Returns a safe contract error when the batch exceeds its limit or contains an invalid delivery.
    pub fn accept_batch(
        &self,
        batch: &DeliveryBatch,
    ) -> Result<Vec<AndroidSourceSummary>, CoreError> {
        if batch.deliveries.len() > 64 || batch.rejections.len() > 64 {
            return Err(safe_error(
                CoreErrorCategory::ResourceLimit,
                "Android delivery batch exceeds its limit",
                false,
            ));
        }
        batch
            .deliveries
            .iter()
            .map(|delivery| self.accept_delivery(delivery))
            .collect()
    }

    #[cfg(target_os = "android")]
    fn source_record(&self, source_id: &SourceId) -> Result<AndroidSourceRecord, CoreError> {
        self.lock_registry()?
            .sources
            .get(source_id)
            .cloned()
            .ok_or_else(|| {
                safe_error(
                    CoreErrorCategory::NotFound,
                    "Android source is not available",
                    false,
                )
            })
    }

    fn lock_registry(&self) -> Result<MutexGuard<'_, Registry>, CoreError> {
        self.registry.lock().map_err(|_| {
            safe_error(
                CoreErrorCategory::InternalInvariant,
                "Android source registry is unavailable",
                false,
            )
        })
    }

    #[cfg(target_os = "android")]
    pub fn drain_deliveries(&self, maximum: usize) -> Result<Vec<AndroidSourceSummary>, CoreError> {
        if maximum == 0 || maximum > 64 {
            return Err(safe_error(
                CoreErrorCategory::InvalidInput,
                "Android delivery limit is invalid",
                false,
            ));
        }
        let batch = self
            .plugin
            .drain_deliveries(maximum)
            .map_err(plugin_error)?;
        self.accept_batch(&batch)
    }

    #[cfg(target_os = "android")]
    pub fn open_document(
        &self,
        media_type: Option<&str>,
    ) -> Result<AndroidSourceSummary, CoreError> {
        let delivery = self
            .plugin
            .open_document(media_type)
            .map_err(plugin_error)?;
        self.accept_delivery(&delivery)
    }

    /// Returns safe cached provider metadata without exposing native authority.
    ///
    /// # Errors
    ///
    /// Returns a safe not-found or registry error when the source is unavailable.
    pub fn query_metadata(&self, source_id: &SourceId) -> Result<SourceMetadata, CoreError> {
        let registry = self.lock_registry()?;
        let source = registry.sources.get(source_id).ok_or_else(|| {
            safe_error(
                CoreErrorCategory::NotFound,
                "Android source is not available",
                false,
            )
        })?;
        Ok(SourceMetadata {
            display_name: source.summary.descriptor.display_name.clone(),
            byte_length: source.summary.descriptor.byte_length,
            modified_unix_nanos: source.summary.external_revision.modified_unix_nanos,
            read_only: true,
        })
    }

    #[cfg(target_os = "android")]
    pub fn open_stream(
        &self,
        source_id: &SourceId,
        offset: u64,
        total_budget: u64,
    ) -> Result<StreamLease, CoreError> {
        if total_budget == 0 || offset.checked_add(total_budget).is_none() {
            return Err(safe_error(
                CoreErrorCategory::BudgetExceeded,
                "Android stream budget is invalid",
                true,
            ));
        }
        let source = self.source_record(source_id)?;
        if offset > 0 && !source.summary.descriptor.capabilities.seek {
            return Err(safe_error(
                CoreErrorCategory::CapabilityDenied,
                "Android stream offset requires seek support",
                true,
            ));
        }
        let mut registry = self.lock_registry()?;
        if registry
            .streams
            .values()
            .filter(|stream| &stream.lease.source_id == source_id)
            .count()
            >= 32
        {
            return Err(safe_error(
                CoreErrorCategory::ResourceLimit,
                "Android source reached its stream lease limit",
                true,
            ));
        }
        let opened = self
            .plugin
            .open_stream(&source.bridge_token, offset, total_budget)
            .map_err(plugin_error)?;
        let lease = StreamLease {
            stream_id: StreamId(Uuid::new_v4().to_string()),
            source_id: source_id.clone(),
            offset,
            total_budget,
            consumed: 0,
            external_revision: source.summary.external_revision,
        };
        registry.streams.insert(
            lease.stream_id.clone(),
            AndroidStreamRecord {
                bridge_token: opened.stream_token,
                lease: lease.clone(),
            },
        );
        Ok(lease)
    }

    #[cfg(target_os = "android")]
    pub fn read_stream(
        &self,
        stream_id: &StreamId,
        length: u64,
    ) -> Result<ReadRangeResult, CoreError> {
        if length == 0 || length > MAX_SOURCE_CHUNK_BYTES {
            return Err(safe_error(
                CoreErrorCategory::BudgetExceeded,
                "Android stream chunk budget is invalid",
                true,
            ));
        }
        let stream = self
            .lock_registry()?
            .streams
            .get(stream_id)
            .cloned()
            .ok_or_else(|| {
                safe_error(
                    CoreErrorCategory::NotFound,
                    "Android stream is not available",
                    false,
                )
            })?;
        if length > stream.lease.total_budget - stream.lease.consumed {
            return Err(safe_error(
                CoreErrorCategory::BudgetExceeded,
                "Android stream chunk exceeds its remaining budget",
                true,
            ));
        }
        let response = self
            .plugin
            .read_stream(&stream.bridge_token, length)
            .map_err(plugin_error)?;
        if response.bytes.len() as u64 > length {
            return Err(safe_error(
                CoreErrorCategory::InternalInvariant,
                "Android provider returned bytes beyond the stream limit",
                false,
            ));
        }
        let consumed = response.bytes.len() as u64;
        let terminal =
            response.end_of_source || stream.lease.consumed + consumed == stream.lease.total_budget;
        let mut registry = self.lock_registry()?;
        if terminal {
            registry.streams.remove(stream_id);
        } else if let Some(active) = registry.streams.get_mut(stream_id) {
            active.lease.consumed += consumed;
        }
        Ok(ReadRangeResult {
            source_id: stream.lease.source_id,
            offset: stream.lease.offset + stream.lease.consumed,
            bytes: response.bytes,
            end_of_source: response.end_of_source,
        })
    }

    #[cfg(target_os = "android")]
    pub fn read_range(
        &self,
        source_id: &SourceId,
        offset: u64,
        length: u64,
        operation_budget: u64,
    ) -> Result<ReadRangeResult, CoreError> {
        if length > operation_budget || length > MAX_SOURCE_CHUNK_BYTES {
            return Err(safe_error(
                CoreErrorCategory::BudgetExceeded,
                "Android read exceeds its declared budget",
                true,
            ));
        }
        let record = self.source_record(source_id)?;
        if !record.summary.descriptor.capabilities.seek && offset != 0 {
            return Err(safe_error(
                CoreErrorCategory::CapabilityDenied,
                "Android source does not support range reads",
                true,
            ));
        }
        if record
            .summary
            .external_revision
            .byte_length
            .is_some_and(|byte_length| offset > byte_length)
        {
            return Err(safe_error(
                CoreErrorCategory::InvalidInput,
                "Android read offset exceeds the source",
                true,
            ));
        }
        let response = self
            .plugin
            .read_range(&record.bridge_token, offset, length)
            .map_err(plugin_error)?;
        if response.bytes.len() as u64 > length {
            return Err(safe_error(
                CoreErrorCategory::InternalInvariant,
                "Android provider returned bytes beyond the requested limit",
                false,
            ));
        }
        Ok(ReadRangeResult {
            source_id: source_id.clone(),
            offset,
            bytes: response.bytes,
            end_of_source: response.end_of_source,
        })
    }

    #[cfg(target_os = "android")]
    pub fn revalidate(
        &self,
        source_id: &SourceId,
        expected: &ExternalRevision,
    ) -> Result<RevalidationResult, CoreError> {
        let record = self.source_record(source_id)?;
        let observed = self
            .plugin
            .revalidate(&record.bridge_token)
            .map_err(plugin_error)?;
        let current = summary_from_delivery(&observed)?.external_revision;
        let status = if &current == expected {
            RevalidationStatus::Match
        } else {
            RevalidationStatus::Changed
        };
        Ok(RevalidationResult {
            source_id: source_id.clone(),
            expected: expected.clone(),
            current: Some(current),
            status,
        })
    }

    #[cfg(target_os = "android")]
    pub fn restore(&self) -> Result<Vec<AndroidRestorationResult>, CoreError> {
        let batch = self.plugin.restore().map_err(plugin_error)?;
        let restored_batch = DeliveryBatch {
            deliveries: batch.deliveries,
            rejections: Vec::new(),
        };
        let mut results = self
            .accept_batch(&restored_batch)?
            .into_iter()
            .map(|source| AndroidRestorationResult {
                display_name: Some(source.descriptor.display_name.clone()),
                source: Some(source),
                status: AndroidRestorationStatus::Restored,
            })
            .collect::<Vec<_>>();
        results.extend(
            batch
                .rejections
                .into_iter()
                .map(|rejection| AndroidRestorationResult {
                    source: None,
                    display_name: None,
                    status: if rejection.code == "permission_revoked" {
                        AndroidRestorationStatus::PermissionRevoked
                    } else {
                        AndroidRestorationStatus::Unavailable
                    },
                }),
        );
        Ok(results)
    }

    #[cfg(target_os = "android")]
    pub fn save_as(
        &self,
        request: AndroidSaveAsRequest,
    ) -> Result<AndroidSaveAsReceipt, CoreError> {
        if request.bytes.len() as u64 > MAX_SAVE_BYTES {
            return Err(safe_error(
                CoreErrorCategory::BudgetExceeded,
                "Android Save As payload exceeds its limit",
                true,
            ));
        }
        let record = self.source_record(&request.source_id)?;
        if record.summary.external_revision != request.expected_external_revision {
            return Err(safe_error(
                CoreErrorCategory::Conflict,
                "Android source revision changed before Save As",
                true,
            ));
        }
        let response = self
            .plugin
            .save_as(
                request.media_type.as_deref(),
                &request.suggested_name,
                &request.bytes,
            )
            .map_err(plugin_error)?;
        if response.byte_count != request.bytes.len() as u64 {
            return Err(safe_error(
                CoreErrorCategory::PartialWritePrevented,
                "Android provider did not verify the complete Save As payload",
                true,
            ));
        }
        let new_source = self.accept_delivery(&response.delivery)?;
        Ok(AndroidSaveAsReceipt {
            previous_source_id: request.source_id,
            new_source,
            byte_count: response.byte_count,
            durability: DurabilityGuarantee::RecoverableNonAtomic,
        })
    }

    #[cfg(target_os = "android")]
    pub fn close(&self, source_id: &SourceId) -> Result<(), CoreError> {
        let record = self.source_record(source_id)?;
        self.plugin
            .close(&record.bridge_token)
            .map_err(plugin_error)?;
        let mut registry = self.lock_registry()?;
        registry.sources.remove(source_id);
        registry
            .streams
            .retain(|_, stream| &stream.lease.source_id != source_id);
        Ok(())
    }
}

fn summary_from_delivery(delivery: &BridgeDelivery) -> Result<AndroidSourceSummary, CoreError> {
    let delivery_kind = match delivery.delivery_kind.as_str() {
        "view" => AndroidDeliveryKind::View,
        "share" => AndroidDeliveryKind::Share,
        "open_result" => AndroidDeliveryKind::OpenResult,
        "create_result" => AndroidDeliveryKind::CreateResult,
        _ => {
            return Err(safe_error(
                CoreErrorCategory::InvalidInput,
                "Android bridge returned an unknown delivery kind",
                false,
            ));
        }
    };
    let strength = match delivery.identity_strength.as_str() {
        "strong" => IdentityStrength::Strong,
        "weak" => IdentityStrength::Weak,
        _ => IdentityStrength::Unavailable,
    };
    let identity = DocumentIdentity {
        authority: IdentityAuthority::AndroidDocument,
        scope: delivery.identity_scope.clone(),
        token: delivery.identity_token.clone(),
        strength,
    };
    let grant = AndroidGrantState {
        read: delivery.read_granted,
        write: delivery.write_granted,
        persisted_read: delivery.persisted_read,
        persisted_write: delivery.persisted_write,
        restorable: delivery.persisted_read || delivery.persisted_write,
    };
    let descriptor = SourceDescriptor {
        identity: identity.clone(),
        display_name: delivery.display_name.clone(),
        claimed_media_type: delivery.media_type.clone(),
        byte_length: delivery.byte_length,
        modified_unix_ms: delivery.modified_unix_ms,
        kind: SourceKind::DocumentUri,
        capabilities: SourceCapabilities {
            read: grant.read,
            seek: grant.read && delivery.seekable,
            stream: grant.read,
            metadata: true,
            observe_revision: true,
            revalidate: true,
            persistent_permission: grant.restorable,
            reopen: grant.restorable,
            ..SourceCapabilities::default()
        },
    };
    Ok(AndroidSourceSummary {
        source_id: SourceId(Uuid::new_v4().to_string()),
        descriptor,
        external_revision: ExternalRevision {
            identity,
            byte_length: delivery.byte_length,
            modified_unix_nanos: delivery
                .modified_unix_ms
                .and_then(|milliseconds| u64::try_from(milliseconds).ok())
                .and_then(|milliseconds| milliseconds.checked_mul(1_000_000)),
            change_token: None,
        },
        delivery_kind,
        grant,
    })
}

fn safe_error(category: CoreErrorCategory, summary: &'static str, retryable: bool) -> CoreError {
    CoreError::new(category, summary, retryable, true)
}

#[cfg(target_os = "android")]
fn plugin_error(error: String) -> CoreError {
    let category = if error.contains("permission_revoked") {
        CoreErrorCategory::PermissionRevoked
    } else if error.contains("budget_exceeded") {
        CoreErrorCategory::BudgetExceeded
    } else if error.contains("picker_cancelled") {
        CoreErrorCategory::Unavailable
    } else if error.contains("source_not_found") {
        CoreErrorCategory::NotFound
    } else if error.contains("write_verification_failed") {
        CoreErrorCategory::PartialWritePrevented
    } else {
        CoreErrorCategory::Unavailable
    };
    safe_error(category, "Android provider operation failed safely", true)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn delivery(token: &str, strength: &str) -> BridgeDelivery {
        BridgeDelivery {
            bridge_token: format!("bridge-{token}"),
            delivery_kind: "view".into(),
            identity_scope: "fixture.provider".into(),
            identity_token: token.into(),
            identity_strength: strength.into(),
            display_name: "fixture.txt".into(),
            media_type: Some("text/plain".into()),
            byte_length: None,
            modified_unix_ms: None,
            read_granted: true,
            write_granted: true,
            persisted_read: false,
            persisted_write: false,
            seekable: false,
        }
    }

    #[test]
    fn strong_identity_deduplicates_but_weak_identity_does_not() {
        let host = AndroidSourceHost::new_for_tests();
        let first = host.accept_delivery(&delivery("one", "strong")).unwrap();
        let duplicate = host.accept_delivery(&delivery("one", "strong")).unwrap();
        assert_eq!(first.source_id, duplicate.source_id);

        let weak_first = host.accept_delivery(&delivery("weak", "weak")).unwrap();
        let weak_second = host.accept_delivery(&delivery("weak", "weak")).unwrap();
        assert_ne!(weak_first.source_id, weak_second.source_id);
    }

    #[test]
    fn provider_write_hint_never_enables_direct_update() {
        let host = AndroidSourceHost::new_for_tests();
        let source = host
            .accept_delivery(&delivery("write-hint", "strong"))
            .unwrap();
        assert!(!source.descriptor.capabilities.write);
        assert!(!source.descriptor.capabilities.replace_atomically);
    }

    #[test]
    fn unknown_provider_size_is_preserved() {
        let source = summary_from_delivery(&delivery("unknown-size", "strong")).unwrap();
        assert_eq!(source.external_revision.byte_length, None);
        assert_eq!(source.descriptor.byte_length, None);
    }
}
