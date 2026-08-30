# Feature Specification: Mermaid Viewing and Editing

**Feature Branch**: `[003-mermaid-view-edit]`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "Add Mermaid chart viewing and editing while preserving Glitchpad's compact, local-first file experience."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open a Mermaid diagram as a document (Priority: P1)

A user opens a standalone Mermaid source file and immediately sees the rendered diagram as the primary document content, with compact controls for switching to source, searching, zooming, panning, and inspecting file information.

**Why this priority**: Standalone diagram viewing establishes Mermaid as a first-class file capability and delivers the core value without requiring the user to wrap diagram source in Markdown.

**Independent Test**: Open representative `.mmd` and `.mermaid` files from each supported platform entry point and verify that each produces the same rendered diagram, navigation controls, and metadata result without a network connection.

**Acceptance Scenarios**:

1. **Given** a valid standalone Mermaid file, **When** the user opens it, **Then** Glitchpad displays a rendered diagram fitted to the viewport and identifies the source as a Mermaid diagram document.
2. **Given** a diagram larger than the viewport, **When** the user zooms or pans, **Then** the user can inspect the entire diagram without the application adding a persistent navigation surface.
3. **Given** a valid diagram whose authored layout direction is horizontal or otherwise differs from Glitchpad's documentation convention, **When** the diagram renders, **Then** the authored direction is preserved exactly.

---

### User Story 2 - Edit and validate a Mermaid diagram (Priority: P1)

A user switches a standalone Mermaid document to source mode, edits the diagram text, sees a refreshed preview after a brief idle period, and saves through the same conflict-safe text workflow used by other editable documents.

**Why this priority**: Viewing without source editing would force users into another application for small diagram changes and would undermine the file-focused workflow.

**Independent Test**: Open a writable diagram, change nodes and relationships, observe validation and preview behavior, save, reopen, and verify that the exact authored source and resulting diagram are retained.

**Acceptance Scenarios**:

1. **Given** a writable Mermaid document in source mode, **When** the user edits valid source and pauses, **Then** the preview refreshes without requiring an explicit render command.
2. **Given** source containing a syntax error, **When** validation completes, **Then** Glitchpad preserves the source, keeps editing available, identifies the error location when the parser provides one, and does not replace the last valid preview with an error diagram.
3. **Given** a document changed externally after opening, **When** the user attempts to save edited Mermaid source, **Then** the standard external-revision conflict flow prevents silent overwrite.

---

### User Story 3 - Read and edit Mermaid blocks in Markdown (Priority: P1)

A user opens Markdown containing one or more fenced `mermaid` blocks, reads the diagrams inline with the surrounding document, and edits their source through the normal Markdown source mode.

**Why this priority**: Mermaid commonly lives inside Markdown documentation, so inline rendering must behave as part of the stable Markdown experience rather than as a disconnected viewer.

**Independent Test**: Open Markdown containing multiple valid and invalid Mermaid fences, switch between rendered and source modes, edit one chart, and verify that unaffected prose and diagrams remain usable throughout.

**Acceptance Scenarios**:

1. **Given** Markdown with valid fenced `mermaid` blocks, **When** the document renders, **Then** each block appears inline at its source position and follows the active theme without loading remote resources.
2. **Given** one malformed Mermaid block among valid Markdown content, **When** the document renders, **Then** only that block shows a bounded error fallback while the rest of the Markdown remains readable.
3. **Given** Markdown source mode, **When** the user edits a Mermaid block, **Then** the standard Markdown preview refreshes and the complete Markdown source remains the saved authority.

---

### User Story 4 - Use diagrams safely and accessibly (Priority: P2)

A keyboard, touch, or assistive-technology user can open and navigate a diagram, discover parse or resource-limit failures, and access an authored diagram title and description or the source fallback without active diagram content executing.

**Why this priority**: Diagram support must preserve the product's security and accessibility guarantees before it can be advertised as stable.

