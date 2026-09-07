# Feature Specification: Consolidated Dependency Maintenance

**Feature Branch**: `codex/024-dependency-maintenance`

**Created**: 2026-09-07

**Status**: In progress

**Input**: Consolidate the outstanding Dependabot pull requests into one reviewable maintenance change before the first release, accepting only updates that are compatible and justified.

## User Scenarios & Testing

### User Story 1 - Release-ready dependency baseline (Priority: P1)

As the release owner, I want compatible dependency updates consolidated into one change so that the v0.1 release starts from a current, tested baseline without inheriting unnecessary major-version risk.

**Why this priority**: The first release is the immediate project goal, and dependency churn should be resolved without delaying it.

**Independent Test**: Review the resulting manifests and lockfiles, then run the repository aggregate validation gate successfully before publication.

**Acceptance Scenarios**:

1. **Given** the open Dependabot proposals, **When** each is compared with the current toolchain and dependency authorities, **Then** compatible maintenance updates are represented in one branch and superseded proposals are closed with a reason.
2. **Given** the consolidated dependency state, **When** the full local validation gate runs, **Then** it completes successfully before a pull request is published.
3. **Given** a proposal that is stale, incompatible, or an unjustified major upgrade, **When** the audit is completed, **Then** it is excluded without weakening an urgent security fix.

### Edge Cases

- A bot branch may target versions already superseded by the current main branch.
- A transitive advisory may have no compatible direct upgrade within the current framework dependency graph.
- A major dependency update may compile but still exceed the risk appropriate for a pre-release maintenance slice.

## Requirements

### Functional Requirements

- **FR-001**: S024 MUST audit every Dependabot pull request open at the start of the slice.
- **FR-002**: S024 MUST consolidate compatible and release-appropriate updates into one pull request.
- **FR-003**: S024 MUST preserve the repository's Node 24 and TypeScript 6 authorities unless an intentional toolchain migration is separately justified.
- **FR-004**: S024 MUST exclude stale, incompatible, or non-urgent major updates and close their superseded bot pull requests with a concise rationale.
- **FR-005**: S024 MUST record the disposition of any known dependency advisory that cannot be safely resolved in this slice.
- **FR-006**: S024 MUST pass the complete local aggregate validation gate before publication.
- **FR-007**: S024 MUST NOT publish a release, create a release tag, or change product behavior.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All ten Dependabot pull requests open at slice start have an explicit included or excluded disposition.
- **SC-002**: One consolidated maintenance pull request replaces the compatible bot proposals.
- **SC-003**: The aggregate local validation gate exits successfully before the pull request is opened.
- **SC-004**: All pull-request CI checks pass and every automatic review comment is answered and resolved.

## Assumptions

- User acceptance testing remains deferred until after v0.1 and is not a closure gate for this maintenance slice.
- Paid Windows signing and Apple notarization are outside the project requirements.
- The current Tauri dependency family remains authoritative unless a safe, bounded update is available through normal resolution.
