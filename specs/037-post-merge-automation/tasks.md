# Tasks: Post-Merge Publication and Branch Cleanup

**Input**: Design documents from `/specs/037-post-merge-automation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Workflow policy tests are required by FR-018 and precede the production workflow changes.

## Phase 1: Setup and baseline

**Purpose**: Establish traceable implementation scope and immutable-release evidence.

- [x] T001 Record the S037 scope, issue mappings, design decisions, and merge-dependent evidence in `specs/037-post-merge-automation/`
- [x] T002 Capture the current v0.1.2 tag, release, and asset inventory with the GitHub CLI before publication changes

---

## Phase 2: Foundational workflow contracts

**Purpose**: Make unsafe workflow shapes fail before implementation.

- [x] T003 [US1] Replace the obsolete release-only site deployment assertion with exact trusted-main-or-authorized-release policy tests in `scripts/check-public-release.test.mjs`
- [x] T004 [US3] Add negative mutation tests for cleanup trigger, permissions, checkout, repository gate, default-branch gate, SHA guard, 404 handling, and error propagation in `scripts/check-public-release.test.mjs`
- [x] T005 [US1] Extend source loading and policy validation for deployment authority and cleanup workflow shape in `scripts/check-public-release.mjs`
- [x] T006 [US3] Extend parsed configuration contracts for the cleanup workflow and shared Pages deployment lane in `scripts/check-config.mjs`
- [x] T007 Run `pnpm check:public-release` and confirm the new tests fail before workflow implementation

**Checkpoint**: The repository rejects the missing S037 workflow contracts.

---

## Phase 3: User Story 1 - Publish validated site changes after merge (Priority: P1)

**Goal**: Promote the exact successful protected-main static artifact while keeping PR runs validation-only and preserving immutable release publication.

**Independent Test**: Parse the workflow and run public-release policy tests to prove only protected-main pushes and the authorized reusable v0.1.2 call can upload/deploy, then verify a pull-request run skips deployment.

- [x] T008 [US1] Implement the exact shared deployment predicate on artifact upload and deploy in `.github/workflows/docs.yml`
- [x] T009 [US1] Add one shared production concurrency group and preserve minimum Pages permissions, build dependency, protected environment, and post-deploy provenance verification in `.github/workflows/docs.yml`
- [x] T010 [US1] Verify `.github/workflows/release.yml` retains its publish dependency, authorized reusable handoff, and immutable v0.1.2 gates without modification

**Checkpoint**: Successful trusted-main builds deploy the same artifact; PR and manual validation runs cannot deploy.

---

## Phase 4: User Story 2 - Read completed S036 documentation in production (Priority: P1)

**Goal**: Prepare the current S036 site artifact and verifier for exact post-merge production observation.

**Independent Test**: Build and verify the static site locally, then use the S037 merge run to verify exact production provenance and the complete sectioned-documentation contract.

- [x] T011 [US2] Run the full static-site build and verifier contract against the S037 revision with `pnpm check:site`
- [x] T012 [US2] Record local evidence and the exact pending post-merge production observation in `specs/037-post-merge-automation/quickstart.md`

**Checkpoint**: The sectioned site is locally complete and the merge-dependent observation is explicit.

---

## Phase 5: User Story 3 - Remove merged feature branches safely (Priority: P2)

**Goal**: Delete only an unchanged merged same-repository feature branch through trusted API-only automation.

**Independent Test**: Run the workflow source-contract suite for all eligibility, mismatch, absent-ref, success, and unexpected-failure cases, then observe S037 branch removal after merge.

- [x] T013 [US3] Add the close-event, least-privilege, no-checkout cleanup workflow in `.github/workflows/delete-merged-branch.yml`
- [x] T014 [US3] Implement current-ref lookup, absent-ref no-op, atomic reviewed-SHA lease, exact ref deletion, visible race outcomes, and propagated unexpected failures in `.github/workflows/delete-merged-branch.yml`

**Checkpoint**: Only the exact unchanged eligible branch can reach deletion.

---

## Phase 6: Convergence and handoff

**Purpose**: Prove the slice is reviewable, stable, and ready for its merge-dependent observations.

- [x] T015 Run configuration, public-release, formatting, Markdown, static-site, mojibake, and repository regression checks through the approved hidden container launcher
- [x] T016 Confirm the v0.1.2 tag, release record, and asset inventory are unchanged from T002
- [ ] T017 Push `codex/s037-post-merge-automation`, open the official pull request closing #170 and #135, and wait for all hosted CI and automatic reviews
- [ ] T018 Address every review comment, resolve every review thread, request exactly one `@codex review` second round, and return hosted checks to green
- [ ] T019 Hand off for the final review and merge ritual with the production revision and automatic branch removal explicitly marked as post-merge observations

## Dependencies and execution order

- Phase 1 precedes all implementation so release immutability and traceability have baselines.
- Phase 2 precedes workflow edits to satisfy test-first correctness.
- User Story 1 enables the production observation for User Story 2.
- User Story 3 is independently implementable after Phase 2.
- Convergence begins only after all three story checkpoints pass.

## Implementation strategy

Complete the work sequentially because the same validator files govern both workflow changes. Preserve the release workflow, keep all production authority declarative and auditable, and defer only the two observations that physically require the user-approved merge.
