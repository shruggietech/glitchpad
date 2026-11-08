# Feature Specification: Android task completion and qualification

**Feature Branch**: `codex/047-android-task-completion`

**Created**: 2026-11-04

**Status**: Specified

**Input**: Owner-approved S047 bundles #249, #250, #251, #253 and #254 under autopilot through PR publication, exact-head CI and at most two external review rounds, stopping for owner final review and merge.

## Clarifications

### Session 2026-11-04

- Scope and release boundary: complete #249/#250/#251/#253/#254; retain #255/#244 and unrelated conformance/performance/format milestones for their own gates.
- Surface behavior: phone task surfaces are modal; the wide inspector may be explicitly nonmodal. Back cancellation preserves state, and committed Back dismisses one eligible layer.
- Reset scope: Reset view returns image/diagram pan and zoom to Fit while retaining selected animation/frame/icon and background state; those controls remain separate.
- Evidence identity: ordinary-candidate tasks and injected-fault probes identify their actual installed APKs separately. A different package is not qualified by matching source alone.
- Report input resolved: the owner supplied Glitchpad-Product-Recovery.pdf (SHA-256 b46fd23ec94fc458c67c044a5dd1be6f3fec628ab55d9b668d08df51a838da9a). Pages 17-31 contain all 119 literal CTRL rows and 24 groups. The report declares 150 named controls/variants; literal top-level slash splitting yields 154 label chunks, which are not a semantic variant count. Preserve every literal label and explicit case mapping, with both counts attributed honestly.

## User Scenarios & Testing

### User Story 1 - Operate a compact document shell (Priority: P1)

A phone user sees the active file, adds or switches documents, uses the relevant tools, dismisses temporary surfaces predictably, and reaches About/Help even after a contained document failure.

**Why this priority**: The shell gives every document task a visible, reachable route while leaving the document dominant.

**Independent Test**: Open one and several documents, exercise compact and wide layouts, navigate app destinations, and verify Back, focus, cancellation and keyboard transitions.

**Acceptance Scenarios**:

1. **Given** an empty, loaded or failed document state, **When** the user views the shell, **Then** document identity, Add document and application destinations remain reachable; one document has a visible title and multiple documents have an accessible switcher.
2. **Given** an input method or temporary surface, **When** Back commits, **Then** exactly the top eligible layer dismisses before any document close; a cancelled predictive gesture changes no document or draft state.
3. **Given** a phone modal surface, **When** it opens and closes, **Then** it blocks background activation, fits the visible window above keyboard/system obstructions and restores focus; a wide nonmodal inspector remains explicitly nonmodal.
4. **Given** normal or contained-failure state, **When** About/Help is opened, **Then** installed version/build/channel, approved explicit destinations, ShruggieTech attribution, offline notices and report/support access are available without automatic document or diagnostic upload.

### User Story 2 - View practical inert SVG and understand refusal (Priority: P1)

A user opens representative SVG exports and receives either a useful bounded preview or a precise reason with a valid next action while keeping the source and metadata available.

**Why this priority**: Current undifferentiated refusal prevents users from distinguishing unsupported content from recoverable delivery failures.

**Independent Test**: Open documented positive, unsupported, malformed, refused-reference, resource-limit and transient-failure cases through document delivery; compare original bytes and observe the reported outcome.

**Acceptance Scenarios**:

1. **Given** representative generated or licensed SVG inside the documented inert profile, **When** it opens, **Then** the preview renders and the original source is unchanged; fixtures cover accepted presentation styling, namespaces and local reuse supported by the profile.
2. **Given** malformed input, unsupported constructs, external or cyclic references, exceeded resource budgets, source-read denial or host transport failure, **When** opening completes, **Then** stable distinct outcomes explain the cause and keep the shell/source/metadata usable.
3. **Given** a deterministic refusal, **When** the user views the failure, **Then** compatibility/source details or Open elsewhere is offered and an identical Retry is not presented as its remedy; recoverable failures may offer Retry.
4. **Given** any SVG, **When** it is parsed or rendered, **Then** scripts, undeclared external network/file resolution and entity expansion have no effects, and depth/node/pixel/time limits remain enforced.

