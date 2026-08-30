# Feature Specification: Desktop Source Lifecycle

**Feature Branch**: `codex/006-desktop-source-lifecycle`

**Created**: 2026-08-30

**Status**: Ready for review

**Input**: User description: "Spec out `S006` and run it end-to-end under the autopilot protocol as usual."

**Issue Traceability**: GitHub Issue #46

## Clarifications

### Session 2026-08-30

- Q: Does S006 include Android document providers? A: No. S006 implements Windows, macOS, and Linux desktop sources. Android URI grants and provider persistence remain in the separately tracked Android source-adapter work.
- Q: May the interface acquire an arbitrary path directly? A: No. Paths enter only through trusted desktop deliveries such as a system dialog, drag-and-drop, command-line launch, or operating-system association. The interface receives only opaque source IDs and bounded values.
- Q: What happens when the host cannot provide the full atomic durability protocol? A: The host must classify the weaker guarantee before any write, require explicit acknowledgement for that specific save, retain a recoverable backup until success, and never treat a partial operation as a successful save.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open an explicitly delivered desktop file (Priority: P1)

A desktop user opens a file through a trusted system delivery and Glitchpad acquires only the authority needed for the operations that source actually supports. Reopening the same strongly identified file focuses its existing session, while uncertain identities remain independent.

**Why this priority**: Every desktop document interaction depends on acquiring a safe source without exposing broad filesystem authority or duplicating a known document session.

**Independent Test**: Deliver regular files through dialog, drop, command-line, and association fixtures; inspect the resulting opaque summaries and session result without giving the interface a reusable path.

**Acceptance Scenarios**:

1. **Given** a readable regular file delivered by a trusted desktop channel, **When** the host acquires it, **Then** the interface receives an unguessable source ID, safe display metadata, the strongest available identity, an external revision, and only capabilities the source supports.
2. **Given** a strongly identified source already has a session, **When** the same file is delivered again through any trusted channel, **Then** the existing session is focused and no duplicate session is created.
3. **Given** two deliveries whose identities cannot prove sameness, **When** both are acquired, **Then** they remain separate sources and sessions.
4. **Given** a directory, missing file, unsupported source kind, or renderer-originated path, **When** acquisition is attempted, **Then** the host rejects it with a stable safe error and grants no source authority.

---

### User Story 2 - Read and observe a bounded source (Priority: P1)

A user can view a document while the host performs bounded reads, exposes safe metadata, observes external changes only while needed, and converts unreliable watcher conditions into explicit states that require revalidation.

**Why this priority**: Viewing and later rendering require trustworthy bytes and revision awareness before editing or persistence can be safe.

**Independent Test**: Acquire a temporary desktop file, exercise allowed and over-budget ranges, mutate, rename, delete, or revoke it, and inspect ordered source events and revalidation results.

**Acceptance Scenarios**:

1. **Given** a readable acquired source, **When** a bounded range or stream chunk is requested, **Then** the host validates offsets and byte budgets before I/O and returns no more than the permitted bytes.
2. **Given** a source whose content or metadata changes externally, **When** watcher events are drained, **Then** the host emits ordered safe events and marks the source as requiring revalidation.
3. **Given** a rename, deletion, permission loss, watcher overflow, or watcher backend failure, **When** the event is observed, **Then** the source enters a stable visible state without losing buffered document content or exposing the native path.
4. **Given** a watcher overflow or ambiguous event, **When** the source is revalidated, **Then** the caller receives the current revision and an explicit match result rather than assuming the source is unchanged.

---

### User Story 3 - Save without silently overwriting external work (Priority: P1)

A user saves an edited desktop document only after the host proves that the expected external revision still matches and completes the strongest durability protocol available on that source.

**Why this priority**: Silent overwrite and partial persistence are unacceptable data-loss failures.

**Independent Test**: Save unchanged sources, force stale revisions, inject write and replacement failures, and verify that only a durable receipt can advance the saved revision.

**Acceptance Scenarios**:

1. **Given** an expected external revision that still matches, **When** a bounded save payload is committed, **Then** the host writes a sibling temporary file, flushes it, preserves required permissions, replaces the destination atomically where supported, performs available directory durability, and returns the new durable revision.
2. **Given** the source changed after editing began, **When** save is requested with the stale revision, **Then** the host returns a conflict before replacement and preserves both the external file and local edits.
3. **Given** the platform or filesystem cannot provide the full atomic protocol, **When** save is requested without acknowledgement of the classified weaker guarantee, **Then** no write begins.
4. **Given** an acknowledged weaker write or any persistence failure, **When** replacement does not complete durably, **Then** the original or recoverable backup remains available and no success receipt is issued.

