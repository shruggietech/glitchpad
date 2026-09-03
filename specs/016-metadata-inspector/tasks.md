# Tasks: Contextual Metadata Inspector

**Input**: Design documents from `/specs/016-metadata-inspector/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Contract, unit, component, host, and platform tests are required by the feature specification and Constitution P6. Tests precede their corresponding implementation.

## Phase 1: Setup

**Purpose**: Establish the fixture and documentation surface without adding dependencies.

- [x] T001 Add bounded public, missing, redacted, hostile, Unicode, and SHA-256 fixture cases in fixtures/metadata/catalog.json
- [x] T002 [P] Record every S016 fixture source, license, redistribution, sensitivity, and digest in fixtures/provenance.toml
- [x] T003 [P] Add the issue #58 behavior fragment in changelog.d/58.added.md

## Phase 2: Foundational Contracts

**Purpose**: Define the native and interface truth model used by every story.

- [x] T004 Add failing metadata fact/catalog serialization, validation, ordering, precision, and redaction tests in crates/glitchpad-core/src/metadata.rs and crates/glitchpad-core/tests/contract_schema.rs
- [x] T005 Implement bounded MetadataFact, typed values, availability, provenance, sensitivity, copy policy, and catalog validation in crates/glitchpad-core/src/metadata.rs and export it from crates/glitchpad-core/src/lib.rs
- [x] T006 Add failing path-free revision-bound SourceMetadataSnapshot and IntegrityProgress schema tests in crates/glitchpad-core/src/source.rs and crates/glitchpad-core/tests/contract_schema.rs
- [x] T007 Extend the native source contract with optional reliable times, effective write state, identity confidence, exact revision, and integrity request/progress types in crates/glitchpad-core/src/source.rs
- [x] T008 Add failing TypeScript catalog, projection, six-state availability, formatting, precision, hostile value, and contribution-validation tests in apps/glitchpad/src/domain/metadata.test.ts
- [x] T009 Implement the static stable-core catalog, typed fact/snapshot/contribution model, source/text/capability projectors, safe formatting, and revision-safe merge in apps/glitchpad/src/domain/metadata.ts
- [x] T010 Mirror native source metadata and integrity wire contracts and add metadata state to ShellSession in apps/glitchpad/src/domain/contracts.ts

**Checkpoint**: Catalog policy and path-free wire contracts are independently testable.

## Phase 3: User Story 1 - Inspect the active file (Priority: P1) MVP

**Goal**: Present one truthful grouped inspector without replacing the document.

**Independent Test**: Open text, Markdown, and Mermaid sessions; invoke file information through shell and contextual controls; inspect groups and dismiss without session mutation.

- [x] T011 [P] [US1] Add failing component tests for grouped facts, all availability labels, long values, Escape, focus restoration, active-tab retargeting, and axe in apps/glitchpad/src/components/MetadataInspector.test.tsx
- [x] T012 [P] [US1] Add failing shell command/contextual integration and no-session-mutation tests in apps/glitchpad/src/App.test.tsx
- [x] T013 [US1] Implement the semantic nonmodal grouped inspector in apps/glitchpad/src/components/MetadataInspector.tsx
- [x] T014 [US1] Route the renderer-driven metadata command, opener focus, active-session changes, and shell-owned overlay through apps/glitchpad/src/App.tsx and apps/glitchpad/src/components/DocumentSurface.tsx
- [x] T015 [US1] Add `update_metadata` stale-rejection reducer tests and implementation in apps/glitchpad/src/domain/tabs.test.ts and apps/glitchpad/src/domain/tabs.ts
- [x] T016 [US1] Replace Mermaid's local metadata panel with shared renderer contributions and contextual open action in apps/glitchpad/src/components/MermaidSurface.test.tsx and apps/glitchpad/src/components/MermaidSurface.tsx
- [x] T017 [US1] Publish Markdown renderer measurements/status as shared contributions in apps/glitchpad/src/components/MarkdownSurface.test.tsx and apps/glitchpad/src/components/MarkdownSurface.tsx

## Phase 4: User Story 2 - Understand and safely copy metadata (Priority: P1)

**Goal**: Make provenance visible and enforce direct, confirmation, and denied copy policies.

**Independent Test**: Copy public values, disclose one sensitive value explicitly, reject redacted/prohibited and bulk sensitive copies, and simulate clipboard failure.

- [x] T018 [P] [US2] Add failing direct/disclosed/denied/bulk/clipboard-error tests in apps/glitchpad/src/components/MetadataInspector.test.tsx and apps/glitchpad/src/domain/metadata.test.ts
- [x] T019 [US2] Implement injected clipboard gateway, exact visible copy projection, and bounded failure handling in apps/glitchpad/src/domain/metadata-gateway.ts and apps/glitchpad/src/domain/metadata-gateway.test.ts
- [x] T020 [US2] Implement provenance disclosure, per-fact confirmation, safe single/bulk copy, and restrained announcements in apps/glitchpad/src/components/MetadataInspector.tsx
- [x] T021 [US2] Reset disclosure and clipboard state on dismiss, tab switch, and session close in apps/glitchpad/src/App.tsx

## Phase 5: User Story 3 - Refresh facts and request integrity (Priority: P1)

**Goal**: Refresh metadata in place and publish only complete SHA-256 evidence for the exact source revision.

**Independent Test**: Refresh a watched/provider source and exercise known, empty, unknown-length, oversized, stale, cancelled, failed, superseded, and 100-cycle checksum cases.

- [x] T022 [P] [US3] Add failing desktop metadata optional-time, rename/change, path-redaction, checksum vector/race/limit/cancel/disposal tests in crates/glitchpad-host/tests/desktop_source_conformance.rs
- [x] T023 [P] [US3] Add failing Android omission, grant-state, provider-refresh, checksum vector/race/limit/cancel/disposal tests in crates/glitchpad-host/tests/android_source_contract.rs
- [x] T024 [US3] Extend desktop source metadata snapshots and implement bounded start/advance/cancel SHA-256 operation state in crates/glitchpad-host/src/source/mod.rs
- [x] T025 [US3] Extend Android source snapshots and implement bounded start/advance/cancel SHA-256 operation state in crates/glitchpad-host/src/android_source/mod.rs
- [x] T026 [US3] Register desktop and Android metadata/integrity Tauri commands with path-free errors in crates/glitchpad-host/src/lib.rs
- [x] T027 [US3] Add failing gateway query, progress, supersession, cancellation, stale publication, and unavailable-native tests in apps/glitchpad/src/domain/metadata-gateway.test.ts
- [x] T028 [US3] Implement one desktop/Android metadata and cooperative integrity gateway in apps/glitchpad/src/domain/metadata-gateway.ts
- [x] T029 [US3] Integrate query, refresh, on-demand checksum, stale-discard, cancellation, and session contribution flow in apps/glitchpad/src/App.test.tsx and apps/glitchpad/src/App.tsx

## Phase 6: User Story 4 - Accessible responsive platform behavior (Priority: P2)

**Goal**: Provide desktop right-sheet, phone bottom-sheet, tablet side-sheet, keyboard, touch, and assistive behavior.

**Independent Test**: Complete open/traverse/copy/dismiss flows at desktop, phone, and tablet profiles with keyboard, touch, and semantic assertions.

- [x] T030 [P] [US4] Add responsive structure, document-context ratio, coarse target, restrained-live-region, and print tests in apps/glitchpad/src/components/MetadataInspector.test.tsx and apps/glitchpad/src/App.test.tsx
- [x] T031 [US4] Implement desktop/tablet/phone sheet layouts, bounded overflow, light theme, print hiding, and 44-pixel coarse targets in apps/glitchpad/src/styles.css
- [x] T032 [P] [US4] Extend controlled Android provider omission/Unicode/failure metadata cases in crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/AndroidSourcePlugin.kt and crates/glitchpad-android-source/android/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidSourceInstrumentedTest.kt
- [x] T033 [US4] Verify the shared metadata contract across desktop and Android schemas in crates/glitchpad-host/tests/desktop_source_conformance.rs and crates/glitchpad-host/tests/android_source_contract.rs

## Phase 7: Polish and Cross-Cutting Validation

- [x] T034 Remove superseded renderer-local metadata styles and duplicated policy from apps/glitchpad/src/styles.css and apps/glitchpad/src/components/MermaidSurface.tsx
- [x] T035 Add catalog/fixture/provenance validation to the existing aggregate gate in crates/xtask/src/main.rs or repository validation scripts
- [x] T036 Run focused Rust and frontend tests and resolve every failure without weakening assertions
- [x] T037 Run the complete `pnpm check` gate through a real successful exit
- [x] T038 Perform UTF-8/no-BOM, mojibake, diff, dependency, and sensitive-locator audits across all S016 files
- [x] T039 Record requirement-linked automated and manual evidence in specs/016-metadata-inspector/verification.md

## Dependencies and Execution Order

- Setup precedes foundational contracts.
- Foundational contracts block all user stories.
- US1 establishes the shared presentation and contribution seam used by US2 and US3.
- US2 and native portions of US3 can proceed independently after US1; US4 depends on the inspector component.
- Polish and full validation follow all stories.
- Within each story, failing tests precede implementation and integration.

## Parallel Opportunities

- T002 and T003 may run beside T001.
- Native schema tests and TypeScript catalog tests can proceed independently in Phase 2.
- US1 component and shell tests can be authored independently before integration.
- Desktop and Android host contract tests are independent.
- Responsive UI tests and Android provider fixture work are independent.

## Implementation Strategy

Deliver the catalog and source contracts first, then the shell-owned inspector, safe copy policy, native refresh/integrity lifecycle, and responsive platform evidence. Treat each checkpoint as incomplete until its focused tests pass. Publish only after the full repository gate passes locally.

## Phase 8: Convergence

- [x] T040 Add and validate a stable derived format-conflicts fact per FR-009 (missing)
- [x] T041 Refresh open-inspector source facts on a bounded provider/watcher cycle without mutating the document revision, and dispose refresh work on close per FR-012, SC-003, and SC-008 (partial)
- [x] T042 Preserve at least 60 percent document context and use a side sheet on coarse-pointer tablets per US4/AC2 and SC-007 (contradicts)
- [x] T043 Replace embedded English catalog labels and fixed `en-US` formatting with localization keys and locale-aware presentation per FR-019 and plan: metadata catalog entry (partial)
- [x] T044 Make metadata fixture validation reject unknown catalog keys and repair the invalid fixture keys per SC-002 and T035 (partial)
