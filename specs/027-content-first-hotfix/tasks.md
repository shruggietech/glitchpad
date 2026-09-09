# Tasks: Content-First Desktop Hotfix

**Input**: Design documents from `/specs/027-content-first-hotfix/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/shell-presentation-contract.md

**Tests**: Automated component, accessibility, delivery, and packaged Windows tests are required by FR-015 through FR-017.

## Phase 1: Setup

- [x] T001 Record the active S027 directory in `.specify/feature.json`
- [x] T002 [P] Record the v0.1.1 behavior delta and issue traceability in `docs/releases/v0.1.1-delta.md`

## Phase 2: Foundational

- [x] T003 Move synthetic sessions behind explicit test and performance entry points in `apps/glitchpad/src/test/fixtures.ts` and `apps/glitchpad/src/App.tsx`
- [x] T004 Make the production entry point initialize the shell with zero sessions in `apps/glitchpad/src/main.tsx`

## Phase 3: User Story 1 - Read the requested file immediately (Priority: P1)

**Goal**: Direct launch is empty and opening a real TXT or Markdown file immediately displays that source.

**Independent Test**: Render production startup with a desktop gateway, then deliver real TXT and Markdown sessions and verify each becomes the sole active visible document.

- [x] T005 [US1] Add failing empty-start, real-delivery, and visible-error coverage in `apps/glitchpad/src/App.test.tsx`
- [x] T006 [US1] Implement the minimal empty state, first-delivery activation, and visible delivery failures in `apps/glitchpad/src/App.tsx` and `apps/glitchpad/src/components/DocumentSurface.tsx`
- [x] T007 [US1] Add delivery materialization coverage for exact TXT and Markdown content in `apps/glitchpad/src/domain/desktop-delivery-gateway.test.ts`

## Phase 4: User Story 2 - Use tabs only for concurrent documents (Priority: P1)

**Goal**: Tabs appear only for at least two documents and every visible tab closes its own document.

**Independent Test**: Exercise zero, one, two, and return-to-one session states and verify tab-list visibility, active delivery, direct close targeting, dirty safeguards, and focus.

- [x] T008 [US2] Add failing conditional-tab and direct-close component coverage in `apps/glitchpad/src/components/TabStrip.test.tsx`
- [x] T009 [US2] Replace always-present tabs and detached active actions with conditional per-document tab groups in `apps/glitchpad/src/components/TabStrip.tsx`
- [x] T010 [US2] Extend tab reducer coverage for non-active direct close and return-to-one state in `apps/glitchpad/src/domain/tabs.test.ts`

## Phase 5: User Story 3 - Reveal controls only when requested (Priority: P1)

**Goal**: One compact menu replaces permanent command rows, renderer controls remain available without persistent clutter, and secondary surfaces do not collide.

**Independent Test**: Open one document, invoke every menu group and secondary surface, dismiss by pointer and Escape, and run accessibility checks in dark and light themes.

- [x] T011 [US3] Add failing menu disclosure, action routing, dismissal, and accessibility coverage in `apps/glitchpad/src/components/ApplicationMenu.test.tsx` and `apps/glitchpad/src/App.test.tsx`
- [x] T012 [US3] Implement the capability-aware compact menu in `apps/glitchpad/src/components/ApplicationMenu.tsx` and integrate it in `apps/glitchpad/src/App.tsx`
- [x] T013 [US3] Remove redundant persistent document and renderer status chrome while preserving commands in `apps/glitchpad/src/components/DocumentSurface.tsx`, `apps/glitchpad/src/components/MarkdownSurface.tsx`, `apps/glitchpad/src/components/MermaidSurface.tsx`, and `apps/glitchpad/src/components/TextEditorSurface.tsx`
- [x] T014 [US3] Theme CodeMirror search and establish content-first overlay geometry in `apps/glitchpad/src/styles.css`
- [x] T015 [US3] Enforce mutually coherent secondary surfaces and focus restoration in `apps/glitchpad/src/App.tsx`, `apps/glitchpad/src/components/PreferencesPanel.tsx`, and `apps/glitchpad/src/components/DiagnosticsPanel.tsx`

## Phase 6: User Story 4 - Prevent another unusable release (Priority: P1)

**Goal**: Packaged Windows validation fails unless clean launch and real TXT, Markdown, and multi-document workflows are visibly usable.

**Independent Test**: Run the Windows portable lifecycle probe from isolated state and verify its bounded receipt proves all required visible outcomes and rejects each prohibited state.

- [x] T016 [US4] Extend the portable UI Automation lifecycle contract and receipt in `scripts/windows/test-portable-lifecycle.ps1`
- [x] T017 [US4] Add policy tests for the strengthened portable lifecycle assertions in `scripts/check-windows-package.test.mjs` and `scripts/check-windows-package.mjs`
- [x] T018 [US4] Wire real TXT and Markdown fixtures and clean-state isolation through `.github/workflows/windows-package.yml`

## Phase 7: Polish and verification

- [x] T019 Run focused frontend, accessibility, delivery, documentation, and Windows package-policy checks from `specs/027-content-first-hotfix/quickstart.md`
- [x] T020 Run the complete repository gate and record real results in `specs/027-content-first-hotfix/verification.md`
- [x] T021 Mark every completed task, verify UTF-8 without BOM and mojibake absence, and reconcile S027 against issues #141-#147 in `specs/027-content-first-hotfix/tasks.md`

## Dependencies and execution order

T001-T004 establish the production boundary. US1 then proves the first-file path. US2 depends on real session initialization from US1. US3 depends on conditional shell geometry from US2. US4 depends on the final visible contracts from US1-US3. T019-T021 run after all user stories.

## Parallel opportunities

T002 can proceed independently of T001. Within the implementation, domain delivery coverage in T007 and reducer coverage in T010 touch independent files after their corresponding behavior is defined. Windows policy tests in T017 can be drafted while the UI implementation is stabilized, but T016-T018 must validate the integrated result sequentially.

## Implementation strategy

Remove production fixtures and prove exact first-file visibility first. Then make multi-document tabs conditional, collapse persistent controls into one compact menu, integrate secondary surfaces, and finally strengthen the packaged Windows gate before running the complete repository check.
