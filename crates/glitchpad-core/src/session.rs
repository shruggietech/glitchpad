//! In-memory document session lifecycle and ordering policy.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::{
    contracts::{
        CoreError, CoreErrorCategory, IdentityMatch, RendererCapabilities, RendererDescriptor,
        SourceDescriptor, compare_identity,
    },
    detection::{DetectionOutcome, DetectionResult},
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
    Closing,
    Closed,
    Failed,
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
            matches!(to, SessionLifecycle::Background | SessionLifecycle::Closing)
        }
        SessionLifecycle::Background => {
            matches!(to, SessionLifecycle::Active | SessionLifecycle::Closing)
        }
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
    pub dirty: bool,
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
}

impl SessionRegistry {
    /// Creates an empty registry.
    pub const fn new() -> Self {
        Self {
            sessions: Vec::new(),
            active: None,
            next_id: 1,
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
            dirty: false,
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
                | SessionLifecycle::Failed
        ) {
            return Err(not_found(id));
        }
        self.background_active();
        if lifecycle != SessionLifecycle::Failed {
            self.sessions[target].lifecycle = SessionLifecycle::Active;
        }
        self.sessions[target].revision += 1;
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
        if self.sessions[position].dirty != dirty {
            self.sessions[position].dirty = dirty;
            self.sessions[position].revision += 1;
        }
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
            session.revision += 1;
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
        for _ in 0..3 {
            registry
                .open(
                    source("weak", IdentityStrength::Weak),
                    detection(),
                    renderer(),
                )
                .expect("open source");
        }
        assert_eq!(registry.sessions().len(), 3);
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
            (SessionLifecycle::Background, SessionLifecycle::Active),
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
}
