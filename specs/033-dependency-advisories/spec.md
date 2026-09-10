# Feature Specification: Clear v0.1.2 Dependency Advisories

**Feature Branch**: `codex/033-dependency-advisories`

**Created**: 2026-09-10

**Status**: Complete

**Input**: User description: "Use S033 to clear the newly published release-blocking dependency advisories before v0.1.2, drive the work through validated implementation and review, and publish a pull request without expanding product scope."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Remove Known Release-Blocking Advisories (Priority: P1)

As the release maintainer, I need every dependency with a known critical or high advisory and an available compatible patch to resolve to a safe version so v0.1.2 is not published with avoidable known vulnerabilities.

**Why this priority**: The current default branch reports five release-blocking alerts, including critical advisories, and compatible patched versions are available.

**Independent Test**: Inspect the declared and resolved dependency authorities and verify that Next.js is at least 16.3.3 and `smol-toml` is at least 1.7.1, with no vulnerable resolution remaining.

**Acceptance Scenarios**:

1. **Given** the website directly declares Next.js 16.3.0, **when** S033 is complete, **then** the declaration and lockfile resolve a compatible patched version at or above 16.3.3.
2. **Given** repository lint tooling transitively resolves `smol-toml` 1.7.0, **when** S033 is complete, **then** the lockfile resolves a compatible patched version at or above 1.7.1 without adding it as an application runtime dependency.
3. **Given** GitHub reports duplicate alerts for direct and lockfile representations, **when** the branch is assessed, **then** all five alert records are covered by the two patched dependency resolutions.

---

### User Story 2 - Preserve the Prepared Release (Priority: P2)

As the product owner, I need the security patch to leave the prepared v0.1.2 product, artifact inventory, public claims, and release workflow unchanged except where dependency provenance necessarily changes.

**Why this priority**: S032 already established the release authority; unrelated changes would add risk and delay publication.

**Independent Test**: Compare the changed file set and run the release policy checks to confirm that the product version remains 0.1.2, the Android version code remains 1002, and the governed artifact inventory remains unchanged.

**Acceptance Scenarios**:

1. **Given** the v0.1.2 release authorities are internally consistent, **when** dependencies are patched, **then** product versions, release notes, supported capabilities, and artifact names remain unchanged.
2. **Given** the public site is a static export with image optimization disabled, **when** Next.js is patched, **then** the exported routes and browser-visible behavior continue to pass their existing checks.
3. **Given** this is a pre-publication pull request, **when** S033 completes, **then** it does not create or push the v0.1.2 tag or publish a GitHub release.

---

### User Story 3 - Supply Reviewable Security Evidence (Priority: P3)

As a reviewer, I need compact evidence that the advisory fixes are compatible, license-safe, fully validated, and traceable to issue #167.

**Why this priority**: A dependency-only change still requires evidence that it neither breaks the release nor introduces incompatible distribution terms.

**Independent Test**: Review the dependency diff, provenance, validation record, pull-request traceability, security checks, and CI results without relying on undocumented local state.

**Acceptance Scenarios**:

1. **Given** the dependency changes are ready, **when** the pull request is opened, **then** it identifies the advisories, patched versions, test evidence, and issue #167.
2. **Given** third-party review or security checks raise an actionable finding, **when** it is received, **then** the finding is answered individually and resolved through a validated change or a documented evidence-based disposition.

### Edge Cases

- A compatible direct dependency patch may also update transitive peer-resolution metadata; those mechanical lockfile changes are permitted only when they are attributable to the patched dependency graph.
- If the existing transitive dependency range does not admit `smol-toml` 1.7.1, the narrowest package-manager-supported resolution constraint may be used, but `smol-toml` must not become a shipped application dependency.
- If a patched dependency breaks the static export, browser contract, license policy, or release gate, publication remains blocked until compatibility is restored or the dependency strategy is revised.
- GitHub may take time after merge to recalculate Dependabot alerts; alert-state lag is monitored separately from the branch's deterministic version evidence.
- A future lockfile refresh must not silently reintroduce a vulnerable resolution covered by this slice.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The website MUST directly declare and resolve Next.js 16.3.3 or a later compatible patched version that clears GHSA-2xp9-vwfh-vxw4 and GHSA-p293-qw3h-jr36.
- **FR-002**: Repository tooling MUST resolve `smol-toml` 1.7.1 or a later compatible patched version that clears GHSA-7w5x-hrqm-74c2.
- **FR-003**: `smol-toml` MUST remain development-only and MUST NOT be added to the desktop, Android, or website runtime dependency declarations.
- **FR-004**: The lockfile MUST be regenerated by the pinned package manager and remain deterministic under frozen installation.
- **FR-005**: The dependency changes MUST retain Apache-2.0-compatible licensing and MUST pass the repository dependency, advisory, and secret-scanning policies.
- **FR-006**: Product version 0.1.2, Android version code 1002, supported capabilities, public copy, package inventory, and release artifact names MUST remain unchanged.
- **FR-007**: The static website export, browser routes, documentation, shared frontend, native hosts, platform packages, and release policies MUST pass their existing validation gates before push.
- **FR-008**: The implementation MUST be traceable to GitHub issue #167 and the v0.1.2 corrective-release milestone.
- **FR-009**: The S033 branch MUST NOT create or publish the v0.1.2 tag, release, or production deployment.
- **FR-010**: Every actionable automated review finding MUST receive an individual response and resolution, with no more than two Codex review rounds requested in total.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All five currently open Dependabot alert records are covered by resolved versions outside their vulnerable ranges.
- **SC-002**: A frozen dependency installation succeeds with zero lockfile changes.
- **SC-003**: The complete repository validation gate exits successfully before the first push.
- **SC-004**: The changed implementation contains zero product behavior, version, public-copy, or release-inventory changes.
- **SC-005**: Pull-request CI and security checks complete with zero failures and all review threads are resolved.
- **SC-006**: The v0.1.2 tag and GitHub release remain absent throughout the pull-request phase.

## Assumptions

- Next.js 16.3.3 and `smol-toml` 1.7.1 are the first patched versions reported by GitHub for the active advisories.
- The website remains a static export with image optimization disabled; no Next.js server is deployed by this repository.
- The dependency graph can accept both patch releases without a framework migration or product behavior change.
- GitHub will recalculate alert state after the patched lockfile reaches the default branch; that external recalculation is not simulated locally.
- The already-approved v0.1.2 release procedure begins only after this pull request is merged.
