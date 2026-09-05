//! Capability-scoped desktop source registry.

mod identity;
mod persistence;
mod watch;

use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant, UNIX_EPOCH};

use glitchpad_core::contracts::{
    CoreError, CoreErrorCategory, IdentityMatch, IdentityStrength, SourceCapabilities,
    SourceDescriptor, SourceKind, compare_identity,
};
use glitchpad_core::source::{
    DesktopSourceSummary, DurabilityGuarantee, ExternalRevision, IntegrityHasher,
    IntegrityProgress, IntegrityRequestId, IntegrityStartRequest, IntegrityState,
    LinkAuthorization, LinkAuthorizationId, MAX_INTEGRITY_SOURCE_BYTES, MAX_INTEGRITY_STEP_BYTES,
    MAX_SAVE_BYTES, MAX_SOURCE_CHUNK_BYTES, ReadRangeResult, RevalidationResult,
    RevalidationStatus, SaveReceipt, SaveRequest, SourceEvent, SourceId, SourceMetadata,
    SourceMetadataSnapshot, SourceState, SourceWriteState, StreamId, StreamLease, UserActivationId,
    UserActivationProof,
};
use serde::{Deserialize, Serialize};
use url::Url;
use uuid::Uuid;

use self::identity::{NativeIdentity, observe_revision, observe_revision_from_metadata};
use self::watch::WatchRegistration;

