//! Android provider-backed source policy and opaque registry.

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};

use glitchpad_android_source::models::{BridgeDelivery, DeliveryBatch};
use glitchpad_core::contracts::{
    CoreError, CoreErrorCategory, DocumentIdentity, IdentityAuthority, IdentityMatch,
    IdentityStrength, SourceCapabilities, SourceDescriptor, SourceKind, compare_identity,
};
use glitchpad_core::source::{
    AndroidDeliveryDrain, AndroidDeliveryKind, AndroidDeliveryRejection, AndroidGrantState,
    AndroidSourceSummary, ExternalRevision, IntegrityHasher, IntegrityProgress, IntegrityRequestId,
    IntegrityStartRequest, IntegrityState, MAX_INTEGRITY_SOURCE_BYTES, MAX_INTEGRITY_STEP_BYTES,
    ReadRangeResult, SourceId, SourceMetadata, SourceMetadataSnapshot, SourceWriteState,
};
#[cfg(target_os = "android")]
use glitchpad_core::source::{StreamId, StreamLease};
use uuid::Uuid;

#[cfg(target_os = "android")]
use glitchpad_android_source::AndroidSource;

#[cfg(target_os = "android")]
use glitchpad_core::source::{
    AndroidRestorationResult, AndroidRestorationStatus, AndroidSaveAsReceipt, AndroidSaveAsRequest,
    DurabilityGuarantee, MAX_SAVE_BYTES, MAX_SOURCE_CHUNK_BYTES, RevalidationResult,
    RevalidationStatus,
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

struct AndroidIntegrityOperation {
    request: IntegrityStartRequest,
    #[cfg(target_os = "android")]
    stream_id: StreamId,
    #[cfg(not(target_os = "android"))]
    bytes: Vec<u8>,
    hasher: IntegrityHasher,
    processed_bytes: u64,
    total_bytes: Option<u64>,
}

#[derive(Default)]
struct Registry {
    sources: HashMap<SourceId, AndroidSourceRecord>,
    #[cfg(target_os = "android")]
    streams: HashMap<StreamId, AndroidStreamRecord>,
    integrity_operations: HashMap<IntegrityRequestId, AndroidIntegrityOperation>,
    #[cfg(not(target_os = "android"))]
    test_source_bytes: HashMap<SourceId, Vec<u8>>,
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

    /// Returns content-free native ownership totals for lifecycle conformance.
    ///
    /// # Errors
    ///
    /// Returns a safe unavailable error if the process-local registry is poisoned.
    pub fn resource_snapshot(&self) -> Result<crate::performance::NativeLeaseSnapshot, CoreError> {
        let registry = self.lock_registry()?;
        Ok(crate::performance::NativeLeaseSnapshot {
            sources: registry.sources.len(),
            #[cfg(target_os = "android")]
            streams: registry.streams.len(),
            #[cfg(not(target_os = "android"))]
            streams: 0,
            integrity_operations: registry.integrity_operations.len(),
        })
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
        let mut candidate = summary_from_delivery(delivery)?;
        let mut registry = self.lock_registry()?;
        if let Some((existing_id, _existing)) = registry
            .sources
            .iter()
            .find(|(_, record)| {
                compare_identity(
                    &record.summary.descriptor.identity,
                    &candidate.descriptor.identity,
                ) == IdentityMatch::Same
            })
            .map(|(source_id, record)| (source_id.clone(), record.clone()))
        {
            candidate.source_id = existing_id.clone();
            registry.sources.insert(
                existing_id,
                AndroidSourceRecord {
                    #[cfg(target_os = "android")]
                    bridge_token: delivery.bridge_token.clone(),
                    summary: candidate.clone(),
                },
            );
            #[cfg(target_os = "android")]
            registry
                .streams
                .retain(|_, stream| stream.lease.source_id != candidate.source_id);
            drop(registry);
            #[cfg(target_os = "android")]
            self.plugin
                .discard(&_existing.bridge_token)
                .map_err(plugin_error)?;
            return Ok(candidate);
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

    /// Registers a bounded bridge batch while preserving each safe rejection.
    ///
    /// # Errors
    ///
    /// Returns a safe contract error when the batch or any accepted delivery is invalid.
    pub fn accept_drain(&self, batch: &DeliveryBatch) -> Result<AndroidDeliveryDrain, CoreError> {
        let sources = self.accept_batch(batch)?;
        let rejections = batch
            .rejections
            .iter()
            .map(|rejection| AndroidDeliveryRejection {
                code: rejection.code.clone(),
                retryable: rejection.retryable,
            })
            .collect();
        Ok(AndroidDeliveryDrain {
            sources,
            rejections,
        })
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
    pub fn drain_deliveries(&self, maximum: usize) -> Result<AndroidDeliveryDrain, CoreError> {
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
        self.accept_drain(&batch)
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

    /// Returns safe provider metadata without exposing native authority.
    ///
    /// # Errors
    ///
    /// Returns a safe not-found or registry error when the source is unavailable.
    pub fn query_metadata(&self, source_id: &SourceId) -> Result<SourceMetadata, CoreError> {
        #[cfg(target_os = "android")]
        let summary = self.refresh_source(source_id)?;
        #[cfg(not(target_os = "android"))]
        let summary = self
            .lock_registry()?
            .sources
            .get(source_id)
            .map(|source| source.summary.clone())
            .ok_or_else(|| {
                safe_error(
                    CoreErrorCategory::NotFound,
                    "Android source is not available",
                    false,
                )
            })?;
        Ok(SourceMetadata {
            display_name: summary.descriptor.display_name,
            byte_length: summary.descriptor.byte_length,
            modified_unix_nanos: summary.external_revision.modified_unix_nanos,
            read_only: true,
        })
    }

    /// Returns a revision-bound provider snapshot without exposing its URI or native identity.
    ///
    /// # Errors
    ///
    /// Returns a safe not-found, provider, or registry error when metadata cannot be refreshed.
    pub fn query_metadata_snapshot(
        &self,
        source_id: &SourceId,
    ) -> Result<SourceMetadataSnapshot, CoreError> {
        let summary = self.current_summary(source_id)?;
        Ok(SourceMetadataSnapshot {
            source_id: source_id.clone(),
            external_revision: path_free_external_revision(source_id, &summary.external_revision),
            display_name: summary.descriptor.display_name,
            source_kind: summary.descriptor.kind,
            byte_length: summary.external_revision.byte_length,
            modified_unix_nanos: summary.external_revision.modified_unix_nanos,
            created_unix_nanos: None,
            accessed_unix_nanos: None,
            write_state: SourceWriteState::SaveAsOnly,
            identity_confidence: summary.descriptor.identity.strength,
        })
    }

    fn current_summary(&self, source_id: &SourceId) -> Result<AndroidSourceSummary, CoreError> {
        #[cfg(target_os = "android")]
        {
            self.refresh_source(source_id)
        }
        #[cfg(not(target_os = "android"))]
        {
            self.lock_registry()?
                .sources
                .get(source_id)
                .map(|source| source.summary.clone())
                .ok_or_else(|| {
                    safe_error(
                        CoreErrorCategory::NotFound,
                        "Android source is not available",
                        false,
                    )
                })
        }
    }

    /// Installs deterministic bytes for non-Android adapter conformance tests.
    #[cfg(not(target_os = "android"))]
    #[doc(hidden)]
    pub fn install_test_source_bytes(
        &self,
        source_id: &SourceId,
        bytes: Vec<u8>,
    ) -> Result<(), CoreError> {
        let mut registry = self.lock_registry()?;
        if !registry.sources.contains_key(source_id) {
            return Err(integrity_not_found());
        }
        registry.test_source_bytes.insert(source_id.clone(), bytes);
        Ok(())
    }

    /// Starts one bounded, revision-bound Android SHA-256 operation.
    ///
    /// # Errors
    ///
    /// Returns a safe validation, conflict, provider, or registry error when work cannot start.
    pub fn start_integrity(
        &self,
        request: IntegrityStartRequest,
    ) -> Result<IntegrityProgress, CoreError> {
        let summary = self.validate_integrity_start(&request)?;
        let total_bytes = summary.external_revision.byte_length;
        if total_bytes.is_some_and(|bytes| bytes > MAX_INTEGRITY_SOURCE_BYTES) {
            return Ok(integrity_progress(
                &request,
                0,
                total_bytes,
                IntegrityState::Limited,
                None,
                Some("source_too_large"),
            ));
        }
        if total_bytes == Some(0) {
            return self.finish_empty_integrity(&request);
        }

        #[cfg(target_os = "android")]
        let stream_id = self
            .open_stream(
                &request.source_id,
                0,
                total_bytes.unwrap_or(MAX_INTEGRITY_SOURCE_BYTES),
            )?
            .stream_id;
        #[cfg(not(target_os = "android"))]
        let bytes = self
            .lock_registry()?
            .test_source_bytes
            .get(&request.source_id)
            .cloned()
            .ok_or_else(|| {
                safe_error(
                    CoreErrorCategory::Unavailable,
                    "Android test source bytes are unavailable",
                    false,
                )
            })?;

        let progress = integrity_progress(
            &request,
            0,
            total_bytes,
            IntegrityState::Pending,
            None,
            None,
        );
        let mut registry = self.lock_registry()?;
        if registry
            .integrity_operations
            .contains_key(&request.request_id)
        {
            #[cfg(target_os = "android")]
            {
                let stream = registry.streams.remove(&stream_id);
                drop(registry);
                if let Some(stream) = stream {
                    let _ = self.plugin.close_stream(&stream.bridge_token);
                }
            }
            return Err(safe_error(
                CoreErrorCategory::InvalidInput,
                "The integrity request identifier is already active",
                false,
            ));
        }
        registry.integrity_operations.insert(
            request.request_id.clone(),
            AndroidIntegrityOperation {
                request,
                #[cfg(target_os = "android")]
                stream_id,
                #[cfg(not(target_os = "android"))]
                bytes,
                hasher: IntegrityHasher::default(),
                processed_bytes: 0,
                total_bytes,
            },
        );
        Ok(progress)
    }

    /// Advances one Android integrity operation by at most one MiB.
    ///
    /// # Errors
    ///
    /// Returns a safe not-found, provider, or registry error when work cannot be advanced.
    pub fn advance_integrity(
        &self,
        request_id: &IntegrityRequestId,
    ) -> Result<IntegrityProgress, CoreError> {
        let mut operation = self
            .lock_registry()?
            .integrity_operations
            .remove(request_id)
            .ok_or_else(integrity_not_found)?;
        if let Some(progress) = self.integrity_revision_failure(&operation) {
            self.retire_integrity_reader(&operation);
            return Ok(progress);
        }

        let remaining = operation
            .total_bytes
            .unwrap_or(MAX_INTEGRITY_SOURCE_BYTES)
            .saturating_sub(operation.processed_bytes);
        let step = remaining.min(MAX_INTEGRITY_STEP_BYTES);
        if step == 0 {
            self.retire_integrity_reader(&operation);
            return Ok(integrity_progress(
                &operation.request,
                operation.processed_bytes,
                operation.total_bytes,
                IntegrityState::Limited,
                None,
                Some("integrity_limit_reached"),
            ));
        }

        let read = match self.read_integrity_step(&operation, step) {
            Ok(read) => read,
            Err(error) => {
                self.retire_integrity_reader(&operation);
                let (state, code) = if error.category == CoreErrorCategory::Conflict {
                    (IntegrityState::Stale, "source_revised")
                } else {
                    (IntegrityState::Failed, "source_read_failed")
                };
                return Ok(integrity_progress(
                    &operation.request,
                    operation.processed_bytes,
                    operation.total_bytes,
                    state,
                    None,
                    Some(code),
                ));
            }
        };
        operation.hasher.update(&read.bytes);
        operation.processed_bytes = operation
            .processed_bytes
            .saturating_add(u64::try_from(read.bytes.len()).unwrap_or(u64::MAX));

        let reached_known_end = operation
            .total_bytes
            .is_some_and(|total| operation.processed_bytes == total);
        if read.end_of_source || reached_known_end {
            return Ok(self.finish_integrity(operation));
        }
        if operation.processed_bytes >= MAX_INTEGRITY_SOURCE_BYTES {
            self.retire_integrity_reader(&operation);
            return Ok(integrity_progress(
                &operation.request,
                operation.processed_bytes,
                operation.total_bytes,
                IntegrityState::Limited,
                None,
                Some("integrity_limit_reached"),
            ));
        }

        let progress = integrity_progress(
            &operation.request,
            operation.processed_bytes,
            operation.total_bytes,
            IntegrityState::Pending,
            None,
            None,
        );
        self.lock_registry()?
            .integrity_operations
            .insert(request_id.clone(), operation);
        Ok(progress)
    }

    fn validate_integrity_start(
        &self,
        request: &IntegrityStartRequest,
    ) -> Result<AndroidSourceSummary, CoreError> {
        if Uuid::parse_str(&request.request_id.0).is_err() {
            return Err(safe_error(
                CoreErrorCategory::InvalidInput,
                "The integrity request identifier is invalid",
                false,
            ));
        }
        if self
            .lock_registry()?
            .integrity_operations
            .contains_key(&request.request_id)
        {
            return Err(safe_error(
                CoreErrorCategory::InvalidInput,
                "The integrity request identifier is already active",
                false,
            ));
        }
        let summary = self.current_summary(&request.source_id)?;
        if path_free_external_revision(&request.source_id, &summary.external_revision)
            != request.expected_external_revision
        {
            return Err(integrity_conflict());
        }
        Ok(summary)
    }

    fn finish_empty_integrity(
        &self,
        request: &IntegrityStartRequest,
    ) -> Result<IntegrityProgress, CoreError> {
        let current = self.current_summary(&request.source_id)?;
        Ok(
            if path_free_external_revision(&request.source_id, &current.external_revision)
                == request.expected_external_revision
            {
                integrity_progress(
                    request,
                    0,
                    Some(0),
                    IntegrityState::Ready,
                    Some(IntegrityHasher::default().finalize()),
                    None,
                )
            } else {
                integrity_progress(
                    request,
                    0,
                    Some(0),
                    IntegrityState::Stale,
                    None,
                    Some("source_revised"),
                )
            },
        )
    }

    fn integrity_revision_failure(
        &self,
        operation: &AndroidIntegrityOperation,
    ) -> Option<IntegrityProgress> {
        let current = match self.current_summary(&operation.request.source_id) {
            Ok(summary) => summary,
            Err(error) => {
                let code = if error.category == CoreErrorCategory::PermissionRevoked {
                    "permission_revoked"
                } else {
                    "source_refresh_failed"
                };
                return Some(integrity_progress(
                    &operation.request,
                    operation.processed_bytes,
                    operation.total_bytes,
                    IntegrityState::Failed,
                    None,
                    Some(code),
                ));
            }
        };
        (path_free_external_revision(&operation.request.source_id, &current.external_revision)
            != operation.request.expected_external_revision)
            .then(|| {
                integrity_progress(
                    &operation.request,
                    operation.processed_bytes,
                    operation.total_bytes,
                    IntegrityState::Stale,
                    None,
                    Some("source_revised"),
                )
            })
    }

    fn read_integrity_step(
        &self,
        operation: &AndroidIntegrityOperation,
        step: u64,
    ) -> Result<ReadRangeResult, CoreError> {
        #[cfg(target_os = "android")]
        {
            self.read_stream(&operation.stream_id, step)
        }
        #[cfg(not(target_os = "android"))]
        {
            let _ = &self.registry;
            let start = usize::try_from(operation.processed_bytes).unwrap_or(usize::MAX);
            let requested = usize::try_from(step).unwrap_or(usize::MAX);
            if start > operation.bytes.len() {
                return Err(safe_error(
                    CoreErrorCategory::Unavailable,
                    "Android test source offset is unavailable",
                    false,
                ));
            }
            let end = start.saturating_add(requested).min(operation.bytes.len());
            Ok(ReadRangeResult {
                source_id: operation.request.source_id.clone(),
                offset: operation.processed_bytes,
                bytes: operation.bytes[start..end].to_vec(),
                end_of_source: end == operation.bytes.len(),
            })
        }
    }

    fn finish_integrity(&self, operation: AndroidIntegrityOperation) -> IntegrityProgress {
        if operation
            .total_bytes
            .is_some_and(|total| total != operation.processed_bytes)
        {
            self.retire_integrity_reader(&operation);
            return integrity_progress(
                &operation.request,
                operation.processed_bytes,
                operation.total_bytes,
                IntegrityState::Failed,
                None,
                Some("source_length_mismatch"),
            );
        }
        if let Some(progress) = self.integrity_revision_failure(&operation) {
            self.retire_integrity_reader(&operation);
            return progress;
        }
        self.retire_integrity_reader(&operation);
        let digest = operation.hasher.finalize();
        integrity_progress(
            &operation.request,
            operation.processed_bytes,
            operation.total_bytes,
            IntegrityState::Ready,
            Some(digest),
            None,
        )
    }

    /// Cancels an active integrity operation. Repeated cancellation is harmless.
    ///
    /// # Errors
    ///
    /// Returns a safe registry error when the operation registry is unavailable.
    pub fn cancel_integrity(&self, request_id: &IntegrityRequestId) -> Result<bool, CoreError> {
        let operation = self
            .lock_registry()?
            .integrity_operations
            .remove(request_id);
        let Some(operation) = operation else {
            return Ok(false);
        };
        self.retire_integrity_reader(&operation);
        Ok(true)
    }

    /// Returns live operation count for cleanup conformance tests.
    ///
    /// # Errors
    ///
    /// Returns a safe registry error when the operation registry is unavailable.
    pub fn active_integrity_operation_count(&self) -> Result<usize, CoreError> {
        Ok(self.lock_registry()?.integrity_operations.len())
    }

    fn retire_integrity_reader(&self, operation: &AndroidIntegrityOperation) {
        #[cfg(target_os = "android")]
        {
            let removed = self
                .lock_registry()
                .ok()
                .and_then(|mut registry| registry.streams.remove(&operation.stream_id));
            if let Some(stream) = removed {
                let _ = self.plugin.close_stream(&stream.bridge_token);
            }
        }
        #[cfg(not(target_os = "android"))]
        let _ = (&self.registry, operation);
    }

    #[cfg(target_os = "android")]
    fn refresh_source(&self, source_id: &SourceId) -> Result<AndroidSourceSummary, CoreError> {
        let record = self.source_record(source_id)?;
        let observed = match self.plugin.revalidate(&record.bridge_token) {
            Ok(observed) => observed,
            Err(error) => {
                if matches!(
                    revalidation_failure_status(&error),
                    RevalidationStatus::PermissionRevoked | RevalidationStatus::Deleted
                ) {
                    self.invalidate_source_streams(source_id);
                }
                return Err(plugin_error(error));
            }
        };
        let mut refreshed = summary_from_delivery(&observed)?;
        refreshed.source_id = source_id.clone();
        if refreshed.external_revision != record.summary.external_revision {
            self.invalidate_source_streams(source_id);
        }
        if let Some(active) = self.lock_registry()?.sources.get_mut(source_id) {
            active.summary = refreshed.clone();
        }
        Ok(refreshed)
    }

    #[cfg(target_os = "android")]
    fn ensure_current(
        &self,
        source_id: &SourceId,
        record: &AndroidSourceRecord,
    ) -> Result<(), CoreError> {
        let observed = match self.plugin.revalidate(&record.bridge_token) {
            Ok(observed) => observed,
            Err(error) => {
                if matches!(
                    revalidation_failure_status(&error),
                    RevalidationStatus::PermissionRevoked | RevalidationStatus::Deleted
                ) {
                    self.invalidate_source_streams(source_id);
                }
                return Err(plugin_error(error));
            }
        };
        let current = summary_from_delivery(&observed)?.external_revision;
        if current != record.summary.external_revision {
            self.invalidate_source_streams(source_id);
            return Err(safe_error(
                CoreErrorCategory::Conflict,
                "Android source changed before provider I/O",
                true,
            ));
        }
        Ok(())
    }

    #[cfg(target_os = "android")]
    fn invalidate_source_streams(&self, source_id: &SourceId) {
        let tokens = self
            .lock_registry()
            .map(|mut registry| {
                let tokens = registry
                    .streams
                    .values()
                    .filter(|stream| &stream.lease.source_id == source_id)
                    .map(|stream| stream.bridge_token.clone())
                    .collect::<Vec<_>>();
                registry
                    .streams
                    .retain(|_, stream| &stream.lease.source_id != source_id);
                tokens
            })
            .unwrap_or_default();
        for token in tokens {
            let _ = self.plugin.close_stream(&token);
        }
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
        if self
            .lock_registry()?
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
        self.ensure_current(source_id, &source)?;
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
        self.lock_registry()?.streams.insert(
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
        let mut registry = self.lock_registry()?;
        let current_consumed = registry
            .streams
            .get(stream_id)
            .map_or(stream.lease.consumed, |active| active.lease.consumed);
        let next_consumed = current_consumed + consumed;
        let terminal = response.end_of_source || next_consumed == stream.lease.total_budget;
        if terminal {
            registry.streams.remove(stream_id);
        } else if let Some(active) = registry.streams.get_mut(stream_id) {
            active.lease.consumed = next_consumed;
        }
        Ok(ReadRangeResult {
            source_id: stream.lease.source_id,
            offset: stream.lease.offset + current_consumed,
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
        self.ensure_current(source_id, &record)?;
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
        let observed = match self.plugin.revalidate(&record.bridge_token) {
            Ok(observed) => observed,
            Err(error) => {
                let status = revalidation_failure_status(&error);
                if matches!(
                    status,
                    RevalidationStatus::PermissionRevoked | RevalidationStatus::Deleted
                ) {
                    self.invalidate_source_streams(source_id);
                }
                return Ok(RevalidationResult {
                    source_id: source_id.clone(),
                    expected: expected.clone(),
                    current: None,
                    status,
                });
            }
        };
        let mut refreshed = summary_from_delivery(&observed)?;
        refreshed.source_id = source_id.clone();
        let current = refreshed.external_revision.clone();
        if let Some(active) = self.lock_registry()?.sources.get_mut(source_id) {
            active.summary = refreshed;
        }
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
        let observed = self
            .plugin
            .revalidate(&record.bridge_token)
            .map_err(plugin_error)?;
        let current = summary_from_delivery(&observed)?.external_revision;
        if current != request.expected_external_revision {
            return Err(safe_error(
                CoreErrorCategory::Conflict,
                "Android source changed before Save As",
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
            operation_id: request.operation_id,
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
        registry
            .integrity_operations
            .retain(|_, operation| &operation.request.source_id != source_id);
        Ok(())
    }
}

fn summary_from_delivery(delivery: &BridgeDelivery) -> Result<AndroidSourceSummary, CoreError> {
    if delivery.display_name.chars().count() > 256
        || delivery
            .media_type
            .as_ref()
            .is_some_and(|media_type| media_type.chars().count() > 128)
    {
        return Err(safe_error(
            CoreErrorCategory::InvalidInput,
            "Android bridge returned oversized metadata",
            false,
        ));
    }
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
        restoration_reference: grant
            .restorable
            .then(|| glitchpad_core::source::opaque_restoration_reference(&identity))
            .flatten(),
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
            change_token: Some(android_metadata_change_token(delivery)),
        },
        delivery_kind,
        grant,
    })
}

fn android_metadata_change_token(delivery: &BridgeDelivery) -> String {
    let media_type = delivery.media_type.as_deref().unwrap_or_default();
    format!(
        "name:{}:{}|media:{}:{}",
        delivery.display_name.len(),
        delivery.display_name,
        media_type.len(),
        media_type,
    )
}

fn path_free_external_revision(
    source_id: &SourceId,
    revision: &ExternalRevision,
) -> ExternalRevision {
    let mut evidence = IntegrityHasher::default();
    for value in [
        revision.identity.scope.as_str(),
        revision.identity.token.as_str(),
        revision.change_token.as_deref().unwrap_or_default(),
    ] {
        evidence.update(&value.len().to_le_bytes());
        evidence.update(value.as_bytes());
    }
    evidence.update(&revision.byte_length.unwrap_or(u64::MAX).to_le_bytes());
    evidence.update(
        &revision
            .modified_unix_nanos
            .unwrap_or(u64::MAX)
            .to_le_bytes(),
    );
    ExternalRevision {
        identity: DocumentIdentity {
            authority: IdentityAuthority::AndroidDocument,
            scope: "android_source".into(),
            token: source_id.0.clone(),
            strength: revision.identity.strength,
        },
        byte_length: revision.byte_length,
        modified_unix_nanos: revision.modified_unix_nanos,
        change_token: Some(format!("sha256:{}", evidence.finalize())),
    }
}

fn integrity_progress(
    request: &IntegrityStartRequest,
    processed_bytes: u64,
    total_bytes: Option<u64>,
    state: IntegrityState,
    sha256: Option<String>,
    error_code: Option<&str>,
) -> IntegrityProgress {
    IntegrityProgress {
        request_id: request.request_id.clone(),
        source_id: request.source_id.clone(),
        external_revision: request.expected_external_revision.clone(),
        processed_bytes,
        total_bytes,
        state,
        sha256,
        error_code: error_code.map(str::to_owned),
    }
}

fn integrity_not_found() -> CoreError {
    safe_error(
        CoreErrorCategory::NotFound,
        "Android integrity operation is not available",
        false,
    )
}

fn integrity_conflict() -> CoreError {
    safe_error(
        CoreErrorCategory::Conflict,
        "Android source revision changed before integrity work",
        true,
    )
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

#[cfg(target_os = "android")]
fn revalidation_failure_status(error: &str) -> RevalidationStatus {
    if error.contains("permission_revoked") {
        RevalidationStatus::PermissionRevoked
    } else if error.contains("source_not_found") {
        RevalidationStatus::Deleted
    } else {
        RevalidationStatus::Unavailable
    }
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

    #[test]
    fn provider_rename_changes_external_revision() {
        let before = delivery("rename", "strong");
        let mut after = before.clone();
        after.display_name = "renamed.txt".into();

        let before = summary_from_delivery(&before).unwrap();
        let after = summary_from_delivery(&after).unwrap();

        assert_ne!(before.external_revision, after.external_revision);
    }
}
