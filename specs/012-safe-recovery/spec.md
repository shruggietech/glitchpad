# Feature Specification: Conflict-Safe Recovery

**Feature Branch**: `codex/012-safe-recovery`

**Created**: 2026-09-01

**Status**: Ready for planning

**Input**: User description: "The next work slice code is S012. Specify and deliver dirty state, conflict handling, crash recovery, and safe close flows end-to-end under the autopilot protocol."

**Issue Traceability**: GitHub Issue #50

## Clarifications

### Session 2026-09-01

- Q: When may dirty content be removed? A: Only after a durable save receipt, an explicit discard decision, or an explicit refusal to recover a previously persisted snapshot.
- Q: What happens when a source changes before save? A: The save is rejected before destination mutation, the session becomes conflicted, and local edits remain available for reload/discard, Save As, or a separately confirmed overwrite.
- Q: Is crash recovery ordinary session restoration? A: No. Recovery stores only bounded dirty editable content and minimum source/session context; routine clean-session restoration remains disabled.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Save without overwriting an external change (Priority: P1)

A user editing a document can save only when the source still matches the revision that was opened or last saved. If another program or provider changes the source, Glitchpad preserves the local edits and presents a stable conflict instead of silently replacing either version.

**Why this priority**: Preventing silent data loss is the primary safety guarantee for every editable renderer that follows.

**Independent Test**: Open a writable source, make local edits, mutate or remove the source externally, then attempt a save and verify that no destination write begins, the local buffer remains dirty, and the conflict actions remain available.

**Acceptance Scenarios**:

1. **Given** a dirty session whose source revision still matches, **When** save completes durably, **Then** the session adopts the returned revision, clears dirty and conflict state, and removes its recovery snapshot.
2. **Given** a dirty session whose source changed, was renamed, was deleted, became unavailable, or lost permission, **When** save is requested, **Then** Glitchpad performs no stale destination write, preserves local edits, and exposes a stable conflicted state.
3. **Given** a conflicted session, **When** the user chooses Save As, **Then** the local edits remain authoritative for the new destination and the original source is not mutated.
4. **Given** a conflicted session, **When** the user explicitly confirms overwrite after reviewing the conflict, **Then** the confirmation applies only to the exact source and external revision that was reviewed; later changes require a new confirmation.
5. **Given** a save fails, completes partially, or returns an obsolete receipt, **When** the failure is observed, **Then** the session remains dirty and recoverable and no success state is published.

---

### User Story 2 - Close or reload without losing dirty edits (Priority: P1)

A user can close, reload, or respond to source loss without Glitchpad discarding dirty content implicitly. Every destructive transition pauses for an explicit save, discard, Save As, or cancellation decision.

**Why this priority**: Close and reload are common loss paths, and source revocation or deletion can otherwise make a dirty buffer unreachable.

**Independent Test**: Exercise close, reload, application exit, rename, deletion, revocation, and unavailable-source transitions against dirty and clean sessions and verify that only clean or explicitly resolved sessions are disposed.

**Acceptance Scenarios**:

1. **Given** a clean session, **When** close or reload is requested, **Then** the transition proceeds without a dirty-content prompt.
2. **Given** a dirty session, **When** close, reload, or application exit is requested, **Then** the transition is blocked until the user saves, discards, uses Save As where required, or cancels.
3. **Given** a dirty session whose source was renamed, deleted, revoked, or unavailable, **When** the user resolves the transition, **Then** Save As, discard, and cancel remain available while unsafe in-place save is unavailable.
4. **Given** the user cancels a destructive transition or a chosen save fails, **When** control returns to the document, **Then** the same local buffer, dirty state, conflict evidence, and recovery coverage remain active.
5. **Given** multiple dirty sessions during application exit, **When** one session remains unresolved, **Then** the application does not report a completed exit and no other unresolved session is discarded.

---

### User Story 3 - Recover dirty text after abnormal termination (Priority: P1)

A user whose application terminates unexpectedly can recover recent dirty editable text without enabling routine session restoration or disclosing document content outside private local storage.

**Why this priority**: A conflict-safe save path cannot prevent loss from process or device failure; bounded local recovery closes that gap.

**Independent Test**: Persist dirty snapshots, terminate without a clean close, restart with valid, expired, corrupted, quota-constrained, and source-unavailable records, then verify deterministic recovery, refusal, cleanup, and privacy behavior.

**Acceptance Scenarios**:

