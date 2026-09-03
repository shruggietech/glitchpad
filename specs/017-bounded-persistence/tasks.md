# Tasks: Bounded Local Persistence

**Input**: Design documents from `/specs/017-bounded-persistence/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Contract, unit, component, host, and lifecycle tests are required by the specification and Constitution P6. Tests precede their corresponding implementation.

## Phase 1: Setup

**Purpose**: Establish bounded hostile fixtures and traceability without new dependencies.

- [x] T001 Add valid, legacy, corrupt, oversized, future-schema, session, and hostile diagnostic cases in fixtures/persistence/
- [x] T002 [P] Record every S017 fixture source, license, redistribution terms, and digest in fixtures/provenance.toml
- [x] T003 [P] Add the issue #59 behavior fragment in changelog.d/59.added.md

## Phase 2: Foundational Contracts

**Purpose**: Define the shared versioning, validation, privacy, and retention model used by every story.

- [x] T004 Add failing preference, session projection, diagnostic event, load status, bound, and serialization tests in crates/glitchpad-core/src/persistence.rs and crates/glitchpad-core/tests/contract_schema.rs
- [x] T005 Implement versioned preference, session, diagnostic, load-result, migration, validation, and deterministic retention contracts in crates/glitchpad-core/src/persistence.rs and export them from crates/glitchpad-core/src/lib.rs
- [x] T006 Add failing TypeScript default, normalization, projection, and hostile diagnostic tests in apps/glitchpad/src/domain/persistence.test.ts
- [x] T007 Mirror safe persistence contracts, normalization, presentation projection, and diagnostic preview policy in apps/glitchpad/src/domain/persistence.ts and apps/glitchpad/src/domain/contracts.ts
- [x] T008 Add failing native gateway command, unavailable-host, and bounded-error tests in apps/glitchpad/src/domain/persistence-gateway.test.ts
- [x] T009 Implement the injected native application-state gateway in apps/glitchpad/src/domain/persistence-gateway.ts

**Checkpoint**: All durable values and cross-boundary results are bounded, versioned, path-free, and independently testable.

## Phase 3: User Story 1 - Persist viewing preferences (Priority: P1) MVP

**Goal**: Load, edit, validate, apply, and atomically persist only the v0.1 preference set.

**Independent Test**: Change every supported preference, restart through a fake gateway, and verify valid values restore while each invalid value falls back independently.

- [x] T010 [P] [US1] Add failing atomic preference load/write, partial fallback, unavailable-root, and future-schema preservation tests in crates/glitchpad-host/tests/app_state_conformance.rs
- [x] T011 [US1] Implement bounded category-isolated application-state file storage and preference migration in crates/glitchpad-host/src/app_state.rs
- [x] T012 [US1] Register safe preference load/write commands and application-config state in crates/glitchpad-host/src/lib.rs
- [x] T013 [P] [US1] Add failing accessible preference interaction, defaults, validation, and reset tests in apps/glitchpad/src/components/PreferencesPanel.test.tsx
- [x] T014 [US1] Implement the compact preference sheet in apps/glitchpad/src/components/PreferencesPanel.tsx and apps/glitchpad/src/styles.css
- [x] T015 [US1] Add failing load, coalesced save, unavailable persistence, and restart tests in apps/glitchpad/src/domain/use-persistence.test.ts
- [x] T016 [US1] Implement preference loading, application, coalesced saving, and safe warning behavior in apps/glitchpad/src/domain/use-persistence.ts
- [x] T017 [US1] Integrate the preference command, sheet, theme/editor variables, and category reset in apps/glitchpad/src/App.tsx and apps/glitchpad/src/App.test.tsx

## Phase 4: User Story 2 - Resume bounded session context (Priority: P1)

**Goal**: Persist at most 32 safe session projections and restore only sources with current native authority or recovery references.

**Independent Test**: Persist mixed clean, dirty, restorable, revoked, and ineligible sessions, then verify independent restoration with no document bytes in stored state.

- [x] T018 [P] [US2] Add failing maximum-count, no-content, recovery-reference, revoked-source, category-isolation, and desktop/Android lifecycle tests in crates/glitchpad-host/tests/app_state_conformance.rs
- [x] T019 [US2] Implement bounded atomic session projection persistence, native restoration-reference isolation, and independent load status in crates/glitchpad-host/src/app_state.rs
- [x] T020 [US2] Register safe session load/write/reset commands in crates/glitchpad-host/src/lib.rs
- [x] T021 [P] [US2] Add failing safe session projection, debounce, dirty recovery reference, and stale-response tests in apps/glitchpad/src/domain/use-persistence.test.ts
- [x] T022 [US2] Implement session projection, coalesced lifecycle persistence, and stale-load rejection in apps/glitchpad/src/domain/use-persistence.ts
- [x] T023 [US2] Expose the validated startup projection for native source-delivery consumers without replacing active document state or treating runtime source IDs as durable references in apps/glitchpad/src/domain/use-persistence.ts and apps/glitchpad/src/domain/use-persistence.test.ts

## Phase 5: User Story 3 - Recover from incompatible state (Priority: P1)

**Goal**: Keep startup usable and preserve last-known or future state through corruption, migration, failed writes, and scoped reset.

**Independent Test**: Exercise every invalid-state and failure fixture repeatedly and verify deterministic results and byte-for-byte preservation outside the selected category.

- [x] T024 [P] [US3] Add failing deterministic migration, corrupt isolation, interrupted write, exact reset, and future-schema byte-preservation tests in crates/glitchpad-host/tests/app_state_conformance.rs
- [x] T025 [US3] Implement bounded reads, deterministic migrations, write blocking for future schemas, atomic replacement, and exact category reset in crates/glitchpad-host/src/app_state.rs
- [x] T026 [US3] Expose stable content-free status and reset results through crates/glitchpad-host/src/lib.rs and apps/glitchpad/src/domain/persistence-gateway.ts
- [x] T027 [US3] Add shell fallback and one-shot warning tests for corrupt, unsupported, and unavailable stores in apps/glitchpad/src/App.test.tsx and apps/glitchpad/src/domain/use-persistence.test.ts

## Phase 6: User Story 4 - Preview and export redacted diagnostics (Priority: P2)

**Goal**: Retain only allowlisted structured events and export exactly the bounded redacted payload the user previewed.

**Independent Test**: Feed every hostile sentinel through diagnostic ingestion, retention, preview, and export and verify zero leaks plus deterministic survivors.

- [x] T028 [P] [US4] Add failing allowlist, hostile value, age/count/byte retention, preview equality, export, and category-isolation tests in crates/glitchpad-host/tests/app_state_conformance.rs
- [x] T029 [US4] Implement diagnostic ingestion, deterministic retention, and exact preview payload construction in crates/glitchpad-host/src/app_state.rs
- [x] T030 [US4] Register bounded diagnostic append, preview, and reset commands in crates/glitchpad-host/src/lib.rs, keeping explicit export of the previewed payload in the renderer-owned download gateway
- [x] T031 [P] [US4] Add failing accessible preview, explicit export, reset, and hostile-sentinel tests in apps/glitchpad/src/components/DiagnosticsPanel.test.tsx
- [x] T032 [US4] Implement the diagnostic preview/export sheet in apps/glitchpad/src/components/DiagnosticsPanel.tsx and apps/glitchpad/src/styles.css
- [x] T033 [US4] Integrate diagnostic preview, explicit export, safe status, and reset in apps/glitchpad/src/App.tsx and apps/glitchpad/src/App.test.tsx

## Phase 7: Polish and Cross-Cutting Validation

- [x] T034 Add persistence fixture/provenance/schema validation to the aggregate gate in crates/xtask/src/main.rs or repository validation scripts
- [x] T035 Run focused Rust and frontend tests and resolve every failure without weakening assertions
- [x] T036 Run the complete `pnpm check` gate through a real successful exit
- [x] T037 Perform UTF-8/no-BOM, mojibake, diff, dependency, document-content, locator, and diagnostic-string audits across all S017 files
- [x] T038 Record requirement-linked automated and manual evidence in specs/017-bounded-persistence/verification.md

## Dependencies and Execution Order

- Setup precedes foundational contracts.
- Foundational contracts block every user story.
- US1 establishes native store and frontend controller seams used by later stories.
- US2 and US4 use separate state categories after US1; US3 hardens the shared store before final integration.
- Polish and complete validation follow all stories.
- Within each story, failing tests precede implementation and integration.

## Parallel Opportunities

- T002 and T003 may run beside T001.
- Rust and TypeScript foundational tests can be authored independently.
- Host preference tests and preference component tests are independent before integration.
- Session lifecycle tests and diagnostic component tests touch independent areas after the store seam exists.
- Documentation evidence and static fixture validation can proceed beside focused test execution after implementation.

## Implementation Strategy

Deliver closed value contracts and fixture bounds first, then the isolated native store, preference experience, session projection, corruption and reset hardening, and diagnostic preview/export. Treat every category as independently degradable. Publish only after convergence finds no gap and the full repository gate passes locally.
