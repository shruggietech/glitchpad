# Feature Specification: Bounded Local Persistence

**Feature Branch**: `[codex/017-bounded-persistence]`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Deliver S017 for issue #59: persist bounded preferences, restorable source and session projections, recovery references, and privacy-safe diagnostics without a database or document-content capture."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Keep a small set of viewing preferences (Priority: P1)

A user changes a stable viewing or editing preference and finds the same preference applied after restarting Glitchpad, without signing in or connecting to a network.

**Why this priority**: Predictable local preferences are the core value of persistence and remove repeated setup while preserving Glitchpad's account-free model.

**Independent Test**: Change each supported preference, restart the application, and verify that valid values return while unsupported values fall back independently without affecting document access.

**Acceptance Scenarios**:

1. **Given** default settings, **When** the user changes theme, editor typography, wrapping, tab width, Markdown mode, or an extension-specific language override, **Then** the bounded preference set is saved atomically and restored on the next launch.
2. **Given** a valid stored preference set, **When** one value is outside its permitted range, **Then** only that value falls back to its documented default and the remaining valid values are retained.
3. **Given** no native persistence capability, **When** the application starts, **Then** every document workflow remains available with stable defaults and no repeated error loop.

---

### User Story 2 - Preserve safe session context without persisting documents (Priority: P1)

A user restarts Glitchpad and the native startup flow can consume bounded window and session context for sources the platform still authorizes, while document contents remain owned by their original sources or explicit recovery records.

**Why this priority**: Session continuity is useful only when it does not silently create another copy of a user's document or bypass platform permissions.

**Independent Test**: Persist a mixed desktop and Android session projection, restart, revoke selected sources, and verify that only valid references are offered for restoration and no source content appears in application-state storage.

**Acceptance Scenarios**:

1. **Given** open clean documents with restorable source authority, **When** the application exits and restarts, **Then** it loads at most the bounded session projection for the native restoration flow, which may reopen sources only after native revalidation.
2. **Given** a non-restorable, revoked, missing, or stale source reference, **When** startup restoration runs, **Then** the reference is skipped or reported with a stable safe status without blocking other sessions.
3. **Given** dirty document state, **When** application state is persisted, **Then** document text exists only in the explicit recovery store and the session projection contains only a matching opaque recovery reference.

---

### User Story 3 - Recover safely from incompatible or corrupt state (Priority: P1)

A user can launch and use Glitchpad even when local configuration is corrupt, oversized, partially written, or from a newer application schema.

**Why this priority**: Persistence must never turn optional convenience state into a startup failure or destroy state a newer version may understand.

**Independent Test**: Start with valid, legacy, corrupt, oversized, interrupted-write, and future-schema fixtures, then verify deterministic migration, fallback, preservation, and reset behavior.

**Acceptance Scenarios**:

1. **Given** a supported older schema, **When** it is loaded, **Then** migration produces the same current state and serialized result on every run.
2. **Given** corrupt or oversized optional state, **When** it is loaded, **Then** defaults are used, a content-free warning is available, and the application remains usable.
3. **Given** a newer schema, **When** it is loaded, **Then** the original bytes are preserved and never overwritten by defaults unless the user explicitly resets that state.
4. **Given** the user requests a reset, **When** the selected category is cleared, **Then** unrelated application state, recovery records, and user-created documents remain untouched.

---

### User Story 4 - Preview and export redacted diagnostics (Priority: P2)

A user can inspect bounded environment facts and diagnostic events before explicitly saving a local support bundle, with sensitive source information removed by default.

**Why this priority**: Diagnostics are useful for troubleshooting only when users can understand and control what leaves the application.

**Independent Test**: Feed hostile paths, provider identifiers, metadata, excerpts, credentials, and recovery payloads through every diagnostic field, then preview and export the bundle and verify none of those values survive.

**Acceptance Scenarios**:

