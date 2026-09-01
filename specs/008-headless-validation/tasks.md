# Tasks: Headless Windows Validation

**Input**: Design documents from `/specs/008-headless-validation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/validation-cli.md, quickstart.md

**Tests**: Required by FR-012, FR-013, and the P6 verification gate. Behavioral tests are written and observed failing before their implementations.

**Organization**: Tasks are grouped by user story so process safety, diagnostic parity, and maintenance protections can be reviewed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes a separate file without an incomplete dependency
- **[Story]**: Maps the task to a feature-specification user story
- Every implementation task names its exact repository path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the direct-validator test and script surfaces without adding dependencies.

- [x] T001 Add the focused `check:validation` test command and direct validator command targets to `package.json`
- [x] T002 [P] Create deterministic Markdown traversal tests and temporary-fixture helpers in `scripts/check-validation.test.mjs`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Supply one cross-platform, shell-free source-discovery contract shared by both validators.

- [x] T003 Implement parameterized deterministic Markdown discovery with preserved exclusion semantics in `scripts/validation-files.mjs`
- [x] T004 Run the traversal tests in `scripts/check-validation.test.mjs` and confirm paths with spaces and non-ASCII characters pass

**Checkpoint**: Both validator stories can consume the same stable content-selection primitive.

---

## Phase 3: User Story 1 - Validate without desktop interruption (Priority: P1) 🎯 MVP

**Goal**: Replace item-proportional nested launchers with direct Node validators and one reusable Mermaid browser.

**Independent Test**: Run the focused resource-count tests and the complete Windows documentation workflow; verify one validator process per command, one Mermaid browser for any nonempty diagram set, and zero visible or focus-stealing console windows.

### Tests for User Story 1

- [x] T005 [US1] Add initially failing tests for zero-browser empty input, exactly one browser across multiple diagrams, and browser cleanup after render failure in `scripts/check-validation.test.mjs`
- [x] T006 [US1] Add initially failing process-topology assertions for direct Node entry points and prohibited nested launcher tokens in `scripts/check-config.mjs`

### Implementation for User Story 1

- [x] T007 [US1] Implement deterministic Mermaid block extraction with one-based block and opening-line metadata in `scripts/check-mermaid.mjs`
- [x] T008 [US1] Implement one reusable Puppeteer browser, installed Mermaid programmatic rendering, GitHub Actions launch configuration, and `finally` cleanup in `scripts/check-mermaid.mjs`
- [x] T009 [US1] Implement the direct programmatic link-validator entry point and per-file URL context in `scripts/check-links.mjs`
- [x] T010 [US1] Activate the direct Node package scripts and focused test command in `package.json`, then retire `scripts/check-links.ps1` and `scripts/check-mermaid.ps1`
- [x] T011 [US1] Run `node --test scripts/check-validation.test.mjs`, `node scripts/check-config.mjs`, `pnpm docs:mermaid`, and `cargo xtask docs` and record the bounded-process and observed Windows results

**Checkpoint**: The reported desktop interruption is removed without restricting direct headless commands.

---

## Phase 4: User Story 2 - Receive equivalent, precise validation failures (Priority: P1)

**Goal**: Preserve full validation coverage while making every failure deterministic, actionable, and correctly propagated.

**Independent Test**: Run isolated valid and invalid fixtures; verify complete selection, exact source/link/block diagnostics, nonzero failure status, and browser cleanup.

### Tests for User Story 2

- [x] T012 [US2] Add initially failing tests for alive, dead, and error-status links with exact source and target diagnostics in `scripts/check-validation.test.mjs`
- [x] T013 [US2] Add initially failing tests for valid and malformed Mermaid blocks with exact source, ordinal, opening line, nonempty SVG, and launcher-error diagnostics in `scripts/check-validation.test.mjs`

### Implementation for User Story 2

- [x] T014 [US2] Aggregate link results, treat dead and error statuses as failures, preserve configuration, and emit deterministic diagnostics in `scripts/check-links.mjs`
- [x] T015 [US2] Aggregate Mermaid results, reject empty output, wrap launcher and renderer failures with source metadata, and preserve cleanup errors in `scripts/check-mermaid.mjs`
- [x] T016 [US2] Run the focused suite and both direct validators, confirming selected file and diagram counts plus real success and injected failure exit behavior

**Checkpoint**: The new topology provides equal or stronger validation with precise attribution.

---

## Phase 5: User Story 3 - Maintain the headless guarantee (Priority: P2)

**Goal**: Make the failure boundary and prohibited regression patterns explicit and enforceable.

**Independent Test**: Run configuration validation against the production scripts and injected prohibited source strings, then follow contributor guidance from direct validator checks through the full observed Windows run.

### Tests for User Story 3

- [x] T017 [US3] Add regression fixtures for nested package-manager, PowerShell, command-shell, process-spawning, and repeated browser-launch patterns in `scripts/check-validation.test.mjs`

### Implementation for User Story 3

- [x] T018 [US3] Export and enforce reusable validator-topology assertions from `scripts/check-config.mjs`
- [x] T019 [US3] Document the Windows visible-window failure boundary, approved direct Git and GitHub behavior, validator architecture, and troubleshooting path in `CONTRIBUTING.md`
- [x] T020 [P] [US3] Record Issue #101 and the headless-validation correction in `changelog.d/101.fixed.md`
- [x] T021 [US3] Run the complete quickstart from `specs/008-headless-validation/quickstart.md` and reconcile any documentation drift

**Checkpoint**: A future item-proportional nested-launch regression fails before merge.

---

## Phase 6: Polish & Cross-Cutting Verification

**Purpose**: Converge artifacts, prove repository-wide compatibility, and prepare the review handoff.

- [x] T022 Format all changed JavaScript, JSON, and Markdown and verify UTF-8 without BOM and no mojibake
- [x] T023 Run `cargo xtask check` to completion on Windows; record the passing topology evidence and leave desktop-window observation for explicit owner confirmation in the pull request
- [x] T024 Run Spec-Kit cross-artifact analysis and converge `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/validation-cli.md`, `quickstart.md`, and `tasks.md`
- [x] T025 Commit the coherent S008 change, push `codex/008-headless-validation`, and open a pull request that closes GitHub Issue #101
- [ ] T026 Wait for every required hosted check, inspect automated review comments, address warranted findings, respond under each reviewed comment, and resolve every responded thread

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately and creates the test entry points.
- **Foundational (Phase 2)**: Depends on setup and blocks both validators.
- **User Story 1 (Phase 3)**: Depends on the shared traversal helper and delivers the process-topology repair.
- **User Story 2 (Phase 4)**: Depends on the validator entry points and completes validation semantics.
- **User Story 3 (Phase 5)**: Depends on the final topology and diagnostics so its contract and guidance are accurate.
- **Polish (Phase 6)**: Depends on all user stories.

### User Story Dependencies

- **US1**: Depends only on the shared traversal foundation and delivers the MVP.
- **US2**: Builds on US1 entry points but is independently testable with injected validation results.
- **US3**: Enforces and documents the completed US1 and US2 behavior.

### Within Each User Story

- Add and observe the behavioral or contract test failing before implementing its protected behavior.
- Implement one long-lived process path before activating it in `package.json`.
- Validate real exit status and resource cleanup before advancing.

### Parallel Opportunities

- T002 can proceed independently from the package command setup in T001.
- T020 can proceed independently after terminology is stable.
- Hosted checks in T026 run in parallel after the pull request is opened.

## Implementation Strategy

### MVP First

1. Create the focused test surface.
2. Implement deterministic shared discovery.
3. Prove the one-browser Mermaid lifecycle and direct Node package entry points.
4. Run the full Windows documentation workflow and observe the desktop.

### Incremental Delivery

1. US1 removes the user-interface failure.
2. US2 proves validation parity and improves silent error handling.
3. US3 makes the repair durable through executable contracts and contributor guidance.
4. Repository-wide and hosted verification establish merge readiness.

## Notes

- Issue traceability: S008 closes GitHub Issue #101.
- No task adds a dependency, changes product runtime behavior, mutates hosting or DNS, or restricts direct Git and GitHub operations.
- T014 deliberately improves the baseline by failing error-status link results; the rationale is recorded in `plan.md` and `research.md`.
