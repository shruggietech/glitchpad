//! In-memory document session lifecycle and ordering policy.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::{
    contracts::{
        CoreError, CoreErrorCategory, IdentityMatch, RendererCapabilities, RendererDescriptor,
        SourceDescriptor, compare_identity,
    },
    detection::{DetectionOutcome, DetectionResult},
    source::{
        DurabilityGuarantee, ExternalRevision, SaveOperationId, SaveReceipt, SourceEvent, SourceId,
        SourceState,
    },
};

/// Stable session identifier within one registry lifetime.
#[derive(
    Clone, Copy, Debug, Eq, Hash, JsonSchema, Ord, PartialEq, PartialOrd, Serialize, Deserialize,
)]
pub struct SessionId(pub u64);

/// Explicit session lifecycle state.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionLifecycle {
    Opening,
    Ready,
    Active,
    Background,
    Conflicted,
    Closing,
    Closed,
    Failed,
}

/// Edit and source integrity, independent from active/background focus.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionIntegrity {
    Clean,
    Dirty,
    Saving,
    Conflicted,
    RecoveryOnly,
}

/// Recovery coverage for the current editable revision.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecoveryCoverage {
    None,
    Current,
    Stale,
    Unavailable,
}

/// Destructive action waiting for explicit dirty-state resolution.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DestructiveTransition {
    Close,
    Reload,
    Exit,
}

/// Explicit user decision for one guarded destructive transition.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransitionDecision {
    Save,
    SaveAs,
    Discard,
    Cancel,
}

/// Portable result of applying a current transition decision.
#[derive(Clone, Copy, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TransitionResolution {
    AwaitingSave,
    Discarded,
    Cancelled,
}

/// One exact in-flight save that may clear dirty state.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct PendingSave {
    pub operation_id: SaveOperationId,
    pub source_id: SourceId,
    pub session_revision: u64,
    pub expected_external_revision: ExternalRevision,
    pub payload_bytes: u64,
    pub durability: DurabilityGuarantee,
}

/// Returns whether a lifecycle transition is part of the documented state machine.
pub const fn can_transition(from: SessionLifecycle, to: SessionLifecycle) -> bool {
    match from {
        SessionLifecycle::Opening => {
            matches!(to, SessionLifecycle::Ready | SessionLifecycle::Failed)
        }
        SessionLifecycle::Ready => {
            matches!(to, SessionLifecycle::Active | SessionLifecycle::Closing)
        }
        SessionLifecycle::Active => {
            matches!(
                to,
                SessionLifecycle::Background
                    | SessionLifecycle::Conflicted
                    | SessionLifecycle::Closing
            )
        }
        SessionLifecycle::Background => {
            matches!(
                to,
                SessionLifecycle::Active | SessionLifecycle::Conflicted | SessionLifecycle::Closing
            )
        }
        SessionLifecycle::Conflicted => matches!(
            to,
            SessionLifecycle::Active | SessionLifecycle::Background | SessionLifecycle::Closing
        ),
        SessionLifecycle::Failed => matches!(to, SessionLifecycle::Closing),
        SessionLifecycle::Closing => matches!(to, SessionLifecycle::Closed),
        SessionLifecycle::Closed => false,
    }
}

/// Renderer-independent navigation projection.
#[derive(Clone, Copy, Debug, Default, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct NavigationProjection {
    pub position: Option<u64>,
    pub total: Option<u64>,
}

/// One independent document session.
#[derive(Clone, Debug, Eq, JsonSchema, PartialEq, Serialize, Deserialize)]
pub struct DocumentSession {
    pub id: SessionId,
    pub source: SourceDescriptor,
    pub detection: DetectionResult,
    pub renderer: RendererDescriptor,
    pub active_capabilities: RendererCapabilities,
    pub lifecycle: SessionLifecycle,
    pub source_state: SourceState,
    pub dirty: bool,
    pub integrity: SessionIntegrity,
    pub source_id: Option<SourceId>,
    pub external_revision: Option<ExternalRevision>,
    pub saved_revision: u64,
    pub pending_save: Option<PendingSave>,
    pub pending_transition: Option<DestructiveTransition>,
    pub recovery_coverage: RecoveryCoverage,
    pub navigation: NavigationProjection,
    pub revision: u64,
    pub error: Option<CoreError>,
}

/// Result of delivering a source to the registry.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OpenResult {
    pub session_id: SessionId,
    pub created: bool,
}

/// Ordered in-memory session registry and active-session policy.
#[derive(Debug, Default)]
pub struct SessionRegistry {
    sessions: Vec<DocumentSession>,
    active: Option<SessionId>,
    next_id: u64,
    next_save_operation_id: u64,
}

impl SessionRegistry {
    /// Creates an empty registry.
    pub const fn new() -> Self {
        Self {
            sessions: Vec::new(),
            active: None,
            next_id: 1,
            next_save_operation_id: 1,
        }
    }