1. **Given** a dirty editable session remains idle for two seconds or dirty for thirty seconds since its last snapshot, **When** recovery persistence is available, **Then** Glitchpad atomically stores the current bounded content and minimum recovery context in private local storage.
2. **Given** a valid unexpired recovery record after abnormal termination, **When** Glitchpad starts, **Then** the user can recover or decline that record without automatically restoring unrelated clean sessions.
3. **Given** the original source is changed, missing, revoked, or unavailable, **When** its recovery record is accepted, **Then** recovered content opens dirty and conflicted with Save As and discard available.
4. **Given** a recovery record is corrupted, newer than supported, expired, or over budget, **When** it is discovered, **Then** Glitchpad isolates or removes it deterministically, reports a safe actionable status, and continues starting.
5. **Given** a durable save, explicit discard, or explicit recovery refusal, **When** the decision completes, **Then** the matching recovery record is removed without affecting other records.

### Edge Cases

- An external revision can change after a conflict is shown but before overwrite confirmation; confirmation is revision-bound and becomes stale.
- A save receipt can arrive after additional edits; it cannot clear a newer dirty revision.
- A close request can target a background or overflowed tab; the same dirty-resolution rules apply without activating or losing the session implicitly.
- Recovery persistence can fail because storage is full, permissions are unavailable, a write is interrupted, or a directory entry is hostile; the active dirty session remains usable and receives a stable warning.
- Quota pressure can affect inactive records and the active dirty record; inactive oldest records are removed first, but active coverage is never silently removed.
- System time can move backward or forward; expiry and scheduling use stored timestamps defensively and never extend a record beyond the documented lifetime due to malformed time data.
- Recovery identifiers, filenames, source locators, provider identifiers, and content are sensitive; diagnostics expose only stable codes and bounded non-content counts.
- Android sources with temporary or revoked grants can still recover buffered content, but cannot claim restored source authority and must use redelivery or Save As.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Glitchpad MUST derive dirty state from the current editable revision compared with the last durably saved revision and MUST preserve dirty state across activation, backgrounding, source events, and failed operations.
- **FR-002**: Every save MUST carry the expected session revision and external revision and MUST revalidate both immediately before destination mutation.
- **FR-003**: A stale session, changed source, rename, deletion, revocation, watcher overflow, or unavailable source MUST prevent an ordinary in-place save and MUST preserve local edits.
- **FR-004**: A conflict MUST retain bounded safe evidence for the opened expectation and current source state without retaining document content in diagnostics.
- **FR-005**: Save As MUST remain available for dirty content when in-place save is unsafe or unavailable and MUST NOT mutate the original source.
- **FR-006**: Explicit overwrite authorization MUST be bound to one source, one reviewed external revision, one session revision, and one durability classification; any mismatch MUST invalidate it before writing.
- **FR-007**: Dirty state MUST clear only after a current durable save receipt or an explicit discard decision; failed, partial, stale, or unverifiable receipts MUST leave the session dirty.
- **FR-008**: Close, reload, and application-exit requests MUST produce an explicit resolution requirement for every dirty session and MUST remain cancelable until all targeted dirty sessions are resolved.
- **FR-009**: Clean sessions MAY close or reload immediately, while dirty sessions MUST remain live and retain their native authority until their resolution completes.
- **FR-010**: Source rename, deletion, revocation, or unavailability MUST NOT dispose a dirty session or remove its recovery coverage.
- **FR-011**: Glitchpad MUST snapshot dirty editable text after two seconds of edit idle time and at least every thirty seconds while dirty, subject to content and total-storage bounds.
- **FR-012**: Recovery snapshots MUST use application-private storage, owner-only permissions where supported, atomic publication, a seven-day maximum lifetime, and total default quotas of 256 MiB on desktop and 128 MiB on Android.
- **FR-013**: Recovery quota enforcement MUST remove the oldest eviction-eligible inactive records first and MUST warn before active dirty content loses recovery coverage; an unreviewed crash-recovery candidate is not eviction-eligible, and active or unresolved coverage MUST NOT be silently evicted.
- **FR-014**: A recovery record MUST contain only bounded editable content and minimum versioned source/session context needed to present and resolve recovery; it MUST exclude native handles, raw provider URIs, credentials, and unrelated metadata.
- **FR-015**: Startup recovery MUST validate schema version, integrity, size, expiry, and source authority before presenting a record and MUST isolate invalid records without blocking application startup.
- **FR-016**: Accepting recovery MUST open the recovered buffer as dirty; it MUST also be conflicted when the original source cannot be proven to match the captured revision.
- **FR-017**: Durable save, explicit discard, and explicit recovery refusal MUST remove only the matching recovery record; ordinary clean shutdown MUST retain any unresolved dirty record.
- **FR-018**: Recovery content and sensitive source context MUST never enter logs, diagnostics, analytics, network requests, or user-visible raw error details.
- **FR-019**: Shared lifecycle, conflict, close-resolution, recovery schema, quota, and cleanup policy MUST remain platform-independent; native adapters MAY provide only private-directory and source-authority mechanics.
- **FR-020**: Automated evidence MUST cover conflict, overwrite authorization, Save As, close/reload/exit cancellation, atomic snapshot publication, interrupted writes, quota, expiry, cleanup, corruption, redaction, and Android temporary or revoked authority behavior.
- **FR-021**: S012 MUST NOT implement the production text editor, routine clean-session restoration, cloud synchronization, telemetry, collaboration, version history, or a generalized workspace database.

