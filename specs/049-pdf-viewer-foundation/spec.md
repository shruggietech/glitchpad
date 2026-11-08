# Feature Specification: PDF viewer foundation

**Feature Branch**: `codex/049-pdf-viewer-foundation`

**Created**: 2026-11-08

**Status**: Specified

**Input**: Owner-approved S049 bundles #77, #78, #79 and #80 into one end-to-end PDF reading capability. Autopilot includes push, PR publication, CI monitoring and at most two external review rounds, then stops unmerged for owner final review. Exhaustive release conformance and stable activation remain #81/#82.

## User Scenarios & Testing

### User Story 1 - Open and read a local PDF (Priority: P1)

A desktop or Android user opens a local PDF and immediately sees useful page content with compact page, fit, zoom, rotation and layout controls. Large documents remain bounded, switching documents preserves navigation without retaining background rendering, and an unreadable source produces a visible, accurate result.

**Why this priority**: A real local reading journey establishes the foundation shared by every included issue.

**Independent Test**: Open licensed representative documents through the actual supported source adapters on all four platform families; read, navigate, cancel, suspend and resume while checking source integrity, bounded resource use and observed completion.

**Acceptance Scenarios**:

1. **Given** an acquired PDF source, **When** the user opens it, **Then** readable pages appear locally with a current-document identity, text selection and available controls, without altering the source or granting processing code source locators/native operations.
2. **Given** a desktop or Android source, **When** size/page/rendered-surface limits are approached or exceeded, **Then** the declared full, reduced-cache or stable refusal outcome occurs within the existing platform budgets.
3. **Given** work in progress or a suspended document, **When** the user cancels, switches, closes or resumes, **Then** the action acknowledges within the configured hard limit, obsolete results cannot attach to another document, and owned processing/resources are disposed or resumed correctly.
4. **Given** malformed, encrypted, unsupported-encryption, revoked or failed processing input, **When** opening fails or requires a password, **Then** the user sees the correct recoverable state; passwords stay in memory and source/session behavior remains intact.

### User Story 2 - Find and navigate PDF content (Priority: P1)

The reader searches text, follows page labels, outlines, thumbnails and internal destinations, and returns to reading through dismissible, accessible document tools. Navigation belongs to the current session and does not modify the file.

**Why this priority**: Rendering alone does not make a long structured PDF usable.

**Independent Test**: Complete ordered search, page/context selection, lazy thumbnails, outline and destination journeys using keyboard and touch; validate semantic accessibility and the existing manual-screen-reader waiver explicitly.

**Acceptance Scenarios**:

1. **Given** searchable text, **When** a query changes or a result is selected, **Then** ordered matches with page context appear and selection navigates to the correct document position without stale results.
2. **Given** labels, outline entries, named destinations or internal links, **When** the reader activates them or enters a page, **Then** valid targets navigate correctly while malformed/out-of-document targets receive a stable refusal.
3. **Given** a large document or reduced-cache mode, **When** thumbnails or navigation drawers are used, **Then** bounded lazy work stays responsive, thumbnails are disabled when required, and active-page state remains synchronized.
4. **Given** compact or wide layouts, **When** the reader uses keyboard, touch or accessible semantics, **Then** tools stay reachable/dismissible with correct names, state, focus and current-document identity; session navigation never writes the source.

### User Story 3 - Inspect, follow links and print deliberately (Priority: P1)

The reader inspects document facts, explicitly follows a permitted external link, or prints selected/all pages using an available platform path. Unavailable actions explain their actual state and failures/cancellation are not reported as success.

**Why this priority**: These actions complete the scoped PDF capability set and share its document/capability model.

**Independent Test**: Inspect known metadata fixtures with provenance/availability, activate and reject link fixtures, and smoke supported print paths plus truthful unavailable/cancelled/failed results.

**Acceptance Scenarios**:

1. **Given** an acquired PDF, **When** Document details is opened, **Then** version, page count/labels/dimensions, encryption/permissions, title/author/subject/keywords, creator/producer, dates, outline and unsupported facts carry typed provenance and availability rather than invented values.
2. **Given** PDF links or actions, **When** the document loads or is navigated, **Then** no external navigation occurs automatically; only an explicit user activation of a validated supported external scheme can request operating-system navigation.
3. **Given** printing capability, **When** selected/all pages are printed or cancelled, **Then** the actual supported platform path is exercised with bounded work and truthful results; unavailable paths expose a truthful unavailable state.
4. **Given** PDF scripts, form actions, embedded attachments, remote resources or executable content, **When** the source is processed/rendered/inspected, **Then** none executes, submits, launches, fetches document-controlled resources or invokes native operations.

### User Story 4 - Review a complete, traceable candidate (Priority: P1)