    /// Returns sessions in presentation order.
    pub fn sessions(&self) -> &[DocumentSession] {
        &self.sessions
    }

    /// Returns the active session identifier.
    pub const fn active_id(&self) -> Option<SessionId> {
        self.active
    }

    /// Opens or activates a source according to strong identity comparison.
    ///
    /// # Errors
    ///
    /// Returns a resource-limit error if session identifiers are exhausted or an activation error if a matching session is no longer live.
    pub fn open(
        &mut self,
        source: SourceDescriptor,
        detection: DetectionResult,
        renderer: RendererDescriptor,
    ) -> Result<OpenResult, CoreError> {
        if let Some(existing) = self
            .sessions
            .iter()
            .find(|session| {
                compare_identity(&session.source.identity, &source.identity) == IdentityMatch::Same
            })
            .map(|session| session.id)
        {
            self.activate(existing)?;
            return Ok(OpenResult {
                session_id: existing,
                created: false,
            });
        }

        let id = SessionId(self.next_id);
        self.next_id = self.next_id.checked_add(1).ok_or_else(|| {
            CoreError::new(
                CoreErrorCategory::ResourceLimit,
                "Session identifier space is exhausted",
                false,
                false,
            )
        })?;
        self.background_active();
        let failed = detection.outcome != DetectionOutcome::Supported;
        let error = failed.then(|| {
            CoreError::new(
                CoreErrorCategory::UnsupportedInput,
                "The document could not enter a ready session",
                false,
                true,
            )
            .with_context("detection_outcome", format!("{:?}", detection.outcome))
        });
        let active_capabilities = effective_capabilities(&source, &renderer);
        self.sessions.push(DocumentSession {
            id,
            source,
            detection,
            renderer,
            active_capabilities,
            lifecycle: if failed {
                SessionLifecycle::Failed
            } else {
                SessionLifecycle::Ready
            },
            source_state: SourceState::Available,
            dirty: false,
            integrity: SessionIntegrity::Clean,
            source_id: None,
            external_revision: None,
            saved_revision: 1,
            pending_save: None,
            pending_transition: None,
            recovery_coverage: RecoveryCoverage::None,
            navigation: NavigationProjection::default(),
            revision: 1,
            error,
        });
        if failed {
            self.active = Some(id);
        } else {
            self.activate(id)?;
        }
        Ok(OpenResult {
            session_id: id,
            created: true,
        })
    }

    /// Selects a live session and backgrounds the previous active session.
    ///
    /// Failed sessions remain failed while selected so their error state stays visible.
    ///
    /// # Errors
    ///
    /// Returns not-found when the session does not exist or is no longer live.
    pub fn activate(&mut self, id: SessionId) -> Result<(), CoreError> {
        let target = self.position(id)?;
        let lifecycle = self.sessions[target].lifecycle;
        if !matches!(
            lifecycle,
            SessionLifecycle::Ready
                | SessionLifecycle::Active
                | SessionLifecycle::Background
                | SessionLifecycle::Conflicted
                | SessionLifecycle::Failed
        ) {
            return Err(not_found(id));
        }
        self.background_active();
        if !matches!(
            lifecycle,
            SessionLifecycle::Failed | SessionLifecycle::Conflicted
        ) {
            self.sessions[target].lifecycle = SessionLifecycle::Active;
        }
        self.active = Some(id);
        Ok(())
    }

    /// Closes a session and returns its final closed snapshot.
    ///
    /// # Errors
    ///
    /// Returns not-found when the session does not exist.
    pub fn close(&mut self, id: SessionId) -> Result<DocumentSession, CoreError> {
        let index = self.position(id)?;
        if self.sessions[index].dirty {
            self.sessions[index].pending_transition = Some(DestructiveTransition::Close);
            return Err(CoreError::new(
                CoreErrorCategory::Conflict,
                "Unsaved changes require an explicit close decision",
                false,
                true,
            ));
        }
        self.close_resolved(index)
    }

    /// Requests a destructive transition without removing unresolved dirty edits.
    ///
    /// Returns `true` when the transition is immediately safe and `false` when a
    /// revision-bound user decision is required.
    ///
    /// # Errors
    ///
    /// Returns not-found when the session does not exist.
    pub fn request_transition(
        &mut self,
        id: SessionId,
        transition: DestructiveTransition,
    ) -> Result<bool, CoreError> {
        let position = self.position(id)?;
        if !self.sessions[position].dirty {
            return Ok(true);
        }
        self.sessions[position].pending_transition = Some(transition);
        Ok(false)
    }

    /// Guards every dirty session for a multi-document application exit.
    pub fn request_exit(&mut self) -> Vec<SessionId> {
        self.sessions
            .iter_mut()
            .filter_map(|session| {
                session.dirty.then(|| {
                    session.pending_transition = Some(DestructiveTransition::Exit);
                    session.id
                })
            })
            .collect()
    }