### Key Entities

- **Editable revision**: Monotonic session value identifying the current buffer and the last durably saved buffer.
- **Conflict state**: Safe comparison of expected and current source revision evidence plus the operations that remain allowed.
- **Destructive-transition request**: Close, reload, or exit intent with its targeted sessions, current resolution state, and cancelability.
- **Overwrite authorization**: One-use approval bound to the exact source, external revision, session revision, and durability guarantee reviewed by the user.
- **Recovery record**: Versioned, integrity-protected, bounded private snapshot of dirty editable content and minimum source/session context.
- **Recovery inventory**: Bounded collection of records with total byte usage, activity status, creation and update times, expiry, and cleanup decisions.
- **Recovery outcome**: Recovered, declined, expired, corrupted, over-budget, source-conflicted, permission-revoked, or unavailable result with stable safe diagnostics.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Across 1,000 injected stale-session, external-change, rename, deletion, revocation, overflow, and unavailable-source save attempts, zero ordinary in-place attempts begin destination mutation and every local buffer remains recoverable.
- **SC-002**: Across 1,000 obsolete, partial, failed, or mismatched save receipts, zero receipts clear a newer dirty revision; every current durable receipt clears exactly one matching dirty state.
- **SC-003**: Every dirty close, reload, background-tab close, and multi-session exit scenario ends in save, discard, Save As, or cancellation with zero implicit content loss.
- **SC-004**: Dirty snapshot scheduling occurs no earlier than the two-second idle threshold and no later than thirty seconds after the prior successful snapshot while edits continue.
- **SC-005**: Desktop and Android quota corpora stay within their configured bounds, remove the oldest eviction-eligible records first, and produce zero silent eviction of active or unresolved recovery coverage.
- **SC-006**: Valid, expired, corrupted, truncated, future-version, interrupted-write, and unavailable-source recovery fixtures each produce one deterministic safe outcome without blocking startup.
- **SC-007**: Recovery acceptance, durable save, explicit discard, and refusal fixtures remove exactly the intended records and leave all unrelated records byte-for-byte unchanged.
- **SC-008**: Automated redaction scans find zero document-content excerpts, full locators, raw Android URIs, credentials, or recovery payloads in logs, diagnostics, and surfaced errors.
- **SC-009**: Shared contract tests exercise identical lifecycle and recovery policy for desktop and Android source states with platform differences limited to storage quotas and native authority evidence.
- **SC-010**: Focused Rust and interface tests plus full formatting, lint, documentation, dependency-license, secret, encoding, security, Android build, and aggregate repository gates complete successfully before publication.

## Assumptions

- S005, S006, and S011 provide the versioned session, source, identity, revision, durability, desktop persistence, Android authority, and safe error contracts that S012 extends.
- Editable content is bounded by the existing save and future editor limits; S012 provides recovery and lifecycle infrastructure without shipping the production editor tracked by Issue #52.
- Recovery storage roots are supplied by the native application host and are never chosen from document-controlled paths.
- Desktop filesystems use their existing atomic replacement path; Android provider sources continue to require Save As unless a separately proven recoverable non-atomic path is authorized.
- The seven-day lifetime and 256 MiB desktop or 128 MiB Android quotas are default product limits and may be lowered by a platform when storage is unavailable, but never increased silently.
- "Inactive" quota eviction is narrowly limited to expired, superseded, or explicitly resolved coverage. This intentionally tightens the broad v0 data-model wording so it cannot contradict Issue #50's stronger no-silent-loss rule.
- Routine clean-session restoration remains disabled, and S012 does not change the product version or stable capability declarations.
