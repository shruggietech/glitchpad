# Feature Specification: Android Source Lifecycle

**Feature Branch**: `codex/011-android-source-lifecycle`

**Created**: 2026-09-01

**Status**: Ready for planning

**Input**: User description: "The next work slice code is S011. Utilize spec-kit to spec out the Android source lifecycle work, then deliver it end-to-end under the autopilot protocol."

**Issue Traceability**: GitHub Issue #47

## Clarifications

### Session 2026-09-01

- Q: Which Android actions arrive as external deliveries versus Glitchpad-initiated picker flows? A: `ACTION_VIEW` and single-item `ACTION_SEND` are inbound deliveries. Glitchpad initiates `ACTION_OPEN_DOCUMENT` for Open and `ACTION_CREATE_DOCUMENT` for Save As, then acquires the returned activity-result source.
- Q: May an inbound delivery become persistable merely because it carries a persistable flag? A: No. Inbound view and share grants remain temporary. Glitchpad requests persisted authority only for its own picker results when the returned grant flags offer it and the provider accepts it.
- Q: Is a provider's write-support flag enough to permit in-place replacement? A: No. Unknown third-party providers default to Save As because Android exposes no general atomic-replacement guarantee. Direct update requires separately proven safe provider behavior and explicit weaker-durability handling.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open content delivered by Android (Priority: P1)

An Android user opens or shares a document with Glitchpad through the operating system, or selects a document from Glitchpad's Open flow, and the application acquires only the authority granted for that individual content source without requiring a filesystem path.

**Why this priority**: Every Android document interaction depends on accepting system deliveries safely and representing provider-backed content directly.

**Independent Test**: Deliver view and share intents and return controlled results from Glitchpad-initiated open-document and create-document pickers, then verify source summaries, capabilities, identities, and grant states without exposing a raw content URI or native path.

**Acceptance Scenarios**:

1. **Given** a readable document delivered by a supported inbound action or returned from Glitchpad's Open picker, **When** Glitchpad acquires it, **Then** the active session receives an opaque source identifier, safe display metadata, provider-backed identity evidence, the current revision evidence, and only the operations supported by that provider and grant.
2. **Given** a picker result that offers persistent authority and a provider that accepts it, **When** Glitchpad acquires the source, **Then** only the offered authority is requested and its actual result is visible in the safe source state.
3. **Given** an inbound view or share grant, **When** Glitchpad acquires the source, **Then** the source remains explicitly temporary and is never represented as restorable authority.
4. **Given** the same strongly identified provider document is delivered again while open, **When** its identity is evaluated, **Then** the existing source session is focused; uncertain identities remain separate.
5. **Given** an unsupported action, absent content, malformed provider result, directory-like source, or delivery without readable authority, **When** acquisition is attempted, **Then** Glitchpad rejects it with a stable safe error and retains no source authority.

---

### User Story 2 - Read and survive Android lifecycle changes (Priority: P1)

An Android user can continue viewing provider-backed content while Glitchpad performs bounded reads, observes provider metadata, handles activity and process lifecycle changes, and turns revoked or failed authority into an explicit recoverable state.

**Why this priority**: Android providers and URI grants can disappear independently of the application, so the host must never assume that previously observed access still exists.

**Independent Test**: Exercise bounded descriptor and stream reads, activity redelivery, process-state restoration, provider failures, renamed metadata, and revoked grants against controlled providers on the oldest and newest supported Android API levels.

**Acceptance Scenarios**:

1. **Given** an acquired source, **When** a bounded range or stream chunk is requested, **Then** Glitchpad validates offsets and byte budgets before provider I/O and returns no more than the permitted bytes.
2. **Given** a source whose provider supports seeking, **When** a range is requested, **Then** the host reads that bounded range; a stream-only source advertises that limitation rather than fabricating seek support.
3. **Given** a provider rename, metadata change, failure, or grant revocation, **When** the source is revalidated, **Then** Glitchpad returns a stable changed, unavailable, or permission-revoked state without losing the document session's buffered content.
4. **Given** Android recreates the activity or application process, **When** Glitchpad restores source state, **Then** persisted authority is revalidated before use and temporary authority is reported as requiring redelivery.
5. **Given** a running activity receives another supported intent, **When** it is delivered, **Then** the new delivery follows the same acquisition and identity rules as initial launch.

---

### User Story 3 - Save through Android providers without silent loss (Priority: P1)