    /// Resolves one current guarded transition without accepting stale decisions.
    ///
    /// # Errors
    ///
    /// Returns not-found, stale-session, conflict, or invalid-input when the
    /// decision cannot apply to the exact pending revision.
    pub fn resolve_transition(
        &mut self,
        id: SessionId,
        expected_revision: u64,
        decision: TransitionDecision,
    ) -> Result<TransitionResolution, CoreError> {
        let position = self.position(id)?;
        let session = &mut self.sessions[position];
        if session.revision != expected_revision {
            return Err(CoreError::new(
                CoreErrorCategory::StaleSession,
                "The document changed while the destructive decision was open",
                true,
                true,
            ));
        }
        if session.pending_transition.is_none() {
            return Err(CoreError::new(
                CoreErrorCategory::InvalidInput,
                "No destructive transition is awaiting a decision",
                false,
                false,
            ));
        }
        match decision {
            TransitionDecision::Cancel => {
                session.pending_transition = None;
                Ok(TransitionResolution::Cancelled)
            }
            TransitionDecision::Discard => {
                session.dirty = false;
                session.integrity = SessionIntegrity::Clean;
                session.pending_save = None;
                session.pending_transition = None;
                session.recovery_coverage = RecoveryCoverage::None;
                session.error = None;
                Ok(TransitionResolution::Discarded)
            }
            TransitionDecision::Save
                if matches!(
                    session.integrity,
                    SessionIntegrity::Conflicted | SessionIntegrity::RecoveryOnly
                ) =>
            {
                Err(CoreError::new(
                    CoreErrorCategory::Conflict,
                    "In-place save is unavailable until source authority is resolved",
                    true,
                    true,
                ))
            }
            TransitionDecision::Save | TransitionDecision::SaveAs => {
                Ok(TransitionResolution::AwaitingSave)
            }
        }
    }

    /// Explicitly discards local edits and closes one session.
    ///
    /// # Errors
    ///
    /// Returns not-found when the session does not exist.
    pub fn discard_and_close(&mut self, id: SessionId) -> Result<DocumentSession, CoreError> {
        let index = self.position(id)?;
        self.sessions[index].dirty = false;
        self.sessions[index].integrity = SessionIntegrity::Clean;
        self.sessions[index].pending_save = None;
        self.sessions[index].pending_transition = None;
        self.close_resolved(index)
    }

    fn close_resolved(&mut self, index: usize) -> Result<DocumentSession, CoreError> {
        let id = self.sessions[index].id;
        let was_active = self.active == Some(id);
        self.sessions[index].lifecycle = SessionLifecycle::Closing;
        let mut closed = self.sessions.remove(index);
        closed.lifecycle = SessionLifecycle::Closed;
        closed.revision += 1;
        if was_active {
            self.active = None;
            if !self.sessions.is_empty() {
                let successor = index.min(self.sessions.len() - 1);
                let successor_id = self.sessions[successor].id;
                self.activate(successor_id)?;
            }
        }
        Ok(closed)
    }

    /// Reorders a session without changing identity or command revision.
    ///
    /// # Errors
    ///
    /// Returns not-found for an unknown session or invalid-input for an out-of-range destination.
    pub fn reorder(&mut self, id: SessionId, destination: usize) -> Result<(), CoreError> {
        let source = self.position(id)?;
        if destination >= self.sessions.len() {
            return Err(CoreError::new(
                CoreErrorCategory::InvalidInput,
                "Tab destination is outside the live session order",
                false,
                true,
            ));
        }
        let session = self.sessions.remove(source);
        self.sessions.insert(destination, session);
        Ok(())
    }

    /// Activates the next session cyclically.
    ///
    /// # Errors
    ///
    /// Returns not-found when no live sessions exist.
    pub fn activate_next(&mut self) -> Result<SessionId, CoreError> {
        self.cycle(true)
    }

    /// Activates the previous session cyclically.
    ///
    /// # Errors
    ///
    /// Returns not-found when no live sessions exist.
    pub fn activate_previous(&mut self) -> Result<SessionId, CoreError> {
        self.cycle(false)
    }

    /// Updates dirty state and command revision.
    ///
    /// # Errors
    ///
    /// Returns not-found when the session does not exist.
    pub fn set_dirty(&mut self, id: SessionId, dirty: bool) -> Result<(), CoreError> {
        let position = self.position(id)?;
        if !dirty {
            return Err(CoreError::new(
                CoreErrorCategory::InvalidInput,
                "Dirty state clears only after a durable save or explicit discard",
                false,
                false,
            ));
        }
        if self.sessions[position].dirty != dirty {
            self.sessions[position].dirty = dirty;
            self.sessions[position].integrity = SessionIntegrity::Dirty;
            self.sessions[position].pending_save = None;
            self.sessions[position].recovery_coverage = RecoveryCoverage::Stale;
            self.sessions[position].revision += 1;
        }
        Ok(())
    }

