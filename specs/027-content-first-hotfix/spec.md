# Feature Specification: Content-First Desktop Hotfix

**Feature Branch**: `codex/027-content-first-hotfix`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "Correct the unusable v0.1.0 first-run experience so production opens no fixtures, real text and Markdown files immediately own the viewport, tabs appear only for concurrent documents, secondary controls stay out of the way, search is integrated, and packaged Windows validation catches regressions."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Read the requested file immediately (Priority: P1)

As a desktop user, I can launch Glitchpad with a real text or Markdown file and immediately see that file's content without demo documents, recovery prompts, blank surfaces, or unrelated controls competing for attention.

**Why this priority**: Opening and reading the selected file is the product's baseline purpose and the published release currently fails that purpose.

**Independent Test**: Start from a clean application state, open one real `.txt` file and one real `.md` file through supported desktop delivery paths, and confirm each becomes the sole visible document with exact content.

**Acceptance Scenarios**:

1. **Given** Glitchpad has no persisted user documents, **When** the user launches it directly, **Then** a restrained empty state offers Open without creating any document tab or recovery prompt.
2. **Given** Glitchpad is not running, **When** the user opens a supported text file through the operating system, **Then** that file becomes visible as soon as the window is ready and its content occupies the primary viewport.
3. **Given** a supported file cannot be read or decoded, **When** delivery completes, **Then** Glitchpad presents a visible actionable failure instead of an unexplained blank window.

---

### User Story 2 - Use tabs only for concurrent documents (Priority: P1)

As a user reading one file, I see no tab strip. If I open another file while Glitchpad is already displaying a document, compact tabs appear for those concurrent documents and each can be closed directly.

**Why this priority**: Permanent tabs and synthetic sessions violate the content-first product promise and materially reduce the viewing area.

**Independent Test**: Open one document, then a second document in the same running application, close either tab, and verify the tab strip appears only while at least two documents remain.

**Acceptance Scenarios**:

1. **Given** zero or one document is open, **When** the shell renders, **Then** no tab strip or tab action controls are present.
2. **Given** one document is visible, **When** a second document is delivered to the running app, **Then** a compact tab strip appears with both documents and the newly delivered document becomes active.
3. **Given** multiple documents are open, **When** the user invokes a tab's own close control, **Then** that specific document follows the existing dirty-close safeguards and closes when authorized.
4. **Given** two documents are open, **When** one closes, **Then** the tab strip disappears and the remaining document again owns the reclaimed space.

---

### User Story 3 - Reveal controls only when requested (Priority: P1)

As a user viewing a file, I can reach file actions, preferences, diagnostics, metadata, and search through compact, conventional entry points without persistent rows of controls or overlapping panels obscuring the content.

**Why this priority**: The current command rows and colliding panels dominate the window and make the application harder to use than the operating-system viewer it replaces.

**Independent Test**: Open a document, inspect the default viewport, invoke each secondary surface, dismiss it by pointer and keyboard, and verify content remains primary throughout.

**Acceptance Scenarios**:

1. **Given** a document is open and no secondary function is active, **When** the user views the window, **Then** document content receives the maximum practical viewport and secondary commands are not presented as persistent rows.
2. **Given** the user needs an application or document action, **When** the compact menu is invoked, **Then** the available actions are organized, labeled, keyboard accessible, and capability-aware.
3. **Given** Preferences, Diagnostics, metadata, or search is open, **When** the user dismisses it or presses Escape, **Then** the surface closes and focus returns to its opener without leaving overlapping controls.
4. **Given** dark or light presentation, **When** search is opened, **Then** every search control uses the application theme and remains legible without covering unrelated panels.

---

### User Story 4 - Prevent another unusable release (Priority: P1)

As the release operator, I receive automated packaged-application evidence that a clean first run and real-file opening work before release readiness can pass.

**Why this priority**: Component tests built around demo fixtures allowed the broken v0.1.0 experience to ship.

**Independent Test**: Exercise a packaged Windows artifact from clean state, deliver real TXT and Markdown fixtures, open a second file, and assert the visible user outcomes without relying on internal lifecycle receipts alone.

**Acceptance Scenarios**:

1. **Given** a packaged Windows build with clean state, **When** its first-run smoke test executes, **Then** it detects any fixture filename, unexpected recovery prompt, missing empty state, or unexplained blank window.
2. **Given** real TXT and Markdown test files, **When** they are delivered to the packaged build, **Then** the smoke test proves their names and representative content are visibly rendered.
3. **Given** a second delivered file, **When** the packaged smoke test inspects the window, **Then** it proves conditional tabs and per-tab close controls work.
4. **Given** any required packaged-user assertion fails, **When** release readiness is evaluated, **Then** the release gate fails with bounded diagnostic evidence.

### Edge Cases

