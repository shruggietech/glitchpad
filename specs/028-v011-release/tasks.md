# Tasks: v0.1.1 Corrective Release

**Input**: Design documents from `/specs/028-v011-release/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/release-handoff.md

**Tests**: Release identity, stale-version rejection, package contracts, and publication guards require automated regression coverage before their implementation changes.

## Phase 1: Setup

- [x] T001 Record the active S028 directory in `.specify/feature.json`
- [x] T002 Create and link the v0.1.1 release tracker as issue #149 in `specs/028-v011-release/spec.md`

## Phase 2: Foundational

- [x] T003 Add failing v0.1.1 identity, stale v0.1.0 rejection, and Android version-code coverage in `scripts/check-community-release.test.mjs`, `scripts/check-android-package.test.mjs`, and the platform package test files
- [x] T004 Inventory active versus immutable historical version references in `specs/028-v011-release/verification.md`

## Phase 3: User Story 1 - Deliver the corrected public application (Priority: P1)

**Goal**: Produce a complete v0.1.1 candidate family containing S027 with consistent package identity and upgrade continuity.

**Independent Test**: Run the version and four platform package suites, then inspect the governed inventory for eight unique v0.1.1 packages and Android version code 1001.

- [x] T005 [US1] Update active product and embedded version authorities in `Cargo.toml`, `Cargo.lock`, `package.json`, `apps/glitchpad/package.json`, `apps/glitchpad/src/domain/persistence.ts`, `crates/glitchpad-core/src/lib.rs`, and `crates/glitchpad-host/`
- [x] T006 [US1] Update the five platform and aggregate package identities in `packaging/desktop/capabilities.json` and `packaging/*/package-contract.json`
- [x] T007 [US1] Update v0.1.1 tag guards, artifact names, and lifecycle paths in `.github/workflows/android-package.yml`, `.github/workflows/linux-package.yml`, `.github/workflows/macos-package.yml`, and `.github/workflows/windows-package.yml`
- [x] T008 [US1] Update active assembly, SBOM, promotion, and package-validation identities with their tests in `scripts/`
- [x] T009 [P] [US1] Update platform packaging guidance for v0.1.1 and Android code 1001 in `packaging/android/README.md`, `packaging/linux/README.md`, `packaging/macos/README.md`, and `packaging/windows/README.md`

## Phase 4: User Story 2 - Review and publish one immutable release (Priority: P2)

**Goal**: Reconcile the official patch record and leave one exact non-publishing handoff for owner approval.

**Independent Test**: Run version, documentation, release-readiness, and community-release policy gates and verify that only an exact post-merge v0.1.1 tag can publish.

- [x] T010 [US2] Move the active version-consistency and public-surface authorities to 0.1.1 in `scripts/check-version.ps1`, `scripts/check-public-surface.ps1`, `README.md`, `SECURITY.md`, `SUPPORT.md`, and the public site content
- [x] T011 [US2] Update the exact tag-only publication transaction and release assembly identities in `.github/workflows/release.yml`, `scripts/check-release-readiness.ps1`, `scripts/check-community-release.mjs`, and `scripts/assemble-community-release.mjs`
- [x] T012 [P] [US2] Reconcile current shipped behavior at v0.1.1 in `docs/glitchpad-technical-specification.md` and `CHANGELOG.md` while preserving the v0.1.0 historical section
- [x] T013 [P] [US2] Promote the S027 delta into official notes in `docs/releases/v0.1.1.md`
- [x] T014 [US2] Author the non-publishing handoff and exact post-merge ritual in `docs/releases/v0.1.1-receipt.md` and `docs/releases/v0.1.1-operator-runbook.md`

## Phase 5: User Story 3 - Make the remaining advisory decision explicit (Priority: P3)

**Goal**: Complete the existing S024 advisory decision without weakening dependency safety.

**Independent Test**: Reproduce the Linux inverse dependency graph, verify no direct affected API use, confirm the narrow cargo-deny entry and expiry, and inspect the GitHub alert disposition.

- [x] T015 [US3] Record current dependency-path, direct-use, compatibility, scope, owner, and expiry evidence in `specs/028-v011-release/verification.md`
- [x] T016 [US3] Formally dismiss GitHub alert #1 under the existing S024 tolerable-risk decision and record the exact disposition in `specs/028-v011-release/verification.md`

## Phase 6: Polish and verification

- [x] T017 Run focused version, release, platform-package, and documentation gates from `specs/028-v011-release/quickstart.md`
- [x] T018 Run the complete repository gate and record the real results in `specs/028-v011-release/verification.md`
- [x] T019 Mark completed tasks and confirm formatting, UTF-8 without BOM, mojibake absence, clean diff integrity, and zero pre-merge tag/release mutation in `specs/028-v011-release/tasks.md`

## Dependencies and execution order

T001-T002 establish traceability. T003 must precede T005-T011 so the version transition is proven by failing tests before implementation. T004 separates active authorities from historical evidence before mechanical edits. T005-T009 complete the package candidate identity before T010-T014 finalize the publication handoff. T015 must complete before T016. T017-T019 run after all user stories.

## Parallel opportunities

T009 can proceed independently after the package contracts are known. T012 and T013 affect separate documents and can be completed together after release identity is stable. Platform-specific tests and contracts may be edited together when their files do not overlap.

## Implementation strategy

First establish stale-version regression coverage, then move the complete candidate family to v0.1.1, reconcile the tag-only release transaction and current documentation, apply the already-approved advisory disposition, and finish with focused plus complete pre-push validation. Do not create a tag or GitHub release from this branch.