1. **Given** recent diagnostic events, **When** the user opens the preview, **Then** it shows bounded structured facts and stable error codes without document content, full paths, raw provider identifiers, metadata values, credentials, or recovery payloads.
2. **Given** a diagnostic preview, **When** the user explicitly exports it, **Then** only the exact previewed redacted payload is written to the chosen local destination.
3. **Given** expired or over-quota diagnostic data, **When** cleanup runs, **Then** the oldest eligible entries are removed deterministically and current application use continues.

### Edge Cases

- A configuration file may be empty, truncated, invalid UTF-8, valid JSON with unknown fields, or larger than its read limit.
- An atomic write may fail before commit; the last valid committed state must remain readable.
- A future-schema file must remain byte-for-byte unchanged across launches and ordinary preference changes.
- Two writes may be requested rapidly; only complete validated snapshots may become current.
- A desktop source may move or lose permission, and an Android provider may revoke or decline persistable URI permission.
- Session projection may refer to a recovery record that expired, was resolved, or failed validation.
- Extension keys may include case differences, leading dots, Unicode, control characters, or excessive length.
- Diagnostic fields may contain disguised paths, URI authorities, secrets, newlines, terminal controls, extremely long values, or document excerpts.
- The platform configuration or data directory may be unavailable or read-only.
- Reset may be interrupted; it must remain idempotent and must not broaden its deletion scope.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The application MUST remain fully functional offline and without an account when persistence is available, unavailable, corrupt, or disabled.
- **FR-002**: Application state MUST use explicitly versioned, bounded records stored separately by purpose, with no workspace database.
- **FR-003**: The supported preference set MUST contain only theme, editor font family and size, line wrapping, tab width, Markdown default mode, and explicit per-extension language overrides.
- **FR-004**: Preference values and override counts, keys, and values MUST be validated independently against documented bounds before use or persistence.
- **FR-005**: Preferences MUST be written atomically so a failed or interrupted write preserves the last committed valid state.
- **FR-006**: Supported older preference and session schemas MUST migrate deterministically, with fixture evidence for every migration step.
- **FR-007**: A corrupt, invalid, or oversized optional-state record MUST produce stable defaults and a content-free safe warning rather than preventing startup.
- **FR-008**: A future-schema record MUST be preserved byte-for-byte and reported as unsupported; ordinary application activity MUST NOT overwrite it.
- **FR-009**: The application MUST persist at most one bounded window projection and a bounded ordered set of session projections containing presentation state and opaque native restoration references, never document content.
- **FR-010**: Persisted source references MUST be created and reopened only where the native platform grants durable authority; missing or revoked authority MUST fail independently with a stable safe status.
- **FR-011**: The v0.1 preference schema MUST NOT contain a recent-file list. Any recent-source reference in S017 MUST exist only as part of the bounded session-restoration projection.
- **FR-012**: Dirty-session projections MUST refer to explicit recovery records by opaque identifier and MUST NOT copy recovery content, source identity evidence, or external revision evidence into application state.
- **FR-013**: Preference, session, recovery, cache, and diagnostic lifecycles MUST remain separate so loading, cleanup, corruption, quota pressure, or reset in one category cannot silently mutate another.
- **FR-014**: Reset MUST be category-scoped, idempotent, and explicit; resetting preferences or session state MUST NOT delete recovery records or user-created documents.
- **FR-015**: Structured diagnostic events MUST use bounded timestamp, level, stable event identifier, platform, component, duration, byte count, and stable error-code fields.
- **FR-016**: Diagnostics MUST exclude document content, editor text, source excerpts, passwords and secret-like values, full paths, raw Android URIs or provider authorities, metadata values, recovery payloads, native handles, and stack traces by default.
- **FR-017**: Diagnostic values MUST be accepted only through a typed allowlist; arbitrary messages, keys, and context maps MUST NOT enter persisted or exported diagnostics.
- **FR-018**: Release diagnostics MUST default to information level and enforce deterministic rolling size, entry-count, and age limits.
- **FR-019**: A diagnostic export MUST require an explicit user action, present the exact redacted payload for preview first, and write only that previewed payload to the selected local destination.
- **FR-020**: Cleanup MUST remove only expired or over-quota eligible application-state and diagnostic records in deterministic oldest-first order, while preserving future-schema files and active recovery coverage.
- **FR-021**: All persistence and diagnostic failures crossing into the shared interface MUST use stable, bounded, content-free classifications.
- **FR-022**: Schema, migration, corruption, atomicity, quota, cleanup, reset, privacy, desktop lifecycle, and Android lifecycle behavior MUST have automated contract evidence.
- **FR-023**: The S017 implementation MUST introduce no network, telemetry, synchronization, plugin, account, or generalized workspace capability.

