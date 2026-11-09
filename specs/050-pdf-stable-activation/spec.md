# Feature Specification: PDF conformance and stable activation

**Feature Branch**: `codex/050-pdf-stable-activation`

**Created**: 2026-11-09

**Status**: Planned; implementation and qualification pending

**Input**: Owner-approved S050 bundles #81 and #82, with #11 release-readiness reconciliation, toward v0.3.0. Autopilot authorizes push, PR publication, CI monitoring and at most two external review rounds, then stops ready and unmerged for owner final review. Tagging, publication and deployment remain after owner merge and later authorization.

## User Scenarios & Testing

### User Story 1 - Open a PDF from the operating system (Priority: P1)

A desktop or Android reader chooses Glitchpad for a local PDF and reaches the existing compact PDF viewer through normal operating-system delivery. Opening another PDF in a running application preserves the existing document/session behavior and original bytes.

**Why this priority**: Stable support requires actual operating-system acquisition in the delivered packages, beyond an explicitly selected candidate file.

**Independent Test**: Install or extract the candidate, inspect its registrations, open PDF fixtures cold and warm through the native delivery paths, read/select/search/navigate and confirm current document identity and source integrity.

**Acceptance Scenarios**:

1. **Given** a supported desktop package, **When** a PDF is opened through its native association or picker, **Then** the correct source reaches the PDF viewer cold or warm without changing the file.
2. **Given** an Android provider-granted PDF, **When** the operating system resolves a PDF view request, **Then** Glitchpad is eligible and reads the granted URI directly, including seek-capable and stream-only sources.
3. **Given** existing open documents, **When** another PDF is delivered, **Then** identity, tabs, recovery and existing text/image behavior remain correct without stale cross-document results.
4. **Given** revoked, changed, unsupported or malformed input, **When** delivery or loading fails, **Then** a stable accurate state appears and no source write or misleading success occurs.

### User Story 2 - Read bounded, non-executable PDFs accessibly (Priority: P1)

The reader uses the existing PDF viewing, selection, search, thumbnail, outline, destination, metadata, link and print capabilities across representative licensed and hostile documents. Large or unsupported inputs produce measured bounded outcomes rather than hidden omissions or a frozen application.

**Why this priority**: Stable activation must qualify the complete existing PDF behavior and its declared limits.

**Independent Test**: Run the version/font/image/navigation/encryption/hostile corpus and small, medium, boundary and reduced-cache scenarios with source, runtime, profile, sample and outcome evidence on every claimed platform.

**Acceptance Scenarios**:

1. **Given** PDFs with varied fonts, Unicode/RTL, images, labels, outlines and links, **When** the reader completes the reading journey, **Then** supported content is readable/selectable and navigation is correct within explicit fidelity limits.
2. **Given** malformed, encrypted, huge-page, over-limit or unavailable processing cases, **When** processing proceeds or refuses, **Then** each outcome maps to a stable contract state and configured limits remain enforced.
3. **Given** scripts, form actions, attachments, automatic links or remote resources, **When** the PDF is read or inspected, **Then** none executes, submits, auto-launches, requests native operations or performs document-controlled network access.
4. **Given** keyboard, touch, reduced motion and compact layouts, **When** controls and document tools are used, **Then** names/state, focus, reachability and navigation remain correct; automated checks and existing manual waivers remain distinct.

### User Story 3 - Use the actual delivered PDF candidate (Priority: P1)

The owner receives proof from the packaged desktop application and installed minified Android release candidate, including actual system printing and provider lifecycle behavior. Source tests, composed browsers and older packages remain separate evidence classes.

**Why this priority**: Development builds and representative browser checks cannot establish final-package PDF operation.

**Independent Test**: Front-load the minified Android PDF journey on minimum/current WebViews, then qualify the frozen candidate across four platforms and independently read installed packages and printed output bytes.

**Acceptance Scenarios**:

1. **Given** actual Windows, macOS and Linux candidate packages, **When** PDF acquisition, reading, inspection and print handoff run, **Then** native/frontend/source identities match the selected candidate and actual outcomes are retained.
2. **Given** installed minified Android candidates on API24/Chrome69 and API36, **When** PDF opening, searching, navigating, printing and provider suspension/resume run offline, **Then** the complete journeys finish with clean instrumentation completion and independently matched installed bytes.
3. **Given** selected/all-page print requests, **When** the system operation ends or is cancelled, **Then** native completion/cleanup is truthful; Android output files have the expected pages and ink, and no physical paper claim is inferred.
4. **Given** cancellation, tab suspension, revision change or cache pressure, **When** work is interrupted, **Then** acknowledgement is within250ms, stale results cannot attach elsewhere, and owned workers, surfaces and private cache files are released.

