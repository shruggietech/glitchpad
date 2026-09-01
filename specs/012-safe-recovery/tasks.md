# Tasks: Conflict-Safe Recovery

**Input**: Design documents from `specs/012-safe-recovery/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: S012 requires tests first for every safety transition, persistence failure, quota/expiry boundary, redaction rule, and interface resolution flow.

**Organization**: Tasks are grouped by independently testable user story while preserving Issue #50 and FR/SC traceability.

## Phase 1: Setup and contract authority

**Purpose**: Establish the direct dependencies and versioned portable vocabulary used by every story.

- [x] T001 Add the reviewed direct SHA-256 dependency and make atomic-write-file cross-platform in `Cargo.toml`, `crates/glitchpad-core/Cargo.toml`, and `crates/glitchpad-host/Cargo.toml`
- [x] T002 [P] Add recovery, save-operation, integrity, transition, and coverage contract fixtures in `crates/glitchpad-core/tests/contract_schema.rs`
- [x] T003 [P] Mirror the portable S012 contracts in `apps/glitchpad/src/domain/contracts.ts`
- [x] T004 Add Issue #50 traceability and the user-visible recovery increment in `changelog.d/50.added.md`

**Checkpoint**: Portable vocabulary and license authority are ready before policy implementation.

---

## Phase 2: Foundational recovery policy

**Purpose**: Define bounded records, hashing, validation, scheduling, expiry, quota policy, and redacted outcomes shared by all platforms.

- [x] T005 [P] Write failing record validation, checksum, timestamp, bound, and redaction tests in `crates/glitchpad-core/src/recovery.rs`
- [x] T006 [P] Write failing idle/max-interval scheduling and clock-discontinuity tests in `crates/glitchpad-core/src/recovery.rs`
- [x] T007 Implement versioned recovery records, safe inventory values, domain-separated hashing, validation, and scheduling in `crates/glitchpad-core/src/recovery.rs`
- [x] T008 Export recovery contracts from `crates/glitchpad-core/src/lib.rs` and keep recovery payloads out of safe error context in `crates/glitchpad-core/src/contracts.rs`

**Checkpoint**: Recovery policy is deterministic and independently testable without filesystem or UI code.

---

## Phase 3: User Story 1 - Save without overwriting an external change (Priority: P1)

**Goal**: Preserve local and external revisions across stale saves, source events, late receipts, and explicit overwrite decisions.

**Independent Test**: Inject 1,000 stale and mismatched save/event/receipt combinations and observe zero unauthorized dirty clears or destination mutations.

### Tests for User Story 1

- [x] T009 [P] [US1] Write failing source-bound event, orthogonal focus/integrity, edit, and conflict transition tests in `crates/glitchpad-core/src/session.rs`
- [x] T010 [P] [US1] Write failing save-operation and receipt binding tests for operation, source, revisions, bytes, and durability in `crates/glitchpad-core/src/session.rs` and `crates/glitchpad-core/src/source.rs`
- [x] T011 [P] [US1] Add stale-before-write and complete-old-or-new failure corpus cases in `crates/glitchpad-host/tests/desktop_source_conformance.rs`

### Implementation for User Story 1

- [x] T012 [US1] Separate focus from edit integrity and bind live source authority in `crates/glitchpad-core/src/session.rs`
- [x] T013 [US1] Implement one-use save transactions, confirmed-overwrite authorization, and fully bound receipts in `crates/glitchpad-core/src/source.rs` and `crates/glitchpad-core/src/session.rs`
- [x] T014 [US1] Preserve truthful durability and recovery coverage across late desktop replacement failures in `crates/glitchpad-host/src/source/persistence.rs` and `crates/glitchpad-host/src/source/mod.rs`
- [x] T015 [US1] Preserve Save As payload and classify incomplete Android destinations without mutating the original in `crates/glitchpad-host/src/android_source/mod.rs` and `crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/AndroidSourcePlugin.kt`

**Checkpoint**: Only one exact durable operation can clear dirty state, and every conflict preserves both revisions.

---

## Phase 4: User Story 2 - Close or reload without losing dirty edits (Priority: P1)

**Goal**: Guard every destructive transition and keep dirty active, background, and overflow sessions actionable until explicit resolution.

**Independent Test**: Exercise clean and dirty close/reload/exit across active and background sessions, with save success/failure, discard, Save As, and cancel outcomes.

### Tests for User Story 2

- [x] T016 [P] [US2] Write failing guarded close, reload, multi-session exit, discard, cancellation, and stale-resolution tests in `crates/glitchpad-core/src/session.rs`
- [x] T017 [P] [US2] Write failing active/background/overflow guarded-close reducer tests in `apps/glitchpad/src/domain/tabs.test.ts` and `apps/glitchpad/src/domain/recovery.test.ts`
- [x] T018 [P] [US2] Write failing keyboard, focus-return, live-region, conflict, and 200-percent layout contract tests in `apps/glitchpad/src/App.test.tsx`

### Implementation for User Story 2

- [x] T019 [US2] Implement portable destructive-transition requests and explicit save/discard/cancel resolution in `crates/glitchpad-core/src/session.rs`
- [x] T020 [US2] Replace unconditional TypeScript close with guarded recovery policy in `apps/glitchpad/src/domain/tabs.ts` and `apps/glitchpad/src/domain/recovery.ts`
- [x] T021 [US2] Add the accessible contextual resolution dialog and conflict/recovery messaging in `apps/glitchpad/src/components/RecoveryResolution.tsx`, `apps/glitchpad/src/App.tsx`, and `apps/glitchpad/src/styles.css`

**Checkpoint**: No UI or core close path can remove an unresolved dirty session.

---

## Phase 5: User Story 3 - Recover dirty text after abnormal termination (Priority: P1)

**Goal**: Atomically persist, inventory, accept, refuse, and clean bounded dirty recovery without restoring native authority or leaking content.

**Independent Test**: Round-trip valid records and inject quota, corruption, expiry, symlink, interruption, permission, and source-authority failures while preserving previous and unrelated records.

### Tests for User Story 3

- [x] T022 [P] [US3] Write failing atomic round-trip, exact quota, protected-record, update-accounting, expiry, corruption, symlink, and cleanup integration tests in `crates/glitchpad-host/tests/recovery_conformance.rs`
- [x] T023 [P] [US3] Write failing store failpoint and Unix permission unit tests in `crates/glitchpad-host/src/recovery.rs`
- [x] T024 [P] [US3] Add Android backup exclusion and process-restoration recovery assertions in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/RestorationInstrumentedTest.kt`

