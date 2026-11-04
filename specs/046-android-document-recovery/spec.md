# Feature Specification: S046 Android Document Recovery and Standalone Authoring

**Feature Branch**: `codex/046-android-document-recovery`

**Created**: 2026-11-03

**Status**: Implemented; exact-candidate qualification and review in progress

**Input**: Execute the approved five-issue bundle (#245, #246, #247, #248, #252) under Spec-Kit autopilot; automatically push/open the PR, monitor CI and address findings within two review rounds, then stop for owner review and merge.

## User Scenarios & Testing

### User Story 1 - Open Markdown with visible recovery (Priority: P1)

A person opens Markdown through Android cold delivery, warm delivery, or the in-app picker and receives readable content or an actionable failure without losing document navigation, source access, or recoverable edits.

**Why this priority**: A blank application prevents every subsequent document task (#245).

**Independent Test**: Open the governed corpus through each route and inject document and startup failures; observe content or recovery with another document still usable.

**Acceptance Scenarios**:

1. **Given** headings, lists, links, code, tables, Unicode, empty and malformed Markdown, **When** each delivery route opens it, **Then** readable content or an explained fallback appears without an empty application viewport.
2. **Given** worker, parse, projection or document failure, **When** rendering fails, **Then** Retry or View source is available where valid and navigation remains usable.
3. **Given** root/bootstrap failure, **When** the application cannot mount, **Then** host-visible recovery or controlled restart remains available with retained state or an explicit recovery limitation.

### User Story 2 - Create, edit, save, reopen and recover a document (Priority: P1)

A person launches Android directly, creates Markdown/text or opens a local file, edits it or an explicit copy, and saves exact bytes through the native document picker (#246, #247).

**Why this priority**: New/Open without durable Save is an incomplete authoring capability.

**Independent Test**: Create each draft type, edit, switch documents, save, independently read and reopen the destination; cancel/fail writes and recreate the process while edits remain recoverable.

**Acceptance Scenarios**:

1. **Given** cold launch or an open document, **When** Add document expands, **Then** three labeled New Markdown, New text file and Open file choices remain reachable and dismiss predictably with useful focus.
2. **Given** a draft, **When** saving succeeds, **Then** a native verified receipt precedes source binding and clean state; reopened bytes exactly match the intended UTF-8 content.
3. **Given** read-only input, **When** Edit a copy is selected and saved, **Then** the original bytes remain unchanged.
4. **Given** cancellation, revoked access, stale revision, partial I/O, storage refusal or pending write, **When** Save/Close/Discard compete, **Then** no false success or unintended close/data loss occurs and recoverable edits remain.

### User Story 3 - Execute actions and export useful diagnostics (Priority: P2)

A menu, shortcut and renderer tool operate on the same current document and report actual performed, failed or cancelled outcomes. A person can save or share the exact redacted diagnostic preview (#248, #252).

**Why this priority**: Validation alone must not masquerade as execution, and failure evidence must have an observable destination.

**Independent Test**: Exercise Save and image/diagram Zoom through all exposed routes, inject stale/unsupported/cancelled operations, then save/read diagnostic JSON and receive a shared bundle with temporary access.

**Acceptance Scenarios**:

1. **Given** a supported command, **When** any exposed route invokes it, **Then** one current-session operation runs and its actual result is reported; no absent handler yields an applied claim.
2. **Given** a frozen redacted preview, **When** Save succeeds, **Then** independent readback matches its exact JSON bytes; pending, cancellation and failure retain truthful state.
3. **Given** Share, **When** the system accepts a handoff, **Then** a receiver can read the bundle and the UI distinguishes handoff from confirmed recipient delivery.

### Edge Cases

- The reported Markdown document, original APK hash and incident trace are unavailable: record that explicitly and do not assign a speculative root cause.
- A pending operation resolves after editing or switching sessions: it cannot clean a newer revision or mutate another document.
- Back/outside tap/rotation/IME dismiss exactly the intended Add document layer and cannot activate background content.
- Source authority may be revoked or insufficient for durable in-place Save: offer Save As or an explained refusal while retaining edits.
- Process recreation cannot restore an external grant: restore a recovery-only copy without fabricating source authority.
- Clipboard denial, failed search/read, empty undo/redo, absent renderer handler and asynchronous failure produce bounded outcomes.
- Clear diagnostics fails: existing events and the frozen export remain available.

## Requirements

### Functional Requirements

- **FR-001**: Trace delivery, authorization/read, session creation, root commit, Markdown render and visible outcome using bounded correlated stage/reason evidence without private input details (#245).
- **FR-002**: Contain document failures and provide startup/root recovery; retain navigation, available source and recoverable draft state or explicitly explain unavailable recovery (#245).
- **FR-003**: Provide inset-aware Add document with distinct New Markdown/New text/Open choices at cold launch and during viewing; drafts have unique identity, editable content and unsaved state without invented external identity (#246).
- **FR-004**: Connect the native Open picker to existing source/session materialization while preserving external Open with/Share delivery; cancellation leaves the app unchanged and revoked access offers fresh selection (#246).
- **FR-005**: Add document geometry, semantics, dismissal and focus work at default/maximum font scale, short viewport, landscape and IME; targets are at least 48dp-equivalent and clear of gesture/tool areas (#246).
- **FR-006**: Save drafts through source-independent native destination selection, write and readback; existing provider Save As retains its source authority checks (#247).
- **FR-007**: Read-only sources offer Edit a copy. In-place Save requires truthful revision/conflict/durability support; otherwise offer Save As. Original/last committed bytes remain intact on failure (#247).
- **FR-008**: Bind destinations and clear dirty state only after successful receipt for the exact saved revision; cancellation/failure preserve edits and pending writes cannot race Discard/Close (#247).
- **FR-009**: Restore bounded draft/copy contents after suspension/process recreation within existing recovery policy, without inventing source grants; Save/Save As/copy and dirty Close/Back use the same result path (#247).
- **FR-010**: Define action identity, session/revision, role/group/rank, availability/reason, pending/cancellation and performed/failed/cancelled result; every exposed menu/keyboard/renderer action runs one provider or reports unavailable (#248).
- **FR-011**: Save requires a durable native receipt; image/diagram menu/local Zoom/Fit share viewport state; advertised Copy/Search/Go to line/Undo/Redo/page shortcuts execute or carry an accurate unavailable disposition (#248).
- **FR-012**: Capture actual cancellation, clipboard/read denial, empty history and asynchronous failure without validation-only success or stale-session mutation (#248).
- **FR-013**: Freeze one immutable redacted diagnostic JSON preview; native Save writes/readbacks those exact bytes and native Share grants temporary receiver access (#252).
- **FR-014**: Distinguish pending/saved/failed/cancelled/share-handoff states; prevent duplicate export, preserve payload after failure and preserve events after failed Clear (#252).
- **FR-015**: Capture correlated Markdown/image/root/delivery/action/export failure events and actual product/build/source/Android/WebView identity where available; explicitly mark unavailable facts and redact contents, names, paths, provider URIs and link targets (#252).
- **FR-016**: Retain exact APK/source/runtime-bound API24/API36 provider and actual WebView task evidence, independent saved-byte readback, geometry and keyboard results; include suitable Android14+ maximum 200% text scale. Extend desktop Markdown regression coverage (#245-#248, #252).
- **FR-017**: Preserve offline operation, existing resource bounds, source integrity, access security and pinned brand contracts; introduce no new product eligibility or usage policy (#245-#248, #252).
- **FR-018**: Execute installed Spec-Kit phases, CI-parity and affected package/native gates, automatic push/PR, at most two external review rounds and owner merge handoff. Track each issue separately and leave incomplete acceptance open.

### Key Entities

- **Draft**: unique session/recovery identity, format, content revision, unsaved state and optional later verified destination.
- **Action**: operation identity, current document/revision, presentation metadata, availability, pending cancellation and actual outcome.
- **Save receipt**: verified destination, saved revision/byte count and host authority; never inferred from a callback alone.
- **Failure event**: bounded correlation identity, component/stage/reason and content-free runtime context.
- **Diagnostic export**: immutable preview bytes and native Save/Share outcome with distinct handoff semantics.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every governed Markdown route/corpus and injected failure ends in readable content or visible recovery; zero tested routes leave an empty app viewport.
- **SC-002**: Both draft types and read-only copies complete exact-byte save/reopen; all exercised cancellation/failure/race cases preserve recoverable edits and original bytes.
- **SC-003**: Every exposed action has one actual execution or an accurate unavailable/cancelled/failed result; zero validation-only applied outcomes remain.
- **SC-004**: Saved diagnostic bytes exactly match the frozen preview and a shared bundle is readable with temporary access; redaction tests reveal zero private content/location/target leakage.
- **SC-005**: Every included issue criterion has its own passing evidence or an explicitly open disposition; applicable final-head checks are terminal-successful before owner handoff.

## Assumptions

- Baseline main is 8160ed2a824384ed42dbd4cd43232a34373e9c20 and the official product remains v0.2.0 until the later release reconciliation (#255).
- #249/#250/#251/#253, aggregate #254, release #255 and epic #244 retain their broader scope; this slice supplies relevant evidence without implicitly closing them.
- Owner waivers of physical-device, manual-screen-reader and reference-hardware prerequisites remain in force; unperformed checks are never claimed.
- Automatic push and PR are authorized. Merge, tags, release publication and public deployment are reserved for the owner.

## Clarifications

### Session 2026-11-03

- Q: Should an unsaved draft pretend to own an external source? A: No. It has local recovery identity and gains external authority only after a verified native destination receipt (FR-003/006/008).
- Q: Must Android implement unsafe provider overwrite to expose Save? A: No. Use verified Save As when required revision/durability guarantees are unavailable (FR-007).
- Q: Does source-level repair establish the original blank-screen cause? A: No. Missing incident bytes are recorded; corpus and injected-boundary evidence establish only their tested outcomes (FR-001/016).
- Q: Does a Sharesheet return prove recipient delivery? A: No. It proves handoff or cancellation, while receiver readability is tested separately (FR-013/014).
