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
    DesktopSourceSummary, DurabilityGuarantee, ExternalRevision, LinkAuthorization,
    LinkAuthorizationId, MAX_SAVE_BYTES, MAX_SOURCE_CHUNK_BYTES, ReadRangeResult,
    RevalidationResult, RevalidationStatus, SaveReceipt, SaveRequest, SourceEvent, SourceId,
    SourceMetadata, SourceState, StreamId, StreamLease, UserActivationId, UserActivationProof,
};
use url::Url;
use uuid::Uuid;

use self::identity::{NativeIdentity, observe_revision};
use self::watch::WatchRegistration;

const USER_ACTIVATION_LIFETIME: Duration = Duration::from_secs(1);

#[tauri::command]
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
pub(crate) fn open_source_stream(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
    offset: u64,
    total_budget: u64,
) -> Result<StreamLease, CoreError> {
    host.open_stream(&source_id, offset, total_budget)
}

#[tauri::command]
pub(crate) fn read_source_stream(
    host: tauri::State<'_, DesktopSourceHost>,
    stream_id: StreamId,
    length: u64,
) -> Result<ReadRangeResult, CoreError> {
    host.read_stream(&stream_id, length)
}

#[tauri::command]
pub(crate) fn query_source_metadata(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
) -> Result<SourceMetadata, CoreError> {
    host.query_metadata(&source_id)
}

#[tauri::command]
pub(crate) fn start_source_watch(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
) -> Result<(), CoreError> {
    host.start_watch(&source_id)
}

#[tauri::command]
pub(crate) fn drain_source_events(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
    maximum: usize,
) -> Result<Vec<SourceEvent>, CoreError> {
    host.drain_events(&source_id, maximum)
}

#[tauri::command]
pub(crate) fn revalidate_source(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
    expected: ExternalRevision,
) -> Result<RevalidationResult, CoreError> {
    host.revalidate(&source_id, &expected)
}

#[tauri::command]
pub(crate) fn save_source(
    host: tauri::State<'_, DesktopSourceHost>,
    request: SaveRequest,
) -> Result<SaveReceipt, CoreError> {
    host.save(request)
}

#[tauri::command]
pub(crate) fn close_source(
    host: tauri::State<'_, DesktopSourceHost>,
    source_id: SourceId,
) -> Result<(), CoreError> {
    host.close(&source_id)
}

/// Trusted native channel that delivered one desktop path.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
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

#[derive(Default)]
struct HostState {
    sources: HashMap<SourceId, SourceRecord>,
    streams: HashMap<StreamId, StreamRecord>,
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

