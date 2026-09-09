# Tasks: Desktop Rendering and Shell Corrections

**Input**: Design documents from `/specs/030-desktop-corrections/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/desktop-presentation.md

**Tests**: Automated component, accessibility, geometry, corpus, and packaged Windows tests are required by FR-013 and FR-014.

## Phase 1: Setup

- [x] T001 Record the active S030 directory in `.specify/feature.json`
- [x] T002 [P] Add synthetic complex Markdown corpus fixtures in `apps/glitchpad/src/test/markdown-corpus.ts`
- [x] T003 [P] Record the unreleased v0.1.2 behavior delta and issue traceability in `docs/releases/v0.1.2.md`

## Phase 2: Foundational

- [x] T004 Add failing document-failure containment and reset-key coverage in `apps/glitchpad/src/components/DocumentErrorBoundary.test.tsx`
- [x] T005 Implement the reusable document-scoped containment boundary in `apps/glitchpad/src/components/DocumentErrorBoundary.tsx`
- [x] T006 Integrate containment and explicit source recovery around active format surfaces in `apps/glitchpad/src/components/DocumentSurface.tsx`

## Phase 3: User Story 1 - Keep every Markdown document usable (Priority: P1)

**Goal**: Every corpus and sequential-open path reaches usable content or a contained actionable error.

**Independent Test**: Exercise A-to-B, B-to-A, repeated, same-byte/different-name, stale result, restoration, and injected failure paths while verifying active identity and shell survival.

- [x] T007 [US1] Add failing corpus, ordering, stale-generation, and contained-failure tests in `apps/glitchpad/src/components/MarkdownSurface.test.tsx` and `apps/glitchpad/src/App.test.tsx`
- [x] T008 [US1] Align render result publication with session, revision, and request generation in `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T009 [US1] Provide contained Markdown failure actions and reset behavior in `apps/glitchpad/src/components/MarkdownSurface.tsx` and `apps/glitchpad/src/components/DocumentSurface.tsx`

## Phase 4: User Story 2 - Protect source while preview is pending (Priority: P1)

**Goal**: Rendered-mode pending frames contain no document-derived content and remain accessible.

**Independent Test**: Delay success and failure deterministically, inject a source-only sentinel, and inspect visual and accessibility trees in default, reduced-motion, forced-color, dark, and light states.

- [x] T010 [US2] Add failing pending-source privacy, status, timeout, theme, and accessibility tests in `apps/glitchpad/src/components/MarkdownSurface.test.tsx`
- [x] T011 [US2] Replace raw pending source with a static accessible state in `apps/glitchpad/src/components/MarkdownSurface.tsx` and `apps/glitchpad/src/styles.css`

## Phase 5: User Story 3 - Use a stable menu clear of scrollbars (Priority: P1)

**Goal**: Menu disclosure never moves its trigger, overlaps document scrollbars, or reflows the document.

**Independent Test**: Measure trigger, popup, viewport, and scrollbar geometry before, during, and after disclosure across shell states and governed accessibility preferences.

- [x] T012 [US3] Add failing focus, dismissal, stable-structure, and geometry-contract coverage in `apps/glitchpad/src/components/ApplicationMenu.test.tsx` and `apps/glitchpad/src/App.test.tsx`
- [x] T013 [US3] Separate fixed trigger and popup geometry and left-anchor the menu in `apps/glitchpad/src/components/ApplicationMenu.tsx` and `apps/glitchpad/src/styles.css`
- [x] T014 [US3] Add static geometry-policy assertions for the left anchor and independently positioned popup in `scripts/check-windows-package.test.mjs`

## Phase 6: User Story 4 - Keep the repository header compact (Priority: P2)

**Goal**: Remove only the redundant Platforms badge.

**Independent Test**: Validate the badge is absent while supported-platform prose and unrelated badges remain.

- [x] T015 [US4] Add a public-surface regression assertion for README badge and platform prose in `scripts/check-public-release.test.mjs`
- [x] T016 [US4] Remove only the Platforms badge from `README.md`

## Phase 7: Packaged regression prevention

- [x] T017 Extend Windows package-policy tests for two-document ordering, blank/source-flash detection, active identity, containment, and menu geometry in `scripts/check-windows-package.test.mjs`
- [x] T018 Extend final portable and installed artifact UI Automation evidence in `scripts/windows/test-portable-lifecycle.ps1` and its policy coverage in `scripts/check-windows-package.test.mjs`
- [x] T019 Wire the governed Markdown corpus and both open orders into `.github/workflows/windows-package.yml`

## Phase 8: Polish and verification

- [x] T020 Run focused frontend, accessibility, corpus, browser, documentation, and Windows package-policy checks from `specs/030-desktop-corrections/quickstart.md`
- [x] T021 Run the complete repository gate and record real results in `specs/030-desktop-corrections/verification.md`
- [x] T022 Mark every completed task, verify UTF-8 without BOM and mojibake absence, and reconcile S030 against issues #160-#163 in `specs/030-desktop-corrections/tasks.md`
- [x] T023 Cap frontend test concurrency in `apps/glitchpad/vitest.config.ts` after the full suite exposed fork-start timeouts under bind-mounted workspace I/O pressure
- [x] T024 Reject an already-ready projection synchronously when the active source revision changes in `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T025 Address first-round Codex findings by monitoring actual raw sentinels from delivery through safe settlement and exercising nontrivial table, footnote, nesting, and embedded-Mermaid paths in final Windows artifacts
- [x] T026 Address second-round Codex findings by synchronizing incoming presentation mode before paint and suppressing a failed projection throughout revision-scoped source recovery
- [x] T027 Correct final-artifact raw-source sentinels to unused Markdown reference definitions so safe inert-HTML rendering cannot create a false positive
- [x] T028 Assert packaged footnote content through bounded UI Automation text discovery instead of an incorrect exact-name element assumption

## Dependencies and execution order

T001-T006 establish the feature context, fixtures, release delta, and containment boundary. US1 then proves document identity and failure containment. US2 strengthens the same Markdown lifecycle without source exposure. US3 is independently implementable after the shared shell foundation. US4 is independent after setup. T017-T019 validate the integrated user stories against packaged Windows artifacts. T020-T022 run last.

## Parallel opportunities

T002 and T003 touch independent files. US3 and US4 do not depend on Markdown lifecycle implementation and may proceed after the foundational phase. Windows policy assertions can be drafted after contracts are fixed, but final lifecycle evidence depends on the integrated application behavior.

## Implementation strategy

First guarantee that a document failure cannot erase the shell. Then prove renderer identity and stale-result rejection, remove source-bearing pending content, stabilize menu geometry, apply the surgical README fix, and finally strengthen final-artifact Windows evidence before the aggregate gate.