---

### User Story 4 - Open external links only from explicit safe intent (Priority: P2)

A user may explicitly request that an allowed external link open through the operating system, while documents and renderers cannot trigger unsupported schemes or background launches.

**Why this priority**: Desktop source content is untrusted, and link dispatch crosses into another privileged application.

**Independent Test**: Submit allowed and disallowed schemes with and without a user-activation proof and inspect the authorization result without launching an external application.

**Acceptance Scenarios**:

1. **Given** an `https`, `http`, or `mailto` link selected through a current explicit user action, **When** authorization is requested, **Then** the host returns a one-use authorization for that normalized target.
2. **Given** a file, script, custom, malformed, credential-bearing, control-character, or non-user-initiated target, **When** authorization is requested, **Then** it is rejected without invoking the operating system.

### Edge Cases

- A source is replaced by a different file at the same path between acquisition and an operation.
- A rename event supplies only one side of the rename or arrives with unrelated parent-directory events.
- A watcher reports an overflow/rescan requirement, disconnects, or coalesces several changes.
- A file changes size without a reliable modified timestamp, or a filesystem exposes only weak identity.
- A read offset plus length overflows, exceeds the source, exceeds the operation budget, or races an external revision.
- A source becomes read-only, unavailable, deleted, or permission-revoked after acquisition.
- A save payload exceeds its budget, disk space is exhausted, permissions cannot be preserved, or the replacement fails after the temporary file is durable.
- The destination is a symlink, directory, device, socket, pipe, or another non-regular file.
- A source name contains invalid Unicode, control characters, or values unsafe for diagnostics.
- An external link uses mixed-case schemes, leading whitespace, embedded credentials, encoded controls, or a deceptive unsupported scheme.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The desktop host MUST accept source acquisition only from trusted dialog, drag-and-drop, command-line, and operating-system association deliveries supplied by native application code.
- **FR-002**: The desktop host MUST reject non-regular files and MUST NOT expose native paths, reusable handles, shell commands, or unrestricted filesystem operations to interface or renderer code.
- **FR-003**: Every acquired source MUST receive an unguessable process-local source ID scoped to one source session and a safe summary containing only display name, claimed media type when available, byte length, modified time when reliable, source kind, identity, revision, and capabilities.
- **FR-004**: The host MUST derive the strongest available desktop identity from platform file identity and MUST use normalized path evidence only as a weak fallback; only comparable strong identities may prove duplicate sessions.
- **FR-005**: Read, seek, stream, stat, watch, revalidate, write, atomic replace, rename observation, and deletion observation MUST be advertised independently, and unavailable capabilities MUST remain false rather than being simulated.
- **FR-006**: Every byte operation MUST validate source ID, offset, per-operation length, cumulative stream budget, and arithmetic overflow before native I/O; an individual range or chunk MUST NOT exceed 1 MiB and a stream lease MUST NOT exceed its declared budget.
- **FR-007**: Metadata results and diagnostic context MUST omit full paths, raw source bytes, document content, and unrestricted native error text.
- **FR-008**: Every source capable of revalidation MUST carry an external revision made from the strongest reliable identity and change facts available on that platform; equality MUST require exact comparable revision facts.
- **FR-009**: Watching MUST be active only while requested, observe the source and its parent where needed for rename and deletion fidelity, assign monotonically increasing event sequence numbers, and expose changed, renamed, deleted, permission-revoked, overflow, and unavailable states.
- **FR-010**: Watcher overflow, backend error, ambiguous rename, and coalesced change events MUST invalidate prior watcher certainty and require explicit revalidation before save.
- **FR-011**: Revalidation MUST return the current revision and one of match, changed, unavailable, deleted, or permission-revoked without treating an I/O failure as equality.
- **FR-012**: Save MUST validate the expected session revision and external revision before opening a temporary destination and MUST return conflict before replacement when either precondition is stale.
- **FR-013**: A full-strength desktop save MUST write through a sibling temporary file, flush buffered data, synchronize file data, preserve required permissions, atomically replace the destination, and synchronize the parent directory where the platform provides that primitive.
- **FR-014**: When the full-strength protocol is unavailable, the host MUST classify and disclose the missing guarantee before writing, require explicit acknowledgement bound to the source and expected revision, and retain a recoverable backup until replacement succeeds.
- **FR-015**: Save success MUST be represented only by a durable receipt carrying source ID, accepted session revision, previous external revision, new external revision, byte count, and actual durability guarantee.
- **FR-016**: Deletion, revocation, storage exhaustion, watcher overflow, conflict, partial-write prevention, and I/O failure MUST map to stable safe states and errors that preserve dirty interface content.
- **FR-017**: Closing a source MUST cancel or reject pending work, stop watching, invalidate stream and write authorizations, release native handles, and make later operations return not found.
- **FR-018**: External-link authorization MUST require a current explicit user action, allow only normalized `https`, `http`, and `mailto` targets, reject credentials and control characters, and produce a one-use authorization rather than invoking an arbitrary renderer-supplied command.
- **FR-019**: One shared desktop conformance suite MUST exercise the same acquisition, identity, range, metadata, watch-state, revalidation, conflict, persistence, close, and link-policy contract on Windows, macOS, and Linux.
- **FR-020**: S006 MUST NOT add Android URI handling, editor save orchestration, recovery storage, general shell execution, arbitrary URL opening, routine session restoration, or release capability claims.