const USER_ACTIVATION_LIFETIME: Duration = Duration::from_secs(1);
const MAX_ACTIVE_STREAMS_PER_SOURCE: usize = 32;

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn read_source_range(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
    offset: u64,
    length: u64,
    operation_budget: u64,
) -> Result<ReadRangeResult, CoreError> {
    host.read_range(&source_id, offset, length, operation_budget)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn open_source_stream(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
    offset: u64,
    total_budget: u64,
) -> Result<StreamLease, CoreError> {
    host.open_stream(&source_id, offset, total_budget)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn read_source_stream(
    host: tauri::State<'_, DesktopSourceHost>,
    stream_id: StreamId,
    length: u64,
) -> Result<ReadRangeResult, CoreError> {
    host.read_stream(&stream_id, length)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn query_source_metadata(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
) -> Result<SourceMetadataSnapshot, CoreError> {
    let _ = host.start_watch(&source_id);
    let _ = host.drain_events(&source_id, 256);
    host.query_metadata_snapshot(&source_id)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn start_source_integrity(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
    expected_revision: ExternalRevision,
    request_id: String,
) -> Result<IntegrityProgress, CoreError> {
    host.start_integrity(IntegrityStartRequest {
        request_id: IntegrityRequestId(request_id),
        source_id,
        expected_external_revision: expected_revision,
    })
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn advance_source_integrity(
    host: tauri::State<'_, DesktopSourceHost>,
    request_id: String,
) -> Result<IntegrityProgress, CoreError> {
    host.advance_integrity(&IntegrityRequestId(request_id))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn cancel_source_integrity(
    host: tauri::State<'_, DesktopSourceHost>,
    request_id: String,
) -> Result<bool, CoreError> {
    host.cancel_integrity(&IntegrityRequestId(request_id))
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn start_source_watch(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
) -> Result<(), CoreError> {
    host.start_watch(&source_id)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn drain_source_events(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
    maximum: usize,
) -> Result<Vec<SourceEvent>, CoreError> {
    host.drain_events(&source_id, maximum)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn revalidate_source(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
    expected: ExternalRevision,
) -> Result<RevalidationResult, CoreError> {
    host.revalidate(&source_id, &expected)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn save_source(
    host: tauri::State<'_, DesktopSourceHost>,
    request: SaveRequest,
) -> Result<SaveReceipt, CoreError> {
    host.save(request)
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub(crate) fn close_source(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
) -> Result<(), CoreError> {
    host.close(&source_id)
}

/// Trusted native channel that delivered one desktop path.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DesktopDeliveryKind {
    Dialog,
    Drop,
    CommandLine,
    Association,
}

/// Native-only source acquisition request.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DesktopDelivery {
    kind: DesktopDeliveryKind,
    path: PathBuf,
}

impl DesktopDelivery {
    /// Creates a delivery after a native dialog selection.
    pub fn dialog(path: impl Into<PathBuf>) -> Self {
        Self::new(DesktopDeliveryKind::Dialog, path)
    }

    /// Creates a delivery after a native file drop.
    pub fn dropped(path: impl Into<PathBuf>) -> Self {
        Self::new(DesktopDeliveryKind::Drop, path)
    }

    /// Creates a delivery from process command-line handling.
    pub fn command_line(path: impl Into<PathBuf>) -> Self {
        Self::new(DesktopDeliveryKind::CommandLine, path)
    }

    /// Creates a delivery from an operating-system association event.
    pub fn association(path: impl Into<PathBuf>) -> Self {
        Self::new(DesktopDeliveryKind::Association, path)
    }

    fn new(kind: DesktopDeliveryKind, path: impl Into<PathBuf>) -> Self {
        Self {
            kind,
            path: path.into(),
        }
    }

    /// Returns the trusted delivery classification without exposing the path.
    pub const fn kind(&self) -> DesktopDeliveryKind {
        self.kind
    }
}

struct SourceRecord {
    path: PathBuf,
    parent: PathBuf,
    native_identity: NativeIdentity,
    summary: DesktopSourceSummary,
    state: SourceState,
    next_event_sequence: u64,
    watcher: Option<WatchRegistration>,
    session_revision: u64,
}

#[derive(Clone)]
struct StreamRecord {
    lease: StreamLease,
}

struct IntegrityOperation {
    request: IntegrityStartRequest,
    stream_id: StreamId,
    hasher: IntegrityHasher,
    processed_bytes: u64,
    total_bytes: Option<u64>,
}

#[derive(Default)]
struct HostState {
    sources: HashMap<SourceId, SourceRecord>,
    streams: HashMap<StreamId, StreamRecord>,
    integrity_operations: HashMap<IntegrityRequestId, IntegrityOperation>,
    activations: HashMap<UserActivationId, Instant>,
    link_authorizations: HashMap<LinkAuthorizationId, String>,
}

/// Process-local desktop source authority managed by the Tauri host.
#[derive(Default)]
pub struct DesktopSourceHost {
    state: Mutex<HostState>,
}

impl DesktopSourceHost {
    /// Creates an empty host registry.
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns content-free native ownership totals for lifecycle conformance.
    ///
    /// # Errors
    ///
    /// Returns a safe unavailable error if the process-local registry is poisoned.
    pub fn resource_snapshot(&self) -> Result<crate::performance::NativeLeaseSnapshot, CoreError> {
        let state = self.lock_state()?;
        Ok(crate::performance::NativeLeaseSnapshot {
            sources: state.sources.len(),
            streams: state.streams.len(),
            integrity_operations: state.integrity_operations.len(),
        })
    }

    /// Acquires or returns an existing strongly identified regular file.
    ///
    /// # Errors
    ///
    /// Returns a safe error when the delivery is missing, inaccessible, a symlink, or not a regular file.
    pub fn acquire(&self, delivery: DesktopDelivery) -> Result<DesktopSourceSummary, CoreError> {
        let path = delivery.path;
        let symlink_metadata = fs::symlink_metadata(&path)
            .map_err(|error| safe_io_error(&error, "acquire_metadata"))?;
        if symlink_metadata.file_type().is_symlink() || !symlink_metadata.is_file() {
            return Err(CoreError::new(
                CoreErrorCategory::UnsupportedInput,
                "Desktop sources must be regular files and cannot be symbolic links",
                false,
                false,
            ));
        }
        let path = fs::canonicalize(path)
            .map_err(|error| safe_io_error(&error, "acquire_canonicalize"))?;
        let parent = path.parent().map(Path::to_path_buf).ok_or_else(|| {
            CoreError::new(
                CoreErrorCategory::InvalidInput,
                "The delivered source does not have a parent directory",
                false,
                false,
            )
        })?;
        File::open(&path).map_err(|error| safe_io_error(&error, "acquire_read"))?;
        let (native_identity, external_revision) = observe_revision(&path)?;

        let mut state = self.lock_state()?;
        if native_identity.contract.strength == IdentityStrength::Strong
            && let Some(existing) = state.sources.values().find(|record| {
                compare_identity(
                    &record.summary.descriptor.identity,
                    &native_identity.contract,
                ) == IdentityMatch::Same
            })
        {
            return Ok(existing.summary.clone());
        }

        let metadata =
            fs::metadata(&path).map_err(|error| safe_io_error(&error, "acquire_metadata"))?;
        let writable = OpenOptions::new().write(true).open(&path).is_ok();
        let display_name = safe_display_name(&path);
        let source_id = random_source_id();
        let descriptor = SourceDescriptor {
            identity: native_identity.contract.clone(),
            restoration_reference: glitchpad_core::source::opaque_restoration_reference(
                &native_identity.contract,
            ),
            display_name: display_name.clone(),
            claimed_media_type: claimed_media_type(&path),
            byte_length: Some(metadata.len()),
            modified_unix_ms: modified_unix_ms(&metadata),
            kind: SourceKind::File,
            capabilities: SourceCapabilities {
                read: true,
                seek: true,
                stream: true,
                metadata: true,
                observe_revision: true,
                revalidate: true,
                watch: true,
                write: writable,
                replace_atomically: writable,
                persistent_permission: false,
                rename: true,
                observe_deletion: true,
                reopen: true,
                reveal_location: false,
            },
        };
        let summary = DesktopSourceSummary {
            source_id: source_id.clone(),
            descriptor,
            external_revision,
        };
        state.sources.insert(
            source_id,
            SourceRecord {
                path,
                parent,
                native_identity,
                summary: summary.clone(),
                state: SourceState::Available,
                next_event_sequence: 1,
                watcher: None,
                session_revision: 1,
            },
        );
        Ok(summary)
    }

    /// Records the current core session revision used by save preconditions.
    ///
    /// # Errors
    ///
    /// Returns not found for a closed or unknown source.
    pub fn note_session_revision(
        &self,
        source_id: &SourceId,
        revision: u64,
    ) -> Result<(), CoreError> {
        self.record_mut(source_id)?.session_revision = revision;
        Ok(())
    }

    /// Reads one validated range without exceeding the operation budget.
    ///
    /// # Errors
    ///
    /// Returns a stable budget, capability, revision, permission, availability, or I/O error.
    pub fn read_range(
        &self,
        source_id: &SourceId,
        offset: u64,
        length: u64,
        operation_budget: u64,
    ) -> Result<ReadRangeResult, CoreError> {
        validate_chunk(offset, length, operation_budget)?;
        let state = self.lock_state()?;
        let record = state.sources.get(source_id).ok_or_else(source_not_found)?;
        ensure_available_revision(record)?;
        validate_source_offset(offset, record.summary.external_revision.byte_length)?;
        let mut file =
            File::open(&record.path).map_err(|error| safe_io_error(&error, "read_range_open"))?;
        file.seek(SeekFrom::Start(offset))
            .map_err(|error| safe_io_error(&error, "read_range_seek"))?;
        let requested_length = usize::try_from(length)
            .map_err(|_| budget_error("The requested byte range does not fit this platform"))?;
        let mut bytes = vec![0; requested_length];
        let read = file
            .read(&mut bytes)
            .map_err(|error| safe_io_error(&error, "read_range_read"))?;
        bytes.truncate(read);
        let read_length = u64::try_from(read)
            .map_err(|_| budget_error("The completed read does not fit the source contract"))?;
        let end = record
            .summary
            .external_revision
            .byte_length
            .is_some_and(|byte_length| offset.saturating_add(read_length) >= byte_length);
        Ok(ReadRangeResult {
            source_id: source_id.clone(),
            offset,
            bytes,
            end_of_source: end,
        })
    }

    /// Opens a bounded stream lease tied to the current external revision.
    ///
    /// # Errors
    ///
    /// Returns a stable error for invalid budgets or unavailable sources.
    pub fn open_stream(
        &self,
        source_id: &SourceId,
        offset: u64,
        total_budget: u64,
    ) -> Result<StreamLease, CoreError> {
        if total_budget == 0 || offset.checked_add(total_budget).is_none() {
            return Err(budget_error(
                "The stream budget is zero or overflows the source offset",
            ));
        }
        let mut state = self.lock_state()?;
        let active_streams = state
            .streams
            .values()
            .filter(|stream| &stream.lease.source_id == source_id)
            .count();
        if active_streams >= MAX_ACTIVE_STREAMS_PER_SOURCE {
            return Err(budget_error(
                "The source has reached its active stream lease limit",
            ));
        }
        let record = state.sources.get(source_id).ok_or_else(source_not_found)?;
        ensure_available_revision(record)?;
        validate_source_offset(offset, record.summary.external_revision.byte_length)?;
        let lease = StreamLease {
            stream_id: random_stream_id(),
            source_id: source_id.clone(),
            offset,
            total_budget,
            consumed: 0,
            external_revision: record.summary.external_revision.clone(),
        };
        state.streams.insert(
            lease.stream_id.clone(),
            StreamRecord {
                lease: lease.clone(),
            },
        );
        Ok(lease)
    }

    /// Reads the next bounded stream chunk.
    ///
    /// # Errors
    ///
    /// Returns not found for invalidated leases and budget exceeded for oversized chunks.
    pub fn read_stream(
        &self,
        stream_id: &StreamId,
        length: u64,
    ) -> Result<ReadRangeResult, CoreError> {
        let mut state = self.lock_state()?;
        let lease = state
            .streams
            .get(stream_id)
            .ok_or_else(|| {
                CoreError::new(
                    CoreErrorCategory::NotFound,
                    "The source stream was not found",
                    false,
                    false,
                )
            })?
            .lease
            .clone();
        if length > MAX_SOURCE_CHUNK_BYTES
            || lease.consumed.checked_add(length).is_none()
            || lease.consumed + length > lease.total_budget
        {
            return Err(budget_error(
                "The stream chunk exceeds its remaining budget",
            ));
        }
        let source_id = lease.source_id;
        let offset = lease.offset + lease.consumed;
        let expected_revision = lease.external_revision;
        let record = state.sources.get(&source_id).ok_or_else(source_not_found)?;
        let (_, current_revision) = observe_revision(&record.path)?;
        if current_revision != expected_revision {
            state.streams.remove(stream_id);
            return Err(CoreError::new(
                CoreErrorCategory::Conflict,
                "The source changed while the bounded stream was active",
                true,
                true,
            ));
        }
        let mut file =
            File::open(&record.path).map_err(|error| safe_io_error(&error, "read_stream_open"))?;
        file.seek(SeekFrom::Start(offset))
            .map_err(|error| safe_io_error(&error, "read_stream_seek"))?;
        let requested_length = usize::try_from(length)
            .map_err(|_| budget_error("The stream chunk does not fit this platform"))?;
        let mut bytes = vec![0; requested_length];
        let read = file
            .read(&mut bytes)
            .map_err(|error| safe_io_error(&error, "read_stream_read"))?;
        bytes.truncate(read);
        let consumed = u64::try_from(read)
            .map_err(|_| budget_error("The completed stream read does not fit the contract"))?;
        let end_of_source = current_revision
            .byte_length
            .is_some_and(|byte_length| offset.saturating_add(consumed) >= byte_length);
        let next_consumed = lease.consumed + consumed;
        if end_of_source || next_consumed >= lease.total_budget {
            state.streams.remove(stream_id);
        } else if let Some(stream) = state.streams.get_mut(stream_id) {
            stream.lease.consumed = next_consumed;
        }
        Ok(ReadRangeResult {
            source_id,
            offset,
            bytes,
            end_of_source,
        })
    }

    /// Returns safe source metadata without a native location.
    ///
    /// # Errors
    ///
    /// Returns not found or a stable metadata I/O error.
    pub fn query_metadata(&self, source_id: &SourceId) -> Result<SourceMetadata, CoreError> {
        let state = self.lock_state()?;
        let record = state.sources.get(source_id).ok_or_else(source_not_found)?;
        let metadata =
            fs::metadata(&record.path).map_err(|error| safe_io_error(&error, "query_metadata"))?;
        Ok(SourceMetadata {
            display_name: record.summary.descriptor.display_name.clone(),
            byte_length: Some(metadata.len()),
            modified_unix_nanos: metadata
                .modified()
                .ok()
                .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                .and_then(|value| u64::try_from(value.as_nanos()).ok()),
            read_only: metadata.permissions().readonly(),
        })
    }

    /// Returns a revision-bound metadata snapshot without serializing the native path.
    ///
    /// # Errors
    ///
    /// Returns a safe source lookup, revision, or metadata observation error.
    pub fn query_metadata_snapshot(
        &self,
        source_id: &SourceId,
    ) -> Result<SourceMetadataSnapshot, CoreError> {
        let state = self.lock_state()?;
        let record = state.sources.get(source_id).ok_or_else(source_not_found)?;
        let metadata =
            fs::metadata(&record.path).map_err(|error| safe_io_error(&error, "query_metadata"))?;
        let (_, current_revision) = observe_revision_from_metadata(&record.path, &metadata)?;
        Ok(SourceMetadataSnapshot {
            source_id: source_id.clone(),
            external_revision: path_free_external_revision(source_id, &current_revision),
            display_name: record.summary.descriptor.display_name.clone(),
            source_kind: record.summary.descriptor.kind,
            byte_length: Some(metadata.len()),
            modified_unix_nanos: system_time_nanos(metadata.modified().ok()),
            created_unix_nanos: system_time_nanos(metadata.created().ok()),
            accessed_unix_nanos: system_time_nanos(metadata.accessed().ok()),
            write_state: if record.summary.descriptor.capabilities.write
                && !metadata.permissions().readonly()
            {
                SourceWriteState::Writable
            } else {
                SourceWriteState::ReadOnly
            },
            identity_confidence: record.summary.descriptor.identity.strength,
        })
    }

    /// Starts one bounded, revision-bound SHA-256 operation.
    ///
    /// # Errors
    ///
    /// Returns a safe validation, source lookup, revision, or stream creation error.
    pub fn start_integrity(
        &self,
        request: IntegrityStartRequest,
    ) -> Result<IntegrityProgress, CoreError> {
        let total_bytes = self.prepare_integrity_start(&request)?;
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
            return Ok(
                if self.integrity_revision_matches(
                    &request.source_id,
                    &request.expected_external_revision,
                )? {
                    integrity_progress(
                        &request,
                        0,
                        total_bytes,
                        IntegrityState::Ready,
                        Some(IntegrityHasher::default().finalize()),
                        None,
                    )
                } else {
                    integrity_progress(
                        &request,
                        0,
                        total_bytes,
                        IntegrityState::Stale,
                        None,
                        Some("source_revised"),
                    )
                },
            );
        }

        let lease = self.open_integrity_stream(
            &request.source_id,
            0,
            total_bytes.unwrap_or(MAX_INTEGRITY_SOURCE_BYTES),
            &request.expected_external_revision,
        )?;
        let progress = integrity_progress(
            &request,
            0,
            total_bytes,
            IntegrityState::Pending,
            None,
            None,
        );
        let mut state = self.lock_state()?;
        if state.integrity_operations.contains_key(&request.request_id) {
            state.streams.remove(&lease.stream_id);
            return Err(CoreError::new(
                CoreErrorCategory::InvalidInput,
                "The integrity request identifier is already active",
                false,
                false,
            ));
        }
        state.integrity_operations.insert(
            request.request_id.clone(),
            IntegrityOperation {
                request,
                stream_id: lease.stream_id,
                hasher: IntegrityHasher::default(),
                processed_bytes: 0,
                total_bytes,
            },
        );
        Ok(progress)
    }

    /// Advances one integrity operation by at most one source chunk.
    ///
    /// # Errors
    ///
    /// Returns a safe lookup or registry error. Source read failures are terminal progress values.
    pub fn advance_integrity(
        &self,
        request_id: &IntegrityRequestId,
    ) -> Result<IntegrityProgress, CoreError> {
        let mut operation = self
            .lock_state()?
            .integrity_operations
            .remove(request_id)
            .ok_or_else(integrity_not_found)?;
        let remaining = operation
            .total_bytes
            .unwrap_or(MAX_INTEGRITY_SOURCE_BYTES)
            .saturating_sub(operation.processed_bytes);
        let step = remaining.min(MAX_INTEGRITY_STEP_BYTES);
        if step == 0 {
            self.retire_stream(&operation.stream_id);
            return Ok(integrity_progress(
                &operation.request,
                operation.processed_bytes,
                operation.total_bytes,
                IntegrityState::Limited,
                None,
                Some("integrity_limit_reached"),
            ));
        }
        let read = match self.read_stream(&operation.stream_id, step) {
            Ok(read) => read,
            Err(error) => {
                self.retire_stream(&operation.stream_id);
                return Ok(failed_integrity_read(&operation, &error));
            }
        };
        operation.hasher.update(&read.bytes);
        operation.processed_bytes = operation
            .processed_bytes
            .saturating_add(u64::try_from(read.bytes.len()).unwrap_or(u64::MAX));

        if read.end_of_source {
            let revision_matches = self.integrity_revision_matches(
                &operation.request.source_id,
                &operation.request.expected_external_revision,
            )?;
            return Ok(if revision_matches {
                let digest = operation.hasher.finalize();
                integrity_progress(
                    &operation.request,
                    operation.processed_bytes,
                    operation.total_bytes,
                    IntegrityState::Ready,
                    Some(digest),
                    None,
                )
            } else {
                integrity_progress(
                    &operation.request,
                    operation.processed_bytes,
                    operation.total_bytes,
                    IntegrityState::Stale,
                    None,
                    Some("source_revised"),
                )
            });
        }
        if operation.processed_bytes >= MAX_INTEGRITY_SOURCE_BYTES {
            self.retire_stream(&operation.stream_id);
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
        let mut state = self.lock_state()?;
        if !state.sources.contains_key(&operation.request.source_id)
            || !state.streams.contains_key(&operation.stream_id)
        {
            return Ok(integrity_progress(
                &operation.request,
                operation.processed_bytes,
                operation.total_bytes,
                IntegrityState::Cancelled,
                None,
                Some("integrity_cancelled"),
            ));
        }
        state
            .integrity_operations
            .insert(request_id.clone(), operation);
        Ok(progress)
    }

    /// Cancels an integrity operation. Repeated cancellation is harmless.
    ///
    /// # Errors
    ///
    /// Returns an internal invariant error when the source registry is unavailable.
    pub fn cancel_integrity(&self, request_id: &IntegrityRequestId) -> Result<bool, CoreError> {
        let mut state = self.lock_state()?;
        let Some(operation) = state.integrity_operations.remove(request_id) else {
            return Ok(false);
        };
        state.streams.remove(&operation.stream_id);
        Ok(true)
    }

    /// Returns the number of live operations for cleanup conformance tests.
    ///
    /// # Errors
    ///
    /// Returns an internal invariant error when the source registry is unavailable.
    pub fn active_integrity_operation_count(&self) -> Result<usize, CoreError> {
        Ok(self.lock_state()?.integrity_operations.len())
    }

    /// Starts one parent-aware native watcher if it is not already active.
    ///
    /// # Errors
    ///
    /// Returns not found or a stable watcher backend error.
    pub fn start_watch(&self, source_id: &SourceId) -> Result<(), CoreError> {
        let mut record = self.record_mut(source_id)?;
        if record.watcher.is_none() {
            record.watcher = Some(WatchRegistration::start(&record.path)?);
        }
        Ok(())
    }

    /// Drains at most `maximum` path-free ordered watcher events.
    ///
    /// # Errors
    ///
    /// Returns invalid input for an unbounded request or not found for a closed source.
    pub fn drain_events(
        &self,
        source_id: &SourceId,
        maximum: usize,
    ) -> Result<Vec<SourceEvent>, CoreError> {
        if maximum == 0 || maximum > 256 {
            return Err(CoreError::new(
                CoreErrorCategory::InvalidInput,
                "Watcher drain count must be between 1 and 256",
                false,
                false,
            ));
        }
        let events = {
            let mut record = self.record_mut(source_id)?;
            let Some(watcher) = record.watcher.as_ref() else {
                return Ok(Vec::new());
            };
            let mut mapped = Vec::new();
            while mapped.len() < maximum {
                let Some(event) = watcher.try_next(&record.path) else {
                    break;
                };
                mapped.push(event);
            }

            let mut events = Vec::with_capacity(mapped.len());
            for event in mapped {
                if let Some(candidate) = event.renamed_path
                    && is_regular_non_symlink(&candidate)
                    && identity::observe_identity(&candidate).file_id
                        == record.native_identity.file_id
                {
                    record.path = candidate;
                    record.summary.descriptor.display_name = safe_display_name(&record.path);
                }
                if event.state == SourceState::Changed
                    && let Ok((_, current)) = observe_revision(&record.path)
                    && current == record.summary.external_revision
                {
                    continue;
                }
                record.state = event.state;
                let sequence = record.next_event_sequence;
                record.next_event_sequence = record.next_event_sequence.saturating_add(1);
                events.push(SourceEvent {
                    source_id: source_id.clone(),
                    sequence,
                    state: event.state,
                    display_name: (event.state == SourceState::Renamed)
                        .then(|| record.summary.descriptor.display_name.clone()),
                    revalidation_required: event.state.requires_revalidation(),
                });
            }
            events
        };
        if !events.is_empty() {
            self.cancel_source_integrity(source_id)?;
        }
        Ok(events)
    }

    /// Reobserves the source and returns an explicit availability result.
    ///
    /// # Errors
    ///
    /// Returns only for an unknown source or poisoned host invariant; native availability failures are values.
    pub fn revalidate(
        &self,
        source_id: &SourceId,
        expected: &ExternalRevision,
    ) -> Result<RevalidationResult, CoreError> {
        let mut record = self.record_mut(source_id)?;
        if !record.path.exists()
            && let Some(renamed) = find_renamed_source(&record.parent, &record.native_identity)
        {
            record.path = renamed;
            record.summary.descriptor.display_name = safe_display_name(&record.path);
        }

        match observe_revision(&record.path) {
            Ok((identity, current)) => {
                let status = if &current == expected {
                    RevalidationStatus::Match
                } else {
                    RevalidationStatus::Changed
                };
                record.state = if status == RevalidationStatus::Match {
                    SourceState::Available
                } else {
                    SourceState::Changed
                };
                if status == RevalidationStatus::Match {
                    record.native_identity = identity;
                    record.summary.external_revision = current.clone();
                    record.summary.descriptor.identity = current.identity.clone();
                    record.summary.descriptor.byte_length = current.byte_length;
                    record.summary.descriptor.modified_unix_ms = current
                        .modified_unix_nanos
                        .map(|value| i64::try_from(value / 1_000_000).unwrap_or(i64::MAX));
                }
                Ok(RevalidationResult {
                    source_id: source_id.clone(),
                    expected: expected.clone(),
                    current: Some(current),
                    status,
                })
            }
            Err(error) => {
                let status = match error.category {
                    CoreErrorCategory::NotFound => RevalidationStatus::Deleted,
                    CoreErrorCategory::PermissionRevoked => RevalidationStatus::PermissionRevoked,
                    _ => RevalidationStatus::Unavailable,
                };
                record.state = match status {
                    RevalidationStatus::Deleted => SourceState::Deleted,
                    RevalidationStatus::PermissionRevoked => SourceState::PermissionRevoked,
                    _ => SourceState::Unavailable,
                };
                Ok(RevalidationResult {
                    source_id: source_id.clone(),
                    expected: expected.clone(),
                    current: None,
                    status,
                })
            }
        }
    }

    /// Commits one bounded payload after session and external revision checks.
    ///
    /// # Errors
    ///
    /// Returns a stable stale, conflict, capability, budget, acknowledgement, or persistence error.
    pub fn save(&self, request: SaveRequest) -> Result<SaveReceipt, CoreError> {
        let byte_count = u64::try_from(request.bytes.len())
            .map_err(|_| budget_error("The save payload does not fit this platform"))?;
        if byte_count > MAX_SAVE_BYTES {
            return Err(budget_error(
                "The save payload exceeds the 16 MiB host budget",
            ));
        }
        let mut record = self.record_mut(&request.source_id)?;
        if request.expected_session_revision != record.session_revision {
            return Err(CoreError::new(
                CoreErrorCategory::StaleSession,
                "The document session changed before save",
                true,
                true,
            ));
        }
        if !record.summary.descriptor.capabilities.write {
            return Err(CoreError::new(
                CoreErrorCategory::CapabilityDenied,
                "The desktop source is read-only",
                false,
                true,
            ));
        }
        let replacing_reviewed_external_change =
            request.expected_external_revision != record.summary.external_revision;
        if record.state != SourceState::Available
            && !(record.state == SourceState::Changed && replacing_reviewed_external_change)
        {
            return Err(CoreError::new(
                CoreErrorCategory::Conflict,
                "The source must be revalidated before save",
                true,
                true,
            ));
        }
        let (_, current) = observe_revision(&record.path)?;
        if current != request.expected_external_revision {
            record.state = SourceState::Changed;
            return Err(CoreError::new(
                CoreErrorCategory::Conflict,
                "The external source changed before save",
                true,
                true,
            ));
        }
        let guarantee = persistence::platform_guarantee();
        if replacing_reviewed_external_change {
            let authorization = request.overwrite_authorization.as_ref().ok_or_else(|| {
                CoreError::new(
                    CoreErrorCategory::AcknowledgementRequired,
                    "Overwriting a reviewed external change requires a second confirmation",
                    false,
                    true,
                )
            })?;
            if authorization.source_id != request.source_id
                || authorization.reviewed_external_revision != current
                || authorization.session_revision != request.expected_session_revision
                || authorization.durability != guarantee
            {
                return Err(CoreError::new(
                    CoreErrorCategory::StaleSession,
                    "The overwrite confirmation no longer matches the reviewed source revision",
                    true,
                    true,
                ));
            }
        }
        validate_durability_acknowledgement(&request, &current, guarantee)?;
        let actual_guarantee = match persistence::replace(&record.path, &request.bytes, &current) {
            Ok(guarantee) => guarantee,
            Err(error) if error.category == CoreErrorCategory::Conflict => {
                record.state = SourceState::Changed;
                return Err(error);
            }
            Err(error) => return Err(error),
        };
        let (native_identity, new_revision) = observe_revision(&record.path)?;
        let previous_external_revision = current;
        record.native_identity = native_identity;
        record.summary.external_revision = new_revision.clone();
        record.summary.descriptor.identity = new_revision.identity.clone();
        record.summary.descriptor.byte_length = new_revision.byte_length;
        record.summary.descriptor.modified_unix_ms = new_revision
            .modified_unix_nanos
            .map(|value| i64::try_from(value / 1_000_000).unwrap_or(i64::MAX));
        record.state = SourceState::Available;
        Ok(SaveReceipt {
            operation_id: request.operation_id,
            source_id: request.source_id,
            accepted_session_revision: request.expected_session_revision,
            previous_external_revision,
            new_external_revision: new_revision,
            byte_count,
            durability: actual_guarantee,
        })
    }

    /// Commits a bounded payload to a user-selected desktop destination.
    ///
    /// # Errors
    ///
    /// Returns a safe budget or persistence error without exposing the destination path.
    pub fn save_as(&self, path: &Path, bytes: &[u8]) -> Result<DurabilityGuarantee, CoreError> {
        let byte_count = u64::try_from(bytes.len())
            .map_err(|_| budget_error("The Save As payload does not fit this platform"))?;
        if byte_count > MAX_SAVE_BYTES {
            return Err(budget_error(
                "The Save As payload exceeds the 16 MiB host budget",
            ));
        }
        persistence::save_as(path, bytes)
    }

    /// Invalidates a source and all leases derived from it.
    ///
    /// # Errors
    ///
    /// Returns not found for an already closed or unknown source.
    pub fn close(&self, source_id: &SourceId) -> Result<(), CoreError> {
        let mut state = self.lock_state()?;
        if state.sources.remove(source_id).is_none() {
            return Err(source_not_found());
        }
        let retired_integrity_streams = state
            .integrity_operations
            .extract_if(|_, operation| &operation.request.source_id == source_id)
            .map(|(_, operation)| operation.stream_id)
            .collect::<Vec<_>>();
        for stream_id in retired_integrity_streams {
            state.streams.remove(&stream_id);
        }
        state
            .streams
            .retain(|_, stream| &stream.lease.source_id != source_id);
        Ok(())
    }

    /// Creates a short-lived proof from native interface event handling.
    pub fn begin_user_activation(&self) -> UserActivationProof {
        let proof = UserActivationProof {
            id: UserActivationId(Uuid::new_v4().to_string()),
        };
        if let Ok(mut state) = self.state.lock() {
            state.activations.insert(proof.id.clone(), Instant::now());
        }
        proof
    }

    /// Validates a target and consumes one current activation proof.
    ///
    /// # Errors
    ///
    /// Returns capability denied for invalid activation or invalid input for an unsafe target.
    pub fn authorize_external_link(
        &self,
        proof: UserActivationProof,
        target: &str,
    ) -> Result<LinkAuthorization, CoreError> {
        let UserActivationProof { id } = proof;
        let mut state = self.lock_state()?;
        let created = state.activations.remove(&id).ok_or_else(|| {
            CoreError::new(
                CoreErrorCategory::CapabilityDenied,
                "External links require a current explicit user action",
                false,
                false,
            )
        })?;
        if created.elapsed() > USER_ACTIVATION_LIFETIME {
            return Err(CoreError::new(
                CoreErrorCategory::CapabilityDenied,
                "The external-link user action expired",
                false,
                false,
            ));
        }
        let normalized_target = validate_external_target(target)?;
        let authorization = LinkAuthorization {
            id: LinkAuthorizationId(Uuid::new_v4().to_string()),
            normalized_target,
        };
        state.link_authorizations.insert(
            authorization.id.clone(),
            authorization.normalized_target.clone(),
        );
        Ok(authorization)
    }

    /// Consumes a one-use authorization for the later narrow native opener.
    ///
    /// # Errors
    ///
    /// Returns capability denied for a replayed or unknown authorization.
    pub fn consume_link_authorization(
        &self,
        authorization: LinkAuthorization,
    ) -> Result<String, CoreError> {
        let LinkAuthorization {
            id,
            normalized_target,
        } = authorization;
        let mut state = self.lock_state()?;
        let target = state.link_authorizations.remove(&id).ok_or_else(|| {
            CoreError::new(
                CoreErrorCategory::CapabilityDenied,
                "The external-link authorization is invalid or already used",
                false,
                false,
            )
        })?;
        if target != normalized_target {
            return Err(CoreError::new(
                CoreErrorCategory::CapabilityDenied,
                "The external-link authorization target changed",
                false,
                false,
            ));
        }
        Ok(target)
    }

    fn lock_state(&self) -> Result<MutexGuard<'_, HostState>, CoreError> {
        self.state.lock().map_err(|_| {
            CoreError::new(
                CoreErrorCategory::InternalInvariant,
                "The desktop source registry is unavailable",
                false,
                false,
            )
        })
    }

    fn record_mut(&self, source_id: &SourceId) -> Result<SourceRecordGuard<'_>, CoreError> {
        let guard = self.lock_state()?;
        if !guard.sources.contains_key(source_id) {
            return Err(source_not_found());
        }
        Ok(SourceRecordGuard {
            guard,
            source_id: source_id.clone(),
        })
    }

    fn retire_stream(&self, stream_id: &StreamId) {
        if let Ok(mut state) = self.state.lock() {
            state.streams.remove(stream_id);
        }
    }

    fn cancel_source_integrity(&self, source_id: &SourceId) -> Result<(), CoreError> {
        let mut state = self.lock_state()?;
        let retired_streams = state
            .integrity_operations
            .extract_if(|_, operation| &operation.request.source_id == source_id)
            .map(|(_, operation)| operation.stream_id)
            .collect::<Vec<_>>();
        for stream_id in retired_streams {
            state.streams.remove(&stream_id);
        }
        Ok(())
    }

    fn integrity_revision_matches(
        &self,
        source_id: &SourceId,
        expected: &ExternalRevision,
    ) -> Result<bool, CoreError> {
        let state = self.lock_state()?;
        let record = state.sources.get(source_id).ok_or_else(source_not_found)?;
        let (_, current) = observe_revision(&record.path)?;
        Ok(integrity_expected_matches(source_id, expected, &current))
    }

    fn prepare_integrity_start(
        &self,
        request: &IntegrityStartRequest,
    ) -> Result<Option<u64>, CoreError> {
        if Uuid::parse_str(&request.request_id.0).is_err() {
            return Err(CoreError::new(
                CoreErrorCategory::InvalidInput,
                "The integrity request identifier is invalid",
                false,
                false,
            ));
        }
        let state = self.lock_state()?;
        if state.integrity_operations.contains_key(&request.request_id) {
            return Err(CoreError::new(
                CoreErrorCategory::InvalidInput,
                "The integrity request identifier is already active",
                false,
                false,
            ));
        }
        let record = state
            .sources
            .get(&request.source_id)
            .ok_or_else(source_not_found)?;
        let (_, current_revision) = observe_revision(&record.path)?;
        if !integrity_expected_matches(
            &request.source_id,
            &request.expected_external_revision,
            &current_revision,
        ) {
            return Err(integrity_conflict());
        }
        Ok(current_revision.byte_length)
    }

    fn open_integrity_stream(
        &self,
        source_id: &SourceId,
        offset: u64,
        total_budget: u64,
        expected_revision: &ExternalRevision,
    ) -> Result<StreamLease, CoreError> {
        let mut state = self.lock_state()?;
        let active_streams = state
            .streams
            .values()
            .filter(|stream| &stream.lease.source_id == source_id)
            .count();
        if active_streams >= MAX_ACTIVE_STREAMS_PER_SOURCE {
            return Err(budget_error(
                "The source has reached its active stream lease limit",
            ));
        }
        let record = state.sources.get(source_id).ok_or_else(source_not_found)?;
        let (_, current_revision) = observe_revision(&record.path)?;
        if !integrity_expected_matches(source_id, expected_revision, &current_revision) {
            return Err(integrity_conflict());
        }
        validate_source_offset(offset, current_revision.byte_length)?;
        let lease = StreamLease {
            stream_id: random_stream_id(),
            source_id: source_id.clone(),
            offset,
            total_budget,
            consumed: 0,
            external_revision: current_revision,
        };
        state.streams.insert(
            lease.stream_id.clone(),
            StreamRecord {
                lease: lease.clone(),
            },
        );
        Ok(lease)
    }
}

struct SourceRecordGuard<'a> {
    guard: MutexGuard<'a, HostState>,
    source_id: SourceId,
}

impl std::ops::Deref for SourceRecordGuard<'_> {
    type Target = SourceRecord;

    fn deref(&self) -> &Self::Target {
        self.guard
            .sources
            .get(&self.source_id)
            .expect("source guard validates existence")
    }
}

impl std::ops::DerefMut for SourceRecordGuard<'_> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.guard
            .sources
            .get_mut(&self.source_id)
            .expect("source guard validates existence")
    }
}

fn ensure_available_revision(record: &SourceRecord) -> Result<(), CoreError> {
    if record.state != SourceState::Available {
        return Err(CoreError::new(
            CoreErrorCategory::Conflict,
            "The source requires revalidation before reading",
            true,
            true,
        ));
    }
    let (_, current) = observe_revision(&record.path)?;
    if current != record.summary.external_revision {
        return Err(CoreError::new(
            CoreErrorCategory::Conflict,
            "The source changed before the bounded read",
            true,
            true,
        ));
    }
    Ok(())
}

fn validate_chunk(offset: u64, length: u64, operation_budget: u64) -> Result<(), CoreError> {
    if length > MAX_SOURCE_CHUNK_BYTES
        || length > operation_budget
        || offset.checked_add(length).is_none()
    {
        return Err(budget_error(
            "The requested byte range exceeds its operation budget",
        ));
    }
    Ok(())
}

fn validate_source_offset(offset: u64, byte_length: Option<u64>) -> Result<(), CoreError> {
    if byte_length.is_some_and(|byte_length| offset > byte_length) {
        return Err(CoreError::new(
            CoreErrorCategory::InvalidInput,
            "The requested byte offset is beyond the current source",
            false,
            false,
        ));
    }
    Ok(())
}

fn validate_durability_acknowledgement(
    request: &SaveRequest,
    current: &ExternalRevision,
    guarantee: DurabilityGuarantee,
) -> Result<(), CoreError> {
    if guarantee.requires_acknowledgement()
        && request
            .durability_acknowledgement
            .as_ref()
            .is_none_or(|acknowledgement| {
                acknowledgement.source_id != request.source_id
                    || acknowledgement.expected_external_revision != *current
                    || acknowledgement.guarantee != guarantee
            })
    {
        return Err(CoreError::new(
            CoreErrorCategory::AcknowledgementRequired,
            "This source requires acknowledgement of a weaker persistence guarantee",
            false,
            true,
        ));
    }
    Ok(())
}

fn budget_error(summary: &str) -> CoreError {
    CoreError::new(CoreErrorCategory::BudgetExceeded, summary, false, false)
}

fn source_not_found() -> CoreError {
    CoreError::new(
        CoreErrorCategory::NotFound,
        "The desktop source was not found",
        false,
        false,
    )
}

fn integrity_not_found() -> CoreError {
    CoreError::new(
        CoreErrorCategory::NotFound,
        "The integrity operation was not found",
        false,
        false,
    )
}

fn integrity_conflict() -> CoreError {
    CoreError::new(
        CoreErrorCategory::Conflict,
        "The source changed before integrity calculation",
        true,
        true,
    )
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

fn failed_integrity_read(operation: &IntegrityOperation, error: &CoreError) -> IntegrityProgress {
    let (state, code) = if error.category == CoreErrorCategory::Conflict {
        (IntegrityState::Stale, "source_revised")
    } else {
        (IntegrityState::Failed, "source_read_failed")
    };
    integrity_progress(
        &operation.request,
        operation.processed_bytes,
        operation.total_bytes,
        state,
        None,
        Some(code),
    )
}

fn integrity_expected_matches(
    source_id: &SourceId,
    expected: &ExternalRevision,
    current: &ExternalRevision,
) -> bool {
    expected == current || expected == &path_free_external_revision(source_id, current)
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
        identity: glitchpad_core::contracts::DocumentIdentity {
            authority: glitchpad_core::contracts::IdentityAuthority::Filesystem,
            scope: "desktop_source".into(),
            token: source_id.0.clone(),
            strength: revision.identity.strength,
        },
        byte_length: revision.byte_length,
        modified_unix_nanos: revision.modified_unix_nanos,
        change_token: Some(format!("sha256:{}", evidence.finalize())),
    }
}

fn system_time_nanos(value: Option<std::time::SystemTime>) -> Option<u64> {
    value
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .and_then(|value| u64::try_from(value.as_nanos()).ok())
}

pub(super) fn safe_io_error(error: &std::io::Error, operation: &str) -> CoreError {
    let category = match error.kind() {
        std::io::ErrorKind::NotFound => CoreErrorCategory::NotFound,
        std::io::ErrorKind::PermissionDenied => CoreErrorCategory::PermissionRevoked,
        std::io::ErrorKind::StorageFull => CoreErrorCategory::StorageFull,
        _ => CoreErrorCategory::Unavailable,
    };
    CoreError::new(
        category,
        "The desktop source operation could not complete",
        true,
        true,
    )
    .with_context("operation", operation)
    .with_context("error_kind", format!("{:?}", error.kind()))
}

pub(super) fn safe_watch_error(error: &notify::Error, operation: &str) -> CoreError {
    CoreError::new(
        CoreErrorCategory::Unavailable,
        "The desktop source watcher could not start",
        true,
        true,
    )
    .with_context("operation", operation)
    .with_context("watch_error_kind", format!("{:?}", error.kind))
}

fn safe_display_name(path: &Path) -> String {
    let value = path
        .file_name()
        .map(|name| name.to_string_lossy())
        .unwrap_or_default();
    let value: String = value
        .chars()
        .filter(|character| !character.is_control())
        .collect();
    if value.is_empty() {
        "Untitled document".into()
    } else {
        value.chars().take(255).collect()
    }
}

fn claimed_media_type(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_string_lossy().to_ascii_lowercase();
    match extension.as_str() {
        "md" | "markdown" => Some("text/markdown".into()),
        "mmd" | "mermaid" => Some("text/vnd.mermaid".into()),
        "txt" => Some("text/plain".into()),
        "json" => Some("application/json".into()),
        _ => None,
    }
}

fn modified_unix_ms(metadata: &fs::Metadata) -> Option<i64> {
    metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .and_then(|value| i64::try_from(value.as_millis()).ok())
}

fn find_renamed_source(parent: &Path, identity: &NativeIdentity) -> Option<PathBuf> {
    let expected = identity.file_id.as_ref()?;
    fs::read_dir(parent)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|candidate| {
            is_regular_non_symlink(candidate)
                && identity::observe_identity(candidate).file_id.as_ref() == Some(expected)
        })
}

fn is_regular_non_symlink(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .is_ok_and(|metadata| metadata.is_file() && !metadata.file_type().is_symlink())
}

fn validate_external_target(target: &str) -> Result<String, CoreError> {
    if target.is_empty()
        || target
            .chars()
            .any(|character| character.is_control() || matches!(character, '\u{2028}' | '\u{2029}'))
        || contains_encoded_control(target)
    {
        return Err(unsafe_link_error());
    }
    let parsed = Url::parse(target).map_err(|_| unsafe_link_error())?;
    match parsed.scheme().to_ascii_lowercase().as_str() {
        "https" | "http"
            if parsed.host_str().is_some()
                && parsed.username().is_empty()
                && parsed.password().is_none() => {}
        "mailto" if !parsed.path().is_empty() => {}
        _ => return Err(unsafe_link_error()),
    }
    Ok(parsed.to_string())
}

fn contains_encoded_control(target: &str) -> bool {
    let lower = target.to_ascii_lowercase();
    if lower.contains("%e2%80%a8") || lower.contains("%e2%80%a9") {
        return true;
    }
    lower.as_bytes().windows(3).any(|window| {
        window[0] == b'%'
            && hex_value(window[1])
                .zip(hex_value(window[2]))
                .is_some_and(|(high, low)| {
                    let value = high * 16 + low;
                    value <= 0x1f || value == 0x7f
                })
    })
}

const fn hex_value(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        _ => None,
    }
}

fn unsafe_link_error() -> CoreError {
    CoreError::new(
        CoreErrorCategory::InvalidInput,
        "The external link target is malformed or uses an unsupported scheme",
        false,
        false,
    )
}

fn random_source_id() -> SourceId {
    SourceId(Uuid::new_v4().to_string())
}

fn random_stream_id() -> StreamId {
    StreamId(Uuid::new_v4().to_string())
}

#[cfg(test)]
pub(crate) mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use glitchpad_core::contracts::{CoreErrorCategory, IdentityStrength};
    use glitchpad_core::source::{MAX_SOURCE_CHUNK_BYTES, SaveRequest};
    use uuid::Uuid;

    use super::*;

    pub(crate) struct TemporarySource {
        directory: PathBuf,
        path: PathBuf,
    }

    impl TemporarySource {
        pub(crate) fn new(bytes: &[u8]) -> Self {
            let directory = std::env::temp_dir().join(format!("glitchpad-s006-{}", Uuid::new_v4()));
            fs::create_dir(&directory).expect("create temporary source directory");
            let path = directory.join("source.md");
            fs::write(&path, bytes).expect("write temporary source");
            Self { directory, path }
        }

        pub(crate) fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TemporarySource {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.directory);
        }
    }

    #[test]
    fn trusted_acquisition_is_opaque_and_deduplicates_strong_identity() {
        let source = TemporarySource::new(b"# document");
        let host = DesktopSourceHost::new();
        let first = host
            .acquire(DesktopDelivery::dialog(source.path()))
            .expect("acquire dialog source");
        let second = host
            .acquire(DesktopDelivery::dropped(source.path()))
            .expect("acquire dropped source");
        assert_eq!(first.source_id, second.source_id);
        assert_eq!(first.descriptor.identity.strength, IdentityStrength::Strong);
        assert!(!first.descriptor.capabilities.reveal_location);
        let serialized = serde_json::to_string(&first).expect("serialize summary");
        assert!(!serialized.contains(&source.path().to_string_lossy().to_string()));
    }

    #[test]
    fn bounded_ranges_reject_oversize_and_overflow_before_io() {
        let source = TemporarySource::new(b"bounded bytes");
        let host = DesktopSourceHost::new();
        let summary = host
            .acquire(DesktopDelivery::command_line(source.path()))
            .expect("acquire source");
        let result = host
            .read_range(&summary.source_id, 0, 7, 7)
            .expect("read bounded range");
        assert_eq!(result.bytes, b"bounded");
        assert!(
            host.read_range(&summary.source_id, 13, 0, 0)
                .expect("allow zero-length read at end")
                .bytes
                .is_empty()
        );
        assert_eq!(
            host.read_range(&summary.source_id, 14, 0, 0)
                .expect_err("reject offset beyond source")
                .category,
            CoreErrorCategory::InvalidInput
        );
        assert_eq!(
            host.read_range(
                &summary.source_id,
                0,
                MAX_SOURCE_CHUNK_BYTES + 1,
                MAX_SOURCE_CHUNK_BYTES + 1,
            )
            .expect_err("reject oversized read")
            .category,
            CoreErrorCategory::BudgetExceeded
        );
        assert_eq!(
            host.read_range(&summary.source_id, u64::MAX, 1, 1)
                .expect_err("reject overflow")
                .category,
            CoreErrorCategory::BudgetExceeded
        );
    }

    #[test]
    fn stream_leases_are_capped_and_retired_at_their_terminal_read() {
        let source = TemporarySource::new(b"x");
        let host = DesktopSourceHost::new();
        let summary = host
            .acquire(DesktopDelivery::dialog(source.path()))
            .expect("acquire source");
        let leases: Vec<_> = (0..MAX_ACTIVE_STREAMS_PER_SOURCE)
            .map(|_| {
                host.open_stream(&summary.source_id, 0, 1)
                    .expect("open bounded stream")
            })
            .collect();
        assert_eq!(
            host.open_stream(&summary.source_id, 0, 1)
                .expect_err("reject stream above source cap")
                .category,
            CoreErrorCategory::BudgetExceeded
        );
        let completed = host
            .read_stream(&leases[0].stream_id, 1)
            .expect("complete stream");
        assert!(completed.end_of_source);
        assert_eq!(
            host.read_stream(&leases[0].stream_id, 1)
                .expect_err("terminal stream is retired")
                .category,
            CoreErrorCategory::NotFound
        );
        host.open_stream(&summary.source_id, 0, 1)
            .expect("retired stream releases capacity");
    }

    #[test]
    fn directories_are_rejected_without_granting_source_authority() {
        let source = TemporarySource::new(b"regular file");
        let host = DesktopSourceHost::new();
        assert_eq!(
            host.acquire(DesktopDelivery::dialog(&source.directory))
                .expect_err("reject directory")
                .category,
            CoreErrorCategory::UnsupportedInput
        );
    }

    #[test]
    fn stale_external_revision_never_replaces_source() {
        let source = TemporarySource::new(b"original");
        let host = DesktopSourceHost::new();
        let summary = host
            .acquire(DesktopDelivery::association(source.path()))
            .expect("acquire source");
        fs::write(source.path(), b"external edit").expect("external edit");
        let error = host
            .save(SaveRequest {
                operation_id: glitchpad_core::source::SaveOperationId(1),
                source_id: summary.source_id,
                expected_external_revision: summary.external_revision,
                expected_session_revision: 1,
                bytes: b"local edit".to_vec(),
                durability_acknowledgement: None,
                overwrite_authorization: None,
            })
            .expect_err("stale save must fail");
        assert_eq!(error.category, CoreErrorCategory::Conflict);
        assert_eq!(
            fs::read(source.path()).expect("read source"),
            b"external edit"
        );
    }

    #[test]
    fn successful_save_returns_durable_revision_and_close_invalidates_authority() {
        let source = TemporarySource::new(b"original");
        let host = DesktopSourceHost::new();
        let summary = host
            .acquire(DesktopDelivery::dialog(source.path()))
            .expect("acquire source");
        let receipt = host
            .save(SaveRequest {
                operation_id: glitchpad_core::source::SaveOperationId(2),
                source_id: summary.source_id.clone(),
                expected_external_revision: summary.external_revision,
                expected_session_revision: 1,
                bytes: b"saved".to_vec(),
                durability_acknowledgement: None,
                overwrite_authorization: None,
            })
            .expect("save source");
        assert_eq!(receipt.byte_count, 5);
        assert_eq!(
            fs::read(source.path()).expect("read saved source"),
            b"saved"
        );
        host.close(&summary.source_id).expect("close source");
        assert_eq!(
            host.query_metadata(&summary.source_id)
                .expect_err("closed source is unavailable")
                .category,
            CoreErrorCategory::NotFound
        );
    }

    #[test]
    fn stale_session_and_oversized_payloads_fail_before_replacement() {
        let source = TemporarySource::new(b"original");
        let host = DesktopSourceHost::new();
        let summary = host
            .acquire(DesktopDelivery::dialog(source.path()))
            .expect("acquire source");
        host.note_session_revision(&summary.source_id, 2)
            .expect("record session revision");
        let request = |expected_session_revision, bytes| SaveRequest {
            operation_id: glitchpad_core::source::SaveOperationId(3),
            source_id: summary.source_id.clone(),
            expected_external_revision: summary.external_revision.clone(),
            expected_session_revision,
            bytes,
            durability_acknowledgement: None,
            overwrite_authorization: None,
        };
        assert_eq!(
            host.save(request(1, b"stale edit".to_vec()))
                .expect_err("reject stale session")
                .category,
            CoreErrorCategory::StaleSession
        );
        assert_eq!(
            host.save(request(
                2,
                vec![0; usize::try_from(MAX_SAVE_BYTES).expect("save budget fits usize") + 1],
            ))
            .expect_err("reject oversized save")
            .category,
            CoreErrorCategory::BudgetExceeded
        );
        assert_eq!(fs::read(source.path()).expect("read source"), b"original");
    }

    #[test]
    fn read_only_capability_rejects_save_before_persistence() {
        let source = TemporarySource::new(b"original");
        let host = DesktopSourceHost::new();
        let summary = host
            .acquire(DesktopDelivery::dialog(source.path()))
            .expect("acquire source");
        host.state
            .lock()
            .expect("lock host state")
            .sources
            .get_mut(&summary.source_id)
            .expect("source record")
            .summary
            .descriptor
            .capabilities
            .write = false;
        let error = host
            .save(SaveRequest {
                operation_id: glitchpad_core::source::SaveOperationId(4),
                source_id: summary.source_id,
                expected_external_revision: summary.external_revision,
                expected_session_revision: 1,
                bytes: b"replacement".to_vec(),
                durability_acknowledgement: None,
                overwrite_authorization: None,
            })
            .expect_err("read-only source must reject save");
        assert_eq!(error.category, CoreErrorCategory::CapabilityDenied);
        assert_eq!(fs::read(source.path()).expect("read source"), b"original");
    }

    #[test]
    fn weaker_guarantee_acknowledgement_is_revision_bound() {
        let source_id = SourceId("weaker-source".into());
        let revision = ExternalRevision {
            identity: glitchpad_core::contracts::DocumentIdentity {
                authority: glitchpad_core::contracts::IdentityAuthority::Synthetic,
                scope: "tests".into(),
                token: "weaker-revision".into(),
                strength: IdentityStrength::Strong,
            },
            byte_length: Some(8),
            modified_unix_nanos: Some(1),
            change_token: None,
        };
        let mut request = SaveRequest {
            operation_id: glitchpad_core::source::SaveOperationId(5),
            source_id: source_id.clone(),
            expected_external_revision: revision.clone(),
            expected_session_revision: 1,
            bytes: b"replacement".to_vec(),
            durability_acknowledgement: None,
            overwrite_authorization: None,
        };
        assert_eq!(
            validate_durability_acknowledgement(
                &request,
                &revision,
                DurabilityGuarantee::RecoverableNonAtomic,
            )
            .expect_err("require acknowledgement")
            .category,
            CoreErrorCategory::AcknowledgementRequired
        );
        request.durability_acknowledgement =
            Some(glitchpad_core::source::DurabilityAcknowledgement {
                source_id,
                expected_external_revision: revision.clone(),
                guarantee: DurabilityGuarantee::RecoverableNonAtomic,
            });
        validate_durability_acknowledgement(
            &request,
            &revision,
            DurabilityGuarantee::RecoverableNonAtomic,
        )
        .expect("accept matching acknowledgement");
    }

    #[test]
    fn link_policy_requires_one_use_activation_and_safe_scheme() {
        let host = DesktopSourceHost::new();
        let proof = host.begin_user_activation();
        let authorization = host
            .authorize_external_link(proof.clone(), "HTTPS://example.com/document")
            .expect("authorize https");
        assert_eq!(
            host.authorize_external_link(proof, "https://example.com")
                .expect_err("activation cannot replay")
                .category,
            CoreErrorCategory::CapabilityDenied
        );
        assert_eq!(
            host.consume_link_authorization(authorization.clone())
                .expect("consume authorization"),
            "https://example.com/document"
        );
        assert_eq!(
            host.consume_link_authorization(authorization)
                .expect_err("authorization cannot replay")
                .category,
            CoreErrorCategory::CapabilityDenied
        );
        let rejected = host.begin_user_activation();
        assert_eq!(
            host.authorize_external_link(rejected, "file:///etc/passwd")
                .expect_err("reject file scheme")
                .category,
            CoreErrorCategory::InvalidInput
        );
        for unsafe_target in [
            "https://user:secret@example.com",
            "https://example.com/%0aheader",
            "https://example.com/%E2%80%A8separator",
        ] {
            let proof = host.begin_user_activation();
            assert_eq!(
                host.authorize_external_link(proof, unsafe_target)
                    .expect_err("reject unsafe target")
                    .category,
                CoreErrorCategory::InvalidInput
            );
        }
    }

    #[test]
    fn expired_user_activation_cannot_authorize_a_link() {
        let host = DesktopSourceHost::new();
        let proof = host.begin_user_activation();
        let expired = Instant::now()
            .checked_sub(USER_ACTIVATION_LIFETIME + Duration::from_millis(1))
            .expect("activation lifetime fits Instant");
        host.state
            .lock()
            .expect("lock host state")
            .activations
            .insert(proof.id.clone(), expired);
        assert_eq!(
            host.authorize_external_link(proof, "https://example.com")
                .expect_err("reject expired activation")
                .category,
            CoreErrorCategory::CapabilityDenied
        );
    }
}
