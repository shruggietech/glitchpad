# Feature Specification: S044 Image Release Convergence and Closeout

**Feature Branch**: `codex/044-image-release-closeout`

**Created**: 2026-11-02

**Status**: Implemented; final candidate authority is the PR #241 handoff receipt

**Input**: Proceed with S044 using Spec-Kit and autopilot; automatically push and open the PR, resolve CI and bot feedback within two review rounds, and stop for owner final review and merge.

## User Scenarios & Testing

### User Story 1 - Qualify a converged release dependency graph (Priority: P1)

As the release owner, I receive one qualified image candidate containing compatible release-relevant dependency fixes, with the application, fuzz qualification, notices and package provenance describing the same dependency graph.

**Why this priority**: The new Cargo update includes an SVG parser fix and native watcher changes that should be assessed before final package qualification.

**Independent Test**: Verify the selected dependency inventory, locked application/fuzz consistency, advisory/license gates and image/source regression results.

**Acceptance Scenarios**:

1. **Given** Cargo PR #240 and npm PR #226, **When** dependency changes are assessed, **Then** each integrated or deferred change has a recorded reason and compatible runtime changes receive affected-platform qualification.
2. **Given** the converged image dependency graph, **When** malformed and deeply nested SVG inputs are opened, **Then** existing admission limits and source-integrity outcomes remain enforced.
3. **Given** the candidate, **When** qualification and package inventories are generated, **Then** shared dependencies agree and notices/provenance match the retained package bytes.

### User Story 2 - Explain native startup observations with retained evidence (Priority: P1)

As a maintainer, I can compare the preceding published baseline and image candidate on the same isolated macOS runner and distinguish first-launch overhead, later process restarts, application readiness, and failed measurements without losing samples or exposing document contents.

**Why this priority**: #239 and #66 retain unclassified startup/readiness observations; changing thresholds or discarding failures would not resolve them.

**Independent Test**: Exercise classification and failure paths, then collect paired baseline/candidate hosted measurements on both macOS architectures with lifecycle checks and bounded diagnostics.

**Acceptance Scenarios**:

1. **Given** the preceding v0.1.4 source and candidate, **When** both run under one hosted profile, **Then** all launch samples, ordering, source/build/OS/architecture provenance and unchanged budget classifications are retained.
2. **Given** an application that times out or exceeds a hard limit, **When** qualification fails, **Then** the failing phase and measurements survive cleanup and the launched process is terminated.
3. **Given** the retained Windows/Android readiness observations, **When** another timeout occurs, **Then** bounded content-free diagnostics identify the readiness stage without document contents, user paths, process arguments or raw UI dumps.
4. **Given** measured results, **When** #239 is dispositioned, **Then** a demonstrated defect is repaired or a measured hosted limitation is recorded; no new release gate or unperformed reference pass is inferred.

### User Story 3 - Hand off an exact release candidate (Priority: P1)

As the owner, I receive an official PR with final-head checks, reviewed changes, a complete package inventory and an executable release runbook, ready for my final review and merge.

**Why this priority**: #76/#10 require publication evidence that cannot be replaced by a preparation PR.

**Independent Test**: Reconcile all eight package identities, digests, sizes, source revisions and qualification receipts; validate release/documentation consistency and explicitly pending publication obligations.

**Acceptance Scenarios**:

1. **Given** a final candidate, **When** its eight packages are read back, **Then** retained bytes match their manifests, checksums and platform qualification receipts.
2. **Given** successful preparation, **When** the PR is handed off, **Then** merge/tag/official publication/public deployment remain pending and #76/#10 are not falsely closed.
3. **Given** external review feedback, **When** at most two review rounds complete, **Then** every actionable comment is addressed and every review thread is dispositioned before owner handoff.

### Edge Cases