### User Story 4 - Review a complete v0.3.0 release preparation (Priority: P1)

The owner reviews one coherent conformance/activation candidate whose version, capabilities, documentation and packages agree, with publication explicitly pending owner merge and later authorization.

**Why this priority**: Stable PDF claims require a complete release documentation and package gate, while preserving the agreed owner boundary.

**Independent Test**: Reconcile every #81/#82 and #11 criterion, final-source checks, publication inputs and issue/project/review state; verify the PR is ready and unmerged without creating a tag or public release.

**Acceptance Scenarios**:

1. **Given** the v0.3.0 candidate, **When** release checks run, **Then** manifests, specification, capability declarations, generated registrations, changelog, notices/SBOM, artifact names and preparation metadata agree.
2. **Given** public copy and downloads, **When** preparation is reviewed before publication, **Then** candidate PDF scope and limitations are accurate, links retain actually published authority, and DOCX/ODT/advanced editing remain planned.
3. **Given** final artifacts and all applicable checks, **When** qualification closes, **Then** exact source/run/attempt/runtime/hash evidence and retained failures support each criterion; publication-only criteria remain explicitly pending.
4. **Given** the authorized autopilot, **When** handoff occurs, **Then** the PR is pushed, ready, unmerged and auto-merge off after at most two external rounds, with all actionable findings resolved and no tag, release or deployment.

### Edge Cases

- Cold/warm desktop and provider delivery, misleading extension/MIME, denied or revoked authority, changed revision, stream-only input and repeated reopen.
- Encrypted and unsupported encryption, malformed/truncated/cyclic structures, huge page geometry, exact and exceeded source/page/surface limits, low memory and reduced cache.
- Fonts, Unicode/RTL, images, recursive outlines, labels, internal destinations, malicious actions/attachments/resources and explicit invalid external schemes.
- Search cancellation/late results, thumbnail pressure, background/resume, source/session disposal, native print cancellation/failure/unavailability and output-copy completion.
- Minification/native source identity, wrong or stale artifacts, installed-byte mismatch, incomplete instrumentation, failed attempts, package trust/upgrade continuity and source-neutral release metadata.
- Unrun manual observations, existing physical/screen-reader/reference waivers, independent #66/#239 dispositions and publication-only #82/#11 closure gates.

## Requirements

### Functional Requirements