An Android user saves to a writable provider source only when its revision and write behavior are safe, or chooses a new destination through the operating system when the original source cannot be updated safely.

**Why this priority**: Provider writes cross an external trust boundary and must not truncate a destination before a complete payload and conflict decision are ready.

**Independent Test**: Exercise writable, read-only, create-document, stale-revision, revoked, short-write, and provider-failure fixtures and verify that only a completed write returns a save receipt.

**Acceptance Scenarios**:

1. **Given** an existing provider source, **When** direct update is requested without separately proven safe provider behavior, **Then** Glitchpad performs no destination write and reports that a new system-selected destination is required.
2. **Given** the provider revision changed, **When** save is requested, **Then** Glitchpad reports a conflict before opening any destination for write and preserves both the external content and submitted edits.
3. **Given** a read-only, unsafe, unavailable, or revoked source, **When** save is requested, **Then** Glitchpad performs no destination write and reports that a new system-selected destination is required.
4. **Given** the user selects a destination through the Android create-document flow, **When** the complete payload is saved, **Then** Glitchpad acquires the resulting source under its actual grant and provider capabilities.
5. **Given** a provider write fails or completes only partially, **When** the result is observed, **Then** Glitchpad issues no success receipt and retains the submitted edits at the caller boundary for retry or Save As.

### Edge Cases

- A share intent may provide the same content item through compatibility fields, one distinct content item, no content item, text-only data, or multiple distinct items; S011 normalizes a duplicated reference, accepts exactly one distinct supported content item, and rejects all other shapes without partial acquisition.
- A provider may omit display name, size, modification time, document ID, seek support, write flags, or persistable-grant support; missing facts reduce capabilities and identity strength rather than receiving fabricated values.
- A provider can return stale metadata, throw while opening a descriptor, close a stream early, report an unknown length, or disappear between metadata and I/O; every case becomes a stable error or revalidation result.
- A persistable-grant request may be advertised but rejected; the source remains usable only under the actually held temporary grant and is marked non-restorable.
- A content URI may contain sensitive provider or user data; raw URIs never appear in interface values, logs, diagnostics, or error messages.
- Process restoration may find a remembered source without a currently held grant; the source is restored as permission-revoked and requires explicit redelivery.
- Direct provider replacement may not offer filesystem-style atomicity; S011 reports the actual Android provider guarantee and never claims desktop atomic replacement.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Glitchpad MUST accept single-source inbound deliveries from Android view and share actions at both initial activity creation and later intent delivery.
- **FR-002**: Glitchpad MUST initiate the Android open-document picker for Open and create-document picker for Save As, then acquire exactly one valid source returned through the corresponding activity result.
- **FR-003**: Glitchpad MUST reject unsupported actions, missing sources, distinct multi-source shares, directory-like or virtual sources, and sources without readable authority using stable safe errors.
- **FR-004**: Glitchpad MUST represent every Android source using an unguessable process-local identifier and MUST NOT expose or require a filesystem path or raw content URI outside the native Android boundary.
- **FR-005**: Glitchpad MUST derive source identity from provider authority, document identity when available, and canonical provider identity evidence; weak or missing evidence MUST NOT deduplicate sessions.
- **FR-006**: Glitchpad MUST derive read, seek, write, metadata, persistence, and restoration capabilities from observed provider behavior and held grants rather than from intent action or filename alone.
- **FR-007**: Glitchpad MUST request persistent read or write authority only for Glitchpad-initiated picker results when the result offers it and the provider accepts it, record whether acquisition actually succeeded, and preserve inbound view and share grants as temporary.
- **FR-008**: Glitchpad MUST provide the same bounded read, metadata, revalidation, save, close, capability, revision, and stable error classes used by the shared source contract while allowing Android-specific grant state to remain explicit.
- **FR-009**: Glitchpad MUST enforce declared operation and stream byte budgets before provider I/O and MUST distinguish seek-capable descriptors from stream-only sources.
- **FR-010**: Glitchpad MUST revalidate provider access and revision evidence after activity recreation, process restoration, new intent delivery, provider metadata change, provider failure, and suspected grant revocation.
- **FR-011**: Glitchpad MUST preserve enough bounded private source state to revalidate persisted grants after process recreation without storing content, raw URIs in diagnostics, or temporary authority as restorable authority.
- **FR-012**: Glitchpad MUST refuse direct save before opening a destination when the expected revision is stale, write authority is absent, provider behavior is unsafe, or authority has been revoked.
- **FR-013**: Glitchpad MUST prepare and validate the complete bounded save payload before opening a newly selected provider destination and MUST issue a save receipt only after the provider reports successful completion and the written result is verified.
- **FR-014**: Glitchpad MUST support acquiring a new destination returned by the Android create-document flow for read-only, unsafe, revoked, or user-directed Save As operations.
- **FR-015**: Glitchpad MUST invalidate native descriptors and stream leases on source close, activity destruction where ownership ends, grant revocation, and process-state replacement.
- **FR-016**: Android platform code MUST remain a narrow native bridge; shared source policy, capability semantics, error classification, and revision comparison MUST remain platform-independent.
- **FR-017**: Automated evidence MUST exercise the complete acceptance matrix on Android API 24 and API 36, including initial and redelivered intents, picker results, bounded reads, persistent and temporary grants, process restoration, provider failure, rename, save, Save As, and revoked authority.
- **FR-018**: S011 MUST NOT implement editor dirty-state policy, recovery snapshot retention, conflict-resolution user interface, format-specific rendering, or release-format intent filters; those remain separately tracked work.

