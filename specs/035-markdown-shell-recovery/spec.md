# Feature Specification: Markdown Preview and Shell Recovery

**Feature Branch**: `codex/s035-markdown-shell-recovery`

**Created**: 2026-09-11

**Status**: In Review

**Input**: User description: "Specify and deliver S035 by restoring packaged Windows Markdown preview and usable recovery for #171, reserving compact non-overlapping shell space for the application menu in #172, validating the shared behavior, publishing a pull request, and completing CI and automated review before the owner merge ritual."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Read Markdown and recover from a failed preview (Priority: P1)

A person opening a supported Markdown file in the installed application sees the rendered document. If one preview attempt fails, the failure remains confined to that document and offers compact actions to inspect the source, retry the preview, close the document, open another document, and obtain privacy-safe diagnostics.

**Why this priority**: Rendered Markdown is a stable released capability. The reported failure prevents the primary document-viewing workflow and therefore blocks confidence in the current release.

**Independent Test**: Install the candidate Windows package, open a minimal supported Markdown file through each supported desktop delivery path, inject one deterministic preview failure, enter source recovery, retry the preview, and confirm the rendered document returns without restarting the application.

**Acceptance Scenarios**:

1. **Given** a newly installed application and a supported Markdown file, **When** the file is opened through the Open command, **Then** its rendered preview appears without a contained-error surface.
2. **Given** multiple supported Markdown files, **When** they are opened sequentially through supported delivery paths, **Then** each active document reaches its own rendered preview without inheriting another document's failure or recovery state.
3. **Given** a deterministic failure in one Markdown preview attempt, **When** the failure reaches the document boundary, **Then** the application remains usable and shows a compact, intrinsic-height recovery surface inside only the affected document.
4. **Given** the contained recovery surface, **When** the user chooses to view source and then retries preview, **Then** the same document can re-enter rendered mode without an application restart.
5. **Given** a repeated preview failure, **When** the user continues working, **Then** source viewing, document close, another document open, and redacted diagnostics remain available.

---

### User Story 2 - Use the application menu without losing document space (Priority: P2)

A person can open the persistent application menu from a compact, visually quiet control that occupies dedicated shell space and never covers document content, controls, selection, errors, or scrollbars.

**Why this priority**: The current absolute overlay obscures every renderer in some states and directly compounds the Markdown recovery defect, but the application remains operable through other commands.

**Independent Test**: Measure the closed trigger, reserved shell region, popup, document client area, and scrollbars before, during, and after disclosure across representative window sizes, scaling, themes, tab states, and input modes; no persistent intersection or disclosure-driven document reflow is allowed.

**Acceptance Scenarios**:

1. **Given** any supported document, empty state, loading state, or contained-error state, **When** the menu is closed, **Then** its persistent trigger occupies a non-document region and does not intersect the document client box or scrollbar regions.
2. **Given** the compact menu trigger, **When** the menu is opened and dismissed by Escape, outside pointer, or item activation, **Then** the trigger stays in the same location and focus returns visibly to it.
3. **Given** a coarse-pointer environment, **When** the visually compact trigger is used, **Then** its interactive target remains at least 44 pixels in both dimensions without increasing the visible chrome to its former footprint.
4. **Given** an ordinary viewport, **When** the menu opens, **Then** the popup remains inside the viewport, does not cover the trigger, and may temporarily overlay document content only while explicitly open.

---

### User Story 3 - Trust the correction across supported desktop environments (Priority: P3)

A maintainer can demonstrate that the preview recovery and shared shell correction work in the packaged Windows application and do not regress the shared desktop shell on macOS or Linux.

**Why this priority**: The defect was reported in a newly installed Windows package, while the affected shell and renderer presentation are shared across desktop platforms.

**Independent Test**: Run the governed automated suites and record packaged Windows evidence plus shared-shell macOS and Linux evidence for ordinary content and deterministic contained-error states.

**Acceptance Scenarios**:

1. **Given** the candidate Windows package, **When** representative Markdown files are opened through supported delivery paths at the required display scales, **Then** rendered preview, compact recovery, retry, and non-overlapping menu geometry satisfy the slice contract.
2. **Given** the shared desktop shell on macOS and Linux, **When** ordinary and failure surfaces are exercised, **Then** the menu and document regions remain non-overlapping and keyboard recovery behavior remains available.
3. **Given** diagnostics produced during failure triage, **When** evidence is recorded or copied, **Then** raw document content, private paths, filenames, link destinations, and embedded metadata are absent by default.

### Edge Cases

