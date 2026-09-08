# Tasks: v0.1.0 Release Publication

**Input**: Design documents from `/specs/026-v010-release/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/readiness-contract.md

## Phase 1: Setup

- [x] T001 Record the active S026 directory in `.specify/feature.json`

## Phase 2: Foundational

- [x] T002 Add failing secret-presence contract coverage in `scripts/check-community-release.test.mjs`

## Phase 3: User Story 1 - Prove publication readiness (Priority: P1)

**Goal**: Fail closed before publication when any Android update-authority secret is unavailable.

**Independent Test**: Run the community-release tests with the governed workflow fixture and mutated secret gates.

- [x] T003 [US1] Add the five-secret fail-closed readiness step in `.github/workflows/release.yml`
- [x] T004 [US1] Enforce the readiness gate structure in `scripts/check-community-release.mjs`

## Phase 4: User Story 2 - Review the exact release handoff (Priority: P2)

**Goal**: Give the owner a current, non-publishing handoff before the final merge and tag ritual.

**Independent Test**: Compare the runbook and receipt with the workflow and merged slice history.

- [x] T005 [P] [US2] Update the pre-tag ritual in `docs/releases/v0.1.0-operator-runbook.md`
- [x] T006 [P] [US2] Reconcile completed slices and publication state in `docs/releases/v0.1.0-receipt.md`

## Phase 5: Polish and verification

- [x] T007 Run focused community-release tests and policy validation from `specs/026-v010-release/quickstart.md`
- [x] T008 Run the complete repository gate and record results in `specs/026-v010-release/verification.md`
- [x] T009 Mark completed tasks and confirm UTF-8, formatting, and no tag/release mutation in `specs/026-v010-release/tasks.md`
- [x] T010 Correct tag-context readiness to reference the S025 brand manifest and integration guide
- [x] T011 Add regression coverage that rejects the removed pre-S025 brand evidence path
- [x] T012 Re-run focused policy validation and the exact tag-context readiness command before pushing the remediation
- [x] T013 Restore GitHub runner ownership of container-produced Linux evidence before tag-only promotion
- [x] T014 Enforce the assembly, ownership-handoff, and promotion ordering in community-release policy tests
- [x] T015 Re-run focused Linux and release policy validation before pushing the ownership remediation
- [x] T016 Execute the real Linux promotion mutation against container-produced evidence on every non-tag CI run, then restore candidate state
- [x] T017 Require the pre-merge promotion probe and exact tag promotion to share the same command in release-policy coverage

## Dependencies and execution order

T001 precedes all other tasks. T002 precedes T003 and T004. T003 and T004 must complete before T005-T006 are finalized. T007-T009 run after both user stories.

## Parallel opportunities

T005 and T006 affect independent documents and may be completed together after the readiness contract is implemented.

## Implementation strategy

Implement the fail-closed readiness gate first, then reconcile the operator handoff, run focused validation, and finish with the complete repository gate before any push.
