# Feature Specification: Local Markdown Viewing and Editing

**Feature Branch**: `codex/014-markdown-view-edit`

**Created**: 2026-09-02

**Status**: Complete

**Input**: User description: "S014 implements issue #53 as the next coherent work slice: local CommonMark and GitHub Flavored Markdown viewing and editing through a secure, bounded, source-preserving document workflow."

## User Scenarios & Testing

### User Story 1 - Read Markdown Safely (Priority: P1)

A user opens a Markdown document and reads locally rendered headings, paragraphs, lists, links, quotations, code, tables, task lists, strikethrough, and footnotes without the document gaining script, network, or native authority.

**Why this priority**: Safe readable output is the minimum useful Markdown capability and establishes the renderer's trust boundary.

**Independent Test**: Open representative and hostile Markdown fixtures, verify supported structures are readable, and verify raw HTML, active URLs, remote resources, and malformed input cannot execute or make requests.

**Acceptance Scenarios**:

1. **Given** a supported Markdown document of at most 16 MiB, **When** it opens, **Then** rendered view is selected and supported CommonMark, GFM, and footnote structures appear in document order.
2. **Given** Markdown containing raw HTML, scripts, event handlers, unsafe URL schemes, embedded frames, or remote media, **When** it renders, **Then** the active content remains inert or is omitted and no network or native operation occurs.
3. **Given** malformed but decodable Markdown, **When** it renders, **Then** the readable portion remains available and the source is preserved without a host crash.

---

### User Story 2 - Edit the Source Without Rewrites (Priority: P1)

A user switches between rendered and source modes, edits through the shared text editor, and returns to a preview derived from the newest revision while the authored source remains the only save authority.

**Why this priority**: Markdown editing must retain the exact source lifecycle already established for text instead of introducing a lossy document serializer.

**Independent Test**: Toggle a writable Markdown document into source mode, make an edit, wait for preview refresh, toggle back, and verify only the explicit edit changes the saved byte projection.

**Acceptance Scenarios**:

1. **Given** a writable Markdown document, **When** the user selects source mode, **Then** the shared editor exposes undo, redo, search, replace, go-to-line, wrapping, indentation, bracket handling, copy, dirty state, recovery, Save, and Save As according to existing capabilities.
2. **Given** several edits within the preview debounce interval, **When** parsing finishes out of order, **Then** only the result for the newest source revision becomes visible.
3. **Given** mixed newlines, a supported byte-order mark, terminal-newline state, comments, or deliberate whitespace, **When** the user edits unrelated text and saves, **Then** untouched source representation remains unchanged.
4. **Given** a 16-32 MiB Markdown document, **When** it opens, **Then** source editing remains available but live rendered preview is disabled with a clear explanation.

---

### User Story 3 - Search and Navigate Rendered Content (Priority: P2)

A user searches rendered text, follows an outline of headings, reaches the matching source location, and prints readable Markdown without leaving the document context.

**Why this priority**: Navigation makes long documents useful while remaining subordinate to safe rendering and exact source editing.

**Independent Test**: Open a document with duplicate headings, Unicode text, hidden markup, links, and footnotes; search and navigate it in both modes, then verify the printable surface contains readable content rather than application chrome.

**Acceptance Scenarios**:

1. **Given** rendered Markdown, **When** the user searches, **Then** matches are found in visible rendered text in deterministic document order and the active match is brought into view.
2. **Given** repeated or Unicode headings, **When** the user opens the outline and selects one, **Then** focus moves to the exact heading with a stable, collision-free identifier.
3. **Given** a rendered selection or heading, **When** the user switches to source mode, **Then** the editor moves to the corresponding source range when an exact range is available.
4. **Given** a print request, **When** print presentation is produced, **Then** tabs, command bars, diagnostics, and mode controls are excluded while document content and safe link destinations remain legible.

---

### User Story 4 - Operate Links and Resources Deliberately (Priority: P2)

A user can inspect an external destination before explicitly opening a permitted web or mail link, while unsafe schemes and document-triggered navigation remain blocked.

