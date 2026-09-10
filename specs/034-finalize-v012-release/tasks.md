# Tasks: Finalize v0.1.2 Release

**Input**: Design documents from `/specs/034-finalize-v012-release/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/release-handoff.md

**Tests**: Active release handoff authority and security traceability require mutation coverage before document changes.

## Phase 1: Setup

- [x] T001 Record the S034 scope, epic #157 traceability, and S032-to-S034 authority correction in `specs/034-finalize-v012-release/spec.md`
- [x] T002 Record the release design and validation contract in `specs/034-finalize-v012-release/plan.md`, `research.md`, `data-model.md`, `contracts/release-handoff.md`, and `quickstart.md`

## Phase 2: Foundational

- [x] T003 Add failing final-handoff authority coverage in `scripts/check-community-release.test.mjs`
- [x] T004 Extend the live release policy to validate active notes, receipt, runbook, and changelog together in `scripts/check-community-release.mjs`

## Phase 3: User Story 1 - Tag the complete corrective release (Priority: P1)

**Goal**: Make the reviewed S034 merge commit the sole v0.1.2 publication source.

**Independent Test**: Mutation coverage fails when the active runbook points to S032 and passes only when it points to S034.

- [x] T005 [US1] Replace the stale S032 tag target with the reviewed S034 merge commit in `docs/releases/v0.1.2-operator-runbook.md`

## Phase 4: User Story 2 - Review an accurate release record (Priority: P2)

**Goal**: Reconcile the security remediation into every active release record.

**Independent Test**: The live release contract requires S033 and issue #167 across release notes, receipt, runbook, and changelog.

- [x] T006 [P] [US2] Add the S033 dependency maintenance and issue #167 traceability to `docs/releases/v0.1.2.md`
- [x] T007 [P] [US2] Add S033 and S034 slice authority, issue #167, and the final merge gate to `docs/releases/v0.1.2-receipt.md`
- [x] T008 [P] [US2] Record the patched dependency graph in `CHANGELOG.md`

## Phase 5: User Story 3 - Hand off one safe publication ritual (Priority: P3)

**Goal**: Deliver a non-publishing pull request whose reviewed merge is ready for exact-main release validation.

**Independent Test**: Focused and complete validation pass, the tag and release remain absent, and CI plus automated reviews settle cleanly.

- [x] T009 [US3] Run focused release-policy tests and live validation from `specs/034-finalize-v012-release/quickstart.md`
- [x] T010 [US3] Run the complete `cargo xtask check` repository gate before push
- [x] T011 [US3] Record validation, encoding, diff hygiene, historical-record preservation, and zero-publication evidence in `specs/034-finalize-v012-release/verification.md`
- [x] T012 [US3] Reconcile specification, plan, tasks, and implementation through analysis and convergence in `specs/034-finalize-v012-release/tasks.md`
- [x] T013 [US3] Push the branch and publish an official pull request against `main` with epic #157 traceability
- [ ] T014 [US3] Address every automated review and security comment individually, request no more than one second Codex round, and confirm all CI checks are green

## Dependencies and execution order

T001-T002 establish intent. T003 must fail before T004-T008 implement the contract and authority corrections. T005-T008 can proceed after the validator shape is known. T009-T012 validate the final source before T013. T014 completes only after the published pull request is fully green and review is settled.

## Parallel opportunities

T006-T008 affect separate release-record documents and can proceed after T004 defines the validator requirements.

## Implementation strategy

Prove the stale S032 boundary first, implement one active-handoff validator, reconcile only the four active release records, and run the full local gate before any push. Preserve all product and package authorities and leave publication for the post-merge owner ritual.
