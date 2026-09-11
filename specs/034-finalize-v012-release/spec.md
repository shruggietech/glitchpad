# Feature Specification: Finalize v0.1.2 Release

**Feature Branch**: `codex/034-finalize-v012-release`

**Created**: 2026-09-10

**Status**: Complete

**Input**: User description: "Finalize S034 through Spec Kit autopilot, publish a pull request, address automated reviews, and return only when review is settled and CI is green."

**Tracking Issue**: [#157](https://github.com/shruggietech/glitchpad/issues/157)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Tag the complete corrective release (Priority: P1)

As the release operator, I can tag the reviewed S034 merge commit knowing it contains the prepared v0.1.2 release plus the S033 dependency-security remediation.

**Why this priority**: The existing runbook points to S032, which would omit the security fixes merged afterward.

**Independent Test**: Inspect the v0.1.2 release handoff and verify that every publication instruction identifies the reviewed S034 merge commit as the sole tag target.

**Acceptance Scenarios**:

1. **Given** S033 is merged after S032, **When** the operator follows the v0.1.2 runbook, **Then** the tag target is the reviewed S034 merge commit rather than the older S032 commit.
2. **Given** S034 is still under review, **When** pull-request validation runs, **Then** no tag, release, or production deployment is created.

---

### User Story 2 - Review an accurate release record (Priority: P2)

As a user or reviewer, I can see that v0.1.2 includes the dependency advisory fixes from S033 and issue #167 alongside the previously prepared corrective work.

**Why this priority**: Release notes, the changelog, and the release receipt must describe the bytes that will actually ship.

**Independent Test**: Validate the release notes, receipt, runbook, and changelog as one handoff and confirm S033 and #167 are present with no stale S032 publication authority.

**Acceptance Scenarios**:

1. **Given** the final v0.1.2 source includes S033, **When** a reviewer reads the release record, **Then** the compatible Next.js and `smol-toml` security patches and issue #167 are traceable.
2. **Given** a stale S032-only tag instruction is introduced, **When** release-policy validation runs, **Then** it fails before publication.

---

### User Story 3 - Hand off one safe publication ritual (Priority: P3)

As the product owner, I receive a reviewed pull request with green checks and a precise post-merge ritual that can publish v0.1.2 without replacing an existing release.

**Why this priority**: Publication must remain a deliberate owner action after review rather than a pull-request side effect.

**Independent Test**: Run the focused release policy and complete repository gates, then verify the v0.1.2 tag and GitHub release remain absent during the pull request.

**Acceptance Scenarios**:

1. **Given** S034 has passed local validation and automated review, **When** its pull request is ready, **Then** all required CI checks are green and every review thread is resolved.
2. **Given** the owner has not completed the merge ritual, **When** S034 concludes, **Then** the tag and release remain absent.

### Edge Cases

- The exact S034 merge commit is not yet known while the pull request is open.
- A release document mentions S033 but omits issue #167, or vice versa.
- A historical S032 specification legitimately retains its original non-publishing boundary.
- The v0.1.2 tag or GitHub release appears before S034 is merged.
- One of the exact-main package workflows fails or remains incomplete.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The active v0.1.2 publication runbook MUST identify the reviewed S034 merge commit as the only valid tag target.
- **FR-002**: The active v0.1.2 release notes, receipt, and changelog MUST record the S033 dependency-security remediation.
- **FR-003**: Issue #167 MUST appear in the final v0.1.2 release traceability and receipt.
- **FR-004**: Automated release-policy validation MUST reject active handoff text that points publication at S032 or omits S033 or issue #167.
- **FR-005**: Historical S032 and S033 Spec Kit records MUST remain unchanged.
- **FR-006**: Product version 0.1.2, Android version code 1002, the eight-package inventory, supported capabilities, and platform trust states MUST remain unchanged.
- **FR-007**: S034 pull-request work MUST NOT create or push the v0.1.2 tag, publish a GitHub release, or deploy the production site.
- **FR-008**: Focused release policy checks and the complete repository validation gate MUST pass before the first push.
- **FR-009**: Every actionable Codex or security review comment MUST receive an individual response and resolution, with no more than two Codex review rounds in total.
- **FR-010**: The final handoff MUST remain blocked until the S034 pull request is merged and exact-main release readiness is green.

### Key Entities

- **Final release authority**: The reviewed S034 merge commit, exact `v0.1.2` tag, release workflow, and owner-controlled publication action.
- **Release record**: The release notes, changelog, receipt, and operator runbook that describe the final source and corrections.
- **Security remediation**: S033 and issue #167, which patched Next.js and `smol-toml` without changing product scope.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All four active release-record documents identify the final handoff consistently, with zero stale S032 tag instructions.
- **SC-002**: Automated mutation tests reject 100% of covered stale-boundary, missing-slice, and missing-issue cases.
- **SC-003**: Product and package authorities retain 100% agreement at version 0.1.2 with exactly eight governed application packages.
- **SC-004**: The complete local repository gate exits successfully before the branch is pushed.
- **SC-005**: Pull-request CI completes with zero failures and every automated review thread is resolved.
- **SC-006**: Zero tags, releases, or production deployments are created during the S034 pull-request phase.

## Assumptions

- S029 through S033 are merged on `main` and S033 is the final implementation change before this authority-only slice.
- Issue #157 remains the release epic and is closed only after successful publication and production deployment.
- The stable Android signing authority remains configured and recoverable outside the repository.
- The owner will explicitly approve and merge S034 before the tag is created.
