---
description: 'Implementation tasks for S033 dependency advisory remediation'
---

# Tasks: Clear v0.1.2 Dependency Advisories

**Input**: Design documents from `/specs/033-dependency-advisories/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup and Baseline

**Purpose**: Establish traceability and prove the pre-change security failure without changing release state.

- [x] T001 Confirm issue #167, current manifest authorities, lockfile resolutions, and absence of a v0.1.2 tag in `package.json`, `site/package.json`, `pnpm-lock.yaml`, and repository tags
- [x] T002 [US1] Run the high-severity package audit against the current lockfile and record the expected advisory failure

---

## Phase 2: User Story 1 - Remove Known Advisories (Priority: P1) 🎯 MVP

**Goal**: Resolve every currently reported high-or-critical package advisory through compatible patch versions.

**Independent Test**: A frozen install succeeds, the dependency graph resolves Next.js 16.3.3 and smol-toml 1.7.1, and the high-severity audit exits successfully.

- [x] T003 [US1] Change the exact Next.js dependency to 16.3.3 in `site/package.json`
- [x] T004 [US1] Add the narrow smol-toml 1.7.1 security override in `package.json`
- [x] T005 [US1] Regenerate `pnpm-lock.yaml` with the repository-pinned pnpm version
- [x] T006 [US1] Verify a frozen install and inspect the resolved Next.js and smol-toml dependency paths from `pnpm-lock.yaml`
- [x] T007 [US1] Run the high-severity package audit and confirm all five alert records are covered
- [x] T008 [US1] Verify the patched packages retain compatible engines and approved licenses using package metadata and `pnpm-lock.yaml`

**Checkpoint**: The repository dependency graph is reproducible and free of the known high-or-critical advisories.

---

## Phase 3: User Story 2 - Preserve v0.1.2 Release State (Priority: P1)

**Goal**: Prove the security remediation does not alter the planned release identity or package inventory.

**Independent Test**: Release checks pass with product version 0.1.2, Android version code 1002, eight release packages, and no v0.1.2 tag or published release.

- [x] T009 [US2] Run the community, public-release, and configuration authority checks against `release/manifest.json`, `package.json`, and platform manifests
- [x] T010 [US2] Confirm the diff contains no product-version, Android version-code, release-note, release-package, tag, or publication change

**Checkpoint**: v0.1.2 remains the unchanged release candidate.

---

## Phase 4: User Story 3 - Produce Reviewable Evidence (Priority: P2)

**Goal**: Deliver a small, traceable change with complete pre-push validation evidence.

**Independent Test**: Focused site checks and the full repository gate pass, artifacts are clean UTF-8 Markdown, and the pull request closes issue #167.

- [x] T011 [US3] Run the focused site validation command against `site/`
- [x] T012 [US3] Run the complete `cargo xtask check` repository gate before push
- [x] T013 [US3] Run diff hygiene, UTF-8, BOM, and mojibake checks across the changed files
- [x] T014 [US3] Reconcile `specs/033-dependency-advisories/spec.md`, `plan.md`, and `tasks.md` with the implemented diff using spec-kit analysis and convergence
- [x] T015 [US3] Publish a pull request that closes issue #167 and records advisory, license, release-invariant, and validation evidence
- [ ] T016 [US3] Address every automated review and security comment individually, request no more than one second Codex round, and confirm all CI checks are green

---

## Dependencies & Execution Order

- Phase 1 establishes the failing security baseline before implementation.
- Phase 2 depends on Phase 1 and produces the safe dependency graph.
- Phase 3 depends on Phase 2 because release checks must inspect the final graph.
- Phase 4 depends on Phases 2 and 3; publication is forbidden until all local checks pass.

## Implementation Strategy

Complete the security graph first, prove release invariants second, then run focused and full validation. Push and publish only after the local gates pass. Treat the automatic reviews as round one and request at most one explicit second Codex review round if changes warrant it.
