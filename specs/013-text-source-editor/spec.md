# Feature Specification: Text and Source Editor

**Feature Branch**: `codex/013-text-source-editor`

**Created**: 2026-09-02

**Status**: Ready for planning

**Input**: User description: "The next work slice code is S013. Specify and deliver text viewing, editing, syntax detection, highlighting, round-trip preservation, and large-file behavior end-to-end under the autopilot protocol."

**Issue Traceability**: GitHub Issue #52

## Clarifications

### Session 2026-09-02

- Q: Which source representation remains authoritative while a document is edited? A: The exact decoded text plus its original encoding, byte-order-mark, per-line newline, terminal-newline, and undecodable-byte decisions remain authoritative until the user explicitly changes one of those decisions.
- Q: How are large sources handled? A: Sources through 32 MiB are fully editable; sources above 32 MiB through 256 MiB are virtualized, read-only, searchable plain text; larger sources are refused with stable guidance.
- Q: What product boundary governs editor commands and language support? A: Commands remain document-local and languages provide highlighting only; execution, workspace, repository, language-server, package, terminal, debugging, and AI features remain excluded.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View and edit text without changing unedited bytes (Priority: P1)

A user can open a supported text or source file, edit its content, undo or redo changes, and save it without Glitchpad silently normalizing its encoding, byte-order mark, mixed newline structure, terminal newline, whitespace, or undecodable-byte decision.

**Why this priority**: Exact, conflict-safe round trips are the core value and safety guarantee of an editor.

**Independent Test**: Open representative UTF-8, UTF-16, legacy-encoded, mixed-newline, terminal-newline, whitespace-sensitive, and invalid-byte fixtures, edit bounded regions, save or Save As, and verify that only explicitly edited content and explicitly changed text-profile decisions differ.

**Acceptance Scenarios**:

1. **Given** a round-trip-safe text source no larger than 32 MiB, **When** it opens, **Then** its content is editable and its original encoding, byte-order-mark, newline, terminal-newline, and language evidence are visible without consuming the primary viewport.
2. **Given** an edited document with a current source revision, **When** the user saves, **Then** the existing conflict-safe save lifecycle writes the exact current revision and preserves every unedited round-trip property.
3. **Given** an edited document, **When** the user invokes undo or redo, **Then** content, selection, dirty state, recovery scheduling, and save authority correspond to the resulting current revision.
4. **Given** content that cannot be saved losslessly under the current text-profile decision, **When** ordinary save is requested, **Then** no write begins and the user must choose a safe encoding or explicitly authorize the identified lossy decision.
5. **Given** a recovered editable buffer whose original source is unavailable or changed, **When** it opens in the editor, **Then** editing and Save As remain available while unsafe in-place save remains unavailable.

---

### User Story 2 - Navigate and transform one document efficiently (Priority: P1)

A user can work inside the active document with line numbers, find, replace, go-to-line, wrapping, indentation, bracket handling, copy, and multiple selections through keyboard, pointer, and touch-accessible commands.

**Why this priority**: These document-local operations make the editor practically useful without expanding into IDE or workspace behavior.

**Independent Test**: Exercise every command through its discoverable interface and supported shortcut against a normal source, including empty matches, Unicode text, long lines, read-only state, repeated edits, and accessibility checks.

**Acceptance Scenarios**:

1. **Given** an editable active document, **When** the user finds or replaces text, **Then** matches are deterministic, replacement changes participate in undo, dirty state, and recovery, and no inactive document is changed.
2. **Given** a valid line number, **When** the user navigates to it, **Then** the requested line is revealed and focused; invalid or out-of-range input is rejected without moving or changing content.
3. **Given** selected text or multiple selections, **When** the user indents, outdents, copies, edits, undoes, or redoes, **Then** all operations remain bounded to the active document and preserve a coherent selection state.
4. **Given** a read-only document, **When** edit, replace, indentation, undo, or redo is requested, **Then** content does not change and the unavailable operation is communicated accessibly.
5. **Given** keyboard, pointer, touch, or screen-reader interaction, **When** the user operates editor controls, **Then** essential actions have equivalent discoverable paths and focus is never trapped or lost.

