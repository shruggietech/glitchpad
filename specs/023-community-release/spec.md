# Feature Specification: v0.1.0 Community Release

**Feature Branch**: `codex/023-community-release`

**Created**: 2026-09-07

**Status**: Complete

**Input**: User description: "Prepare and publish Glitchpad v0.1.0 without paid Windows or Apple signing gatekeepers, using truthful community-release trust states and the existing four-platform artifact work."

## Clarifications

### Session 2026-09-07

- Q: Must v0.1.0 require paid Windows Authenticode signing or Apple Developer ID/notarization? → A: No. Publish truthful unsigned or non-notarized community artifacts.
- Q: How is Android signing handled without a paid gatekeeper? → A: Use a free, stable, project-owned update key because Android requires signing-key continuity for upgrades.
- Q: Does pre-release manual platform validation block publication? → A: No. Manual, accessibility, physical-device, and real-world validation begins after v0.1.0 and is tracked by issue #66.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Assemble a truthful community release (Priority: P1)

As the release operator, I can assemble the declared Windows, macOS, Linux, and Android v0.1.0 artifacts with consistent versions, checksums, bills of materials, provenance, licenses, and explicit trust states without purchasing third-party signing or notarization services.

**Why this priority**: A reproducible, truthful artifact set is the minimum release increment and the prerequisite for publication.

**Independent Test**: Execute the release-candidate validation path from a clean source revision and verify that every declared artifact and evidence document is present, version-aligned, internally consistent, and labeled with its actual trust state.

**Acceptance Scenarios**:

1. **Given** a reviewed v0.1.0 source revision, **When** the release-candidate pipeline runs, **Then** it produces the complete four-platform artifact inventory without requiring paid Windows or Apple credentials.
2. **Given** unsigned Windows artifacts and an ad-hoc-signed, non-notarized macOS artifact, **When** release evidence is validated, **Then** those states are accepted only when explicitly recorded and never represented as third-party verified.
3. **Given** an Android release build, **When** its artifacts are assembled, **Then** all Android artifacts use the same stable project-owned update key and record its public fingerprint without exposing private key material.

---

### User Story 2 - Understand artifact trust and installation limits (Priority: P2)

As a downloader, I can determine exactly what Glitchpad supports, what each artifact contains, and what Windows or macOS warning I may encounter before installing it.

**Why this priority**: Removing commercial trust services is acceptable only when users receive accurate, prominent information and strong integrity evidence.

**Independent Test**: Review the release notes, technical specification, package metadata, checksums, and notices and verify that a user can identify platform support, trust status, installation warnings, privacy behavior, known limits, and the post-release defect process without contradictory claims.

**Acceptance Scenarios**:

1. **Given** the v0.1.0 release page, **When** a user selects a Windows or macOS download, **Then** the release notes state that the artifact is unsigned or non-notarized and describe the expected operating-system warning using ordinary supported system controls.
2. **Given** any v0.1.0 artifact, **When** a user verifies its checksum and accompanying evidence, **Then** the evidence identifies the exact source revision, version, platform, artifact bytes, license, and trust state.
3. **Given** the published capability matrix, **When** a user compares it with the application and release notes, **Then** Markdown, Mermaid, text/source, metadata, recovery, and platform claims agree across all surfaces.

---

### User Story 3 - Publish and close the first-release milestone (Priority: P3)

As the project owner, I can approve the reviewed release preparation, merge it, create the v0.1.0 tag, and have automation publish a GitHub release containing only the governed artifact set.

**Why this priority**: Publication completes the milestone, but it must consume the already validated release preparation rather than bypassing review.

**Independent Test**: Exercise the publication workflow in a non-publishing validation mode, verify its event and repository guards, then confirm that the authorized tag path would create exactly one v0.1.0 release with the declared assets and release notes.

**Acceptance Scenarios**:

1. **Given** an unmerged or untagged revision, **When** release validation runs, **Then** it can prove readiness without publishing or mutating a GitHub release.
2. **Given** the merged release commit and exact `v0.1.0` tag, **When** the authorized workflow completes, **Then** it publishes one GitHub release with the complete governed artifact and evidence inventory.
3. **Given** any version mismatch, missing artifact, missing Android update authority, failed platform build, or inconsistent public claim, **When** publication is attempted, **Then** publication fails before a release is created or assets are attached.

### Edge Cases