**Why this priority**: Links are core Markdown content, but opening them crosses the local-file boundary and requires deliberate authorization.

**Independent Test**: Activate permitted and forbidden link fixtures by keyboard, pointer, and touch; verify destinations are disclosed, only explicit actions reach the host authorization boundary, and blocked targets remain inert.

**Acceptance Scenarios**:

1. **Given** an HTTPS, HTTP, or mail link, **When** the user focuses or activates it, **Then** the normalized destination is disclosed and operating-system navigation requires a separate explicit confirmation.
2. **Given** a relative document link or local image, **When** no renderer-scoped local asset authorization is available, **Then** it is reported as unavailable and is never fetched through the network.
3. **Given** a `file:`, `javascript:`, `data:`, custom executable, protocol-relative, credential-bearing, or malformed destination, **When** it renders or is activated, **Then** it is blocked before host authorization.

### Edge Cases

- Empty Markdown renders an intentional empty-document state and retains source-mode access when editing is allowed.
- A source that crosses 16 MiB after an edit stops scheduling preview work without losing the edit; the shared 32 MiB editable limit still applies.
- A source above 32 MiB follows the existing source-backed large-text path, and a source above 256 MiB follows the existing refusal path.
- Duplicate headings, punctuation-only headings, bidirectional text, very deep nesting, wide tables, very long tokens, and invalid character sequences remain bounded and navigable without creating unstable identifiers.
- A cancelled, superseded, suspended, or disposed parse cannot commit output, retain timers, or update a different session.
- Raw HTML is displayed as inert text rather than interpreted as document markup.
- Missing footnote definitions and broken relative targets remain readable with bounded diagnostics.
- A remote image never loads, even if its address uses a permitted external-link scheme.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST render supported Markdown locally through one deterministic document pipeline supporting CommonMark, GFM tables, task lists, strikethrough, autolinks, and footnotes.
- **FR-002**: Rendered view MUST be the default for eligible Markdown sources of at most 16 MiB, while source text remains the sole persistence authority.
- **FR-003**: The system MUST treat raw HTML as inert text and MUST sanitize every generated rendered tree through an application-owned, versioned element, property, and URL policy after all transforms.
- **FR-004**: Rendering MUST provide no document-content network, native bridge, script, form, frame, object, style, font, media, or automatic-navigation authority.
- **FR-005**: The system MUST block remote images and other remote embedded resources without attempting retrieval.
- **FR-006**: The system MUST represent every rendered external link as an inert application control that discloses its normalized destination and requires explicit confirmation before requesting host navigation.
- **FR-007**: External-link validation MUST allow only normalized HTTP, HTTPS, and mail destinations and MUST reject unsafe, ambiguous, credential-bearing, relative-to-remote, and executable schemes before host authorization.
- **FR-008**: Relative links and local images MUST use renderer-scoped local asset resolution with path normalization and source-root containment when such authority exists; otherwise they MUST remain unavailable without fallback network access.
- **FR-009**: A compact mode action MUST switch eligible documents between rendered and source modes without a permanent split view.
- **FR-010**: Source mode MUST compose the existing text editor, text profile, dirty-state, recovery, conflict, Save, and Save As contracts rather than maintaining an independent serialized document model.
- **FR-011**: Preview refresh MUST begin 100 ms after the newest edit, cancel superseded work, and commit only a result matching the active session and exact source revision.
- **FR-012**: Markdown at 16 MiB or less MUST remain renderable and editable; Markdown above 16 MiB through 32 MiB MUST remain source-editable with live preview disabled; larger sources MUST retain the existing 32-256 MiB large-text view and greater-than-256 MiB refusal behavior.
- **FR-013**: Rendered search MUST inspect visible semantic text in deterministic document order, support next and previous navigation with wraparound, and expose the active match without rewriting source.
- **FR-014**: The renderer MUST produce a heading outline with stable collision-free identifiers, heading levels, readable labels, and exact source ranges where available.
- **FR-015**: Mode changes and outline navigation MUST preserve or translate the user's meaningful location whenever an exact rendered-to-source range exists.
- **FR-016**: Rendered Markdown MUST provide semantic headings, lists, quotations, code, tables, task states, links, and footnote relationships that remain keyboard, touch, and screen-reader operable.
- **FR-017**: Print presentation MUST include readable rendered content and safe destination text while excluding application chrome and non-document controls.
- **FR-018**: Parse outcomes MUST distinguish ready, empty, unavailable, limited, cancelled, stale, and failed states without exposing source dumps, paths, stack traces, or host identifiers.
- **FR-019**: Hiding, replacing, closing, or disposing a Markdown session MUST cancel scheduled work and release timers, observers, generated trees, and other regenerable state idempotently.
- **FR-020**: Markdown viewing and editing MUST operate without an account, telemetry, or network connection on Windows, macOS, Linux, and Android through one platform-independent renderer contract.
- **FR-021**: The implementation MUST provide automated fixtures and checks for supported syntax, hostile input, URL policy, stale revisions, size boundaries, source round trips, search, outline navigation, accessibility, disposal, and rendering performance.
- **FR-022**: This slice MUST NOT implement Mermaid rendering, split view, format conversion, selectable parser engines, HTML authoring, project-wide link validation, online content retrieval, collaboration, or a generalized plugin interface.