### Key Entities

- **Android source record**: Native-only authority for one provider-backed source, including opaque ID, provider identity evidence, capabilities, current revision, held grant state, lifecycle state, and bounded active leases.
- **Android delivery**: One validated system intent delivery with action kind, exactly one source reference, grant flags, and whether it originated at launch or redelivery.
- **Grant state**: Actual temporary or persisted read/write authority, restoration eligibility, and the last validation outcome.
- **Provider revision**: Comparable provider identity, size, modification evidence, and change token used for revalidation and save preconditions.
- **Restoration record**: Bounded private state sufficient to revalidate a source with persisted authority after process recreation; it contains no document content.
- **Provider save request**: Opaque source ID, expected revision, complete bounded bytes, and destination mode for update or system-selected creation.
- **Provider save receipt**: Evidence that the provider operation completed, with accepted revision, byte count, resulting source summary, and actual durability classification.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every supported initial and redelivered inbound action and picker-result fixture produces exactly one accepted source or one deterministic safe rejection on API 24 and API 36.
- **SC-002**: Across 100 repeated deliveries of the same strong provider identity, exactly one source session is selected; across 100 weak or unavailable identity pairs, zero pairs are merged.
- **SC-003**: Boundary and property tests observe zero reads beyond declared operation or stream budgets and zero seek attempts against sources that do not advertise seek support.
- **SC-004**: Temporary, persisted, rejected-persistence, revoked, and missing-after-restoration grant fixtures each produce the correct visible grant and lifecycle state with no raw URI, path, or content disclosure.
- **SC-005**: Across 1,000 stale-revision, read-only, unsafe-provider, and revoked-authority save attempts, zero attempts open the destination for write and every submitted edit payload remains available to the caller.
- **SC-006**: Provider failure and short-write fixtures produce zero successful save receipts; successful Save As fixtures return a receipt only after the complete payload is observable from the new destination.
- **SC-007**: API 24 and API 36 instrumentation evidence covers open, edit-payload save, share, process restoration, provider failure, rename, Save As, and revoked grants with no conditional shared-policy differences.
- **SC-008**: Static architecture checks find zero Android filesystem-path derivations, zero raw URI exposure across the interface boundary, and no shared business-rule implementation in Kotlin.
- **SC-009**: Focused Android tests, shared Rust contract tests, formatting, lint, dependency-license, documentation, encoding, Android debug build, and aggregate repository gates complete successfully.

## Assumptions

- S005 and S006 provide the versioned source, capability, identity, revision, error, session, bounded I/O, and desktop lifecycle contracts that S011 extends without weakening desktop behavior.
- Android API 24 is the minimum supported runtime and API 36 is the current target and newest required acceptance runtime.
- Provider metadata and capability claims are untrusted hints and are verified through the narrowest safe operation available before authority is advertised.
- The Android application continues to use one activity with single-task delivery, so supported intents may arrive during initial creation or through later intent redelivery.
- S011 may store bounded restoration metadata in application-private state only for sources whose persistent authority was actually acquired.
- S012 will own dirty buffer snapshots, seven-day recovery retention, safe-close interaction, and conflict-resolution interface policy; S011 preserves the host evidence and failure states that S012 consumes.
- Released MIME-type intent filters remain unchanged until their format capabilities reach stable release status; S011 tests intent handling with explicit controlled deliveries.
