---
description: 'Task list for the S013 text and source editor'
---

# Tasks: Text and Source Editor

**Input**: Design documents from `/specs/013-text-source-editor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Contract, unit, integration, accessibility, performance-structure, and platform evidence are required by FR-021, FR-022, and SC-001 through SC-010.

**Organization**: Tasks are grouped by independently testable user story, with tests written before their corresponding implementation.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the reviewed editor dependency family and fixture provenance without enabling product behavior.

- [x] T001 Add pinned CodeMirror 6 and lazy language dependencies to `apps/glitchpad/package.json` and `pnpm-lock.yaml`
- [x] T002 Record S013 fixture provenance and compatible license purpose in `fixtures/provenance.toml`
- [x] T003 Add the issue-linked unreleased behavior fragment in `changelog.d/52.added.md`
- [x] T004 Verify existing ignore, license, secret, and public-surface policies cover editor packages and generated outputs in `.gitignore`, `deny.toml`, and repository validation scripts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared editor modes, language evidence, interface contracts, and transaction projections used by every story.

- [x] T005 [P] Add failing mode-boundary, extreme-line, language-evidence, conflict, and serialization schema tests in `crates/glitchpad-core/src/editor.rs` and `crates/glitchpad-core/tests/contract_schema.rs`
- [x] T006 [P] Add failing TypeScript contract, raw-shadow, encoding, and transaction tests in `apps/glitchpad/src/domain/text-document.test.ts`
- [x] T007 Add platform-independent editor mode, language decision, bounded evidence, and status contracts in `crates/glitchpad-core/src/editor.rs`
- [x] T008 Extend bounded detection with exact filename, extension, shebang, modeline, content, and conflict evidence in `crates/glitchpad-core/src/detection.rs`
- [x] T009 Export editor contracts and stable JSON schemas from `crates/glitchpad-core/src/lib.rs` and `crates/glitchpad-core/tests/contract_schema.rs`
- [x] T010 Mirror editor, text-profile, language, selection, large-view, and source-authority contracts in `apps/glitchpad/src/domain/contracts.ts`
- [x] T011 Implement normalized-to-raw offset mapping, mixed-newline-preserving transactions, encoding, BOM, terminal-newline, and revision-bound serialization in `apps/glitchpad/src/domain/text-document.ts`
- [x] T012 Prove the foundational Rust and TypeScript domain suites pass without enabling the editor component

**Checkpoint**: Size, language, round-trip, and transaction policy is stable and independently testable.

---

## Phase 3: User Story 1 - Exact text editing and save authority (Priority: P1) 🎯 MVP

**Goal**: Edit bounded text with undo and redo while preserving byte-level source decisions and S012 safety state.

**Independent Test**: Open every encoding and newline fixture, perform edits and undo or redo, serialize the current revision, and verify only explicitly edited content or profile decisions differ.

- [x] T013 [P] [US1] Add failing editor mount, input, undo, redo, dirty, recovery, stale-save, suspension, and disposal tests in `apps/glitchpad/src/components/TextEditorSurface.test.tsx`
- [x] T014 [P] [US1] Add failing shell integration tests for current content, revision, dirty state, recovery payload, and recovered-buffer editing in `apps/glitchpad/src/App.test.tsx`
- [x] T015 [US1] Implement the minimal explicit CodeMirror configuration and lifecycle in `apps/glitchpad/src/components/TextEditorSurface.tsx`
- [x] T016 [US1] Project each accepted CodeMirror transaction through exact raw-shadow state and the S012 revision lifecycle in `apps/glitchpad/src/domain/text-document.ts` and `apps/glitchpad/src/domain/tabs.ts`
- [x] T017 [US1] Route text and source sessions to the editable renderer while retaining non-text fallback behavior in `apps/glitchpad/src/components/DocumentSurface.tsx`
- [x] T018 [US1] Integrate current editor state, dirty transitions, recovery snapshots, save availability, and recovered-session behavior in `apps/glitchpad/src/App.tsx`
- [x] T019 [US1] Add compact encoding, BOM, newline, terminal-newline, round-trip, size, and mode status presentation in `apps/glitchpad/src/components/TextEditorSurface.tsx` and `apps/glitchpad/src/styles.css`
- [x] T020 [US1] Prove User Story 1 fixture, transaction, lifecycle, accessibility, and regression tests pass

**Checkpoint**: Normal bounded text is safely editable and serializable with no regression to S012.

---

## Phase 4: User Story 2 - Document-local navigation and transformations (Priority: P1)

**Goal**: Provide discoverable find, replace, go-to-line, wrapping, indentation, bracket, copy, selection, undo, and redo operations scoped to the active document.

**Independent Test**: Exercise every operation against editable, read-only, stale, empty, Unicode, invalid-input, keyboard, pointer, and touch-accessible paths.

- [x] T021 [P] [US2] Add failing active-session, stale-command, read-only-denial, shortcut, and availability tests in `apps/glitchpad/src/domain/commands.test.ts`
- [x] T022 [P] [US2] Add failing find, replace, go-to-line, wrapping, indentation, bracket, copy, multi-selection, Unicode, and focus tests in `apps/glitchpad/src/components/TextEditorSurface.test.tsx`
- [x] T023 [US2] Extend command IDs, capability filtering, platform shortcut labels, and stale revision guards in `apps/glitchpad/src/domain/commands.ts`
- [x] T024 [US2] Implement editor command dispatch, search and replace panel, line navigation, selectable wrapping, indentation, bracket handling, copy, and multiple-selection support in `apps/glitchpad/src/components/TextEditorSurface.tsx`
- [x] T025 [US2] Connect shell command invocation to the mounted active editor without granting commands to inactive or read-only sessions in `apps/glitchpad/src/App.tsx` and `apps/glitchpad/src/components/CommandBar.tsx`
- [x] T026 [US2] Add accessible compact controls, focus restoration, read-only messaging, high-zoom layout, and touch target styles in `apps/glitchpad/src/components/TextEditorSurface.tsx` and `apps/glitchpad/src/styles.css`
- [x] T027 [US2] Prove User Story 2 command, Unicode, keyboard, pointer, touch, focus, accessibility, and regression tests pass

**Checkpoint**: Required text operations work only against the current active document and remain discoverable and accessible.

---

## Phase 5: User Story 3 - Evidence-based lazy syntax highlighting (Priority: P1)

**Goal**: Select and lazily load a bounded non-executing language mode while preserving plain-text access on uncertainty or failure.

**Independent Test**: Resolve known, ambiguous, contradictory, unknown, unavailable, stale, cancelled, overridden, and extreme-line fixtures and verify deterministic decisions with zero content mutation.

- [x] T028 [P] [US3] Add failing language registry, lazy-load, override, stale-result, cancellation, and fallback tests in `apps/glitchpad/src/domain/language.test.ts`
- [x] T029 [P] [US3] Add failing highlighted, loading, fallback, explicit-override, automatic-reset, and extreme-line component tests in `apps/glitchpad/src/components/TextEditorSurface.test.tsx`
- [x] T030 [US3] Implement the canonical allowlist and revision-bound dynamic language loader in `apps/glitchpad/src/domain/language.ts`
- [x] T031 [US3] Integrate a reconfigurable language compartment, safe exception sink, plain-text fallback, and session override control in `apps/glitchpad/src/components/TextEditorSurface.tsx`
- [x] T032 [US3] Project core language evidence, conflicts, confidence, override origin, and load status into shell sessions in `apps/glitchpad/src/domain/contracts.ts` and `apps/glitchpad/src/App.tsx`
- [x] T033 [US3] Prove User Story 3 language corpus, stale asynchronous result, no-network, accessibility, and regression tests pass

**Checkpoint**: Supported language highlighting is deterministic, lazy, session-scoped, and incapable of blocking plain-text editing.

---

## Phase 6: User Story 4 - Virtualized large-text inspection (Priority: P2)

**Goal**: Inspect, navigate, search, and copy 32–256 MiB text sources through bounded reads without a complete decoded interface allocation or any edit authority.

**Independent Test**: Use deterministic in-memory source gateways at both thresholds, across multibyte and newline chunk boundaries, and verify bounded windows, correct matches, cancellation, source revision checks, and operation denial.

- [x] T034 [P] [US4] Add failing bounded-range, false-size, changing-size, chunk-decode, sparse-index, search, copy, cancellation, and stale-result tests in `apps/glitchpad/src/domain/large-text-gateway.test.ts`
- [x] T035 [P] [US4] Add failing virtual window, progress, navigation, search, copy, read-only denial, accessibility, and disposal tests in `apps/glitchpad/src/components/LargeTextSurface.test.tsx`
- [x] T036 [US4] Implement the platform-selecting opaque source range gateway and deterministic in-memory test gateway in `apps/glitchpad/src/domain/large-text-gateway.ts`
- [x] T037 [US4] Implement revision-bound incremental decoding, bounded sparse line indexing, chunked search, copy limits, progress, and cancellation in `apps/glitchpad/src/domain/large-text.ts`
- [x] T038 [US4] Implement the bounded virtual large-text window, navigation, search, copy, progress, and disposal lifecycle in `apps/glitchpad/src/components/LargeTextSurface.tsx`
- [x] T039 [US4] Route large and refused text modes without editable content publication in `apps/glitchpad/src/components/DocumentSurface.tsx`, `apps/glitchpad/src/App.tsx`, and `apps/glitchpad/src/domain/contracts.ts`
- [x] T040 [US4] Prove User Story 4 boundary, memory-structure, cancellation, stale-result, accessibility, and regression tests pass

**Checkpoint**: Large text remains useful, bounded, source-backed, and strictly read-only.

---

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: Close cross-story conformance, documentation, performance evidence, and publication gates.

- [x] T041 [P] Add shared renderer conformance coverage for capabilities, malformed and oversized input, suspension, repeated open or close, disposal, round trips, conflicts, save, Save As, recovery, and lossy denial in `apps/glitchpad/src/domain/editor-conformance.test.ts`
- [x] T042 [P] Add deterministic generated 1,000-sequence revision, edit, undo, redo, replace, conflict, recovery, and receipt coverage in `apps/glitchpad/src/domain/text-document.test.ts`
- [x] T043 Add deterministic performance-structure coverage and a release-profile measurement harness in `apps/glitchpad/src/domain/editor-performance.test.ts` and `apps/glitchpad/src/domain/editor-performance.ts`
- [x] T044 Run the release-profile measurement harness and record environment, fixture digests, samples, median, p95, peak memory, and limitations in `specs/013-text-source-editor/verification.md`
- [x] T045 Complete the quickstart keyboard, pointer, touch, high-zoom, bidirectional-text, combining-character, emoji, screen-reader, and read-only manual checks in `specs/013-text-source-editor/quickstart.md` and record results in `specs/013-text-source-editor/verification.md`
- [x] T046 Run focused Rust and interface suites, full `pnpm check`, local Android debug build, encoding and mojibake scans, dependency-license review, and final diff inspection; record exact evidence in `specs/013-text-source-editor/verification.md`
- [x] T047 Re-run Spec-Kit convergence against every requirement, acceptance scenario, plan decision, task, and constitution principle; append and complete any remediation tasks in `specs/013-text-source-editor/tasks.md`

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 has no implementation dependency.
- Phase 2 depends on Phase 1 and blocks all user stories.
- User Story 1 depends on Phase 2 and establishes the mounted editor lifecycle.
- User Story 2 depends on User Story 1's editor instance and transaction integration.
- User Story 3 depends on User Story 1's editor instance but remains independently testable through injected loaders.
- User Story 4 depends on Phase 2 contracts and can be tested independently from editable and highlighting behavior.
- Phase 7 depends on all selected user stories.

### Parallel Opportunities

- T002 and T003 can proceed independently after T001 selects the dependency footprint.
- T005 and T006 cover separate Rust and TypeScript foundations.
- Each story's domain and component test tasks marked `[P]` can be authored independently before implementation.
- T041 and T042 cover separate conformance and generated state corpora.

## Implementation Strategy

Complete the foundation, then deliver exact normal-file editing as the minimum viable increment. Add document-local commands, language loading, and large read-only inspection in dependency order. At every checkpoint, run focused tests before starting the next story. Do not publish until all stories, convergence, Android build evidence, and the full repository gate pass locally.

## Format Validation

All 47 tasks use the required checkbox, sequential ID, optional parallel marker, required user-story label within story phases, imperative description, and explicit file path format.