### Key Entities

- **Source ID**: Unguessable process-local authorization token for one acquired source; it contains no reusable path semantics.
- **Desktop delivery**: Trusted native event identifying how a file entered the host, including dialog, drop, command-line, or association.
- **Source record**: Host-private native path and handles plus the safe descriptor, external revision, capabilities, watcher state, and outstanding bounded leases.
- **Document identity**: Strong platform file identity or weak normalized-path fallback used only according to evidence strength.
- **External revision**: Comparable set of identity, size, modified/change time, and platform facts used as a save precondition.
- **Source event**: Ordered visible state transition for changed, renamed, deleted, revoked, overflow, or unavailable observations.
- **Save request**: Source ID, expected session and external revisions, bounded bytes, and optional weaker-guarantee acknowledgement.
- **Save receipt**: Durable evidence of a completed replacement and the new external revision.
- **Link authorization**: One-use approval for one normalized allowed target tied to a current explicit user action.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The desktop adapter conformance suite passes without conditional business-rule differences on Windows, macOS, and Linux CI runners.
- **SC-002**: Across 100 repeated mixed-channel deliveries of the same strong file identity, exactly one source session is created; across 100 weak or unavailable identity pairs, zero pairs are merged.
- **SC-003**: Range and stream property tests cover zero, boundary, oversized, and overflowing inputs and observe zero reads beyond the declared operation or stream budget.
- **SC-004**: Mutation, rename, deletion, revocation, watcher overflow, and watcher failure fixtures each produce a stable serialized state with a monotonically increasing sequence and no native path or content disclosure.
- **SC-005**: Across 1,000 stale-revision save attempts, zero attempts replace the destination and every attempt returns a conflict that preserves the original file and submitted edit payload at the caller boundary.
- **SC-006**: Successful-save fault tests demonstrate that no durable receipt is returned before content flush, file synchronization, replacement, and every platform-available directory durability step complete.
- **SC-007**: Every platform adapter reports its actual persistence guarantee, and every weaker-guarantee fixture performs zero writes before an acknowledgement bound to the current source revision is supplied.
- **SC-008**: Allowed and rejected external-link policy fixtures produce 100 percent deterministic decisions, and no test invokes an external application.
- **SC-009**: Focused host tests, shared workspace tests, formatting, lint, dependency-license, documentation, encoding, and public-surface gates complete successfully with no release-facing support claim changed.

## Assumptions

- S005’s versioned source, identity, session, error, and capability contracts are the foundation and may be extended compatibly within contract version 1 where fields are internal to unreleased code.
- Native application code is trusted to originate delivery events, but every delivered path is still treated as untrusted input and revalidated by the host.
- Local regular files are the only desktop source kind in S006. Directories, devices, sockets, pipes, network URLs, and Android document URIs are excluded.
- Watch notifications are hints rather than revision authority; revalidation remains authoritative before save.
- Network-mounted and unusual filesystems may provide weaker identity, watching, or replacement guarantees and must advertise those limits explicitly.
- UI conflict resolution, editor buffers, recovery snapshots, Save As dialogs, and renderer integration remain later work; S006 supplies the safe host contracts and states they consume.
