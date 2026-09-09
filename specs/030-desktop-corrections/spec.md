# Feature Specification: Desktop Rendering and Shell Corrections

**Feature Branch**: `codex/030-desktop-corrections`

**Created**: 2026-09-09

**Status**: Complete

**Input**: User description: "Correct the confirmed v0.1.1 desktop regressions that blank Markdown viewports, expose raw Markdown while previews load, move the application menu over document scrollbars, and leave an oversized platform badge in the README."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Keep every Markdown document usable (Priority: P1)

As a desktop user, I can open ordinary and complex Markdown documents in any sequence without the document or application shell becoming blank.

**Why this priority**: A blank viewport defeats the product's primary file-viewing purpose and is a confirmed v0.1.1 release regression.

**Independent Test**: Open a governed Markdown corpus in both orders, repeat and restore sessions, inject renderer and projection failures, and confirm every document reaches a preview, source fallback, or contained actionable error while the shell remains usable.

**Acceptance Scenarios**:

1. **Given** two distinct Markdown documents, **When** they are opened as A then B and B then A, **Then** the active document identity and visible content remain aligned and neither surface blanks.
2. **Given** Markdown rendering, worker startup, safe-tree projection, embedded diagram, or local-resource work fails, **When** the failure reaches the document surface, **Then** the affected document shows a contained error with View source and Close routes while the application shell remains mounted.
3. **Given** a render is canceled or superseded, **When** a stale result arrives, **Then** it cannot clear or replace the current document's surface.

---

### User Story 2 - Protect source while preview is pending (Priority: P1)

As a user opening Markdown in rendered mode, I see a stable non-content-bearing loading state until the safe preview or contained failure is ready, without raw Markdown appearing visually or through assistive technology.

**Why this priority**: The current pending path deliberately exposes complete source text and can reveal destinations, comments, markup, or metadata before sanitization completes.

**Independent Test**: Hold rendering behind a deterministic delay and assert that a source-only sentinel never enters the visual or accessibility tree before success, failure, or timeout settles the surface.

**Acceptance Scenarios**:

1. **Given** rendered mode and pending work, **When** the first document frame appears, **Then** it contains only a concise accessible rendering status and no document-derived text.
2. **Given** reduced-motion preference, **When** the loading state is visible, **Then** it uses no continuous or flashing animation.
3. **Given** rendering fails or times out, **When** the pending state ends, **Then** the user receives a contained error and must explicitly choose View source before source becomes visible.

---

### User Story 3 - Use a stable menu clear of scrollbars (Priority: P1)

As a user navigating a document, I can open and close the application menu without its trigger moving, covering the document scrollbar, changing the document viewport, or losing keyboard access.

**Why this priority**: The current right-anchored intrinsic-width layout visibly moves the trigger and obstructs a primary scrolling affordance on every document.

**Independent Test**: Measure the trigger, popup, document client area, and scrollbar gutter before, during, and after menu disclosure across document, tab, viewport, scaling, theme, and forced-color states.

**Acceptance Scenarios**:

1. **Given** an overflowing document, **When** the menu opens and closes, **Then** the trigger's bounding rectangle remains unchanged within one device pixel and does not intersect a scrollbar hit region.
2. **Given** zero, one, or multiple open documents, **When** the menu is disclosed, **Then** only its documented vertical offset may change and the document width, scroll position, and scrollbar visibility remain stable.
3. **Given** pointer, keyboard, or focus dismissal, **When** the popup closes, **Then** focus returns to the same stationary trigger without animation or layout bounce.

---

### User Story 4 - Keep the repository header compact (Priority: P2)

As a repository visitor, I see a proportionate badge row without a redundant oversized Platforms badge while retaining the supported-platform details below.

**Why this priority**: This is visible public polish but does not affect application functionality.

**Independent Test**: Render the README header and confirm only the Platforms badge is removed while the supported-platform section and all other badges remain intact.

**Acceptance Scenarios**:

1. **Given** the repository README, **When** its header renders on GitHub, **Then** the Platforms badge is absent and the remaining header content is unchanged.

### Edge Cases