The owner receives one coherent, licensed and source-bound implementation with all four issues traceable and existing text/image/source behavior preserved.

**Why this priority**: Correct implementation and defensible observed evidence are both needed before owner merge.

**Independent Test**: Reconcile each issue criterion with current contract/regression/browser/native evidence, inspect package/licensing/brand gates and verify the PR/issue/review boundary.

**Acceptance Scenarios**:

1. **Given** the candidate contract and actual runtime observations, **When** implementation is assessed, **Then** every included issue criterion has a concrete result or explicit still-open disposition; source/session/metadata regressions remain passing.
2. **Given** the required platform environments including the minimum Android WebView, **When** qualification executes, **Then** representative PDF tasks pass on actual supported WebViews with exact source, artifact, runtime and attempt identities, without substituting synthetic browser or historical evidence for installed operation.
3. **Given** dependencies, fixtures and the pinned brand kit, **When** validation runs, **Then** compatible provenance/notices, locked dependency checks, budgets, accessible compact controls and exact delivered brand conformance pass.
4. **Given** the authorized autopilot boundary, **When** work completes, **Then** the PR is pushed, ready, unmerged and has auto-merge off after at most two external rounds, with terminal applicable checks and resolved findings; no tag/release/deployment or premature #81/#82 closure occurs.

### Edge Cases

- Empty, truncated, malformed, encrypted/password-rejected and unsupported-encryption files; revoked authority and changed external revision mid-read.
- Zero, 10,000 and over-limit pages; exact source thresholds; huge page dimensions, dense text, bounded canvases, low-memory/reduced-cache mode and obsolete render/search responses.
- Android content URIs, seek-capable versus stream-only providers, small/landscape/IME-obstructed viewports, old WebView, tab suspension and repeated close/reopen.
- Missing/duplicated labels, recursive or malformed outlines, invalid page indices/coordinates, long text queries and destinations owned by another document.
- PDF JavaScript, form submission, automatic actions, external resources, attachments, unexpected protocols and permission restrictions.
- Print range errors, OS cancellation/failure/unavailability, unreadable metadata and unavailable/manual evidence.

## Requirements

### Functional Requirements

- **FR-001**: Define a versioned PDF document/capability/error/lifecycle contract covering load, password state, pages, labels, outline/destinations, text search, thumbnails, rotation/layout/zoom, printing, metadata, limits, cancellation and disposal.
- **FR-002**: Reuse existing native source authority, identity, revision and bounded-read contracts. Android content URIs remain source handles rather than desktop paths. Processing receives bounded bytes and typed operations, never source locators or native authority.
- **FR-003**: PDF content MUST NOT execute scripts, submit forms, launch attachments/actions, make document-controlled network requests, silently navigate or invoke native operations. Remote fonts, resources and workers are not fetched.
- **FR-004**: Representative licensed PDFs MUST render readable selectable content consistently on Windows, macOS, Linux and Android, including the current minimum WebView; use the existing compact application shell rather than a separate permanent viewer workspace.
- **FR-005**: Enforce desktop 512 MiB / Android 256 MiB source thresholds, at most 10,000 pages and active rendered-surface budgets of 200 MiB / 96 MiB. Limits are checked before oversized allocation, with reduced-cache/thumbnails-disabled behavior and stable refusal where required.
- **FR-006**: Use ranged reads for seek-capable PDF sources and the existing private, quota/revision/cleanup-governed cache contract for stream-only sources when seeking is required. Seek-capable first content MUST NOT require whole-document buffering. A stream-only source that needs its tail/index may finish bounded private-disk spooling first, with visible progress and cancellation, without retaining the whole source in memory.
- **FR-007**: Render only visible/adjacent pages inside bounded cache/concurrency budgets; provide fit, zoom, rotation, page labels/direct navigation and responsive continuous/single-page layouts.
- **FR-008**: Cancel, close, revision change and tab switching MUST obey the current renderer hard limits, reject stale/cross-document results and release owned tasks, canvases, object URLs, fonts, workers and caches deterministically. Suspended tabs retain compact navigation state.
- **FR-009**: Surface distinct malformed, password-required/rejected, unsupported-encryption, oversized, revoked and processing-failure outcomes. Passwords stay in memory and never enter logs, persistence or diagnostic exports.
- **FR-010**: Provide ordered cancellable text search with page context, selection and synchronized active-page navigation.
- **FR-011**: Provide bounded lazy thumbnails, document outline, page labels, named destinations and validated internal links; malformed targets cannot escape the document or crash processing.
- **FR-012**: Navigation drawers and controls MUST be compact, dismissible, keyboard/touch operable, correctly named/stateful and focus-restoring. Navigation remains session-only and source-neutral.
- **FR-013**: PDF facts MUST integrate the existing Source/Content/Embedded/Derived/Renderer metadata model, with typed provenance, availability, units, sensitivity and copy policy for all #80 fact groups. Metadata extraction failure alone does not block readable content.
- **FR-014**: External links require validated schemes and explicit user action through the existing operating-system opener boundary, with actual completion/refusal reporting. No load, search or internal-navigation event may trigger one.
- **FR-015**: Provide bounded selected/all-page printing through supported platform paths with real smoke evidence and truthful success, cancellation, failure or unavailable outcomes. Document permission flags are reported as facts; they do not introduce a new product eligibility or usage policy.
- **FR-016**: Every advertised control derives from the current document/platform capability contract; do not expose enabled inert controls or report callback-only success. Any represented form content remains read-only and never submits.
- **FR-017**: Preserve existing text/image/detection/source/session/save/recovery/metadata behavior, encodings, line endings and original PDF bytes. Viewing/navigation/metadata/print do not modify the source.
- **FR-018**: Pin compatible, provenance-documented dependencies/resources and licensed fixtures. Required notices ship in every applicable artifact; no incidental unrelated dependency upgrades or permanent brand-consumer divergence.
- **FR-019**: Front-load representative minimum-WebView worker/load/render/cancellation compatibility before the complete candidate campaign. Retain failed observations diagnostically and isolate fixture/transport errors before rerunning full matrices.
- **FR-020**: Required source, contract, hostile-input, accessibility, compatibility, performance/budget, documentation and platform/package gates MUST finish successfully on the actual final candidate. Evidence identifies source, artifact hashes, runtime/platform, profile, attempt and scope.
- **FR-021**: Preserve existing owner waivers of unavailable physical-device/manual-screen-reader/reference-hardware prerequisites. Other unrun manual observations remain explicit; automated semantics are not relabelled as a manual assistive-technology pass.
- **FR-022**: Map every #77-#80 criterion to implemented behavior and concrete verification. S049 is an unreleased capability delta; v0.2.1 release records stay immutable, product/spec version remains the current released authority, and stable PDF associations/intents/public activation remain #81/#82.
- **FR-023**: Follow approved hidden/virtualized local execution and isolated hosted native qualification, UTF-8 without BOM, single-line Markdown prose and top-to-bottom Mermaid. No owner-desktop focus is taken for native tests.
- **FR-024**: Push/open the PR automatically, monitor CI and address findings within at most two external rounds; record reviewed/final heads and retained failures, resolve actionable threads, and stop ready/unmerged with auto-merge disabled. No merge, tag, release or deployment is authorized for S049.

