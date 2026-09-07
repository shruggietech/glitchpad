# Feature Specification: v0.1.0 Release Publication

**Feature Branch**: `codex/026-v010-release`

**Created**: 2026-09-07

**Status**: Complete

**Input**: User description: "Complete the final reviewed work slice before publishing Glitchpad v0.1.0, automatically push it for third-party review, and leave one explicit owner-approved merge and release ritual."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Prove publication readiness (Priority: P1)

As the release operator, I can run one non-publishing readiness workflow that confirms the repository release evidence and every required Android update-authority secret exist before a release tag is created.

**Why this priority**: The stable Android authority is the only external prerequisite not already represented by committed release evidence, and discovering that it is missing after tagging would create a broken release attempt.

**Independent Test**: Run the readiness path with complete and incomplete secret sets and verify that it succeeds only for the complete set without printing any secret value.

**Acceptance Scenarios**:

1. **Given** all five Android authority secrets and consistent v0.1.0 evidence, **When** readiness runs manually, **Then** it succeeds without publishing a tag or release.
2. **Given** any required Android authority secret is missing, **When** readiness runs manually or for the release tag, **Then** it fails before platform artifacts are gathered or a release is created.
3. **Given** readiness checks secret availability, **When** its logs are reviewed, **Then** no password, key material, alias value, encoded keystore, or fingerprint value is printed.

---

### User Story 2 - Review the exact release handoff (Priority: P2)

As the project owner, I can review a current receipt and operator ritual that account for every completed slice, distinguish preparation from publication, and state the precise actions that will make Glitchpad public after merge.

**Why this priority**: The first release must be understandable and deliberate without reviving completed feature work or deferred manual validation.

**Independent Test**: Compare the receipt, runbook, release issue, and automation and verify that they consistently identify S026 as the final publication-control slice and the v0.1.0 tag as the sole publishing event.

**Acceptance Scenarios**:

1. **Given** S001 through S025 are merged, **When** the final receipt is reviewed, **Then** it records those completed slices and identifies S026 as the final publication-control slice.
2. **Given** the S026 pull request has not been merged, **When** any S026 validation runs, **Then** no `v0.1.0` tag or GitHub release is created.
3. **Given** S026 is approved and merged and readiness passes, **When** the owner authorizes the release ritual, **Then** the exact merged commit can be tagged once to start publication.

### Edge Cases

- One or more secret values contain whitespace or shell-significant characters.
- A secret exists but is empty, or a similarly named secret is configured instead of the exact required name.
- The readiness workflow is dispatched from a branch other than current `main`.
- The tag already exists locally or remotely, or a GitHub release already exists for `v0.1.0`.
- A post-merge package workflow is still running or has failed when the operator prepares to tag.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The non-publishing readiness path MUST verify the presence of `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, and `ANDROID_SIGNING_CERT_SHA256`.
- **FR-002**: Secret readiness validation MUST fail when any required value is empty and MUST identify only the missing secret name.
- **FR-003**: Secret readiness validation MUST NOT print, persist, transform, or expose secret values.
- **FR-004**: The exact same secret-presence gate MUST protect manual readiness and tag-triggered publication.
- **FR-005**: Manual readiness MUST remain non-publishing and MUST NOT create or move a tag or release.
- **FR-006**: Publication MUST remain restricted to the exact `v0.1.0` tag in `shruggietech/glitchpad` after S026 is reviewed and merged.
- **FR-007**: The release runbook MUST require a successful manual readiness run from current `main` before tag creation.
- **FR-008**: The runbook MUST retain the stable, free, project-owned Android update key policy and prohibit repository storage of its private material and credentials.
- **FR-009**: The release documentation receipt MUST account for completed slices S001 through S025 and identify S026 as the final publication-control slice.
- **FR-010**: Automated contract tests MUST reject a release workflow that omits any required Android authority secret or the fail-closed availability gate.
- **FR-011**: Local repository, documentation, release-policy, and relevant package checks MUST pass before the pull request is published.
- **FR-012**: S026 MUST NOT create the `v0.1.0` tag or GitHub release; those mutations remain part of the owner-approved post-merge ritual.
- **FR-013**: Manual platform validation and defect discovery tracked after v0.1.0 MUST remain non-blocking for publication.
- **FR-014**: Manual release readiness MUST reject any source ref other than current `main`.

### Key Entities

- **Release authority set**: The five named secret values required to produce stable-key Android artifacts, represented in validation only by presence and never by their contents.
- **Readiness run**: A non-publishing evaluation of committed v0.1.0 evidence and external release prerequisites against a specific source revision.
- **Publication handoff**: The reviewed state that permits an owner-authorized `v0.1.0` tag on the exact merged S026 commit.
- **Release receipt**: The versioned record of completed preparation slices, governing policy, and publication state.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Readiness detects 100% of the five required Android authority secret names, fails for every tested single-secret omission, and rejects a manual run outside `main`.
- **SC-002**: Automated tests expose zero secret values in output or committed artifacts.
- **SC-003**: Manual readiness performs zero release or tag mutations.
- **SC-004**: The receipt accounts for all 25 completed slices preceding S026 with no stale S022 or S023 completion boundary.
- **SC-005**: All required pre-push repository and release-policy gates complete successfully before the pull request is opened.
- **SC-006**: After approval and merge, one documented tag action is sufficient to start creation of all eight governed public packages and their evidence.

## Assumptions

- S001 through S025 are merged into `main`, and issues #62 through #65 are closed.
- GitHub Actions repository secrets are the existing protected transport for the Android update authority.
- The project owner retains the keystore and recovery credentials outside the repository before authorizing the tag.
- The first public distribution channel is GitHub Releases; stores and paid trust programs remain outside v0.1.0.
- Issue #66 and defects found after publication remain post-release work and do not block S026 or v0.1.0.