- Persisted preferences exist but no restorable user document exists.
- A recovery record for genuine user work exists while the application starts empty.
- The same file is delivered twice, or two files share a display name but have different source identities.
- A dirty document is the tab explicitly closed while other documents remain open.
- A secondary surface is open when another document is delivered.
- The window is narrow enough that concurrent document names cannot all fit inline.
- A valid empty file is opened and must be distinguishable from a failed or stalled delivery.
- Windows startup is slow enough that delivery arrives before the interface reports readiness.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Production startup MUST initialize with zero synthetic or demonstration document sessions.
- **FR-002**: Test and performance fixtures MUST remain available only through explicit non-production entry points and MUST NOT create production recovery records.
- **FR-003**: Direct launch with no restorable user document MUST show a minimal empty state with one clear Open action and no tab strip or document-specific command row.
- **FR-004**: A newly opened TXT or Markdown source MUST become active and visibly render its content when delivery completes.
- **FR-005**: Delivery failure MUST produce a visible, actionable message that distinguishes failure from a valid empty file.
- **FR-006**: The tab strip MUST be absent while fewer than two document sessions are open.
- **FR-007**: Opening a second document while another remains open MUST reveal tabs for the concurrent documents and activate the newly opened document.
- **FR-008**: Every visible tab MUST provide a close control targeting that tab, with a programmatically determinable accessible name.
- **FR-009**: Closing from two documents to one MUST remove the tab strip and return its space to the document viewport.
- **FR-010**: Existing dirty-document save, discard, cancellation, recovery, focus, and source-release protections MUST remain effective for per-tab close actions.
- **FR-011**: File, document, preference, diagnostic, and metadata actions MUST be reached through a compact, explicitly invoked application control rather than permanent command rows.
- **FR-012**: Secondary surfaces MUST be mutually coherent, dismissible by explicit control and Escape, and MUST restore focus to their opener.
- **FR-013**: Search controls MUST use the active application theme, provide an explicit close action, remain keyboard and screen-reader operable, and avoid collision with other secondary surfaces.
- **FR-014**: The primary document surface MUST receive the overwhelming majority of the usable window whenever a document is open.
- **FR-015**: Automated tests MUST cover empty startup, real TXT and Markdown delivery, conditional tab visibility, direct per-tab closing, compact command disclosure, and secondary-surface dismissal.
- **FR-016**: Required Windows package validation MUST exercise the received application from clean state and verify visible first-run and real-file outcomes rather than only internal readiness receipts.
- **FR-017**: Release validation MUST fail when the packaged-user workflow exposes fixtures, a spurious recovery prompt, invisible delivered content, incorrect tab behavior, or a blank unexplained surface.
- **FR-018**: The hotfix MUST preserve offline operation, existing source authority, bounded decoding, encoding preservation, and atomic-save protections.
- **FR-019**: The shipped-behavior documentation MUST record this correction as an unreleased v0.1.1 delta and maintain issue traceability for #141 through #147.

### Key Entities

- **Document session set**: The currently open user documents, their active member, dirty state, source authority, and lifecycle status.
- **Shell presentation state**: Whether the empty state, single-document chrome, concurrent-document tabs, compact menu, or one secondary surface is visible.
- **Desktop delivery**: A sequenced operating-system or dialog request that resolves to an opened, duplicate, or rejected real source.
- **Packaged-user receipt**: Bounded evidence that the packaged application visibly completed a required first-run or real-file workflow.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A clean direct launch displays zero document tabs, zero fixture filenames, zero fixture recovery prompts, and exactly one primary Open action.
- **SC-002**: Every tested TXT and Markdown launch displays the requested filename and representative file content as the active document on the first completed delivery.
- **SC-003**: The tab strip is absent for zero and one open document, appears for two open documents, and disappears again within one render cycle after returning to one.
- **SC-004**: Every visible tab can be closed directly by pointer and keyboard without closing a different document or bypassing dirty-document safeguards.
- **SC-005**: With one document open and no secondary surface active, no persistent secondary command row consumes document height.
- **SC-006**: Search, Preferences, Diagnostics, and metadata can each be opened and dismissed with no overlapping secondary surface and with focus restored to the invoking control.
- **SC-007**: Automated user-interface accessibility checks report zero serious or critical violations for the empty, single-document, multi-document, menu, search, and secondary-panel states.
- **SC-008**: Required packaged Windows validation catches every intentionally simulated regression named in FR-017 and emits no fixture or user-file content beyond the bounded test evidence.
- **SC-009**: All repository, interface, native-host, package-policy, documentation, and encoding gates pass before the pull request is published.

## Assumptions

- S027 is an emergency v0.1.1 hotfix and does not add new file formats or generalized workspace behavior.
- "Opened while the app is already viewing something else" includes supported operating-system delivery and the application's explicit Open action into the same running instance.
- Genuine recovery records remain eligible for recovery; only synthetic fixture-derived recovery behavior is prohibited.
- The compact command entry point may use native or in-window presentation, provided it is conventional, accessible, and does not permanently occupy a full command row.
- Windows packaged-user validation may use accessibility/UI automation and bounded screenshots or text evidence, but must not depend solely on implementation-private lifecycle markers.
- v0.1.0 remains published until the owner separately authorizes a release-state change; S027 prepares a corrective v0.1.1 release.