### Key Entities

- **PDF document session**: Current source identity/revision, load/password state, capabilities, page facts and owned processing/resources.
- **Page and navigation target**: Validated document-owned page, label, geometry, outline/destination and session navigation state.
- **Search/thumbnail request**: Bounded cancellable work, revision/owner identity, results and disposal state.
- **Metadata/print/link result**: Typed facts or user-requested action outcome with provenance, availability and truthful completion.
- **Qualification observation**: Exact source/package/runtime/profile/attempt, result, retained evidence and explicit evidence class.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All sixteen #77-#80 acceptance criteria map to current implementation and verifiable results, with zero silently incomplete criteria.
- **SC-002**: Representative open/read/navigation/inspect/print-supported-path journeys pass on every supported platform family, including actual minimum and current Android WebViews, with exact candidate/source/package identity.
- **SC-003**: Every boundary/cancellation/resource-disposal test meets its configured hard limit; zero stale cross-document updates, unauthorized writes, automatic navigation, document-controlled network requests or native invocations occur.
- **SC-004**: Source-size/page/surface thresholds and degraded/refusal cases pass at/beyond each specified boundary without weakening existing budgets or discarding failed samples.
- **SC-005**: Existing source/session/metadata/text/image regressions, compatible licensing/notices, pinned brand and applicable final checks pass; every unrun/waived/manual limitation stays literal.
- **SC-006**: A ready unmerged PR is handed to the owner within two external rounds, with no unresolved findings, no pending/failed applicable check and no merge/tag/release/deployment.

## Assumptions

- S049 delivers the owner-approved four-issue functional bundle. Exhaustive #81 conformance, #82 stable activation/publication and advanced PDF editing #227-#237 remain separate later work.
- The currently published v0.2.1 identity, historical receipts and existing platform/WebView compatibility promises remain authoritative. Changes to those promises require explicit owner agreement rather than a convenient technical narrowing.
- Existing physical-device/manual-screen-reader/reference waivers persist. No new prerequisite or unsupported completion claim is inferred from legacy issue wording.
- Routine technical choices are resolved through repository context and primary-source research. The owner has already authorized phase progression, push/PR publication and the bounded review workflow.
