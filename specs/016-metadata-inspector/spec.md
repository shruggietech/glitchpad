# Feature Specification: Contextual Metadata Inspector

**Feature Branch**: `[codex/016-metadata-inspector]`

**Created**: 2026-09-03

**Status**: Draft

**Input**: User description: "Deliver S016 for issue #58: a contextual file information inspector and provenance model for host, detection, text, renderer, integrity, and capability facts."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Inspect the active file without leaving it (Priority: P1)

A user opens file information from the active document bar and sees useful source, content, derived, and renderer facts while the document remains visible and usable.

**Why this priority**: The inspector replaces common trips to a file manager and gives users the context needed to understand the file they are viewing or editing.

**Independent Test**: Open representative text, Markdown, and Mermaid sources from desktop and Android entry points, open file information, verify the grouped facts, dismiss the inspector, and confirm the active document and session state are unchanged.

**Acceptance Scenarios**:

1. **Given** an active document with metadata capability, **When** the user opens file information, **Then** a compact contextual inspector shows available facts grouped as Source, Content, Derived, and Renderer without replacing the document.
2. **Given** a fact the source or renderer does not provide, **When** the inspector opens, **Then** the fact is labeled `Not provided`, `Unsupported`, `Redacted`, `Pending`, or with a stable error rather than omitted ambiguously or fabricated.
3. **Given** an open inspector, **When** the user dismisses it, **Then** the full document surface is restored and focus returns to the control that opened it.

---

### User Story 2 - Understand and safely copy metadata (Priority: P1)

A user can tell where every displayed fact came from, whether it is current and available, and whether it may be copied without exposing protected source identity or sensitive metadata.

**Why this priority**: Metadata can expose paths, provider identifiers, coordinates, or private document properties; a truthful provenance and copy policy is necessary before the inspector is safe to ship.

**Independent Test**: Exercise public, unavailable, redacted, sensitive, pending, and errored facts and verify that provenance is visible, allowed values copy exactly, and prohibited values never reach the clipboard or diagnostics.

**Acceptance Scenarios**:

1. **Given** an available copyable fact, **When** the user invokes its copy action, **Then** the exact displayed value and unit are copied and a restrained confirmation is announced.
2. **Given** a redacted or non-copyable fact, **When** the inspector displays it, **Then** no action exposes its underlying value.
3. **Given** a sensitive fact, **When** the user requests a copy, **Then** the interface requires a separate explicit disclosure action before copying and never enables disclosure through bulk copy.

---

### User Story 3 - Observe metadata changes and request integrity evidence (Priority: P1)

A user sees metadata refresh in the existing document session after a source change and can request a checksum that is tied to the exact external revision it represents.

**Why this priority**: Stale file facts and revisionless checksums are misleading precisely when users need integrity and conflict information.

**Independent Test**: Open a watched desktop source and a controlled Android provider source, change their metadata externally, verify in-place refresh, request SHA-256, change the source during calculation, and verify stale or cancelled results never appear as current.

**Acceptance Scenarios**:

1. **Given** a source whose metadata changes externally, **When** the host reports the change, **Then** the inspector updates the applicable facts without replacing the document session or discarding document state.
2. **Given** a source with checksum capability, **When** the user requests SHA-256, **Then** the inspector shows bounded pending progress and publishes the digest only with the exact external revision it represents.
3. **Given** a checksum request superseded by a source revision, tab suspension, close, or cancellation, **When** the older work finishes, **Then** its result is discarded and cannot be presented as current.

---

### User Story 4 - Inspect metadata accessibly across platforms (Priority: P2)

A keyboard, touch, or assistive-technology user can open, navigate, copy from, and dismiss file information using a layout appropriate to the current form factor.

**Why this priority**: File information is a stable capability and must be usable through every supported input and accessibility path.

**Independent Test**: Complete the primary inspector flow with keyboard and screen reader on desktop and touch and TalkBack-equivalent semantics on phone and tablet viewport profiles.

**Acceptance Scenarios**:

1. **Given** a desktop viewport, **When** file information opens, **Then** it appears as a dismissible right-side overlay no wider than 360 pixels with logical headings, focus order, and visible focus.
2. **Given** an Android phone or tablet viewport, **When** file information opens, **Then** it uses a bottom sheet on phones and a side sheet on tablets without blocking its own close or copy controls.
3. **Given** facts that update asynchronously, **When** their state changes, **Then** assistive technology receives a restrained status announcement without repeated document-content narration.

### Edge Cases

- A source may provide a name and byte length but omit all timestamps, provider identity, or permission details.
- A platform may reject a metadata query after the document has already rendered; viewing remains available and facts show a stable error.
- A metadata refresh may arrive after a newer refresh or after the active tab changes; only the matching source session and external revision may update.
- Created or accessed times may be unavailable or unreliable on a platform and must not be inferred from modified time.
- A value may be present but intentionally redacted; the UI must distinguish that state from absence.
- Very long names, provenance labels, units, and values must remain bounded, selectable when permitted, and must not widen the inspector beyond its layout limit.
- Clipboard access may fail or be unavailable; the fact remains visible and a stable copy error is reported without exposing additional data.
- Checksum calculation may encounter a read error, exceed the source-size policy, be cancelled, or become stale before completion.
- Renderer metadata may be pending while source and text facts are already ready; groups update independently.
- Closing the inspector during asynchronous work must not close the document or leak observers, timers, handles, or pending announcements.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Glitchpad MUST expose file information through a compact control in the active document bar and the renderer-driven command surface when the active source and renderer permit metadata inspection.
- **FR-002**: The inspector MUST preserve the active document as the primary surface, use a dismissible right-side overlay no wider than 360 pixels on desktop, use a bottom sheet on phone layouts and a side sheet on tablet layouts, and restore focus to its opener when dismissed.
- **FR-003**: Facts MUST be grouped as Source, Content, Embedded, Derived, and Renderer, with empty groups omitted only when no catalog fact applies to the active document type.
- **FR-004**: Every metadata fact MUST include a stable catalog key, typed value when present, display label, provenance, availability, sensitivity, copy policy, and external or session revision where currency matters.
- **FR-005**: Availability MUST distinguish available, not provided, unsupported, redacted, pending, and errored states; errored facts MUST use stable bounded error codes and MUST NOT include paths, provider identifiers, source excerpts, or stack traces.
- **FR-006**: Source facts MUST include display name, source kind, byte length, observed modification time, creation time and access time when supplied reliably, write or provider capability state, identity confidence, and current external revision.
- **FR-007**: Text content facts MUST include encoding, byte-order-mark state, newline pattern, terminal-newline state, line count, character count, detected language, and round-trip safety when applicable.
- **FR-008**: Renderer facts MUST preserve renderer-specific catalog values already available for Markdown and Mermaid, including Mermaid parser, revision, accessibility, measurement, timing, and resource-limit facts, through the shared provenance model.
- **FR-009**: Derived facts MUST include format evidence and conflicts, detection confidence, warnings, and an on-demand SHA-256 fact when the source supports bounded repeatable reads.
- **FR-010**: SHA-256 MUST remain absent until explicitly requested, execute cancellably against a bounded source snapshot, and publish only a digest associated with the exact external revision read.
- **FR-011**: A checksum request MUST be invalidated by a newer external revision, source replacement, tab suspension, tab close, or explicit cancellation; stale completion MUST NOT overwrite a newer checksum state.
- **FR-012**: Metadata updates from file watching, provider refresh, text profiling, detection, or renderer work MUST update the existing matching document session without replacing it or disturbing edits, selection, scroll, preview, recovery, or tab state.
- **FR-013**: Copy actions MUST copy only facts whose policy permits copying; redacted and prohibited facts MUST expose no underlying value, and sensitive facts MUST require a separate explicit disclosure action that bulk copy cannot bypass.
- **FR-014**: Bulk copy, if offered, MUST include only currently available facts allowed by their copy policy and MUST preserve visible group, label, value, and unit context without hidden identifiers.
- **FR-015**: The inspector MUST be fully operable by keyboard, pointer, and touch, expose semantic headings and metadata groups, maintain visible focus, announce restrained asynchronous status changes, and meet the existing application contrast and target-size rules.
- **FR-016**: Metadata extraction and normalization MUST work offline, use the existing native source and renderer boundaries, obey the same resource and cancellation limits as document work, and MUST NOT introduce telemetry, remote lookup, shell execution, or arbitrary native authority.
- **FR-017**: Desktop and Android source adapters MUST satisfy one shared metadata catalog contract while preserving platform truth: Android document URIs MUST NOT be represented as filesystem paths, and unavailable host facts MUST remain unavailable.
- **FR-018**: Metadata query failure MUST NOT prevent content viewing unless it independently proves the source malformed for the selected renderer.
- **FR-019**: All displayed dates, byte units, counts, plurals, state labels, and user-visible errors MUST use localization-ready formatting, while file names and metadata values remain untranslated.
- **FR-020**: S016 MUST NOT add EXIF, IPTC, XMP, image, PDF, or office parsing; it establishes the shared catalog and inspector that later format slices will populate.

