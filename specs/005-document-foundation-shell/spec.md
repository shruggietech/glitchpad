# Feature Specification: Document Foundation and Content Shell

**Feature Branch**: `005-document-foundation-shell`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "Use Spec Kit to specify and implement work slice S005 as one bundled slice covering GitHub issues #45, #48, #49, and #51: platform-independent document contracts, bounded format and text detection, the content-first compact-tab shell, and renderer-driven accessible commands."

## User Scenarios & Testing

### User Story 1 - Receive a safe document session (Priority: P1)

A user delivers a candidate document to Glitchpad and receives one stable session whose identity, format decision, available actions, and failure state are explicit rather than inferred from an extension alone.

**Why this priority**: Every viewer, editor, tab, save flow, and platform adapter depends on one trustworthy source-independent document model.

**Independent Test**: Supply bounded in-memory sources with matching, misleading, missing, and conflicting names and media claims, then verify that each produces the expected format decision, text profile, capabilities, identity behavior, and stable error result without native filesystem access.

**Acceptance Scenarios**:

1. **Given** a supported text source with consistent content evidence, **When** the source is delivered, **Then** Glitchpad creates a document session with a format decision, text profile, renderer capabilities, and no undeclared native authority.
2. **Given** two deliveries with the same strong document identity, **When** the second is delivered, **Then** Glitchpad focuses the existing session instead of creating a duplicate.
3. **Given** two deliveries whose identities are uncertain or incomparable, **When** both are delivered, **Then** Glitchpad keeps separate sessions and does not guess that they are the same document.
4. **Given** a malformed, unsupported, ambiguous, oversized, inaccessible, encrypted, binary, or revoked source, **When** it is evaluated, **Then** Glitchpad returns a stable bounded result without crashing, fabricating capabilities, or losing safe basic facts.

---

### User Story 2 - Work across compact document tabs (Priority: P1)

A user keeps several documents available in one window, identifies dirty documents, changes the active document quickly, reorders tabs, closes tabs, and reaches overflowed tabs without the application becoming a workspace or crowding the document.

**Why this priority**: Compact multi-document access is the primary usability improvement in this slice and establishes the shell used by every later renderer.

**Independent Test**: Seed the shell with several document sessions, including duplicate identity attempts, long names, dirty states, and enough tabs to overflow, then complete every tab action with keyboard, pointer, touch-sized controls, and accessibility queries.

**Acceptance Scenarios**:

1. **Given** several open sessions, **When** the user selects a tab, **Then** that document becomes active while every other session retains its own state.
2. **Given** an active tab, **When** the user moves it, closes it, or switches to the next or previous tab, **Then** tab order, focus, active-session selection, and dirty-state communication remain correct.
3. **Given** more tabs than the strip can show, **When** overflow occurs, **Then** every session remains reachable through a bounded compact control without adding permanent navigation.
4. **Given** contextual controls are closed at the 1280 by 800 reference viewport, **When** the shell is measured, **Then** the active document receives at least 90 percent of the application client area.

---

### User Story 3 - See only relevant document commands (Priority: P2)

A user sees compact, discoverable commands derived from the active renderer and source capabilities, so unavailable actions do not create visual noise or misleading promises.

**Why this priority**: Capability-driven commands prevent the shell from hard-coding format assumptions and keep the interface minimal as future renderers arrive.

**Independent Test**: Activate sessions with distinct read-only, editable, searchable, navigable, inspectable, and zoomable capability sets, then verify the visible command set, labels, shortcuts, focus behavior, and touch alternatives for each state.

**Acceptance Scenarios**:

1. **Given** an active session whose renderer advertises a capability, **When** the command surface is shown, **Then** the matching command is available with a discoverable label and platform-appropriate interaction.
2. **Given** an active session whose renderer does not advertise a capability, **When** the command surface is shown, **Then** the unsupported renderer command is absent rather than displayed as permanent disabled clutter.
3. **Given** the active session changes, **When** its capability set differs, **Then** the command surface updates from the new session and stale commands cannot act on the prior session.
4. **Given** keyboard-only, pointer-only, touch-only, or screen-reader operation, **When** the user navigates tabs and commands, **Then** every essential action remains operable, named, focused in logical order, and free of keyboard traps.

---

### User Story 4 - Preserve source representation decisions (Priority: P2)

A later editable renderer can rely on the foundation to retain the source encoding, byte-order-mark intent, newline pattern, terminal newline, and undecodable-byte decision selected during detection.

**Why this priority**: The slice does not implement saving, but a lossy foundation would make safe editing and persistence impossible in subsequent slices.

**Independent Test**: Evaluate the text-profile corpus, carry each accepted representation through a no-change round trip in the core model, and verify that every representation fact and undecodable-byte decision remains unchanged.

**Acceptance Scenarios**:

1. **Given** UTF-8 or supported UTF-16 text with a byte-order mark, **When** the source is profiled, **Then** encoding and byte-order-mark intent are recorded separately and accurately.
2. **Given** LF, CRLF, CR, mixed, or absent line endings, **When** the source is profiled, **Then** the observed newline pattern and terminal-newline state are explicit.
3. **Given** invalid or undecodable byte sequences, **When** text eligibility is decided, **Then** the decision is explicit, non-destructive, and available to later editing and save flows.

### Edge Cases

- A source name is empty, extremely long, contains control characters, or differs only by case under a host whose identity comparison rules are unknown.
- Extension, claimed media type, signature evidence, and text evidence disagree.
- The source is empty, contains only a byte-order mark, contains NUL bytes, starts with a shebang, or resembles both plain text and a supported structured text format.
- A detection request is cancelled, reaches its evidence budget, or observes a source revision change before completion.
- A duplicate-open request arrives while the matching session is opening, closing, suspended, or already active.
- The active tab is closed when it is the only tab, the first tab, the last tab, or one of many overflowed tabs.
- A tab is removed or reordered while it or its overflow entry owns focus.
- Capability changes arrive while a user has a command focused or while an earlier command is pending.
- Text, browser, operating-system, or assistive-technology zoom changes the available tab-strip width.
- Reduced motion, high contrast, 200 percent zoom, narrow Android width, and touch input are active simultaneously.

## Requirements

### Functional Requirements

- **FR-001**: The foundation MUST represent a document identity as strong, weak, or unavailable evidence and MUST compare identities only when their authority and comparison rules permit it.
- **FR-002**: Delivering a source whose strong identity equals an existing live session MUST focus that session, while uncertain, weakly comparable, or unavailable identities MUST remain separate.
- **FR-003**: A document source MUST advertise each available operation independently, including reading, seeking, streaming, metadata, revision observation, revalidation, and writing-related capabilities, and the foundation MUST NOT fabricate an unavailable operation.
- **FR-004**: A document session MUST own exactly one source reference, format decision, renderer descriptor, active capability set, dirty state, lifecycle state, navigation projection, and stable error state.
- **FR-005**: Session lifecycle MUST distinguish opening, ready, active, background, closing, closed, and failed outcomes with only documented transitions.
- **FR-006**: Renderer descriptors MUST advertise operations independently, and shell commands MUST derive from the active renderer and source capabilities rather than file extensions or format-specific branches.
- **FR-007**: Every core error MUST have a stable category, safe user-facing summary, retryability and recoverability facts, and bounded diagnostic context that excludes source contents and undeclared native details.
- **FR-008**: Format detection MUST combine bounded name, extension, claimed media type, signature, structured-text, and general text evidence without treating any one external claim as sole authority.
- **FR-009**: Detection MUST produce explicit supported, ambiguous, unsupported, encrypted, malformed, oversized, inaccessible, binary, cancelled, and source-revised outcomes where applicable.
- **FR-010**: Detection MUST recognize eligible Markdown, standalone Mermaid, plain text, and supported source-language candidates while preserving an explicit confidence and evidence record.
- **FR-011**: Text profiling MUST record accepted encoding, byte-order-mark intent, newline pattern, terminal-newline state, and undecodable-byte decision without normalizing source bytes.
- **FR-012**: Detection and text profiling MUST enforce fixed evidence, time, and memory budgets, support cancellation, and avoid reading an entire oversized source solely to choose a format.
- **FR-013**: Unsupported binary sources MUST retain safe basic identity, size, name, claimed-type, and detection facts when those facts are available.
- **FR-014**: The shell MUST present all live sessions as compact tabs that communicate document name, active state, and dirty state without using color as the only indicator.
- **FR-015**: Users MUST be able to activate, reorder, close, move to the next tab, move to the previous tab, and reach every overflowed tab through keyboard, pointer, and platform-appropriate touch interaction.
- **FR-016**: Closing or reordering a tab MUST move focus predictably to a remaining logical target and MUST NOT leave focus on removed or hidden content.
- **FR-017**: Each background session MUST retain its independent model and navigation projection while allowing later renderers to suspend regenerable resources.
- **FR-018**: At the 1280 by 800 desktop reference viewport with contextual surfaces closed, the active document surface MUST occupy at least 90 percent of the application client area.
- **FR-019**: The shell MUST provide bounded overflow instead of a workspace, project tree, dashboard, permanent navigator, or oversized toolbar.
- **FR-020**: The visible command set MUST update atomically with the active session and MUST prevent a stale command from targeting a previously active session.
- **FR-021**: Supported commands MUST expose concise names and discoverable shortcuts where applicable, yield to platform-reserved behavior, and provide a touch alternative for every essential action.
- **FR-022**: Tabs and commands MUST use semantic controls, expose programmatic names, roles, selected/expanded/dirty states, maintain a logical focus order, retain visible focus, avoid keyboard traps, and remain usable at 200 percent zoom.
- **FR-023**: Essential touch targets MUST meet a 44 by 44 CSS-pixel target area or provide an equivalently sized encompassing activation area without forcing desktop tabs to become visually oversized.
- **FR-024**: Dynamic tab, active-document, overflow, and command changes MUST be announced only when necessary for understanding and MUST avoid repetitive or disruptive live-region output.
- **FR-025**: Core contracts and test fixtures MUST remain platform-independent and MUST NOT depend on native host, WebView, UI framework, shell, network, account, telemetry, workspace, or cloud behavior.
- **FR-026**: This slice MUST NOT implement desktop or Android source adapters, persistence writes, crash recovery, text editing, Markdown rendering, Mermaid rendering, metadata extraction, packaging, file associations, or release activation beyond the contracts required for those later capabilities.
- **FR-027**: Every implemented behavior MUST trace to GitHub issues #45, #48, #49, or #51 and to at least one automated test or explicit accessibility measurement.