---

### User Story 3 - Use safe, evidence-based syntax highlighting (Priority: P1)

A user opening recognized source text receives bounded syntax highlighting based on filename, extension, shebang, modeline, and content evidence, while unknown or risky input remains usable as plain text.

**Why this priority**: Highlighting improves source readability, but it must never delay or endanger access to the underlying text.

**Independent Test**: Open known, ambiguous, contradictory, unknown, malformed, extensionless, shebang, modeline, and extreme-line fixtures, then verify the selected language, evidence, override behavior, lazy activation, and plain-text fallback.

**Acceptance Scenarios**:

1. **Given** bounded consistent language evidence, **When** a source opens, **Then** the detected language is reported and highlighting becomes available without changing source text.
2. **Given** contradictory or insufficient evidence, **When** a source opens, **Then** Glitchpad records the conflict or uncertainty and safely selects plain text or the highest-confidence non-executing language mode.
3. **Given** a user language override, **When** it is selected, **Then** it affects only that session unless a separate preference action is explicitly requested, and returning to automatic detection restores evidence-based selection.
4. **Given** an unknown language, unavailable language definition, highlighting failure, or cancellation, **When** the editor remains open, **Then** viewing and editing continue in plain-text mode with a stable non-destructive status.
5. **Given** a line longer than 2 MiB, **When** the source opens, **Then** syntax parsing is disabled for that document while plain-text viewing or editing remains available within the document-size limit.

---

### User Story 4 - Read very large text safely (Priority: P2)

A user can inspect and search a source larger than the editing budget without the application freezing, allocating an unsafe decoded representation, or implying that edits can be saved.

**Why this priority**: Large files are common diagnostic inputs and require an explicit degraded mode rather than unstable best-effort editing.

**Independent Test**: Open sources immediately below, at, and above the 32 MiB and 256 MiB boundaries, with short and extreme lines, then verify mode selection, chunked navigation and search, copy, cancellation, memory limits, and refusal behavior.

**Acceptance Scenarios**:

1. **Given** a text source larger than 32 MiB and no larger than 256 MiB, **When** it opens, **Then** Glitchpad presents virtualized read-only plain text with search, copy, line navigation, size status, and no highlighting or save capability.
2. **Given** a large-text search or navigation request, **When** it is superseded, cancelled, hidden, or the tab closes, **Then** new work stops within the cancellation budget and stale results never replace current state.
3. **Given** a text source larger than 256 MiB, **When** opening is attempted, **Then** Glitchpad refuses it deterministically with its size limit and alternative-tool guidance while the shell remains responsive.
4. **Given** a source whose size is unknown or changes during bounded reading, **When** a limit is crossed, **Then** Glitchpad stops further work, retains no partial editable authority, and reports the correct degraded or refused outcome.

### Edge Cases