- A valid empty Markdown document must remain distinguishable from a blank or failed render.
- Two differently named files with identical bytes and one file reopened after another must not reuse stale presentation state.
- A renderer exception may occur during asynchronous parsing, safe-tree projection, React commit, embedded diagram rendering, or local-resource resolution.
- A secondary panel or search surface may be open when another Markdown document is delivered.
- The document may have both horizontal and vertical scrollbars at the minimum supported window size and 200 percent scaling.
- Forced-colors and reduced-motion preferences must preserve menu focus, pending status, and contained error affordances.
- Diagnostics must remain useful without including raw content, private filenames, paths, link destinations, or provider identifiers.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every governed Markdown document MUST reach rendered preview, bounded source mode, or a visible contained error; no document may leave the application or document viewport blank.
- **FR-002**: Markdown rendering failures MUST be isolated to the affected document surface while application navigation, View source, Close, and redacted diagnostics remain operable.
- **FR-003**: Active session identity, source revision, renderer result, and displayed document MUST remain aligned across sequential opens, tab switching, repeated opens, close/reopen, cancellation, and restoration.
- **FR-004**: Stale, canceled, or superseded renderer work MUST NOT replace, clear, or mutate another session's current view.
- **FR-005**: Rendered-mode pending presentation MUST contain no raw source, source-derived accessible name, hidden source copy, link destination, markup sentinel, or document-derived placeholder.
- **FR-006**: Pending presentation MUST provide a concise polite status, preserve the shell, and honor reduced-motion and forced-color preferences.
- **FR-007**: Render failure or timeout MUST replace pending presentation with a contained actionable error and MUST require explicit user action before source is shown.
- **FR-008**: A document-level containment boundary MUST cover parser, worker, sanitized-tree projection, embedded diagram, local-resource, and component-render failures without obscuring actionable diagnostics.
- **FR-009**: The application menu trigger MUST retain the same measured position and dimensions before, during, and after menu disclosure within one device pixel.
- **FR-010**: The menu trigger and popup MUST NOT overlap document scrollbar hit regions or alter document viewport width, scroll position, or scrollbar visibility.
- **FR-011**: Menu dismissal by action, outside pointer, Escape, and focus flow MUST restore focus to the stationary trigger.
- **FR-012**: Menu geometry MUST remain usable with zero, one, and multiple documents; minimum window size; supported display scaling; dark, light, and forced-color themes; and mouse, touch, and keyboard input.
- **FR-013**: Automated tests MUST cover Markdown corpus permutations, same-byte/different-name sessions, stale results, delayed rendering, contained failures, loading privacy, menu geometry, accessibility, and packaged Windows visible outcomes.
- **FR-014**: Packaged Windows validation MUST exercise at least two nontrivial Markdown documents in both orders and fail on blank shell, blank document, raw-source flash, incorrect active content, or moving/overlapping menu geometry.
- **FR-015**: Shared shell and Markdown behavior MUST retain macOS, Linux, and Android compatibility even though packaged regression evidence is Windows-focused.
- **FR-016**: Default diagnostics MUST NOT retain raw Markdown, private filenames or paths, link destinations, provider identifiers, or document-derived content.
- **FR-017**: The README Platforms badge MUST be removed without changing the supported-platform section, other badges, or platform claims.
- **FR-018**: The correction MUST preserve offline rendering, sanitization, remote-resource blocking, bounded work, source authority, recovery, and save protections.
- **FR-019**: The unreleased v0.1.2 record MUST trace the delivered behavior to issues #160, #161, #162, and #163 without claiming publication.

### Key Entities

- **Markdown presentation lifecycle**: The current session, source revision, render generation, mode, pending/result/failure state, and allowed user recovery actions.
- **Contained document failure**: A redacted document-scoped error state that preserves shell controls and explicit source access.
- **Menu geometry state**: The trigger, popup, document viewport, scrollbar gutters, tab-dependent vertical offset, focus owner, and disclosure state.
- **Packaged desktop receipt**: Bounded evidence that final Windows artifacts display the correct document and stable shell across required permutations.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: One hundred percent of governed Markdown fixtures and open-order permutations reach preview, explicit source mode, or contained error with zero blank application or document surfaces.
- **SC-002**: Zero document-derived sentinel characters or accessible text appear during every deterministically delayed rendered-mode pending state.
- **SC-003**: One hundred percent of injected parser, worker, projection, embedded diagram, resource, and component failures preserve visible View source and Close recovery routes.
- **SC-004**: The menu trigger moves no more than one device pixel and has zero intersection with governed vertical and horizontal scrollbar hit regions across the layout matrix.
- **SC-005**: Opening and closing the menu changes document viewport width and scroll position by zero pixels outside an intentional responsive breakpoint.
- **SC-006**: Automated accessibility checks report zero serious or critical violations for pending, failed, menu-open, menu-closed, forced-color, and reduced-motion states.
- **SC-007**: Final portable and installed Windows artifact tests pass both Markdown open orders and reject intentionally simulated blank, source-flash, identity-mismatch, and menu-geometry regressions.
- **SC-008**: The GitHub README header contains zero Platforms badge instances while retaining all supported-platform prose and every unrelated badge.
- **SC-009**: All required format, lint, unit, browser, documentation, security, platform, and packaging checks pass before pull-request publication.

## Assumptions

- The user-reported v0.1.1 failures will be reduced with synthetic fixtures; private files are not required or copied into the repository.
- A compact left-anchored menu is the preferred correction because it avoids the primary right-side scrollbar; an equally measurable non-overlapping geometry is acceptable only if repository evidence proves it safer.
- The optional decorative scrollbar refinement from #162 is out of scope unless it is trivial, cross-platform, and accessibility-neutral.
- No new runtime dependency, file format, telemetry, network path, generalized workspace behavior, or release publication is part of S030.
- #159 remains a separate Android-specific slice because its resolver and final-APK evidence require an independent platform boundary.