- The same bytes opened under different source identities must not share preview-recovery suppression.
- Closing and reopening a failed document must start from the current persisted document mode rather than an obsolete error-boundary state.
- Restored sessions must not replay an unrecoverable preview suppression state across documents.
- An individual embedded diagram failure must remain local and must not be misclassified as a whole-document preview failure.
- Malformed, oversized, revoked, unsupported, or inaccessible sources must retain their existing contained outcomes.
- A menu popup near the smallest supported window boundary must remain reachable without moving the closed trigger or creating document scroll jumps.
- Browser zoom, 100/125/150/200 percent display scaling, dark and light themes, reduced motion, and forced colors must preserve visible focus and non-overlap.
- A touch-sized interactive target must not force a touch-sized visible background treatment in desktop layouts.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Supported Markdown files MUST reach rendered preview in the packaged Windows application through the Open command, file association, command-line delivery, and delivery to an already-running process.
- **FR-002**: Preview state MUST remain isolated by document identity and current revision across initial open, sequential open, close/reopen, restored sessions, and same-content/different-name cases.
- **FR-003**: A preview or presentation failure MUST remain contained to the affected document and MUST NOT make the application, another open document, or shared commands unavailable.
- **FR-004**: A contained preview failure MUST present its message and controls at intrinsic content height near the start of the document region.
- **FR-005**: Recovery controls MUST remain compact and expose visible hover, focus, active, disabled where applicable, and forced-colors states.
- **FR-006**: A Markdown failure MUST offer a source-view action when source is available.
- **FR-007**: After source recovery, the user MUST have a visible Preview or Retry preview action that attempts rendered mode again without restarting the application.
- **FR-008**: A failed retry MUST update contained feedback while preserving source access, document close, another document open, and privacy-safe diagnostics.
- **FR-009**: Failure diagnostics MUST exclude raw document content, private filenames or paths, link destinations, and embedded metadata by default.
- **FR-010**: The persistent application-menu trigger MUST occupy a measured shell region outside the document client box.
- **FR-011**: The closed trigger MUST NOT intersect document content, editor controls, rendered preview, selection, loading or error surfaces, or horizontal and vertical scrollbars.
- **FR-012**: The non-overlap contract MUST be implemented once at the shared shell boundary rather than through renderer-specific padding or offsets.
- **FR-013**: The trigger's visible treatment MUST be approximately 50 percent smaller in perceived footprint than the released 2.25-rem square treatment while preserving a reliable desktop target.
- **FR-014**: Coarse-pointer mode MUST preserve a minimum 44-by-44-pixel interactive target even when the visible glyph and chrome are smaller.
- **FR-015**: The trigger bounding rectangle MUST remain stable within one device pixel before, during, and after popup disclosure.
- **FR-016**: The popup MUST remain inside the viewport, MUST NOT cover its trigger, and MAY overlay document content only while open.
- **FR-017**: Opening and closing the popup MUST NOT change document scroll position or trigger avoidable document reflow.
- **FR-018**: Escape, outside pointer dismissal, item activation, and focus restoration MUST return interaction to the same visible trigger location.
- **FR-019**: Automated checks MUST measure failure-surface row sizing and menu/document/scrollbar geometry and fail on persistent overlap or stretched recovery controls.
- **FR-020**: Packaged Windows verification MUST cover governed Markdown fixtures, supported delivery paths, representative window sizes, required scaling values, themes, keyboard use, and forced colors.
- **FR-021**: Shared-shell verification MUST cover macOS and Linux without weakening the one shared behavior contract.
- **FR-022**: S035 MUST record requirement-to-evidence traceability for #171 and #172 and MAY contribute focused evidence to #66 without representing #66 as complete.
- **FR-023**: S035 MUST NOT change stable format claims, product version, release metadata, document persistence semantics, or publish a corrective release.

### Key Entities

- **Document presentation attempt**: One bounded attempt to present the current document identity, revision, renderer, and requested mode, with an outcome of rendered, source, pending, contained failure, or unsupported.
- **Markdown recovery state**: The affected document and revision, current visible mode, latest preview outcome, retry availability, and contained feedback needed to recover without restarting.
- **Persistent menu region**: The dedicated shell area, interactive target, visible chrome, and stable anchor used by the application menu outside the document client box.
- **Validation evidence**: A privacy-safe record linking one requirement to automated results or an explicit packaged-platform observation.

### Scope Boundaries

- S035 corrects released Markdown presentation, failure recovery, and shared desktop menu geometry only.
- A product version change, corrective release transaction, new renderer capability, image roadmap implementation, documentation-site restructuring, and repository branch-cleanup automation are outside this slice.
- The stable-core conformance matrix in #66 remains separately owned; S035 adds only directly relevant regression evidence.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: One hundred percent of the governed supported Markdown corpus reaches rendered preview in the candidate packaged Windows application when no failure is injected.
- **SC-002**: One hundred percent of deterministic injected presentation failures remain confined to the affected document while another document and shared application commands remain usable.
- **SC-003**: A user can move from contained failure to source and back to a successful rendered preview in one retry attempt without restarting the application.
- **SC-004**: The contained-error message and every recovery control use intrinsic content height, with no row or control consuming more than twice its measured content height.
- **SC-005**: The closed persistent menu region has zero intersection area with the document client box, document controls, selection layer, and both scrollbar regions in every governed geometry case.
- **SC-006**: The trigger's bounding rectangle changes by no more than one device pixel during a complete open-and-dismiss cycle, and the active document's scroll position remains unchanged.
- **SC-007**: Coarse-pointer cases retain an interactive target of at least 44 by 44 pixels while ordinary desktop cases show a visibly smaller treatment than the released 2.25-rem square control.
- **SC-008**: All governed keyboard dismissal and focus-restoration scenarios complete with visible, unclipped focus on the same trigger.
- **SC-009**: Packaged Windows verification passes at 100, 125, 150, and 200 percent scaling for ordinary Markdown and contained-failure states, with no overlap or stretched control.
- **SC-010**: Shared-shell macOS and Linux checks pass for ordinary and contained-failure states, and the complete repository validation gate reports zero failures before the pull request is published.
- **SC-011**: Redacted diagnostic evidence contains zero raw document-content excerpts, private paths, filenames, link destinations, or embedded metadata values.
- **SC-012**: Every acceptance criterion for #171 and #172 maps to an automated result or explicit packaged-platform observation before the slice is declared complete.

## Assumptions

- The reported Windows defect applies to the current v0.1.2 package and can be reproduced or bounded using privacy-safe synthetic fixtures.
- The existing source, session, renderer, recovery, and diagnostics contracts remain authoritative unless diagnosis exposes an architecture contradiction, in which case implementation stops for a recorded amendment.
- The current coarse-pointer minimum is the accessibility floor; visual size and interactive size may differ.
- Packaged Windows evidence is release-like validation, not authorization to publish a new product release.
- Owner-controlled merge and any later corrective release remain separate rituals after CI and automated review are satisfied.
