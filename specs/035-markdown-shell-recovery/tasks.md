# Tasks: Markdown Recovery and Reserved Shell Chrome

**Input**: Design documents from `/specs/035-markdown-shell-recovery/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/desktop-presentation.md

**Tests**: Automated compatibility, component, accessibility, rendered-geometry, package-policy, and final-byte Windows tests are required by FR-017 through FR-023.

## Phase 1: Setup

- [x] T001 Record the active S035 directory in `.specify/feature.json`
- [x] T002 [P] Record the S035 design, runtime compatibility boundary, shell geometry, and content-free evidence contract in `specs/035-markdown-shell-recovery/`
- [x] T003 [P] Add safe minimal, governed-complex, same-bytes/different-name, and long-and-wide Markdown fixtures to the existing test and Windows lifecycle fixture systems

## Phase 2: Foundational compatibility and recovery tests

- [x] T004 Add failing Chrome 69 compatibility coverage for projection, cleanup, worker startup, and production output in `apps/glitchpad/src/runtime-polyfills.test.ts`, `apps/glitchpad/src/components/MarkdownSurface.test.tsx`, and package policy tests
- [x] T005 Add failing contained-failure, compact-layout, source-recovery, fresh-retry, repeated-failure, stale-attempt, close/reopen, and restoration tests in `apps/glitchpad/src/components/DocumentSurface.test.tsx`, `apps/glitchpad/src/components/MarkdownSurface.test.tsx`, and `apps/glitchpad/src/App.test.tsx`
- [x] T006 Add failing empty/single/multi-document shell ownership, connected-focus, first-enabled-item, coarse-target, and disclosure behavior tests in `apps/glitchpad/src/App.test.tsx` and `apps/glitchpad/src/components/ApplicationMenu.test.tsx`

## Phase 3: User Story 1 - Restore Markdown preview and recovery (Priority: P1)

**Goal**: Supported Markdown renders normally and any contained failure has compact, explicit, repeatable recovery without restart.

**Independent Test**: Open minimal and governed Markdown in both orders, inject projection and renderer failures, choose source, retry to success and failure, close/reopen, and restore state while the shell stays usable and private content stays absent from evidence.

- [x] T007 [US1] Replace unsupported Chrome 69 primitives in `apps/glitchpad/src/components/MarkdownSurface.tsx` and `apps/glitchpad/src/domain/markdown-worker.ts`
- [x] T008 [US1] Implement revision-scoped suppression plus retry-attempt ownership and stale-attempt rejection in `apps/glitchpad/src/components/DocumentSurface.tsx` and `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T009 [US1] Add visible Retry preview actions and preserve explicit source, close, open, menu, and diagnostics access in `apps/glitchpad/src/components/DocumentSurface.tsx`, `apps/glitchpad/src/components/MarkdownSurface.tsx`, and `apps/glitchpad/src/App.tsx`
- [x] T010 [US1] Constrain contained failure and recovery layouts to intrinsic rows with compact accessible control states in `apps/glitchpad/src/styles.css`

## Phase 4: User Story 2 - Reserve compact shell chrome (Priority: P1)

**Goal**: Persistent application controls occupy a stable in-flow region and never obscure any document surface or scrollbar.

**Independent Test**: Measure the toolbar, trigger, glyph, popup, document client, and scroll offsets before, during, and after disclosure with empty, single, and multiple documents under fine/coarse pointer and accessibility preferences.

- [x] T011 [US2] Introduce the shared in-flow shell row and keep its layout owner stable across empty, document, panel, and inspector states in `apps/glitchpad/src/App.tsx`
- [x] T012 [US2] Make the application menu support empty-state commands, first-enabled focus, connected focus restoration, and a dedicated compact glyph in `apps/glitchpad/src/components/ApplicationMenu.tsx`
- [x] T013 [US2] Implement 32px desktop, 40px tabbed, 44px coarse-pointer, 18px glyph, viewport-bounded popup, print, theme, and forced-color geometry in `apps/glitchpad/src/styles.css`
- [x] T014 [US2] Replace policy assertions for the defective absolute overlay with reserved-shell structural and geometry invariants in `scripts/check-windows-package.test.mjs`

## Phase 5: Rendered geometry and packaged regression prevention

- [x] T015 Add a production-build Puppeteer geometry probe for shell disclosure and compact failure rows in `scripts/check-shell-layout.mjs` and wire `check:shell-layout` through `package.json` and `crates/xtask/src/main.rs`
- [x] T016 Extend portable and installed Windows lifecycle UI Automation for minimal/complex/order/same-bytes/close-reopen/restoration/delivery flows and measured toolbar/document/popup geometry in `scripts/windows/test-portable-lifecycle.ps1` and `scripts/windows/test-installer-lifecycle.ps1`
- [x] T017 Extend the closed receipt allowlist, artifact identity checks, content-free assertions, and workflow fixtures in `scripts/check-windows-package.mjs`, `scripts/check-windows-package.test.mjs`, and `.github/workflows/windows-package.yml`
- [x] T018 Add a named focused Markdown-recovery and shared-shell smoke step to the Windows, macOS, and Linux matrix in `.github/workflows/ci.yml`

## Phase 6: Polish and verification

- [x] T019 Run focused compatibility, component, accessibility, geometry, and package-policy checks from `specs/035-markdown-shell-recovery/quickstart.md`
- [ ] T020 Run the complete repository gate and record exact local plus hosted results in `specs/035-markdown-shell-recovery/verification.md`
- [ ] T021 Mark completed tasks, verify UTF-8 without BOM and mojibake absence, and reconcile S035 against #171, #172, and focused evidence for #66 in `specs/035-markdown-shell-recovery/tasks.md`

## Dependencies and execution order

T001-T003 establish the feature context and safe fixtures. T004-T006 add failing evidence before implementation. US1 and US2 can then proceed independently because they touch separate lifecycle and shell ownership concerns, but both must settle before the integrated browser and package gates. T015-T018 validate the combined capability. T019-T021 run last.

## Parallel opportunities

T003 can proceed beside the three foundational test groups. After T006, US2 can proceed independently of US1. The package-policy and workflow assertions can be drafted beside the browser probe, but final lifecycle evidence depends on the integrated application behavior and exact candidate artifacts.

## Implementation strategy

First lock in failing compatibility, retry, intrinsic-layout, and shell-ownership cases. Then harden the runtime boundary and recovery attempt model, move the menu into reserved shell chrome, and validate their combined geometry in a production browser. Finally extend exact packaged Windows evidence, run the complete repository gate, publish the pull request, address at most two review rounds, and wait for green hosted checks before final-review handoff.