**Independent Test**: Exercise valid, malformed, oversized, accessibility-annotated, link-bearing, HTML-bearing, and adversarial fixtures with keyboard, touch, and screen-reader checks while monitoring for network or script activity.

**Acceptance Scenarios**:

1. **Given** a diagram with an accessible title and description, **When** assistive technology reaches the rendered diagram, **Then** the authored label and description are exposed with the diagram role.
2. **Given** a diagram without accessible annotations, **When** assistive technology reaches it, **Then** Glitchpad exposes a useful generated label and a direct way to reach the source text.
3. **Given** Mermaid source containing links, click callbacks, HTML, scripts, or remote-resource references, **When** the source is rendered, **Then** no script, callback, navigation, or network request executes.

### Edge Cases

- An empty standalone Mermaid file opens in source mode with an empty-state explanation and remains editable.
- An unrecognized diagram declaration produces a source-preserving parse result instead of being treated as generic Markdown.
- A render request that exceeds source, complexity, time, or output limits is cancelled; source editing, saving, and copying remain available.
- Rapid edits coalesce into the newest preview request, and an older result never replaces a newer source revision.
- Closing, switching, or backgrounding a tab cancels unnecessary rendering without discarding dirty source.
- Theme changes re-render or restyle the preview without modifying source text.
- Multiple Mermaid blocks in one Markdown file fail independently and share a bounded document-level rendering budget.
- Read-only sources retain view, search, copy, zoom, pan, and metadata capabilities while edit and save controls remain absent.
- Unsupported Mermaid syntax remains visible as source with a parser-version-aware error and no destructive conversion.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Glitchpad MUST recognize `.mmd` and `.mermaid` as standalone Mermaid diagram documents through the same evidence-based format detection used for other text formats.
- **FR-002**: Glitchpad MUST recognize fenced code blocks whose information string identifies Mermaid within supported Markdown documents.
- **FR-003**: A standalone Mermaid document MUST provide rendered and source modes, with rendered mode as the default for valid source and source mode as the default for empty or currently unrenderable source.
- **FR-004**: Standalone Mermaid source MUST support editing, undo and redo, find and replace, line navigation, source diagnostics, copy, save, Save As, dirty-state recovery, and external-revision conflict protection.
- **FR-005**: Mermaid previews MUST refresh after a bounded idle delay following the newest source change, and stale, superseded, hidden, or cancelled render results MUST NOT replace the current preview.
- **FR-006**: A parse failure MUST preserve all source text, keep source editing and saving available, retain the last valid preview for the current document session when one exists, and expose line and column information when supplied by the parser.
- **FR-007**: Rendered diagrams larger than the viewport MUST support fit-to-view, zoom in, zoom out, reset, and pan through keyboard, pointer, and touch interactions appropriate to the platform.
- **FR-008**: Standalone diagrams MUST support text search across source text and rendered labels; an embedded diagram MUST participate in Markdown document search.
- **FR-009**: Rendering MUST occur locally and MUST disable scripts, HTML execution, click callbacks, automatic link navigation, remote resources, and document-content network requests.
- **FR-010**: Rendered output MUST be sanitized after diagram generation and MUST remain confined to the renderer's unprivileged presentation boundary.
- **FR-011**: Glitchpad MUST preserve user-authored Mermaid source, including diagram type, layout direction, comments, initialization directives that pass the security policy, whitespace, encoding, byte-order-mark intent, and line-ending contract; it MUST NOT auto-format or rewrite source during render or save.
- **FR-012**: The top-to-bottom Mermaid convention for Glitchpad project documentation MUST NOT be applied as a validation rule or transformation to user documents.
- **FR-013**: Each embedded Mermaid block MUST render and fail independently so one invalid block cannot prevent the remaining Markdown from rendering.
- **FR-014**: Rendering MUST enforce explicit source-size, diagram-complexity, execution-time, output-size, memory, and per-document concurrency limits while leaving source viewing, editing, copying, and saving available after a render refusal.
- **FR-015**: The metadata inspector for a Mermaid document MUST report host and text metadata plus detected diagram type, parser status, parser version, accessible-title presence, accessible-description presence, and the active resource-limit result when available.
- **FR-016**: Rendered diagrams MUST expose an accessible diagram role, preserve authored accessible titles and descriptions, provide a useful fallback label when those annotations are absent, and offer a direct route to source mode.
- **FR-017**: Mermaid viewing and editing MUST work without an account or network connection on every platform where the Markdown and editable-text core is released.
- **FR-018**: File dialogs, desktop associations, Android intents, release notes, help, and public support claims MUST include standalone Mermaid formats only when the feature passes the stable release matrix.
- **FR-019**: Mermaid rendering failures MUST be classified as malformed source, unsupported syntax, resource limit, cancellation, or internal renderer failure and MUST produce stable, non-destructive user-visible results.
- **FR-020**: Diagram export, remote rendering, collaboration, presentation mode, custom executable callbacks, user-supplied renderer plugins, and automatic diagram layout rewriting MUST remain outside this feature.