### Key Entities

- **Markdown document projection**: The revision-bound rendered or source-mode view of one text document, including eligibility, parse state, outline, and current location.
- **Markdown render result**: A sanitized semantic tree and source mappings associated with exactly one session and source revision.
- **Rendered node**: A safe semantic element with bounded text, allowed properties, and an optional exact source range.
- **Heading entry**: A stable identifier, level, label, document order, and source range for one heading.
- **Link candidate**: An authored destination plus its normalized classification, disclosure text, and authorization eligibility.
- **Rendered search state**: A query, ordered semantic matches, active match, and wrap state bound to a rendered revision.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Representative 1 MiB Markdown reaches first readable rendered content within 800 ms at p95 on the desktop reference profile.
- **SC-002**: One hundred rapid source revisions produce zero stale rendered-result commits and leave no scheduled preview after disposal.
- **SC-003**: Every hostile HTML, URL, image, and malformed-markup fixture produces zero script execution, native invocation, automatic navigation, or network request.
- **SC-004**: All supported syntax fixtures retain their expected semantic order, labels, source mappings, and accessible relationships across repeated renders.
- **SC-005**: All round-trip fixtures preserve encoding, byte-order-mark intent, newline sequence, terminal-newline state, comments, whitespace, and untouched text outside explicit user edits.
- **SC-006**: Boundary fixtures immediately below, at, and above 16 MiB, 32 MiB, and 256 MiB select the specified full, degraded, large-text, and refusal modes in every run.
- **SC-007**: Keyboard-only and touch-sized controls can toggle mode, search, navigate headings, inspect links, confirm permitted navigation, edit, and save without critical or serious accessibility findings.
- **SC-008**: Complete workspace format, lint, unit, integration, browser, dependency, documentation, encoding, platform, and package gates pass before pull-request publication.

## Assumptions

- Issues #51 and #52 provide the renderer-driven command shell, source lifecycle, text editor, lossless text profile, recovery behavior, and size-aware large-text fallback used by this slice.
- Issue #54 owns the Mermaid renderer and sanitizer; fenced Mermaid blocks remain escaped code in S014 and gain independent diagrams only in the later dependent slice #56.
- Local asset resolution is capability-gated. Memory-only fixtures and sources without a normalized root do not gain implicit filesystem access.
- Host navigation uses an application-owned, scheme-limited command because the existing source-host link authorization is not exposed through the cross-platform Tauri boundary. The renderer still requires a separate confirmation and the host independently revalidates the normalized destination.
- Printing uses the host WebView's existing print facility and a print-specific document presentation; platform-specific print-dialog automation is explicit manual evidence where unavailable to tests.
- English interface text is sufficient for this unreleased slice; localization infrastructure remains outside scope.