- **FR-001**: Activate PDF in the canonical capability registry, generated desktop associations, picker and Android PDF intent declarations consistently, retaining content-based detection and existing source authority.
- **FR-002**: Native cold/warm PDF delivery MUST reach the existing PDF viewer with correct current-document identity, URI/path semantics and source-neutral session behavior.
- **FR-003**: Seek-capable and stream-only Android sources MUST retain bounded read/private-cache, revision, cancellation, grant and cleanup contracts; viewing never writes original bytes.
- **FR-004**: Preserve the S049 viewing, selectable text, search, thumbnails, outline, labels, destinations, zoom/rotation/layout, metadata, explicit-link and selected/all-print capabilities.
- **FR-005**: Maintain a provenance-licensed and digest-bound conformance corpus spanning PDF versions, fonts/Unicode/RTL, images, navigation, encryption, malformed/hostile structures, huge pages and long documents.
- **FR-006**: Every failed/unsupported/refused observation MUST map to a stable contract state; source corruption, misleading success and silently missing failed rows are forbidden.
- **FR-007**: PDF scripts, submission, attachment/action launch, automatic navigation, document-controlled remote resources and undeclared native invocation MUST remain disabled; explicit validated external links retain their existing user-action boundary.
- **FR-008**: Enforce source limits512MiB desktop/256MiB Android and at most10000pages at/beyond boundaries without weakening existing refusal rules.
- **FR-009**: Enforce active rendered-surface budgets200MiB desktop/96MiB Android, bounded cache/concurrency and reduced-cache/thumbnails-disabled behavior before oversized allocation.
- **FR-010**: Cancellation, close, switch, background suspension and revision replacement MUST acknowledge within250ms, reject stale/cross-document work and dispose owned workers, canvases, fonts, object URLs and actual temporary files.
- **FR-011**: Passwords stay in memory and never enter persistence, logs, diagnostics or artifact metadata. Unsupported encryption and revoked authority have explicit outcomes.
- **FR-012**: Measure first useful page, navigation, search, thumbnails, memory and cache behavior on every claimed platform using identified fixtures, host/WebView/build profile, samples and existing budgets; hosted observations never become an unsupported reference-hardware claim.
- **FR-013**: Complete applicable automated accessibility, keyboard, touch, compact-layout and semantic navigation checks; preserve existing owner waivers and distinguish each remaining unrun manual observation.
- **FR-014**: Qualify the actual packaged Windows/macOS/Linux PDF journeys, including native delivery, worker, reading/navigation/metadata/link behavior, printing and source integrity.
- **FR-015**: Qualify installed minified Android release PDF operation on API24 with actual Chrome69 and on API36, including offline open/search/navigation/metadata/print and seek/stream provider lifecycle; source and installed app/test bytes MUST be independently matched.
- **FR-016**: Native selected/all printing MUST retain bounded truthful handoff/cancel/failure/completion and cleanup. Independently read actual Android printed PDFs, verify expected page counts and ink, and preserve the distinction from physical paper output.
- **FR-017**: Complete dependency/advisory, source/contract/security/fuzz, notices/license provenance, SBOM and package-size/resource gates, retaining the pinned brand and existing trust/update-key contracts.
- **FR-018**: Prepare v0.3.0 in all canonical/mirrored version, package, tag-contract and release metadata authorities; mismatches block preparation before broad native builds. Creating the actual tag remains later owner-authorized publication.
- **FR-019**: Complete the release documentation pass for S049/S050 and reconcile canonical/generated PDF claims, platform matrix, help/site/README/changelog and fidelity/execution limits; DOCX/ODT/advanced PDF tools remain planned.
- **FR-020**: Reuse the existing accepted-staging/publication workflow with immutable actual source/run/attempt/artifact/payload bindings; preserve historical release receipts and do not rename a staged source after a squash merge or qualify changed bytes using old artifacts.
- **FR-021**: Every applicable final-source CI/platform/package gate MUST finish successfully, with expected skips explained, retained failed attempts and independent package/APK/output readback; repeated self-SHA documentation changes MUST NOT invalidate their own qualification.
- **FR-022**: Map all8 #81/#82 criteria and4 #11 epic criteria to implemented/verified or explicitly publication-pending outcomes. #82/#11 MUST remain open until actual publication/readback satisfies their final criteria. #66/#239 retain separate dispositions.
- **FR-023**: Follow the approved hidden/virtualized execution boundary, UTF-8 without BOM, single-line Markdown prose, MermaidTB and exact delivered brand contract.
- **FR-024**: Push/open the PR automatically, monitor CI, resolve findings within at most two external rounds and stop ready/unmerged/auto-merge off for owner final review. No merge, tag, release or deployment is authorized in this run.

### Key Entities

- **Activated PDF capability**: Versioned canonical format row, native registrations, delivery semantics and declared fidelity/exclusions.
- **Conformance observation**: Criterion/case, fixture digest, platform/runtime/build/source identity, attempts, outcome, budgets and retained evidence.
- **Qualified package candidate**: Exact source, trust state, package/installed payload hashes and associated native receipts.
- **Release preparation receipt**: Target/prior version, reconciled slices/claims, immutable accepted inputs, final gates and pending publication/owner boundary.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All12 issue/epic criteria have explicit traceable dispositions, with zero implicit premature closures or unsupported release claims.
- **SC-002**: PDF native acquisition and complete reading/inspection/print-supported-path journeys pass on all four platform families, including minified API24/Chrome69 and API36 installed candidates.
- **SC-003**: Zero unauthorized source writes, implicit execution/network/native actions or stale cross-document updates occur; each required cancellation acknowledgement is at most250ms.
- **SC-004**: All source/page/surface/cache boundaries and degraded/refusal scenarios pass at/beyond existing thresholds with retained measurements and no relaxed budgets.
- **SC-005**: Version/docs/capability/package/notices/security/brand and applicable final gates all pass, with independently matched source/package/installed/output bytes and literal manual/physical/reference limitations.
- **SC-006**: One ready unmerged PR is handed to the owner within two external rounds with zero unresolved actionable findings and zero pending/failed applicable checks; publication remains explicitly pending.

## Assumptions

- S049 at merged main7d341dae79ea26fabe23bf5756687f135c071ea4 is the foundation. Its historical/source-qualified observations guide coverage but do not qualify changed S050 inputs.
- v0.3.0 is the existing #82 target. v0.2.1 remains the actually published authority until later authorized publication; no incidental renderer/brand/toolchain upgrade or advanced editing scope is inferred.
- Existing physical-device, manual-screen-reader and reference-hardware waivers persist. #66/#239 are independent follow-ups, not newly introduced PDF release gates.
- Owner merge and later exact-byte publication/readback may finish #82/#11 through the existing release operation without a second feature slice; this run ends at the approved PR handoff boundary.