### Key Entities

- **Mermaid diagram document**: A standalone text document identified as Mermaid source, with source capabilities, text round-trip profile, authored diagram declaration, current source revision, render status, and navigation state.
- **Embedded Mermaid block**: A fenced Mermaid source region owned by a Markdown document, identified by source range and revision, with an independent parse and render result.
- **Diagram render result**: The bounded result for one exact source revision, containing success output or a classified failure, diagnostics, accessibility facts, measurements, and cancellation state.
- **Diagram viewport state**: Per-session fit, zoom, pan, search, and focus state that never alters source content.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can open a valid 1 MiB standalone Mermaid file and see first rendered content within 1.5 seconds at the 95th percentile on the reference desktop profile and within 2.5 seconds on the reference Android profile.
- **SC-002**: After an edit to a normal test diagram, validation begins no sooner than 250 milliseconds and no later than 500 milliseconds after the final keystroke, and the updated preview appears within 1 second at the 95th percentile.
- **SC-003**: In rapid-edit tests containing at least 100 consecutive source revisions, zero stale render results replace the preview for a newer revision.
- **SC-004**: One malformed Mermaid block among at least 20 blocks leaves all valid blocks and all non-diagram Markdown readable in 100 percent of conformance fixtures.
- **SC-005**: Security fixtures containing scripts, HTML event handlers, callbacks, remote resources, and automatic links produce zero script executions, navigations, native invocations, or network requests across every release platform.
- **SC-006**: Keyboard-only and touch-only users can switch modes, search, fit, zoom, pan, inspect metadata, edit, and save without a blocked essential action in the release accessibility matrix.
- **SC-007**: Every authored accessible title and description in the conformance corpus is exposed to assistive technology, and every unannotated diagram exposes a fallback label and source route.
- **SC-008**: Source round-trip fixtures preserve accepted encoding, byte-order-mark intent, newline structure, whitespace, comments, and authored direction byte-for-byte except for the exact text edits made by the user.

## Assumptions

- Mermaid is a diagram language commonly embedded in Markdown, not a syntactic subset of Markdown; standalone Mermaid files and fenced Mermaid blocks are separate document contexts that share one rendering policy.
- The feature joins the first stable Markdown and editable-text release because it uses the same source, editing, save, recovery, tab, and metadata contracts.
- Rendered mode is the initial mode for valid standalone diagrams because opening a diagram is primarily a viewing action; the user's last mode for the active session is retained while the tab remains open.
- The current bundled Mermaid parser defines supported diagram syntax. Unsupported syntax never triggers an online fallback or source conversion.
- Export is deferred because viewing and editing provide the requested file interaction without adding output-format, font-embedding, and accessibility-export policy.
- The project documentation direction rule governs diagrams authored for this repository only. User files retain all valid Mermaid direction declarations.
