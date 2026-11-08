# Feature Specification: v0.2.1 product-recovery release

**Feature Branch**: `codex/048-v021-recovery-release`

**Created**: 2026-11-08

**Status**: Specified

**Input**: Owner-approved S048 completes the release-preparation scope of #255 and the remaining release criterion of #244 under autopilot through PR publication, exact-candidate qualification and at most two external review rounds. Stop unmerged for owner final review. Tagging and publication require later owner authorization.

## User Scenarios & Testing

### User Story 1 - Understand the recovered product and its release state (Priority: P1)

A user or maintainer reads consistent current documentation describing the qualified document tasks, supported platforms, recovery behavior and actual release status.

**Why this priority**: The current source still labels the published v0.2.0 release as an unpublished image candidate, while merged recovery behavior needs a v0.2.1 release definition.

**Independent Test**: Compare public-facing source copy, installed candidate facts, the normative specification and release records against the actual published release and candidate inventory.

**Acceptance Scenarios**:

1. **Given** published v0.2.0 and an unreleased v0.2.1 candidate, **When** current release material is read, **Then** each is identified accurately and historical release receipts remain unchanged.
2. **Given** a recovery task, **When** the user reads installation, usage, troubleshooting or help, **Then** instructions match the qualified behavior and state relevant source-authority, compatibility and recovery limits.
3. **Given** current and planned formats and platform distributions, **When** capability or installation claims are read, **Then** only confirmed candidate capabilities are attributed to v0.2.1 and signature/notarization limits remain explicit.

### User Story 2 - Operate the identified recovery candidate (Priority: P1)

An operator installs the identified Android candidate and completes the recovered open, read, edit, save, copy, recover, image, diagnostics, layout, Back and help tasks with independently observable results.

**Why this priority**: Existing S047 evidence cannot establish operation of changed v0.2.1 package bytes.

**Independent Test**: Run the applicable supported Android environments and separately identified ordinary/fault-probe campaigns, compare installed package identities and exported content, and exercise the actual installable release candidate.

**Acceptance Scenarios**:

1. **Given** the final source and identified packages, **When** qualification runs, **Then** all ten ordinary journeys and every applicable fault/profile row pass with source, package, runtime, geometry and attempt provenance.
2. **Given** saved text, selected image export, draft recovery or frozen redacted Diagnostics export, **When** a task completes, **Then** independently read content matches the expected result and source integrity/authority remains intact.
3. **Given** different debug, fault-probe and release packages, **When** evidence is reported, **Then** their identities and exercised behavior remain separate and a different payload is never qualified by source similarity alone.

### User Story 3 - Review one complete release handoff (Priority: P1)

The owner reviews one coherent candidate whose version, documentation, package identities, checks, licensing and retained evidence agree.

**Why this priority**: A complete reviewable candidate allows a deliberate merge and subsequent publication without recreating or ambiguously selecting artifacts.

**Independent Test**: Reconcile all included issue criteria to final evidence and independently read retained package hashes and source identities.

**Acceptance Scenarios**:

1. **Given** final candidate artifacts, **When** the handoff is reconciled, **Then** every required platform/package check is terminal-successful and each accepted artifact has an immutable identity and independently checked digest.
2. **Given** a failed, retried, unrun, conditional or waived observation, **When** evidence is reviewed, **Then** its actual disposition remains visible without replacing it with an unrelated pass.
3. **Given** the pinned brand and distributed dependencies, **When** release checks run, **Then** the delivered brand contract, compatible licensing, notices, provenance and package declarations agree.

### User Story 4 - Retain owner control of finalization (Priority: P1)

The owner receives an unmerged PR ready for final review without an unauthorized tag, public release or deployment.

**Why this priority**: This session authorizes preparation and review, while publication remains a later owner decision.

**Independent Test**: Inspect PR/review/issue/project state and public release/tag state at handoff.

**Acceptance Scenarios**:

1. **Given** the authorized review cap, **When** review findings are addressed, **Then** at most two external rounds are used, actionable threads are resolved, and final-source automation supports any later corrections.
2. **Given** a ready PR, **When** this session ends, **Then** it remains unmerged with auto-merge off, and #244/#255 remain open for publication and final release verification.
3. **Given** deferred conformance or startup observations, **When** the release handoff is prepared, **Then** #66/#239 retain their actual separate dispositions and no new completion or waiver is implied.

### Edge Cases

- Documentation says published while no release exists, or labels an already published version as unpublished.
- A version/build/channel fact differs between the specification, manifests, native About projection, package metadata or receipt.
- A final documentation or instrumentation change invalidates previously captured source/package bindings.
- Missing or duplicate artifacts, immutable artifact names on rerun, malformed capture bytes, missing required rows or callback-only completion.
- Old WebView, maximum text, keyboard/system obstructions, native text-edit action mode, predictive Back cancellation and process restart.
- Conditional animation controls, passive or unmounted controls, platform-unavailable actions, failed attempts and unavailable original incident data.
- A release gate requires publication even though this session ends at an unmerged PR.

## Requirements

### Functional Requirements