### User Story 3 - Use image and diagram tools without losing the document (Priority: P1)

A user fits, zooms, pans, plays animation, selects an icon entry or exports a PNG using relevant controls that remain reachable on a phone.

**Why this priority**: These are existing advertised document capabilities whose visible controls and results must agree.

**Independent Test**: Invoke local, menu, keyboard and gesture routes on the same image/diagram; disclose options, rotate, change scale, select frames/entries and read the exported PNG.

**Acceptance Scenarios**:

1. **Given** a rendered document, **When** any exposed Zoom/Fit route runs, **Then** it changes the same intended viewport or reports an actual unavailable/failure result.
2. **Given** image, animated image, ICO or diagram content, **When** tools are disclosed or orientation changes, **Then** document identity, viewport, animation and selected-entry state remain coherent; pan/keyboard alternatives and export act on the correct document.
3. **Given** no usable preview, **When** content is displayed, **Then** the reason and valid next action appear beside the affected content and unusable Zoom/Fit controls are absent or disabled with an explanation.
4. **Given** a narrow portrait, landscape, short window, keyboard obstruction or enlarged text, **When** tools are used, **Then** every visible action is reachable without sideways toolbar hunting, targets remain at least 48dp-equivalent and document content remains dominant.

### User Story 4 - Complete document tools and settings (Priority: P1)

A user edits and searches text, reads or edits Markdown/Mermaid, navigates large text, inspects/copies current metadata and validates settings through truthful accessible controls.

**Why this priority**: A reachable shell is useful only when each current-document control performs its actual task.

**Independent Test**: Exercise each assigned control record and variant on the composed app, comparing exact text, position, focus, clipboard and persisted preference outcomes.

**Acceptance Scenarios**:

1. **Given** editable text and search controls, **When** a query, replacement, history or mode action runs, **Then** the intended text changes once, read-only authority is respected, and query/match/no-match/invalid states are announced.
2. **Given** Markdown/Mermaid or source fallback, **When** mode, links, outline, pan/zoom/Fit or embedded tools are used, **Then** document identity, edits, position and focus remain coherent and errors remain contained.
3. **Given** a large-text document, **When** search, navigation, go-to-line or copy runs, **Then** user-facing labels and actual results preserve or deliberately move the current position.
4. **Given** metadata or Preferences, **When** values change, copy runs or validation fails, **Then** current values, scope, validation and actual completion are exposed; sensitive-value copy confirmation is retained.
5. **Given** the control register, **When** scope is reconciled, **Then** all assigned records/variants have an owner, intended outcome and evidence or justified non-applicable disposition; passive Markdown task boxes stay read-only and unmounted controls are not counted as passing interactive controls.

### User Story 5 - Complete the installed recovery journeys (Priority: P1)

An operator qualifies one identified candidate by completing the ten recovery journeys on the actual installed app, retaining failures and provenance.

**Why this priority**: Complete user tasks establish the result that source tests and callbacks alone cannot establish.

**Independent Test**: Run the full matrix on the supported hosted Android environments, independently reconcile tested package bytes and saved/exported results, and retain per-row geometry/runtime records.

**Acceptance Scenarios**:

1. **Given** the final candidate, **When** cold/warm/in-app delivery, authoring, copy, recovery, SVG/images, Diagnostics, layout, Back and About/support journeys run, **Then** every required row has a source/package/runtime-bound pass with actual observable results.
2. **Given** normal and fault-injection builds, **When** evidence is collected, **Then** each actual installed package is identified separately; a probe build does not establish operation of different ordinary or release bytes.
3. **Given** failure, retry or an unrun required row, **When** results are aggregated, **Then** all attempts and limits remain explicit and incomplete criteria prevent qualification and issue closure.
4. **Given** unavailable original incident data and recorded owner waivers, **When** qualification is reported, **Then** original incident replay, physical-device, manual-screen-reader and reference-hardware checks are not claimed.

### Edge Cases