    /// Binds native source authority and its last accepted external revision.
    ///
    /// # Errors
    ///
    /// Returns not-found when the session does not exist.
    pub fn bind_source(
        &mut self,
        id: SessionId,
        source_id: SourceId,
        external_revision: ExternalRevision,
    ) -> Result<(), CoreError> {
        let position = self.position(id)?;
        self.sessions[position].source_id = Some(source_id);
        self.sessions[position].external_revision = Some(external_revision);
        self.sessions[position].revision += 1;
        self.sessions[position].saved_revision = self.sessions[position].revision;
        Ok(())
    }

    /// Applies one host source event without discarding dirty state.
    ///
    /// # Errors
    ///
    /// Returns not found when the session does not exist.
    pub fn apply_source_event(
        &mut self,
        id: SessionId,
        event: &SourceEvent,
    ) -> Result<(), CoreError> {
        let position = self.position(id)?;
        if self.sessions[position].source_id.as_ref() != Some(&event.source_id) {
            return Err(CoreError::new(
                CoreErrorCategory::InvalidInput,
                "The source event does not belong to this document session",
                false,
                false,
            ));
        }
        self.sessions[position].source_state = event.state;
        if self.sessions[position].dirty && event.state != SourceState::Available {
            self.sessions[position].integrity = if matches!(
                event.state,
                SourceState::Deleted | SourceState::PermissionRevoked | SourceState::Unavailable
            ) {
                SessionIntegrity::RecoveryOnly
            } else {
                SessionIntegrity::Conflicted
            };
            self.sessions[position].pending_save = None;
            self.sessions[position].error = Some(CoreError::new(
                CoreErrorCategory::Conflict,
                "The external source changed while local edits are present",
                true,
                true,
            ));
        }
        self.sessions[position].revision += 1;
        Ok(())
    }

    /// Begins one fully bound save operation for the current dirty revision.
    ///
    /// # Errors
    ///
    /// Returns a stable error when authority, revision, or integrity is not current.
    pub fn begin_save(
        &mut self,
        id: SessionId,
        expected_revision: u64,
        payload_bytes: u64,
        durability: DurabilityGuarantee,
    ) -> Result<PendingSave, CoreError> {
        self.prepare_save(id, expected_revision)?;
        let position = self.position(id)?;
        let source_id = self.sessions[position].source_id.clone().ok_or_else(|| {
            CoreError::new(
                CoreErrorCategory::CapabilityDenied,
                "The document session has no bound native source authority",
                false,
                true,
            )
        })?;
        let expected_external_revision = self.sessions[position]
            .external_revision
            .clone()
            .ok_or_else(|| {
                CoreError::new(
                    CoreErrorCategory::Conflict,
                    "The document session has no accepted external revision",
                    true,
                    true,
                )
            })?;
        let operation_id = SaveOperationId(self.next_save_operation_id);
        self.next_save_operation_id =
            self.next_save_operation_id.checked_add(1).ok_or_else(|| {
                CoreError::new(
                    CoreErrorCategory::ResourceLimit,
                    "Save operation identifier space is exhausted",
                    false,
                    false,
                )
            })?;
        let pending = PendingSave {
            operation_id,
            source_id,
            session_revision: expected_revision,
            expected_external_revision,
            payload_bytes,
            durability,
        };
        self.sessions[position].pending_save = Some(pending.clone());
        self.sessions[position].integrity = SessionIntegrity::Saving;
        Ok(pending)
    }

    /// Leaves a failed save dirty while preserving its recovery coverage.
    ///
    /// # Errors
    ///
    /// Returns not-found when the session does not exist.
    pub fn fail_save(&mut self, id: SessionId, conflict: bool) -> Result<(), CoreError> {
        let position = self.position(id)?;
        self.sessions[position].pending_save = None;
        self.sessions[position].integrity = if conflict {
            SessionIntegrity::Conflicted
        } else {
            SessionIntegrity::Dirty
        };
        self.sessions[position].dirty = true;
        self.sessions[position].revision += 1;
        Ok(())
    }

    /// Validates that a save request still targets the current dirty session revision.
    ///
    /// # Errors
    ///
    /// Returns not found, stale session, or invalid input when the session cannot prepare a save.
    pub fn prepare_save(&self, id: SessionId, expected_revision: u64) -> Result<(), CoreError> {
        let position = self.position(id)?;
        let session = &self.sessions[position];
        if session.revision != expected_revision {
            return Err(CoreError::new(
                CoreErrorCategory::StaleSession,
                "The document session changed before save",
                true,
                true,
            ));
        }
        if !session.dirty {
            return Err(CoreError::new(
                CoreErrorCategory::InvalidInput,
                "The document session has no unsaved changes",
                false,
                false,
            ));
        }
        if session.source_state != SourceState::Available {
            return Err(CoreError::new(
                CoreErrorCategory::Conflict,
                "The document source must be revalidated before save",
                true,
                true,
            ));
        }
        if matches!(
            session.integrity,
            SessionIntegrity::Conflicted | SessionIntegrity::RecoveryOnly
        ) {
            return Err(CoreError::new(
                CoreErrorCategory::Conflict,
                "The document conflict must be resolved before ordinary save",
                true,
                true,
            ));
        }
        Ok(())
    }