- Baseline source uses the same shell-ready endpoint but an older receipt shape: preserve original evidence and normalize only documented comparable fields.
- A hosted first launch is slow while later restarts are fast: retain both, do not rename cached restarts as fresh OS-cold measurements.
- A launch fails before its process is discoverable: retain phase and bounded process state without leaking command lines.
- A dependency update conflicts with pinned runtime/brand contracts: defer or adapt it with explicit evidence instead of silently changing those contracts.
- A failure artifact is missing or CI remains queued: report the unresolved obligation; do not mark the candidate ready.
- A new source commit invalidates earlier package identity: regenerate and verify packages for the final candidate.

## Requirements

### Functional Requirements

- **FR-001**: Assess #240 and #226 and integrate compatible release-relevant fixes; record deferred changes and retain exact licensed Linux plugin patches unless their replacement is demonstrated equivalent.
- **FR-002**: Keep application/fuzz dependencies consistent and pass unchanged advisory, license, hostile-input, source-integrity and image resource gates.
- **FR-003**: Compare baseline and candidate startup on each hosted macOS architecture using the same runner, definition, fixtures and profile; retain all samples and identify first versus subsequent launches.
- **FR-004**: Preserve reference thresholds (1500 ms pass, 2500 ms warning) and hosted-smoke hard limit (10000 ms); classify evidence independently and never infer a reference pass from hosted smoke.
- **FR-005**: Retain startup samples and phase diagnostics on timeout or budget failure before cleanup, and terminate qualification-owned application processes on every exit path.
- **FR-006**: Add bounded content-free readiness diagnostics for the Windows portable harness and Android AppFrame observations without relaxing their existing timeouts or assertions.
- **FR-007**: Reconcile release documentation, notices, capability claims and all eight candidate packages with the exact final source and retained artifact bytes.
- **FR-008**: Record #239 and #66 results with evidence and remaining obligations; #66 manual package criteria remain explicit, and owner-removed physical-device/manual screen-reader gates remain removed.
- **FR-009**: Retain a release handoff inventory separating candidate qualification from pending merge, tag, official publication and deployment; keep #76/#10 open until their actual acceptance evidence exists.
- **FR-010**: Complete installed Spec-Kit phases, aggregate checks, affected hosted native/package checks, automatic push/official PR and at most two external review rounds; stop for owner final review and merge.

### Key Entities

- **Dependency disposition**: proposed version, selected version, reason, affected boundary and validation.
- **Startup comparison**: baseline/candidate revisions, shared environment, ordered samples, readiness endpoint, launch category, diagnostics and independent budget results.
- **Release candidate inventory**: final revision, platform packages, byte digests/sizes, provenance, qualification evidence and pending publication states.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every assessed dependency change has an explicit disposition and all integrated shared qualification dependencies match the application candidate.
- **SC-002**: Both macOS architecture comparisons retain every attempted launch and a measured attribution or limitation for #239; zero samples are discarded to improve classifications.
- **SC-003**: Injected launch failures retain diagnostics and leave zero qualification-owned processes running after cleanup.
- **SC-004**: All eight final candidate packages pass inventory/readback checks and every applicable final-head CI check reaches success before handoff.
- **SC-005**: Every review comment is dispositioned within at most two review rounds; publication-dependent issue criteria remain explicitly pending.

## Assumptions

- S043 merged as 386097b46e5080780012711d7ee2282bec7d5f74; the preceding published v0.1.4 tree is represented by 9181247 and release source 1d7dcd4.
- PDF baseline/advanced implementation remains the following roadmap increment, including #77/#78/#228; it is not activated here.
- Automatic push and PR publication are authorized. Merge, tags, release publication and Pages deployment are reserved for the owner ritual.
- Hosted runners supply native UI isolation. All local repository tooling uses hidden Docker/VCS boundaries.

## Clarifications

### Session 2026-11-02

- Q: Does S044 publish v0.2.0 before owner review? → A: No. The current instruction ends at final review and merge; retain a reviewable exact candidate and publication runbook.
- Q: Should a hosted startup outlier change the existing limits? → A: No. Compare like profiles and repair measured defects or document the environment limitation while preserving classifications.
- Q: Must all of #66 close? → A: No. Complete actionable automated follow-ups and retain non-waived manual rows explicitly.
