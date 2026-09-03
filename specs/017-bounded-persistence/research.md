# Research: Bounded Local Persistence

## Decision 1: Separate stores by lifecycle

**Decision**: Persist preferences, session projection, and diagnostic events as separate schema-versioned application-owned records; retain the existing recovery directory as an independent store.

**Rationale**: The categories have different privacy, retention, reset, and future-schema behavior. Isolation prevents optional corruption from cascading into startup failure and lets resets prove their exact deletion scope.

**Alternatives considered**: One aggregate JSON file couples failures and reset. SQLite introduces prohibited workspace-database complexity. Browser storage cannot own native source references or provide the required cross-platform atomicity evidence.

## Decision 2: Preserve future schemas and block implicit writes

**Decision**: Return defaults with an `unsupported` status while preserving future-schema bytes and reject ordinary writes for that category until explicit reset.

**Rationale**: This is the only behavior that both keeps startup usable and prevents an older application from destroying newer state.

**Alternatives considered**: Renaming or overwriting the file mutates unsupported data. Parsing known fields from a future record assumes compatibility the current release cannot establish.

## Decision 3: Treat recent references as session restoration only

**Decision**: Store at most 32 ordered session projections; include a native-owned restoration reference only when the platform confirms durable authority. Do not add a recent-file preference, menu, or general history.

**Rationale**: Issue #59 asks for recent-source references where permitted, while the v0.1 specification prohibits a recent-file setting. A bounded restart projection satisfies continuity without inventing product history.

**Alternatives considered**: A general recent list contradicts the governing specification. Persisting every tab without authority creates dead entries and can bypass Android grant semantics.

## Decision 4: Use typed allowlisted diagnostics

**Decision**: Accept only stable event ID, severity, platform, component, stable error code, duration, and byte count. Derive user-facing descriptions from stable identifiers and never accept arbitrary log messages or context maps for persistence/export.

**Rationale**: Paths, content, provider identifiers, metadata, and credentials cannot leak through fields that do not exist. Field bounds and known identifiers also make quotas deterministic.

**Alternatives considered**: Regex redaction of arbitrary strings is bypassable and locale-sensitive. Persisting raw stack traces or source errors conflicts with the privacy requirements.

## Decision 5: Use atomic JSON replacement and bounded reads

**Decision**: Read file metadata before allocation, reject records above their category limit, validate in memory, serialize once, and atomically replace the same-category file using the repository's existing atomic-write dependency.

**Rationale**: The pattern already underpins recovery, introduces no dependency, and preserves the last committed record on interruption.

**Alternatives considered**: In-place truncation can destroy the last valid state. Append-only preference/session journals complicate migration and cleanup beyond this slice.

## Decision 6: Coalesce interface-owned writes

**Decision**: Apply loaded preferences once, then coalesce preference and session projection persistence requests without allowing failure to block the document surface.

**Rationale**: This keeps repeated writes off active interaction paths and prevents unavailable native storage from producing an error loop.

**Alternatives considered**: Synchronous writes per keystroke or tab update violate interaction goals. Saving only at shutdown is unreliable on mobile lifecycle termination.