    /// Applies a durable host receipt and only then clears dirty state.
    ///
    /// # Errors
    ///
    /// Returns not found or stale session when the receipt no longer targets the session revision.
    pub fn apply_save_receipt(
        &mut self,
        id: SessionId,
        receipt: &SaveReceipt,
    ) -> Result<(), CoreError> {
        let position = self.position(id)?;
        let pending = self.sessions[position]
            .pending_save
            .as_ref()
            .ok_or_else(|| {
                CoreError::new(
                    CoreErrorCategory::StaleSession,
                    "No current save operation accepts this receipt",
                    true,
                    true,
                )
            })?;
        if pending.operation_id != receipt.operation_id
            || pending.source_id != receipt.source_id
            || pending.session_revision != receipt.accepted_session_revision
            || pending.expected_external_revision != receipt.previous_external_revision
            || pending.payload_bytes != receipt.byte_count
            || pending.durability != receipt.durability
        {
            return Err(CoreError::new(
                CoreErrorCategory::StaleSession,
                "The save receipt does not match the current bound save operation",
                true,
                true,
            ));
        }
        self.sessions[position].dirty = false;
        self.sessions[position].integrity = SessionIntegrity::Clean;
        self.sessions[position].external_revision = Some(receipt.new_external_revision.clone());
        self.sessions[position].saved_revision = receipt.accepted_session_revision;
        self.sessions[position].pending_save = None;
        self.sessions[position].pending_transition = None;
        self.sessions[position].recovery_coverage = RecoveryCoverage::None;
        self.sessions[position].source_state = SourceState::Available;
        self.sessions[position].error = None;
        self.sessions[position].lifecycle = if self.active == Some(id) {
            SessionLifecycle::Active
        } else {
            SessionLifecycle::Background
        };
        self.sessions[position].revision += 1;
        Ok(())
    }

    fn cycle(&mut self, forward: bool) -> Result<SessionId, CoreError> {
        if self.sessions.is_empty() {
            return Err(CoreError::new(
                CoreErrorCategory::NotFound,
                "No live document sessions exist",
                false,
                true,
            ));
        }
        let current = self
            .active
            .and_then(|id| self.sessions.iter().position(|session| session.id == id))
            .unwrap_or(0);
        let target = if forward {
            (current + 1) % self.sessions.len()
        } else if current == 0 {
            self.sessions.len() - 1
        } else {
            current - 1
        };
        let id = self.sessions[target].id;
        self.activate(id)?;
        Ok(id)
    }

    fn position(&self, id: SessionId) -> Result<usize, CoreError> {
        self.sessions
            .iter()
            .position(|session| session.id == id)
            .ok_or_else(|| not_found(id))
    }

    fn background_active(&mut self) {
        if let Some(active) = self.active
            && let Some(session) = self
                .sessions
                .iter_mut()
                .find(|session| session.id == active)
            && session.lifecycle == SessionLifecycle::Active
        {
            session.lifecycle = SessionLifecycle::Background;
        }
    }
}

fn effective_capabilities(
    source: &SourceDescriptor,
    renderer: &RendererDescriptor,
) -> RendererCapabilities {
    let source_capabilities = source.capabilities;
    let renderer_capabilities = renderer.capabilities;
    RendererCapabilities {
        view: renderer_capabilities.view && source_capabilities.read,
        edit: renderer_capabilities.edit && source_capabilities.write,
        navigate: renderer_capabilities.navigate
            && (source_capabilities.seek || source_capabilities.read),
        search: renderer_capabilities.search && source_capabilities.read,
        zoom: renderer_capabilities.zoom && source_capabilities.read,
        copy: renderer_capabilities.copy && source_capabilities.read,
        save: renderer_capabilities.save && source_capabilities.write,
        inspect_metadata: renderer_capabilities.inspect_metadata && source_capabilities.metadata,
    }
}

