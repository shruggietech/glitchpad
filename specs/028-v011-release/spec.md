# Feature Specification: v0.1.1 Corrective Release

**Feature Branch**: `codex/028-v011-release`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "Prepare the S027 content-first correction as v0.1.1, automatically push an official pull request, complete no more than two Codex review rounds, and return only when reviews are settled and CI is green."

**Tracking Issue**: [#149](https://github.com/shruggietech/glitchpad/issues/149)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Deliver the corrected public application (Priority: P1)

As a Glitchpad user, I can obtain a v0.1.1 package that contains the content-first corrections from S027 while retaining the supported formats, platform coverage, privacy posture, and update continuity of v0.1.0.

**Why this priority**: The existing public version exposes a severely defective first-run and file-opening experience, so corrected packages must be the next product delivery.

**Independent Test**: Inspect and exercise every v0.1.1 package candidate and verify that its identity is v0.1.1, its content-first behavior matches S027, and its platform trust state remains truthful.

**Acceptance Scenarios**:

1. **Given** the reviewed S027 correction, **When** v0.1.1 candidates are assembled, **Then** all eight governed packages identify as v0.1.1 and contain the corrected application.
2. **Given** a v0.1.1 desktop package, **When** a user launches it or opens TXT and Markdown files, **Then** production starts without synthetic documents and real file content owns the viewport.
3. **Given** an existing Android installation signed by the project update authority, **When** the v0.1.1 Android package is inspected, **Then** it preserves the stable signing identity required for upgrades.

---

### User Story 2 - Review and publish one immutable release (Priority: P2)

As the release operator, I can review one consistent release handoff and, only after merge, create one exact tag that triggers the governed package and publication workflows without replacing v0.1.0.

**Why this priority**: Patch publication must be deliberate, reproducible, and unable to mix old and new artifact identities.

**Independent Test**: Run the non-publishing readiness path and release-policy gates, then verify that pull-request and manual runs cannot publish while the exact post-merge tag is the sole publication trigger.

**Acceptance Scenarios**:

1. **Given** an unmerged S028 pull request, **When** validation runs, **Then** no v0.1.1 tag or release is created.
2. **Given** any stale v0.1.0 release identity in an active v0.1.1 authority or artifact path, **When** release validation runs, **Then** it fails before publication.
3. **Given** S028 is merged into current `main` and readiness succeeds, **When** the owner authorizes the exact v0.1.1 tag, **Then** the existing governed workflow can publish one immutable release containing the complete inventory.

---

### User Story 3 - Make the remaining advisory decision explicit (Priority: P3)

As a user or maintainer, I can see why the remaining `glib` advisory has a bounded exception, what platform and dependency path it affects, what limits exposure, and when that exception must be removed or reviewed.

**Why this priority**: Shipping while silently ignoring a runtime advisory would undermine the release evidence, while forcing an incompatible dependency combination would make the package less safe.

**Independent Test**: Compare the advisory record, dependency graph, and governing S024 decision and verify that the disposition is narrow, time-bounded, discoverable, and does not weaken treatment of other advisories.

**Acceptance Scenarios**:

1. **Given** the current supported dependency graph, **When** the advisory is reviewed, **Then** the record identifies the affected Linux-only transitive Tauri/GTK path and the absence of direct use of the affected iterator API.
2. **Given** no compatible upstream Tauri transition exists, **When** the release is prepared, **Then** no unsupported direct `glib` override or mixed GTK dependency family is introduced.
3. **Given** the exception remains necessary, **When** its disposition is inspected, **Then** it retains the S024 owner, scope, rationale, and expiry at the first compatible Tauri GTK transition or the v0.2 dependency pass.

### Edge Cases

- The v0.1.1 tag or release already exists when publication is attempted.
- One platform workflow publishes a stale v0.1.0 artifact or evidence filename.
- Package candidates agree on filenames but embed a stale product version or source revision.
- The Android signing authority is absent or differs from the v0.1.0 update authority.
- A version bump accidentally rewrites immutable v0.1.0 release notes, receipt, or historical Spec Kit evidence.
- The transitive `glib` dependency becomes upgradable before S028 merges.
- A pull-request or manual readiness invocation reaches a publishing step.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every active product, package, specification, release, and public version authority MUST agree on `0.1.1`.
- **FR-002**: Active v0.1.1 validation MUST reject stale v0.1.0 tags, artifact names, embedded versions, release notes, and publication paths.
- **FR-003**: The release MUST retain exactly eight governed application packages across Windows, macOS, Linux, and Android.
- **FR-004**: The Windows unsigned, macOS ad-hoc and non-notarized, Linux repository-attested, and Android stable-project-key trust states MUST remain explicit and unchanged.
- **FR-005**: Official packages MUST retain checksums, software bills of materials, provenance, license and notice material, source revision, and machine-readable trust evidence.
- **FR-006**: The official v0.1.1 release notes MUST describe the S027 content-first corrections, supported capabilities, platform requirements, installation warnings, privacy behavior, known limits, and feedback path.
- **FR-007**: The changelog and release receipt MUST reconcile S027 and S028 without altering the immutable v0.1.0 historical record.
- **FR-008**: Pull-request validation and manual readiness MUST perform zero tag or release mutations.
- **FR-009**: Publication MUST be restricted to the exact `v0.1.1` tag in `shruggietech/glitchpad` after S028 is reviewed and merged.
- **FR-010**: Release automation MUST refuse to replace an existing v0.1.1 release or accept an inconsistent source revision.
- **FR-011**: All platform package-policy, clean-install lifecycle, documentation, security, and repository gates MUST pass before publication is described as ready.
- **FR-012**: The Android packages MUST use the existing stable project-owned signing authority and preserve upgrade continuity.
- **FR-013**: GHSA-wrw7-89jp-8q8g MUST receive a formal disposition that cites the existing S024 scope, rationale, owner, and expiry.
- **FR-014**: The advisory disposition MUST NOT add an incompatible direct dependency override, mix GTK dependency families, or weaken enforcement for any other unsound advisory.
- **FR-015**: The advisory exception MUST expire at the first compatible Tauri GTK transition or the v0.2 dependency pass, whichever occurs first.
- **FR-016**: Issue #66 and manual real-world validation MUST remain post-release work and MUST NOT block v0.1.1 preparation or publication.
- **FR-017**: S028 MUST NOT create the v0.1.1 tag or GitHub release before the owner-approved post-merge ritual.

### Key Entities

- **Patch release identity**: The `0.1.1` product version, `v0.1.1` tag, source revision, release notes, receipt, and active public claims that must agree.
- **Governed package inventory**: The eight platform application packages and their checksums, evidence, trust states, and update-authority attributes.
- **Publication handoff**: The reviewed and merged repository state from which one owner-approved tag may start official publication.
- **Advisory disposition**: The narrow, time-bounded record for the transitive Linux `glib` advisory and its required re-evaluation boundary.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: One consistency run verifies 100% agreement across all active version authorities at 0.1.1 and detects each tested stale v0.1.0 mutation.
- **SC-002**: Candidate and official inventories contain exactly eight uniquely named v0.1.1 application packages with complete evidence.
- **SC-003**: Pull-request and manual readiness runs perform zero tag creations, tag moves, release creations, or release replacements.
- **SC-004**: All required repository and platform checks complete successfully before the pull request is reported ready for merge.
- **SC-005**: The release record accounts for all seven S027 issues and issue #149 with no contradictory v0.1.0 claim in active documentation.
- **SC-006**: The remaining advisory disposition names one exact advisory, one affected platform family, one transitive dependency path, and one enforceable expiry boundary without suppressing unrelated advisories.
- **SC-007**: After approval and merge, one documented annotated-tag action is sufficient to start the governed v0.1.1 publication workflow.

## Assumptions

- S027 and issues #141 through #147 are merged and complete on `main`.
- v0.1.0 remains an immutable published historical release and is never replaced.
- The stable Android update key and all five protected release-authority values remain configured from v0.1.0.
- The S024 exception for RUSTSEC-2024-0429 remains the governing security decision unless a compatible upstream Tauri dependency transition appears during S028.
- GitHub Releases remains the distribution channel; store enrollment and paid signing or notarization remain outside this patch.
- No v0.2 image-viewing feature work belongs in S028.