- Empty launcher, single document, many documents, duplicate source ownership, revoked source, read-only copy, unsaved edits and in-flight native writes.
- Predictive Back cancellation, committed Back with IME, multiple transient layers, rotation/resume during disclosure, focus loss and a contained renderer/root failure.
- SVG declarations/namespaces, internal styles/local reuse, malformed XML, external references, cycles, entity declarations, excessive nesting/nodes/pixels/deadline and transport failure.
- No-preview image state, animation frame changes while tools open, selected ICO entry export, stale command completion after switching documents and repeated activation.
- Search controls generated by the installed editor, invalid queries, no matches, read-only replacement, sensitive metadata, clipboard denial and invalid settings.
- Short physical visible frames, landscape at maximum text scale, keyboard consuming space, light/dark contrast and controls that exist only in a legacy or passive state.

## Requirements

### Functional Requirements

- **FR-001**: The shell MUST retain active-document identity, Add document and application destinations in empty, loaded, error and recovery states, with an accessible multiple-document switcher and a visible single-document title.
- **FR-002**: Compact and wide compositions MUST keep the document dominant and place primary versus secondary tools by current-document relevance without horizontal toolbar hunting.
- **FR-003**: Preferences, Diagnostics, Help and About MUST be reachable application destinations; About MUST expose installed version/build/channel, approved destinations, attribution, offline notices and support/report access.
- **FR-004**: Committed Back MUST dismiss exactly one eligible top input/temporary layer before document navigation; cancelled predictive Back MUST NOT close or discard anything.
- **FR-005**: Phone modal surfaces MUST block background activation, remain usable above keyboard/system obstructions and restore focus; any wide nonmodal inspector MUST preserve deliberate background interaction.
- **FR-006**: Rotation, resume, picker cancellation and tool disclosure MUST preserve document context, drafts and existing source/write authority rules.
- **FR-007**: SVG inside a documented representative inert profile MUST render, including accepted presentation styling, namespaces and supported local fragment reuse, with provenance-bearing minimized fixtures for every newly accepted construct.
- **FR-008**: SVG opening MUST distinguish malformed content, unsupported constructs, refused external references, cyclic references, resource/deadline limits, source-read failures and host-transport failures using stable outcomes.
- **FR-009**: SVG processing MUST preserve original bytes and enforce existing script, external-resolution, entity-expansion and depth/node/pixel/time boundaries.
- **FR-010**: A refusal MUST retain shell, original-source and metadata access and a useful next action; identical Retry MUST NOT be the proposed fix for deterministic refusal.
- **FR-011**: Every exposed local, menu, keyboard and gesture Zoom/Fit route MUST affect one intended viewport or report truthful unavailability/failure. Fit uses measured intrinsic/content bounds; the first pan preserves its effective scale and the first zoom multiplies that scale without jumping to intrinsic size.
- **FR-012**: Relevant Actual size, Reset, background, pan, animation/frame and ICO controls MUST be reachable; Reset view MUST restore pan and zoom to Fit without changing animation/frame/icon selection or background, and state MUST survive disclosure/orientation coherently.
- **FR-013**: Selected ICO PNG export MUST write the correct selected content to the chosen destination, verify actual bytes and retain original-source integrity.
- **FR-014**: No-preview states MUST show the content-area cause and valid next action and prevent misleading viewport-action success.
- **FR-015**: All visible controls MUST fit the actual usable frame in the required window/text/IME profiles, expose meaningful names/roles/states, maintain visible focus and contrast, and meet 48dp-equivalent targets where interactive.
- **FR-016**: Editor, find/replace and history actions MUST operate once on exact intended text and respect source/mode authority while exposing query/match/no-match/invalid states.
- **FR-017**: Markdown/Mermaid Read/Edit, source fallback, links, outline, pan/zoom/Fit and embedded tools MUST preserve document identity, edits, position and focus with contained failures.
- **FR-018**: Large-text navigation, search, go-to-line and copy MUST expose user-facing labels and actual results while retaining coherent position.
- **FR-019**: Metadata and Preferences MUST expose current values, validation, scope and completion; clipboard failure and sensitive-value confirmation MUST remain truthful.
- **FR-020**: One control ledger MUST cover the report's 119 records and 150 named controls/variants, retaining per-issue ownership, built-app status, source owner and evidence or justified non-applicability; overlapping diagram rows MUST be cross-referenced rather than counted twice.
- **FR-021**: Passive task checkboxes MUST remain read-only and legacy/unmounted controls MUST be recorded explicitly without being counted as passing interactive controls.
- **FR-022**: The full ten-journey recovery matrix MUST pass on the actual composed installed candidate with source commit, tested package hash/identity, Android/API/WebView identity, viewport, text scale and retained logs/screenshots per row.
- **FR-023**: Hosted API24/API36 journeys MUST include the applicable narrow portrait, landscape, short-window, keyboard, default/maximum text and Android14+ 200-percent text profiles, alongside affected shared/desktop/native regressions. Local checks MUST remain headless; GUI/keyboard acceptance MUST use explicitly isolated hosted CI sessions.
- **FR-024**: Saved text, exported image and frozen redacted Diagnostics Save/Share MUST be verified through actual destination/receiver readback; callback success alone MUST NOT establish completion.
- **FR-025**: Ordinary-candidate and fault-probe package evidence MUST remain separate, with every failed attempt, retry and unrun row retained; incomplete required rows MUST block #254 and affected issue closure.
- **FR-026**: S046 authoring, source ownership, pending-write guards, draft/root recovery and truthful async-action behavior MUST remain intact throughout these changes.
- **FR-027**: Core tasks MUST remain local/offline; support/link actions MUST be explicit and MUST NOT automatically upload document or diagnostic content.
- **FR-028**: Qualification MUST retain the recorded physical-device/manual-screen-reader/reference-hardware waivers and unavailable original incident bytes/hash/trace literally, without claiming different release bytes were exercised.

