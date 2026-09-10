# Tasks: Publish v0.1.2

**Input**: Design documents from `/specs/032-publish-v012/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/release-handoff.md

**Tests**: Release identity, stale-version rejection, package contracts, publication guards, and public claims require automated regression coverage before implementation changes.

## Phase 1: Setup

- [x] T001 Record the active S032 directory in `.specify/feature.json`
- [x] T002 Link release epic #157 and its eleven completed child issues in `specs/032-publish-v012/spec.md`

## Phase 2: Foundational

- [x] T003 Add failing v0.1.2 identity, stale v0.1.1 rejection, Android version-code, release-workflow, and public-surface coverage in `scripts/*.test.mjs`, `scripts/**/*.test.mjs`, and `site/tests/`
- [x] T004 Inventory active versus immutable historical version references in `specs/032-publish-v012/verification.md`

## Phase 3: User Story 1 - Obtain the corrected application (Priority: P1)

**Goal**: Produce a complete v0.1.2 candidate family containing S029-S031 with consistent package identity and update continuity.

**Independent Test**: Run version and four platform package suites, then inspect the governed inventory for eight unique v0.1.2 packages and Android version code 1002.

- [x] T005 [US1] Update active product and embedded version authorities in `Cargo.toml`, `Cargo.lock`, `package.json`, `apps/glitchpad/package.json`, `site/package.json`, `apps/glitchpad/src/domain/persistence.ts`, `crates/glitchpad-core/src/lib.rs`, and `crates/glitchpad-host/`
- [x] T006 [US1] Update the platform and aggregate package identities in `packaging/desktop/capabilities.json` and `packaging/*/package-contract.json`
- [x] T007 [US1] Update v0.1.2 tag guards, artifact names, and lifecycle paths in `.github/workflows/android-package.yml`, `.github/workflows/linux-package.yml`, `.github/workflows/macos-package.yml`, and `.github/workflows/windows-package.yml`
- [x] T008 [US1] Update active assembly, SBOM, promotion, and package-validation identities with their tests in `scripts/`
- [x] T009 [P] [US1] Update platform packaging guidance for v0.1.2 and Android code 1002 in `packaging/android/README.md`, `packaging/linux/README.md`, `packaging/macos/README.md`, and `packaging/windows/README.md`

## Phase 4: User Story 2 - Review one immutable release handoff (Priority: P2)

**Goal**: Leave one exact, non-publishing v0.1.2 handoff for owner approval.

**Independent Test**: Run version, release-readiness, community-release, and package-policy gates and verify that only an exact post-merge v0.1.2 tag can publish.

- [x] T010 [US2] Update the exact tag-only publication transaction and release assembly identities in `.github/workflows/release.yml`, `scripts/check-release-readiness.ps1`, `scripts/check-community-release.mjs`, and `scripts/assemble-community-release.mjs`
- [x] T011 [US2] Add stale-v0.1.1 mutation coverage and preserve immutable prior-release inputs in `scripts/check-community-release.test.mjs` and `scripts/assemble-community-release.test.mjs`
- [x] T012 [US2] Author the non-publishing handoff and exact post-merge ritual in `docs/releases/v0.1.2-receipt.md` and `docs/releases/v0.1.2-operator-runbook.md`

## Phase 5: User Story 3 - Reconcile the public release record (Priority: P3)

**Goal**: Make current repository and public-site sources describe v0.1.2 accurately without altering historical records.

**Independent Test**: Run version, documentation, public-surface, and site export gates and verify active claims resolve to v0.1.2 while prior release records remain unchanged.

- [x] T013 [US3] Move active version-consistency and public-surface authorities to 0.1.2 in `scripts/check-version.ps1`, `scripts/check-public-surface.ps1`, `scripts/check-public-release.mjs`, `README.md`, `SECURITY.md`, `SUPPORT.md`, and `.github/workflows/docs.yml`
- [x] T014 [US3] Update active site source and tests to v0.1.2 in `site/app/`, `site/components/`, `site/scripts/`, `site/content/`, and `site/tests/`
- [x] T015 [US3] Reconcile shipped v0.1.2 behavior in `docs/glitchpad-technical-specification.md` and `CHANGELOG.md` while preserving historical sections
- [x] T016 [US3] Promote the corrective delta into official release notes in `docs/releases/v0.1.2.md`

## Phase 6: Polish and verification

- [x] T017 Run focused version, release, platform-package, public-site, and documentation gates from `specs/032-publish-v012/quickstart.md`
- [x] T018 Run the complete repository gate and record real results in `specs/032-publish-v012/verification.md`
- [x] T019 Confirm formatting, UTF-8 without BOM, mojibake absence, clean diff integrity, historical-record preservation, and zero pre-merge tag or release mutation in `specs/032-publish-v012/verification.md`
- [x] T020 Mark completed tasks and confirm the implementation satisfies every requirement in `specs/032-publish-v012/tasks.md`

## Dependencies and execution order

T001-T002 establish traceability. T003 precedes T005-T016 so the transition is exercised as a failing test before implementation. T004 separates active authorities from immutable history before mechanical edits. T005-T009 complete package candidate identity before T010-T012 finalize publication. T013-T016 reconcile public records after release identity is stable. T017-T020 run after all user stories.

## Parallel opportunities

T009 can proceed after package contracts are known. Platform-specific tests and workflows can be updated together when files do not overlap. T012 and T016 affect separate release documents. Site and technical-specification work can proceed independently after active version authority is settled.

## Implementation strategy

Establish stale-version regression coverage, move the complete candidate family to v0.1.2, reconcile exact-tag publication and current public documentation, then finish with focused and complete pre-push validation. Do not create a tag or GitHub release from this branch.