- A Windows or macOS artifact unexpectedly carries a third-party signature or notarization claim that is not declared by the community-release contract.
- An Android artifact is signed with a disposable candidate key, a different key from another Android artifact, or a fingerprint that differs from the configured stable update authority.
- A tag, package manifest, application manifest, technical specification, changelog, or release-note version differs from `0.1.0`.
- A release job is rerun after a partial failure or after a release with the same tag already exists.
- An artifact filename, checksum, size, source revision, SBOM digest, provenance digest, license, notice, or capability claim is missing or inconsistent.
- Paid signing credentials happen to exist but the v0.1.0 community contract does not authorize claims based on them.
- Manual validation issue #66 remains open when v0.1.0 is published.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The release preparation MUST set the product, application, package, technical specification, and release metadata version to exactly `0.1.0`.
- **FR-002**: The release preparation MUST reconcile every completed v0.1.0 slice into one truthful capability matrix, platform matrix, changelog, release note, license, notice, and privacy statement.
- **FR-003**: The governed artifact set MUST include the declared Windows x86_64 installer and portable archive, macOS universal disk image, Linux x86_64 AppImage and Debian package, Android universal APK, Android ARM64 APK, and Android application bundle.
- **FR-004**: Windows artifacts MUST be accepted for v0.1.0 publication with an explicit unsigned community trust state and MUST NOT require or claim Authenticode signing.
- **FR-005**: The macOS artifact MUST be accepted for v0.1.0 publication with its actual ad-hoc application signature and non-notarized disk-image state and MUST NOT require or claim Apple Developer ID signing, notarization, or Apple endorsement.
- **FR-006**: Linux artifacts MUST retain repository-bound attestations, checksums, SBOMs, provenance, clean-host package evidence, licenses, and notices without introducing a paid signing dependency.
- **FR-007**: Android release artifacts MUST be signed by one stable project-owned update key, MUST record and validate its public SHA-256 certificate fingerprint, and MUST keep private key material and passwords out of the repository, logs, artifacts, and evidence.
- **FR-008**: Pull-request and branch validation MUST remain non-publishing and MAY use disposable Android candidate authority only when its evidence is explicitly blocked from publication.
- **FR-009**: Every published artifact MUST have an exact SHA-256 checksum, CycloneDX SBOM, provenance record, Apache-2.0 license, required notices, source revision, version, and machine-readable trust-state evidence.
- **FR-010**: The release workflow MUST fail before publication on a missing artifact, failed platform gate, version mismatch, checksum mismatch, evidence mismatch, undeclared artifact, or missing stable Android update authority.
- **FR-011**: The publication workflow MUST accept only the `shruggietech/glitchpad` repository and exact `v0.1.0` tag and MUST use minimum required repository permissions.
- **FR-012**: The publication workflow MUST be idempotent or fail safely when the tag or release already exists, without silently replacing previously published final bytes.
- **FR-013**: Release notes MUST identify supported capabilities, known limits, local-only privacy behavior, platform baselines, Windows unsigned status, macOS non-notarized status, expected operating-system warnings, integrity verification steps, and the post-release validation and defect process.
- **FR-014**: User-facing installation guidance MUST use ordinary operating-system approval flows and MUST NOT instruct users to disable platform-wide security protections.
- **FR-015**: Manual platform receipts, physical-device checks, accessibility passes, and real-world validation tracked by issue #66 MUST remain explicitly deferred and MUST NOT block v0.1.0 publication.
- **FR-016**: Release preparation MUST include automated checks that detect stale paid-signing or notarization requirements and contradictory trust claims in governed v0.1.0 documentation and contracts.
- **FR-017**: Release preparation MUST validate the complete candidate path before pull-request publication and retain a verification receipt that records commands, outcomes, and intentional post-merge publication steps.
- **FR-018**: The pull request MUST prepare but MUST NOT create the `v0.1.0` tag or GitHub release; publication occurs only after owner review, merge, and the explicit release ritual.

### Key Entities

- **Release manifest**: The canonical v0.1.0 identity, source revision, artifact inventory, evidence inventory, trust policy, and publication state.
- **Platform artifact**: One installable or portable deliverable with a canonical name, platform, architecture, version, byte digest, size, trust state, and evidence references.
- **Trust state**: A closed vocabulary describing unsigned Windows, ad-hoc/non-notarized macOS, repository-attested Linux, stable-key Android, or blocked candidate authority without overstating third-party verification.
- **Android update authority**: The stable project-owned key identity represented in evidence only by its public certificate fingerprint.
- **Release evidence**: Checksums, SBOMs, provenance, licenses, notices, package inventories, platform receipts, and trust-state records bound to final artifact bytes.
- **Publication transaction**: The guarded transition from reviewed merged commit and exact tag to one immutable GitHub release and its governed assets.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: One validation run proves 100% version agreement across all governed v0.1.0 product, specification, package, and release metadata sources.
- **SC-002**: The release inventory contains exactly the eight declared installable or portable artifacts, with no missing or undeclared platform artifact.
- **SC-003**: Every declared artifact has matching checksum, SBOM, provenance, license/notice, source revision, version, and trust-state evidence, with zero digest mismatches.
- **SC-004**: Automated policy checks find zero paid Windows or Apple credential prerequisites and zero false third-party trust claims in governed v0.1.0 release surfaces.
- **SC-005**: Pull-request validation completes all repository, documentation, security, and platform package gates successfully before the release preparation is proposed for merge.
- **SC-006**: The publication path refuses 100% of tested invalid events, repositories, versions, incomplete inventories, and mismatched Android update fingerprints before creating a release.
- **SC-007**: Release notes identify all four platform families, all declared v0.1.0 capability families, both desktop trust warnings, and the post-release issue process in one reviewable document.
- **SC-008**: The final reviewed preparation can be published after merge through one explicit release ritual without purchasing a certificate, developer membership, notarization service, or store account.

## Assumptions

- GitHub Releases is the direct distribution channel for v0.1.0; store publication is outside this slice.
- The repository owner will securely retain the free Android update keystore and its recovery material before the tag is published.
- Windows and macOS users may encounter operating-system reputation or provenance warnings because the project deliberately declines paid trust programs.
- Existing S019-S022 package builders and evidence generators are the implementation baseline and will be revised rather than replaced.
- Issue #66 and defects discovered after publication are handled before v0.2 feature work but do not block this release.
- Active dependency-update pull requests are handled independently and should settle before the final release tag when they are compatible with v0.1.0.