### Key Entities

- **Document Identity**: Comparable evidence used to decide whether two deliveries represent the same source, including its authority, strength, normalized token, and comparison scope.
- **Document Source Descriptor**: An opaque source reference plus independently advertised operations and safe host facts; it does not imply a filesystem path.
- **Detection Evidence**: One bounded observation about a candidate source, with evidence kind, value category, weight, provenance, and limits.
- **Format Decision**: The selected format or stable non-selection outcome plus confidence, contributing evidence, alternatives, and the source revision evaluated.
- **Text Profile**: Encoding, byte-order-mark intent, newline pattern, terminal-newline state, binary indicators, and undecodable-byte decision.
- **Renderer Descriptor**: A source-independent renderer identity with its supported document kinds and advertised operations.
- **Document Session**: Runtime ownership for one delivered source and its identity, format decision, renderer, capabilities, lifecycle, active/dirty state, and navigation projection.
- **Tab Collection**: Ordered live-session references, active-session identity, focused tab, visible range, and overflow projection.
- **Command Descriptor**: A stable command identity, concise label, optional shortcut, required capabilities, interaction category, and current target session.
- **Core Error**: A stable safe failure category with retryability, recoverability, user summary, and bounded diagnostic facts.

## Success Criteria

### Measurable Outcomes

- **SC-001**: One hundred percent of the detection fixture corpus produces the expected format outcome, evidence classification, and text representation facts without reading beyond the declared evidence budget.
- **SC-002**: One hundred consecutive deliveries of an already-open strong identity create zero duplicate live sessions, while uncertain-identity fixtures create zero accidental merges.
- **SC-003**: Every documented session and tab transition is covered by an automated state-transition test, and zero undocumented transitions are accepted.
- **SC-004**: With at least 100 open test sessions, every session remains reachable, reorderable, activatable, and closable through the tab strip or overflow projection without creating a workspace surface.
- **SC-005**: At the 1280 by 800 reference viewport, automated geometry measurement confirms that the active document receives at least 90 percent of the client area when contextual surfaces are closed.
- **SC-006**: For every capability-set fixture, the visible command set contains all and only the expected renderer-driven commands, and 100 rapid active-session changes produce zero stale command targets.
- **SC-007**: Automated accessibility checks report zero critical or serious findings for the shell, tabs, overflow, and command surfaces, and keyboard-only testing completes every essential action without a trap.
- **SC-008**: At 200 percent zoom and the narrow reference mobile width, every session and essential command remains reachable with no two-dimensional page scrolling and no clipped focused control.
- **SC-009**: All accepted text-profile fixtures preserve encoding, byte-order-mark intent, newline structure, terminal newline, and undecodable-byte decision exactly through an unchanged core-model round trip.
- **SC-010**: Malformed, unsupported, ambiguous, oversized, inaccessible, encrypted, binary, cancelled, and source-revised fixtures produce stable safe results with zero crashes, source-content diagnostics, implicit network requests, or native invocations.
- **SC-011**: Core contract, detection, session, shell, command, and accessibility tests pass on the shared CI environments without platform-specific business-rule forks.
- **SC-012**: The completed slice passes repository formatting, lint, type, unit, contract, documentation, dependency, encoding, and public-surface gates with no unsupported capability claim added to release-facing documentation.

## Assumptions

- Native desktop and Android adapters will deliver opaque source descriptors through later slices; S005 uses in-memory and fixture descriptors to prove the shared contracts.
- Actual text editing, saving, conflict resolution, recovery, metadata extraction, format rendering, and package integration remain owned by their existing roadmap issues.
- The existing product version remains 0.0.0 because S005 is unreleased implementation work and does not activate a stable public capability.
- Command labels are written in English in this slice while command identities and presentation contracts remain localization-ready.
- Automatic activation is used for tab selection because shell content is lightweight in this slice; later expensive renderers may introduce an explicitly specified manual-activation mode if measured latency requires it.
- Closing the final tab returns to a minimal empty document surface rather than closing the application window.