### Key Entities

- **Document task context**: Active document identity, capabilities, mode, viewport/selection/position and retained source/draft authority.
- **Temporary surface**: Kind, modal/nonmodal behavior, invoking focus, visibility and ordering relative to keyboard and document navigation.
- **SVG outcome/profile**: Documented accepted constructs, bounded input/render facts, stable refusal/failure reason and valid next actions.
- **Control record**: Report ID and variants, owner, intended behavior, current built-app status, evidence references and explicit passive/non-applicable disposition.
- **Candidate journey receipt**: Source/package/runtime identity, window/text profile, actual task results, byte/receiver readback and all attempts.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 119 control records and 150 named controls/variants have traceable dispositions; every required interactive variant has a task result and passive/unmounted rows are distinguished explicitly.
- **SC-002**: Every visible control in the required composed-app profiles remains reachable inside the usable frame with the specified target, focus, semantics and contrast criteria; no primary task requires sideways toolbar hunting.
- **SC-003**: All ten recovery journeys and their required variants pass on each applicable supported hosted Android environment, with no required failed/unrun row hidden by the aggregate.
- **SC-004**: The representative SVG corpus renders within its documented profile, and every malformed/unsupported/reference/resource/read/transport category receives the corresponding stable outcome while original bytes remain unchanged.
- **SC-005**: Every exposed image/diagram Zoom/Fit route changes the intended viewport; animation/frame/ICO actions and selected PNG export operate on the identified document with independently observed results.
- **SC-006**: Text saves/reopens, image exports and frozen Diagnostics Save/Share match expected bytes or receiver content exactly; cancellation/failure/pending-write cases preserve their documented source/draft state.
- **SC-007**: About/Help stays reachable in normal and contained-failure states, and every displayed package/build fact, explicit destination and offline notice is verified.
- **SC-008**: Every acceptance criterion of #249/#250/#251/#253/#254 maps to retained passing evidence before closure; issue/project/review state and final source/package identities reconcile at the owner handoff.

## Assumptions

- S046 is merged at 603df36 and supplies shared actions, native authoring/recovery and viewport measurement foundations; current main and pins are rechecked at kickoff.
- Current pinned brand vocabulary and AppFrame ownership govern composition. A demonstrated recipe defect requires authoritative correction and formal repinning, with no permanent generated-consumer fork.
- The report's unavailable incident inputs remain unavailable; representative fixtures and current source evidence establish new results independently.
- Existing resource, retry, gesture, security, privacy, license and owner-waiver contracts remain in force.
- #255 and parent #244 remain open for separate v0.2.1 release reconciliation/publication. #66/#239 and future format milestones remain separate. No merge, tag, release publication or deployment is authorized by this slice.