- Empty files, files containing only a byte-order mark, and files with no terminal newline remain editable and round-trip safely.
- Mixed CRLF, LF, and CR newlines are preserved per line; insertion uses the documented session default without normalizing existing lines.
- Combining characters, bidirectional text, emoji, tabs, non-breaking spaces, and zero-width characters remain selectable, searchable, copyable, and saveable without corruption.
- Find and replace handle zero-width matches, overlapping-looking Unicode sequences, case sensitivity, wraparound, and replacement text containing special characters without infinite loops.
- Language evidence can conflict with the filename or change after editing a shebang or modeline; automatic re-evaluation cannot rewrite content or silently override an explicit session choice.
- Loading or highlighting can fail after first content; the editor retains plain text, selection, undo history, dirty state, and recovery coverage.
- A source can change, disappear, lose permission, or become conflicted during editing; S012 save, close, and recovery safeguards continue to govern every transition.
- A large-source chunk can split a multibyte character or newline sequence; displayed text, search positions, copy ranges, and line numbers remain correct across chunk boundaries.
- A source can report a false or missing size; actual bounded reads enforce the same thresholds independently of metadata.
- Background tabs suspend regenerable syntax and large-view caches without losing authoritative text or dirty state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Glitchpad MUST provide full text editing for supported text sources through 32 MiB, subject to the single-line safety limit.
- **FR-002**: The editor MUST preserve source encoding, byte-order-mark intent, per-line newline structure, terminal-newline state, whitespace, and undecodable-byte decisions, and MUST change them only through explicit edits or explicit profile decisions.
- **FR-003**: Ordinary save MUST be denied when the current content cannot round-trip under the active text profile; any lossy save authorization MUST identify the affected decision and apply only to the exact current session revision.
- **FR-004**: Every content-changing transaction MUST advance the shared editable revision and participate in dirty state, recovery, conflict handling, save preconditions, and durable-receipt handling from S012.
- **FR-005**: The editor MUST provide line numbers, undo, redo, find, replace, go-to-line, selectable wrapping, indentation and outdent commands, bracket handling, copy, and multiple selections for editable documents.
- **FR-006**: Document commands MUST act only on the active session, advertise availability from actual renderer and state capabilities, expose discoverable platform-appropriate shortcuts, and provide equivalent essential keyboard, pointer, and touch paths.
- **FR-007**: Find, replace, line navigation, and selection behavior MUST support Unicode content and MUST remain deterministic for empty, zero-width, invalid, wrapped, and out-of-range inputs.
- **FR-008**: The editor MUST expose compact encoding, byte-order-mark, newline, terminal-newline, language, round-trip-safety, size, and editable/read-only status without materially reducing the document viewport.
- **FR-009**: Language detection MUST evaluate exact filename, extension, shebang, modeline, and bounded content evidence, preserve confidence and conflicts, and treat unknown text as plain text.
- **FR-010**: Language support MUST load only for the selected language, MUST provide highlighting without execution authority, and MUST fall back to usable plain text on unavailable definitions, errors, timeouts, or cancellation.
- **FR-011**: A language override MUST be explicit, session-scoped by default, reversible to automatic detection, and incapable of changing source text or save encoding.
- **FR-012**: A source containing any line longer than 2 MiB MUST disable syntax parsing for that document while remaining usable in plain-text mode within the applicable size boundary.
- **FR-013**: Text sources larger than 32 MiB and no larger than 256 MiB MUST open in virtualized read-only plain-text mode with search, copy, line navigation, progress, and cancellation, and MUST expose no edit, replace, highlighting, recovery, save, or Save As capability.
- **FR-014**: Text sources larger than 256 MiB MUST be refused before unbounded decoding or interface publication, with a stable size result and actionable alternative-tool guidance.
- **FR-015**: Unknown, missing, false, or changing source sizes MUST be enforced through bounded reads so that crossing a threshold deterministically selects editable, large read-only, or refused behavior without publishing partial editable authority.
- **FR-016**: Editor input-to-paint MUST meet a 50 ms p95 target with no repeated 100 ms stalls, and first content for a representative 1 MiB UTF-8 source MUST meet a 300 ms p95 target in release evidence.
- **FR-017**: Main-thread editor work SHOULD remain below 16 ms and MUST NOT repeatedly exceed 50 ms; cancellation MUST stop new syntax, search, and large-view work within 250 ms.
- **FR-018**: Background or suspended tabs MUST release regenerable syntax, viewport, search, and large-view caches while preserving authoritative content, text profile, revision, dirty state, selection intent, and recovery coverage.
- **FR-019**: The editor MUST remain local-only and MUST NOT make network requests, expose arbitrary native authority, execute document content, or disclose content through logs, diagnostics, or errors.
- **FR-020**: S013 MUST NOT implement language servers, compilers, build commands, debugging, terminals, project or repository operations, project search or symbols, package management, AI completion, IDE refactoring, persistent language preferences, or format conversion.
- **FR-021**: Shared renderer contracts and automated conformance evidence MUST cover first content, capabilities, cancellation, malformed and oversized input, suspension, repeated open and close, disposal, undo and redo, dirty state, round-trip preservation, conflict, save, Save As, recovery, lossy-save denial, language evidence, and large-text thresholds.
- **FR-022**: Fixtures and evidence MUST cover supported encodings, byte-order marks, mixed newlines, terminal-newline states, invalid bytes, language evidence sources and conflicts, Unicode interaction, extreme lines, size boundaries, stale asynchronous results, and read-only command denial with compatible provenance.