### Key Entities

- **Preference state**: One versioned bounded set of stable viewing and editing choices plus explicit per-extension language overrides.
- **Window projection**: Bounded non-document presentation state for the application window, including active session position and compact inspector visibility where appropriate.
- **Session projection**: A bounded restorable reference and presentation snapshot for one clean or recoverable document session, containing no document bytes.
- **Source restoration reference**: Opaque platform-owned evidence that may reopen a source only after native permission and revision checks.
- **Recovery reference**: An opaque identifier linking a dirty session projection to the independently governed recovery store.
- **Diagnostic event**: A typed allowlisted, bounded, content-free operational fact.
- **Diagnostic bundle**: The exact redacted environment and event payload a user previews before choosing a local export destination.
- **Persistence status**: A stable result describing available, defaulted, migrated, unsupported, corrupt, quota-limited, reset, or unavailable state without leaking stored data.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Across valid, missing, corrupt, oversized, interrupted-write, and future-schema fixtures, 100 percent of launches reach a usable document surface without an account or network connection.
- **SC-002**: Every supported preference survives 100 save-and-restart cycles, while every invalid field falls back independently and valid sibling fields remain unchanged.
- **SC-003**: Every supported legacy fixture migrates to one byte-stable current representation across 100 repeated migration runs.
- **SC-004**: Future-schema fixtures remain byte-for-byte unchanged after 100 launches, preference changes, session updates, cleanup passes, and failed reset attempts that do not explicitly target them.
- **SC-005**: Session restoration handles the maximum supported projection within one second on reference desktop and Android devices, with zero document-content bytes present in application-state fixtures.
- **SC-006**: Hostile diagnostic fixtures produce zero document excerpts, full paths, provider authorities, metadata values, credentials, recovery payloads, stack traces, or unapproved fields in retained, previewed, or exported output.
- **SC-007**: Diagnostic retention never exceeds 2,000 events, 2 MiB of serialized event data, or seven days, and cleanup produces identical survivors for identical inputs.
- **SC-008**: Category-scoped reset and cleanup tests modify zero files outside their exact application-owned category across desktop and Android lifecycle fixtures.
- **SC-009**: One hundred simulated storage-unavailable and atomic-write-failure cycles preserve the last committed valid state and allow uninterrupted viewing and editing.

## Dependencies and Issue Traceability

- S017 implements GitHub issue #59 as one coherent bounded local-state and diagnostics slice.
- Completed issues #45, #50, and #58 provide the shared contracts, independent recovery store, and redacted metadata boundaries required by #59.
- Issue #60 performance enforcement and issues #62 through #67 packaging, conformance, and release gates remain outside S017.

## Assumptions

- The existing recovery store remains the sole authority permitted to persist dirty document text.
- Session restoration references are not a general recent-file feature and are never exposed as a preference or unbounded history.
- Desktop source delivery derives a path-free reference from strong native identity for safe re-delivery matching; Android restoration uses only strong identity plus platform-granted durable URI authority. Neither form crosses into diagnostics or the shared renderer as a raw locator.
- S017 persists and loads the bounded startup projection, invokes Android's existing native restoration adapter after that projection is available, and materializes only revalidated sources whose opaque durable references match. It does not introduce a second source-opening authority.
- The maximum persisted session projection contains 32 sessions. The maximum language override set contains 128 entries, and each extension key contains at most 32 Unicode scalar values after normalization.
- Diagnostic retention is capped at 2,000 events, 2 MiB, and seven days, with the oldest event removed first when any limit is exceeded.
- A reset is initiated from a bounded shared command and executed by the native owner of the selected application-state category.