fn not_found(id: SessionId) -> CoreError {
    CoreError::new(
        CoreErrorCategory::NotFound,
        "Document session was not found",
        false,
        true,
    )
    .with_context("session_id", id.0.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        contracts::{
            DocumentIdentity, IdentityAuthority, IdentityStrength, RendererCapabilities,
            SourceCapabilities, SourceKind,
        },
        detection::{DetectionConfidence, DetectionOutcome, DetectionResult, FormatCandidate},
    };

    fn source(token: &str, strength: IdentityStrength) -> SourceDescriptor {
        SourceDescriptor {
            identity: DocumentIdentity {
                authority: IdentityAuthority::Synthetic,
                scope: "tests".into(),
                token: token.into(),
                strength,
            },
            display_name: format!("{token}.md"),
            claimed_media_type: Some("text/markdown".into()),
            byte_length: Some(10),
            modified_unix_ms: None,
            kind: SourceKind::Memory,
            capabilities: SourceCapabilities {
                read: true,
                ..SourceCapabilities::default()
            },
        }
    }

    fn detection() -> DetectionResult {
        DetectionResult {
            outcome: DetectionOutcome::Supported,
            candidate: Some(FormatCandidate::Markdown),
            confidence: Some(DetectionConfidence::High),
            evidence: Vec::new(),
            text_profile: None,
            bytes_examined: 10,
            truncated: false,
        }
    }

    fn renderer() -> RendererDescriptor {
        RendererDescriptor {
            id: "markdown".into(),
            label: "Markdown".into(),
            capabilities: RendererCapabilities {
                view: true,
                ..RendererCapabilities::default()
            },
        }
    }

    #[test]
    fn repeated_strong_identity_delivery_never_duplicates() {
        let mut registry = SessionRegistry::new();
        for index in 0..100 {
            let result = registry
                .open(
                    source("same", IdentityStrength::Strong),
                    detection(),
                    renderer(),
                )
                .expect("open source");
            assert_eq!(result.created, index == 0);
        }
        assert_eq!(registry.sessions().len(), 1);
    }

    #[test]
    fn uncertain_identity_delivery_never_merges() {
        let mut registry = SessionRegistry::new();
        for _ in 0..100 {
            registry
                .open(
                    source("weak", IdentityStrength::Weak),
                    detection(),
                    renderer(),
                )
                .expect("open source");
        }
        assert_eq!(registry.sessions().len(), 100);
    }

    #[test]
    fn activation_backgrounds_previous_session_and_preserves_state() {
        let mut registry = SessionRegistry::new();
        let first = registry
            .open(
                source("first", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open first")
            .session_id;
        registry.set_dirty(first, true).expect("mark dirty");
        let second = registry
            .open(
                source("second", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open second")
            .session_id;

        assert_eq!(registry.active_id(), Some(second));
        assert_eq!(
            registry.sessions()[0].lifecycle,
            SessionLifecycle::Background
        );
        assert!(registry.sessions()[0].dirty);
    }

    #[test]
    fn close_selects_next_then_previous_and_returns_closed_snapshot() {
        let mut registry = SessionRegistry::new();
        let ids: Vec<_> = ["a", "b", "c"]
            .into_iter()
            .map(|token| {
                registry
                    .open(
                        source(token, IdentityStrength::Strong),
                        detection(),
                        renderer(),
                    )
                    .expect("open source")
                    .session_id
            })
            .collect();
        registry.activate(ids[1]).expect("activate middle");
        let closed = registry.close(ids[1]).expect("close middle");
        assert_eq!(closed.lifecycle, SessionLifecycle::Closed);
        assert_eq!(registry.active_id(), Some(ids[2]));
        registry.close(ids[2]).expect("close final");
        assert_eq!(registry.active_id(), Some(ids[0]));
    }

    #[test]
    fn close_selects_a_remaining_failed_session_without_losing_its_error_state() {
        let mut registry = SessionRegistry::new();
        let supported = registry
            .open(
                source("supported", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open supported source")
            .session_id;
        let mut unsupported_detection = detection();
        unsupported_detection.outcome = DetectionOutcome::Unsupported;
        unsupported_detection.candidate = None;
        unsupported_detection.confidence = None;
        let failed = registry
            .open(
                source("failed", IdentityStrength::Strong),
                unsupported_detection,
                renderer(),
            )
            .expect("open failed source")
            .session_id;

        registry
            .activate(supported)
            .expect("reactivate supported source");
        registry.close(supported).expect("close supported source");

        assert_eq!(registry.active_id(), Some(failed));
        assert_eq!(registry.sessions().len(), 1);
        assert_eq!(registry.sessions()[0].lifecycle, SessionLifecycle::Failed);
        assert!(registry.sessions()[0].error.is_some());
    }

    #[test]
    fn reorder_and_cyclic_navigation_preserve_ids() {
        let mut registry = SessionRegistry::new();
        let first = registry
            .open(
                source("a", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open a")
            .session_id;
        let second = registry
            .open(
                source("b", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open b")
            .session_id;
        registry.reorder(first, 1).expect("reorder");
        assert_eq!(registry.sessions()[1].id, first);
        assert_eq!(registry.activate_next().expect("next"), first);
        assert_eq!(registry.activate_previous().expect("previous"), second);
    }

    #[test]
    fn lifecycle_transition_table_accepts_only_documented_edges() {
        let states = [
            SessionLifecycle::Opening,
            SessionLifecycle::Ready,
            SessionLifecycle::Active,
            SessionLifecycle::Background,
            SessionLifecycle::Conflicted,
            SessionLifecycle::Closing,
            SessionLifecycle::Closed,
            SessionLifecycle::Failed,
        ];
        let expected = [
            (SessionLifecycle::Opening, SessionLifecycle::Ready),
            (SessionLifecycle::Opening, SessionLifecycle::Failed),
            (SessionLifecycle::Ready, SessionLifecycle::Active),
            (SessionLifecycle::Ready, SessionLifecycle::Closing),
            (SessionLifecycle::Active, SessionLifecycle::Background),
            (SessionLifecycle::Active, SessionLifecycle::Conflicted),
            (SessionLifecycle::Background, SessionLifecycle::Active),
            (SessionLifecycle::Background, SessionLifecycle::Conflicted),
            (SessionLifecycle::Conflicted, SessionLifecycle::Active),
            (SessionLifecycle::Conflicted, SessionLifecycle::Background),
            (SessionLifecycle::Conflicted, SessionLifecycle::Closing),
            (SessionLifecycle::Active, SessionLifecycle::Closing),
            (SessionLifecycle::Background, SessionLifecycle::Closing),
            (SessionLifecycle::Failed, SessionLifecycle::Closing),
            (SessionLifecycle::Closing, SessionLifecycle::Closed),
        ];
        for from in states {
            for to in states {
                assert_eq!(can_transition(from, to), expected.contains(&(from, to)));
            }
        }
    }

    #[test]
    fn session_owns_the_intersection_of_source_and_renderer_capabilities() {
        let mut registry = SessionRegistry::new();
        let mut renderer = renderer();
        renderer.capabilities.edit = true;
        renderer.capabilities.save = true;
        registry
            .open(
                source("read-only", IdentityStrength::Strong),
                detection(),
                renderer,
            )
            .expect("open source");
        let capabilities = registry.sessions()[0].active_capabilities;
        assert!(capabilities.view);
        assert!(!capabilities.edit);
        assert!(!capabilities.save);
    }

    #[test]
    fn external_change_conflicts_dirty_session_and_preserves_edits() {
        let mut registry = SessionRegistry::new();
        let id = registry
            .open(
                source("conflict", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open source")
            .session_id;
        let source_id = crate::source::SourceId("source-conflict".into());
        registry
            .bind_source(
                id,
                source_id.clone(),
                crate::source::ExternalRevision {
                    identity: source("conflict", IdentityStrength::Strong).identity,
                    byte_length: Some(10),
                    modified_unix_nanos: Some(1),
                    change_token: None,
                },
            )
            .expect("bind source");
        registry.set_dirty(id, true).expect("mark dirty");
        registry
            .apply_source_event(
                id,
                &SourceEvent {
                    source_id,
                    sequence: 1,
                    state: SourceState::Changed,
                    display_name: None,
                    revalidation_required: true,
                },
            )
            .expect("apply source event");

        let session = &registry.sessions()[0];
        assert!(session.dirty);
        assert_eq!(session.lifecycle, SessionLifecycle::Active);
        assert_eq!(session.integrity, SessionIntegrity::Conflicted);
        assert_eq!(session.source_state, SourceState::Changed);
        assert_eq!(
            registry
                .prepare_save(id, session.revision)
                .expect_err("unrevalidated source cannot save")
                .category,
            CoreErrorCategory::Conflict
        );
    }

    #[test]
    fn only_current_durable_receipt_clears_dirty_state() {
        let mut registry = SessionRegistry::new();
        let descriptor = source("receipt", IdentityStrength::Strong);
        let identity = descriptor.identity.clone();
        let id = registry
            .open(descriptor, detection(), renderer())
            .expect("open source")
            .session_id;
        let external_revision = crate::source::ExternalRevision {
            identity,
            byte_length: Some(10),
            modified_unix_nanos: Some(1),
            change_token: None,
        };
        let source_id = crate::source::SourceId("source-receipt".into());
        registry
            .bind_source(id, source_id.clone(), external_revision.clone())
            .expect("bind source");
        registry.set_dirty(id, true).expect("mark dirty");
        let revision = registry.sessions()[0].revision;
        let pending = registry
            .begin_save(
                id,
                revision,
                10,
                crate::source::DurabilityGuarantee::AtomicFile,
            )
            .expect("begin save");
        let receipt = SaveReceipt {
            operation_id: pending.operation_id,
            source_id: source_id.clone(),
            accepted_session_revision: revision,
            previous_external_revision: external_revision.clone(),
            new_external_revision: external_revision.clone(),
            byte_count: 10,
            durability: crate::source::DurabilityGuarantee::AtomicFile,
        };
        for attempt in 1..=1_000 {
            let mut mismatched = receipt.clone();
            match attempt % 6 {
                0 => mismatched.operation_id = SaveOperationId(pending.operation_id.0 + attempt),
                1 => mismatched.source_id = SourceId(format!("other-source-{attempt}")),
                2 => mismatched.accepted_session_revision = revision.saturating_sub(1),
                3 => {
                    mismatched.previous_external_revision.byte_length =
                        Some(10_u64.saturating_add(attempt));
                }
                4 => mismatched.byte_count = 10_u64.saturating_add(attempt),
                _ => mismatched.durability = DurabilityGuarantee::RecoverableNonAtomic,
            }
            assert_eq!(
                registry
                    .apply_save_receipt(id, &mismatched)
                    .expect_err("reject mismatched receipt")
                    .category,
                CoreErrorCategory::StaleSession
            );
            assert!(registry.sessions()[0].dirty);
        }

        registry
            .apply_save_receipt(id, &receipt)
            .expect("apply current receipt");
        assert!(!registry.sessions()[0].dirty);
        assert_eq!(registry.sessions()[0].lifecycle, SessionLifecycle::Active);
    }

    #[test]
    fn dirty_close_is_guarded_until_explicit_discard() {
        let mut registry = SessionRegistry::new();
        let id = registry
            .open(
                source("guarded-close", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open source")
            .session_id;
        registry.set_dirty(id, true).expect("mark dirty");
        let revision = registry.sessions()[0].revision;

        assert_eq!(
            registry
                .close(id)
                .expect_err("dirty close must be guarded")
                .category,
            CoreErrorCategory::Conflict
        );
        assert_eq!(registry.sessions().len(), 1);
        assert!(registry.sessions()[0].dirty);
        assert_eq!(registry.sessions()[0].revision, revision);
        assert_eq!(
            registry.sessions()[0].pending_transition,
            Some(DestructiveTransition::Close)
        );

        registry
            .resolve_transition(id, revision, TransitionDecision::Discard)
            .expect("discard current edits");
        let closed = registry.close(id).expect("close resolved session");
        assert_eq!(closed.lifecycle, SessionLifecycle::Closed);
    }

    #[test]
    fn reload_decisions_are_revision_bound_and_cancel_preserves_edits() {
        let mut registry = SessionRegistry::new();
        let id = registry
            .open(
                source("guarded-reload", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open source")
            .session_id;
        registry.set_dirty(id, true).expect("mark dirty");
        let revision = registry.sessions()[0].revision;
        assert!(
            !registry
                .request_transition(id, DestructiveTransition::Reload)
                .expect("request reload")
        );
        assert_eq!(
            registry
                .resolve_transition(id, revision - 1, TransitionDecision::Discard)
                .expect_err("reject stale decision")
                .category,
            CoreErrorCategory::StaleSession
        );
        assert_eq!(
            registry
                .resolve_transition(id, revision, TransitionDecision::Cancel)
                .expect("cancel current decision"),
            TransitionResolution::Cancelled
        );
        assert!(registry.sessions()[0].dirty);
        assert_eq!(registry.sessions()[0].pending_transition, None);
    }

    #[test]
    fn exit_guards_every_dirty_session_without_closing_any_session() {
        let mut registry = SessionRegistry::new();
        let first = registry
            .open(
                source("exit-a", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open first")
            .session_id;
        let second = registry
            .open(
                source("exit-b", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open second")
            .session_id;
        let third = registry
            .open(
                source("exit-c", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open third")
            .session_id;
        registry.set_dirty(first, true).expect("dirty first");
        registry.set_dirty(third, true).expect("dirty third");

        assert_eq!(registry.request_exit(), vec![first, third]);
        assert_eq!(registry.sessions().len(), 3);
        assert_eq!(
            registry
                .sessions()
                .iter()
                .find(|session| session.id == second)
                .expect("clean session")
                .pending_transition,
            None
        );
        assert_eq!(
            registry
                .sessions()
                .iter()
                .find(|session| session.id == first)
                .expect("dirty first")
                .pending_transition,
            Some(DestructiveTransition::Exit)
        );
        assert_eq!(
            registry
                .sessions()
                .iter()
                .find(|session| session.id == third)
                .expect("dirty third")
                .pending_transition,
            Some(DestructiveTransition::Exit)
        );
    }

    #[test]
    fn focus_changes_do_not_mutate_integrity_or_save_revision() {
        let mut registry = SessionRegistry::new();
        let first = registry
            .open(
                source("focus-a", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open first")
            .session_id;
        let second = registry
            .open(
                source("focus-b", IdentityStrength::Strong),
                detection(),
                renderer(),
            )
            .expect("open second")
            .session_id;
        registry.set_dirty(first, true).expect("dirty first");
        let revision = registry
            .sessions()
            .iter()
            .find(|session| session.id == first)
            .expect("first session")
            .revision;

        registry.activate(first).expect("activate first");
        registry.activate(second).expect("activate second");

        let first = registry
            .sessions()
            .iter()
            .find(|session| session.id == first)
            .expect("first session");
        assert_eq!(first.revision, revision);
        assert_eq!(first.integrity, SessionIntegrity::Dirty);
        assert!(first.dirty);
    }
}