### Key Entities

- **Text document**: Authoritative decoded content plus its source identity, editable revision, text profile, language decision, capabilities, and lifecycle state.
- **Text profile**: Encoding, byte-order-mark intent, per-line newline structure, insertion newline default, terminal-newline state, round-trip safety, and undecodable-byte decision.
- **Language decision**: Selected language or plain text, confidence, bounded evidence, conflicts, explicit session override, loading state, and safe fallback reason.
- **Editor transaction**: One content or selection operation with before and after revisions, undo grouping, dirty-state effect, and recovery impact.
- **Search session**: Active query, options, matches or progress, current selection, replacement authority, cancellation, and document revision.
- **Large-text view**: Read-only bounded source reader with virtual line/chunk index, visible window, search progress, copy range, cancellation, and size-limit outcome.
- **Editor status**: Compact user-visible encoding, newline, language, size, safety, mode, progress, and error facts.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Across the complete encoding, byte-order-mark, newline, terminal-newline, whitespace, and invalid-byte fixture matrix, unedited files save byte-for-byte identically and edited files differ only at explicitly edited text or explicitly changed profile decisions.
- **SC-002**: Across 1,000 generated edit, undo, redo, multi-selection, replace, save, conflict, recovery, and stale-receipt sequences, the published content, editable revision, dirty state, and durable save state remain mutually consistent with zero silent content loss.
- **SC-003**: Every required editor command has a passing editable path, read-only denial path, unavailable-state path, keyboard path, and touch- or pointer-accessible discoverable path.
- **SC-004**: Language fixture results are deterministic across filename, extension, shebang, modeline, content, conflicting, unknown, unavailable-definition, extreme-line, and explicit-override cases, with zero source mutation caused by detection or highlighting.
- **SC-005**: Representative 1 MiB UTF-8 text reaches first content within 300 ms p95, editor input reaches paint within 50 ms p95 with no repeated 100 ms stalls, and cancellation stops new work within 250 ms p95 in documented release-profile evidence.
- **SC-006**: Boundary fixtures at 32 MiB and 256 MiB select the documented mode exactly; over-limit, false-size, unknown-size, and changing-size fixtures perform no unbounded decode and publish no partial editable document.
- **SC-007**: Large-text viewing and search stay within the documented decoded-memory budget, return correct line, match, and copy results across chunk and multibyte boundaries, and never expose editing or save capabilities.
- **SC-008**: Automated accessibility checks and documented keyboard, pointer, touch, high-zoom, long-name, bidirectional-text, combining-character, and screen-reader critical-flow checks report no blocker.
- **SC-009**: Network and authority instrumentation records zero document-triggered network requests, content execution, unrestricted native calls, or sensitive content in logs, diagnostics, and surfaced errors.
- **SC-010**: Focused Rust and interface tests plus full formatting, lint, documentation, dependency-license, secret, encoding, security, Android build, and aggregate repository gates complete successfully before publication.

## Assumptions

- Issues #48, #49, #50, and #51 provide format detection, text profiling, session ownership, commands, source capabilities, safe save, conflict, recovery, and lifecycle foundations that S013 extends rather than replaces.
- The issue-authoritative editor and language dependency family is acceptable only when each distributed package has Apache-2.0-compatible provenance and is loaded on demand for a selected language.
- Existing text detection is the authority for encoding and initial language evidence; the editor may refine language evidence within documented bounds but does not invent a second format-detection system.
- Mixed-newline preservation is exact for existing line separators. Newly inserted line breaks use the session's documented insertion newline default until the user explicitly chooses normalization in a future preference-capable slice.
- Invalid-byte content is viewable with its replacement decision recorded, but ordinary save remains disabled until the user chooses a round-trip-safe encoding or explicitly authorizes the exact lossy decision.
- Large-text mode is a source-backed read-only view rather than a complete decoded in-memory editor, and it may build bounded indexes incrementally.
- Persistent extension-to-language preferences are deferred to Issue #59; S013 language overrides are session-scoped.
- S013 records an unreleased specification delta and changelog fragment but does not change product version or stable capability declarations.