- **FR-001**: Candidate product manifests, installed identity, normative specification, release notes and package declarations MUST agree on v0.2.1.
- **FR-002**: Current material MUST distinguish the published v0.2.0 release from unreleased v0.2.1 preparation without rewriting immutable historical receipts.
- **FR-003**: The mandatory documentation pass MUST reconcile capability/platform matrices, README, site, Android installation/usage/help, troubleshooting, source authority, recovery behavior and known limits with S046/S047 behavior.
- **FR-004**: Candidate claims MUST preserve the actual format scope, minimum Android/WebView compatibility, signature/notarization status and explicit unavailable actions; planned formats MUST remain planned.
- **FR-005**: Installed About/build facts MUST match the actual candidate's version, channel and source/package provenance; unavailable facts MUST remain explicitly unavailable.
- **FR-006**: The exact delivered BrandBuilder contract MUST pass its verification. Any necessary brand source/recipe change MUST follow formal pinned upstream delivery; permanent generated-consumer divergence is prohibited.
- **FR-007**: The final source MUST pass all applicable source, documentation, security, compatibility, platform and packaging checks, including exact branch-head qualification and documented expected skips.
- **FR-008**: Fresh ordinary/fault-probe API24/API36 evidence MUST cover all ten ordinary journeys and every applicable containment/profile row with actual package, source, API/WebView, geometry, text/navigation profile, logs, screenshots and attempts.
- **FR-009**: The actual installable Android release candidate MUST receive source/package-bound operational qualification. Debug ordinary/fault-probe evidence, signed assembly, release-runtime operation, publication and physical-device trust MUST remain separately supported claims.
- **FR-010**: Text saves/reopens, selected image exports, exact draft recovery and frozen redacted Diagnostics Save/Share MUST be verified by actual destination/receiver/content readback; callback success alone is insufficient.
- **FR-011**: Retained artifacts MUST be selected by exact source/run/creation identity and independently read back for bytes, hashes and declared package metadata, without falling back from a newer failed candidate to an older pass.
- **FR-012**: One reviewable final handoff MUST reconcile source, checks, package identities/digests, Android task evidence, licensing/notices, documentation and every included issue criterion.
- **FR-013**: Historical failures, retries, missing/unrun rows, conditional controls and source-only/supplemental evidence MUST remain explicit. S047 control-register dispositions MUST remain traceable without relabelling supplemental cases as individual installed passes.
- **FR-014**: Original incident bytes/APK hash/trace MUST remain recorded as unavailable. Existing physical-device/manual-screen-reader/reference-hardware waivers MUST remain unchanged; other unrun manual checks and #66/#239 dispositions MUST remain literal.
- **FR-015**: This session MUST stop at a ready, unmerged PR with auto-merge disabled after at most two external review rounds. No tag, release or deployment is authorized; #244/#255 MUST remain open until separately authorized publication and release verification are complete.
- **FR-016**: Local commands MUST obey the hidden/virtualized execution contract, and GUI/native acceptance MUST use isolated hosted environments without taking the owner's desktop focus.
- **FR-017**: The later separately authorized publisher MUST consume the exact accepted staged payloads and source identity without rebuilding or silently promoting different bytes. Owner merge/content verification MUST NOT relabel the accepted package source as a different merge commit.

### Key Entities

- **Release candidate**: Final source identity, version, documentation state, supported capabilities and independently identified platform packages.
- **Qualification observation**: Tested source/package/runtime/profile, task, result, attempt, retained evidence and explicit evidence class.
- **Release handoff**: Exact candidate/artifact references, checks, digests, issue criteria, review-round state, known limits and owner finalization boundary.
- **Historical release**: Existing immutable published identity and receipt, kept separate from the current candidate.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every candidate version/identity surface agrees on 0.2.1, with zero stale present-tense publication claims or changes to immutable prior receipts.
- **SC-002**: Every required Android journey/profile has a current, correctly scoped result with zero required failed or unrun rows; actual release-candidate operation has its own package-bound evidence.
- **SC-003**: All required checks finish successfully, and every accepted artifact independently matches its recorded digest, package facts and source identity.
- **SC-004**: Every acceptance criterion of #255 and the remaining #244 release criterion maps to completed preparation evidence or an explicit later owner-controlled publication/verification step.
- **SC-005**: The handoff preserves every known waiver, unverified/manual limit, failed attempt and separate #66/#239 disposition without unsupported completion claims.
- **SC-006**: The PR is ready for owner review within the two-round external review cap, remains unmerged with auto-merge off, and no release/tag/deployment is created by this session.

## Assumptions

- This is release reconciliation of merged S046/S047 behavior, not a new format or broad redesign. Only demonstrated release-blocking defects justify proportional implementation changes.
- Dependency and brand pins remain the current authorities; this slice does not adopt incidental upgrades from unrelated maintenance PRs.
- The prior owner waivers remain in force. Manual macOS/Linux GUI and VoiceOver work is not silently claimed or newly waived.
- #255 and #244 can complete release preparation in this PR but close only after separately authorized publication and release verification.
- The latest public release and branch/package identities are rechecked during execution rather than assumed from historical records.