### Implementation for User Story 3

- [x] T025 [US3] Implement the locked private atomic recovery store, strict inventory, quota/expiry cleanup, and safe commands in `crates/glitchpad-host/src/recovery.rs`
- [x] T026 [US3] Initialize the recovery store from the native application-local data root and expose bounded Tauri commands in `crates/glitchpad-host/src/lib.rs`
- [x] T027 [US3] Exclude `recovery-v1` from Android cloud backup, device transfer, and legacy backup in `crates/glitchpad-host/gen/android/app/src/main/res/xml/backup_rules.xml` and `crates/glitchpad-host/gen/android/app/src/main/res/xml/backup_rules_legacy.xml`
- [x] T028 [US3] Add recovery inventory, accept, refuse, cleanup, and coverage-at-risk projections in `apps/glitchpad/src/domain/recovery.ts` and `apps/glitchpad/src/components/RecoveryResolution.tsx`

**Checkpoint**: Valid dirty content survives abnormal termination while invalid records remain isolated and private.

---

## Phase 6: Polish and cross-cutting evidence

**Purpose**: Complete traceability, platform parity, documentation, and pre-publication validation.

- [x] T029 [P] Record requirement-to-test and platform evidence in `specs/012-safe-recovery/verification.md`
- [x] T030 [P] Update contributor-facing validation guidance only where S012 introduces a new focused command in `CONTRIBUTING.md`
- [x] T031 Audit S012 files for raw locators, recovery payloads, unsafe debug output, UTF-8 BOM, mojibake, and prohibited generated artifacts
- [x] T032 Run focused Rust, frontend, Android API 24, and Android API 36 validation from `specs/012-safe-recovery/quickstart.md`
- [x] T033 Run the complete local `pnpm check` gate and resolve every failure before commit or push
- [x] T034 Complete the Spec-Kit convergence audit, mark every completed task, and verify Issue #50 acceptance coverage in `specs/012-safe-recovery/tasks.md`

---

## Dependencies and execution order

- Phase 1 establishes contracts and dependencies.
- Phase 2 is the policy foundation and blocks every user story.
- User Story 1 establishes safe save/conflict transitions used by safe close and cleanup.
- User Story 2 consumes User Story 1 receipt outcomes but remains independently testable with fixtures.
- User Story 3 consumes shared integrity and resolution state and is independently testable with an injected root and clock.
- Phase 6 follows all stories and is mandatory before publication.

## Parallel opportunities

- T002, T003, and T004 touch independent contract, interface, and changelog files.
- T005 and T006 are independent test groups in the same module and execute conceptually before T007.
- T009, T010, and T011 cover separate policy/host evidence surfaces.
- T016, T017, and T018 cover Rust, TypeScript reducer, and interface interaction surfaces.
- T022, T023, and T024 cover host integration, store internals, and Android instrumentation.
- T029 and T030 are independent documentation work after implementation.

## Implementation strategy

1. Establish recovery value contracts and deterministic policy.
2. Remove the existing silent-loss save and close paths before adding storage.
3. Add the private record store with injected paths, clocks, and failpoints.
4. Project only safe decisions into the interface and Android lifecycle evidence.
5. Converge against every FR/SC, then run focused platform evidence and the full local gate before the first push.