### Key Entities

- **Metadata fact**: One cataloged piece of information with a stable key, group, typed value, availability, provenance, sensitivity, copy policy, unit, revisions, and stable error state.
- **Metadata snapshot**: The bounded set of facts for one document session, source identity, external revision, and renderer revision, updated incrementally without replacing the session.
- **Metadata catalog entry**: The stable definition for a fact's key, group, value kind, label, applicability, sensitivity default, and permitted copy behavior.
- **Integrity request**: A cancellable on-demand SHA-256 calculation tied to one source snapshot and external revision.
- **Inspector state**: Per-window presentation, focus origin, responsive placement, selected disclosure state, and pending status announcements; it contains no document content authority.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can open or dismiss file information in under 100 milliseconds at the 95th percentile without changing the active session, selection, scroll position, dirty state, or preview revision.
- **SC-002**: Every applicable source, text, detection, and renderer fact in the stable-core conformance catalog appears with exactly one explicit availability state and provenance result in 100 percent of fixtures.
- **SC-003**: External metadata changes appear in the already-open inspector within one second of the corresponding host change event on reference desktop systems and within one provider refresh cycle on Android.
- **SC-004**: Across at least 100 superseded or cancelled checksum requests, zero stale digests are presented as current, and every published digest matches the bytes and external revision it identifies.
- **SC-005**: Hostile metadata fixtures produce zero leaked paths, provider identifiers, source excerpts, sensitive values, or stack traces in the inspector, clipboard, announcements, or diagnostics.
- **SC-006**: Keyboard-only and touch-only users can open, traverse, selectively disclose when required, copy permitted facts, and dismiss the inspector without a blocked essential action in the release accessibility matrix.
- **SC-007**: Desktop, Android phone, and Android tablet viewport tests retain at least 60 percent of the available viewport for document context while the inspector is open, except where the phone bottom sheet is intentionally expanded by the user.
- **SC-008**: Repeating open, refresh, checksum cancellation, and close for 100 cycles leaves no active metadata subscriptions, source reads, observers, timers, focus traps, or status announcements owned by the closed inspector.

## Dependencies and Issue Traceability

- S016 implements GitHub issue #58 as one coherent metadata capability slice.
- Completed issues #45, #46, #47, and #49 provide the shared contracts, desktop and Android source adapters, and document-session shell required by #58.
- Completed text, Markdown, Mermaid, recovery, and renderer-command slices provide the source facts and contextual integration points consumed by the inspector.
- Issue #59 depends on #58 and remains outside S016.

## Assumptions

- The initial catalog covers stable-core source, text, Markdown, Mermaid, detection, integrity, and capability facts; later format slices extend the same catalog with embedded metadata groups.
- A source or renderer can truthfully omit a fact. Absence is a first-class state rather than a reason to infer or synthesize data.
- Source identity and native locators remain private host concerns. The shared inspector receives safe display and provenance facts, never raw desktop paths or Android provider authorities.
- SHA-256 is the sole integrity digest in this slice because it is already the project-wide checksum authority.
- Platform layout differences are presentations of one shared inspector behavior, not separate metadata products.
- Copying one sensitive value requires an explicit per-value disclosure. No persistent preference weakens that policy.
