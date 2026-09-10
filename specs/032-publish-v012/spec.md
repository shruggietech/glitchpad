# Feature Specification: Publish v0.1.2

**Feature Branch**: `codex/032-publish-v0-1-2`

**Created**: 2026-09-09

**Status**: Complete

**Input**: User description: "Prepare the v0.1.2 corrective release, automatically publish its pull request, complete no more than two Codex review rounds, and return when reviews are settled and CI is green."

**Tracking Issue**: [#157](https://github.com/shruggietech/glitchpad/issues/157)

## Issue Traceability

- #151: Repair README logo rendering.
- #152: Restore legible site lockups.
- #153: Align landing-page copy, attribution, actions, and navigation.
- #154: Deploy current release claims and prevent stale production content.
- #155: Correct technical-specification version and date authority.
- #156: Synchronize the authoritative brand kit.
- #159: Restore Android file-opener eligibility and delivery.
- #160: Prevent blank Markdown viewports.
- #161: Prevent raw Markdown source exposure while rendering.
- #162: Stabilize the compact application menu.
- #163: Remove the oversized README platforms badge.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Obtain the corrected application (Priority: P1)

As a Glitchpad user, I can obtain v0.1.2 packages that contain the public-presentation, desktop-rendering, and Android file-opening corrections completed in S029 through S031 while preserving the supported formats, privacy posture, platform coverage, and update continuity of v0.1.1.

**Why this priority**: The completed corrective work has user value only after consistent packages are published through the official release channel.

**Independent Test**: Inspect every v0.1.2 package candidate and verify its identity, correction inventory, platform trust state, and source revision against the release record.

**Acceptance Scenarios**:

1. **Given** merged S029 through S031 corrections, **When** v0.1.2 candidates are assembled, **Then** all eight governed packages identify as v0.1.2 and contain the corrected application.
2. **Given** a supported desktop or Android package, **When** a user opens released text or Markdown content through the operating system, **Then** the file reaches a usable content-first viewport under the corrected delivery behavior.
3. **Given** an existing Android installation signed by the project update authority, **When** the v0.1.2 Android package is inspected, **Then** it preserves signing identity and uses a greater version code than v0.1.1.

---

### User Story 2 - Review one immutable release handoff (Priority: P2)

As the release operator, I can review one internally consistent v0.1.2 handoff and, only after merge, create one exact tag that starts governed package publication without replacing either prior release.

**Why this priority**: Publication must not mix versions, source revisions, platform artifacts, or trust claims.

**Independent Test**: Run the non-publishing readiness path and release-policy gates, then verify that pull-request and manual runs cannot publish while the exact post-merge tag is the sole publication trigger.

**Acceptance Scenarios**:

1. **Given** an unmerged S032 pull request, **When** validation runs, **Then** no v0.1.2 tag or GitHub release is created.
2. **Given** a stale v0.1.1 identity in an active v0.1.2 authority or artifact path, **When** release validation runs, **Then** it fails before publication.
3. **Given** S032 is reviewed and merged into current `main`, **When** the owner authorizes the exact v0.1.2 tag, **Then** the governed workflows can publish one immutable release containing the complete inventory.

---

### User Story 3 - Reconcile the public release record (Priority: P3)

As a user or maintainer, I can identify v0.1.2 as the current release and understand its corrections, supported platforms, trust limitations, privacy behavior, and known limitations without encountering stale pre-release claims.

**Why this priority**: Public version and behavior claims must remain truthful when the release moves.

**Independent Test**: Validate the technical specification, changelog, release notes, release receipt, repository surface, and production-site source against one v0.1.2 authority.

**Acceptance Scenarios**:

1. **Given** the v0.1.2 preparation branch, **When** documentation validation runs, **Then** active documents agree on v0.1.2 while historical v0.1.0 and v0.1.1 records remain unchanged.
2. **Given** the release notes, **When** a user reads them, **Then** every corrective issue completed for v0.1.2 is traceable and no unshipped v0.2 capability is claimed.
3. **Given** a successful post-merge publication, **When** the production site is deployed, **Then** its current-version claims and download destination identify v0.1.2.

### Edge Cases

- The v0.1.2 tag or GitHub release already exists when publication is attempted.
- A platform workflow produces a stale v0.1.1 artifact, embedded version, receipt, or evidence filename.
- Candidate filenames agree while their embedded product versions or source revisions differ.
- The Android signing authority is absent or differs from the v0.1.1 update authority.
- A broad replacement accidentally rewrites immutable prior-release notes, receipts, runbooks, or completed specifications.
- A pull-request or manual readiness invocation reaches a publishing mutation.
- Production documentation deploys before the immutable release exists.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every active product, package, specification, release, and public version authority MUST agree on `0.1.2`.
- **FR-002**: Active v0.1.2 validation MUST reject stale v0.1.1 tags, artifact names, embedded versions, release metadata, and publication paths.
- **FR-003**: The release MUST retain exactly eight governed application packages across Windows, macOS, Linux, and Android.
- **FR-004**: Existing platform trust states MUST remain explicit: unsigned Windows, ad-hoc and non-notarized macOS, repository-attested Linux, and stable-project-key Android.
- **FR-005**: Official packages MUST retain checksums, software bills of materials, provenance, license and notice material, source revision, and machine-readable trust evidence.
- **FR-006**: Official v0.1.2 notes MUST describe the S029-S031 corrections, supported capabilities, platform requirements, installation warnings, privacy behavior, known limits, and feedback path.
- **FR-007**: The changelog and release receipt MUST reconcile the v0.1.2 corrective issues without altering immutable prior-release records.
- **FR-008**: Pull-request validation and manual readiness MUST perform zero tag or release mutations.
- **FR-009**: Publication MUST be restricted to the exact `v0.1.2` tag in `shruggietech/glitchpad` after S032 is reviewed and merged.
- **FR-010**: Release automation MUST refuse to replace an existing v0.1.2 release or accept an inconsistent source revision.
- **FR-011**: Required repository, documentation, security, package-policy, candidate, and lifecycle gates MUST pass before publication is described as ready.
- **FR-012**: Android packages MUST preserve the existing project-owned signing authority and use version code `1002`.
- **FR-013**: Issue #66 and post-release real-world validation MUST remain post-release work and MUST NOT block v0.1.2 preparation or publication.
- **FR-014**: S032 MUST NOT create the v0.1.2 tag or GitHub release before the owner-approved post-merge ritual.
- **FR-015**: The production-site release claim MUST move to v0.1.2 only through the governed release and deployment sequence.

### Key Entities

- **Corrective release identity**: Product version `0.1.2`, tag `v0.1.2`, Android version code `1002`, reviewed source revision, release notes, receipt, and current public claims.
- **Governed package inventory**: Eight platform packages plus their checksums, evidence, provenance, trust states, licenses, and update-authority attributes.
- **Publication handoff**: The reviewed and merged repository state from which one owner-approved tag may start official publication.
- **Historical release record**: Immutable v0.1.0 and v0.1.1 notes, receipts, runbooks, artifacts, tags, and completed feature specifications.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: One consistency run verifies 100% agreement across active version authorities at 0.1.2 and detects every tested stale v0.1.1 mutation.
- **SC-002**: Candidate and official inventories contain exactly eight uniquely named v0.1.2 application packages with complete evidence.
- **SC-003**: Pull-request and manual readiness runs perform zero tag creations, tag moves, release creations, or release replacements.
- **SC-004**: All required repository and platform checks complete successfully before the pull request is reported ready for merge.
- **SC-005**: The release record traces all eleven completed v0.1.2 child issues plus issue #157 with no contradictory active release claim.
- **SC-006**: Historical v0.1.0 and v0.1.1 release records remain byte-for-byte unchanged by S032.
- **SC-007**: After approval and merge, one documented annotated-tag action is sufficient to start governed v0.1.2 publication.

## Assumptions

- S029, S030, S031, and all eleven v0.1.2 child issues are merged and complete on `main`.
- v0.1.0 and v0.1.1 remain immutable published historical releases.
- The stable Android update key and protected release-authority values remain configured from prior releases.
- GitHub Releases remains the distribution channel; store enrollment and paid signing or notarization remain outside this release.
- No v0.2 image-viewing capability belongs in S032.
- Physical-device and subjective owner validation occurs after release and is tracked separately rather than gating publication.