    /// Acquires or returns an existing strongly identified regular file.
    ///
    /// # Errors
    ///
    /// Returns a safe error when the delivery is missing, inaccessible, a symlink, or not a regular file.
    pub fn acquire(&self, delivery: DesktopDelivery) -> Result<DesktopSourceSummary, CoreError> {
        let symlink_metadata = fs::symlink_metadata(&delivery.path)
            .map_err(|error| safe_io_error(&error, "acquire_metadata"))?;
        if symlink_metadata.file_type().is_symlink() || !symlink_metadata.is_file() {
            return Err(CoreError::new(
                CoreErrorCategory::UnsupportedInput,
                "Desktop sources must be regular files and cannot be symbolic links",
                false,
                false,
            ));
        }
        let path = fs::canonicalize(&delivery.path)
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

        let metadata = fs::metadata(&path)
            .map_err(|error| safe_io_error(&error, "acquire_metadata"))?;
        let writable = OpenOptions::new().write(true).open(&path).is_ok();
        let display_name = safe_display_name(&path);
        let source_id = random_source_id();
        let descriptor = SourceDescriptor {
            identity: native_identity.contract.clone(),
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
                reveal_location: true,
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
        let mut file = File::open(&record.path)
            .map_err(|error| safe_io_error(&error, "read_range_open"))?;
        file.seek(SeekFrom::Start(offset))
            .map_err(|error| safe_io_error(&error, "read_range_seek"))?;
        let mut bytes = vec![0; usize::try_from(length).expect("chunk size is bounded")];
        let read = file
            .read(&mut bytes)
            .map_err(|error| safe_io_error(&error, "read_range_read"))?;
        bytes.truncate(read);
        let end = offset.saturating_add(u64::try_from(read).expect("read length fits u64"))
            >= record.summary.external_revision.byte_length;
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
            return Err(budget_error("The stream budget is zero or overflows the source offset"));
        }
        let mut state = self.lock_state()?;
        let record = state.sources.get(source_id).ok_or_else(source_not_found)?;
        ensure_available_revision(record)?;
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
        let lease = state.streams.get(stream_id).ok_or_else(|| {
            CoreError::new(
                CoreErrorCategory::NotFound,
                "The source stream was not found",
                false,
                false,
            )
        })?.lease.clone();
        if length > MAX_SOURCE_CHUNK_BYTES
            || lease.consumed.checked_add(length).is_none()
            || lease.consumed + length > lease.total_budget
        {
            return Err(budget_error("The stream chunk exceeds its remaining budget"));
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
        let mut file = File::open(&record.path)
            .map_err(|error| safe_io_error(&error, "read_stream_open"))?;
        file.seek(SeekFrom::Start(offset))
            .map_err(|error| safe_io_error(&error, "read_stream_seek"))?;
        let mut bytes = vec![0; usize::try_from(length).expect("chunk size is bounded")];
        let read = file
            .read(&mut bytes)
            .map_err(|error| safe_io_error(&error, "read_stream_read"))?;
        bytes.truncate(read);
        let consumed = u64::try_from(read).expect("read length fits u64");
        let end_of_source = offset.saturating_add(consumed) >= current_revision.byte_length;
        if let Some(stream) = state.streams.get_mut(stream_id) {
            stream.lease.consumed += consumed;
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
        let metadata = fs::metadata(&record.path)
            .map_err(|error| safe_io_error(&error, "query_metadata"))?;
        Ok(SourceMetadata {
            display_name: record.summary.descriptor.display_name.clone(),
            byte_length: metadata.len(),
            modified_unix_nanos: metadata
                .modified()
                .ok()
                .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                .and_then(|value| u64::try_from(value.as_nanos()).ok()),
            read_only: metadata.permissions().readonly(),
        })
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
                && identity::observe_identity(&candidate).file_id == record.native_identity.file_id
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
        if u64::try_from(request.bytes.len()).unwrap_or(u64::MAX) > MAX_SAVE_BYTES {
            return Err(budget_error("The save payload exceeds the 16 MiB host budget"));
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
        if record.state != SourceState::Available {
            return Err(CoreError::new(
                CoreErrorCategory::Conflict,
                "The source must be revalidated before save",
                true,
                true,
            ));
        }
        let (_, current) = observe_revision(&record.path)?;
        if current != request.expected_external_revision
            || current != record.summary.external_revision
        {
            record.state = SourceState::Changed;
            return Err(CoreError::new(
                CoreErrorCategory::Conflict,
                "The external source changed before save",
                true,
                true,
            ));
        }
        let guarantee = persistence::platform_guarantee();
        if guarantee.requires_acknowledgement()
            && request.durability_acknowledgement.as_ref().is_none_or(|acknowledgement| {
                acknowledgement.source_id != request.source_id
                    || acknowledgement.expected_external_revision != current
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
        let actual_guarantee = persistence::replace(&record.path, &request.bytes)?;
        let (native_identity, new_revision) = observe_revision(&record.path)?;
        let previous_external_revision = record.summary.external_revision.clone();
        record.native_identity = native_identity;
        record.summary.external_revision = new_revision.clone();
        record.summary.descriptor.identity = new_revision.identity.clone();
        record.summary.descriptor.byte_length = Some(new_revision.byte_length);
        record.summary.descriptor.modified_unix_ms = new_revision
            .modified_unix_nanos
            .map(|value| i64::try_from(value / 1_000_000).unwrap_or(i64::MAX));
        record.state = SourceState::Available;
        Ok(SaveReceipt {
            source_id: request.source_id,
            accepted_session_revision: request.expected_session_revision,
            previous_external_revision,
            new_external_revision: new_revision,
            byte_count: u64::try_from(request.bytes.len()).expect("save budget fits u64"),
            durability: actual_guarantee,
        })
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
        let mut state = self.lock_state()?;
        let created = state.activations.remove(&proof.id).ok_or_else(|| {
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
        let mut state = self.lock_state()?;
        let target = state
            .link_authorizations
            .remove(&authorization.id)
            .ok_or_else(|| {
                CoreError::new(
                    CoreErrorCategory::CapabilityDenied,
                    "The external-link authorization is invalid or already used",
                    false,
                    false,
                )
            })?;
        if target != authorization.normalized_target {
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
    let value: String = value.chars().filter(|character| !character.is_control()).collect();
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
            candidate.is_file()
                && identity::observe_identity(candidate).file_id.as_ref() == Some(expected)
        })
}

fn validate_external_target(target: &str) -> Result<String, CoreError> {
    if target.is_empty()
        || target.chars().any(|character| {
            character.is_control() || matches!(character, '\u{2028}' | '\u{2029}')
        })
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
    fn stale_external_revision_never_replaces_source() {
        let source = TemporarySource::new(b"original");
        let host = DesktopSourceHost::new();
        let summary = host
            .acquire(DesktopDelivery::association(source.path()))
            .expect("acquire source");
        fs::write(source.path(), b"external edit").expect("external edit");
        let error = host
            .save(SaveRequest {
                source_id: summary.source_id,
                expected_external_revision: summary.external_revision,
                expected_session_revision: 1,
                bytes: b"local edit".to_vec(),
                durability_acknowledgement: None,
            })
            .expect_err("stale save must fail");
        assert_eq!(error.category, CoreErrorCategory::Conflict);
        assert_eq!(fs::read(source.path()).expect("read source"), b"external edit");
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
                source_id: summary.source_id.clone(),
                expected_external_revision: summary.external_revision,
                expected_session_revision: 1,
                bytes: b"saved".to_vec(),
                durability_acknowledgement: None,
            })
            .expect("save source");
        assert_eq!(receipt.byte_count, 5);
        assert_eq!(fs::read(source.path()).expect("read saved source"), b"saved");
        host.close(&summary.source_id).expect("close source");
        assert_eq!(
            host.query_metadata(&summary.source_id)
                .expect_err("closed source is unavailable")
                .category,
            CoreErrorCategory::NotFound
        );
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
    }
}
