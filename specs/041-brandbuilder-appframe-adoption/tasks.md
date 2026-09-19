# Tasks: BrandBuilder AppFrame Adoption

**Input**: Design documents from `specs/041-brandbuilder-appframe-adoption/`

**Tests**: Required. Add each regression first and observe failure before implementation.

## Phase 1: Pinned Contract

- [x] T001 Record issue #196, upstream issue #219, exact upstream revision, workflow artifact, existing shell ownership, and historical measurement limitations in `specs/041-brandbuilder-appframe-adoption/verification.md`
- [x] T002 Import the complete verified S042 kit and immutable receipt through `scripts/sync-brand-kit.mjs`

## Phase 2: User Story 1 - One shell contract (P1)

- [x] T003 [P] [US1] Add failing AppFrame composition, full-bleed, viewport, scroll-owner, menu, and accessibility assertions in `apps/glitchpad/src/App.test.tsx` and `scripts/check-shell-layout.mjs`
- [x] T004 [P] [US1] Add failing governance merge and exact-kit assertions in the existing brand contract checks
- [x] T005 [US1] Mount generated AppFrame and environment bridge in `apps/glitchpad/src/main.tsx` and `apps/glitchpad/src/App.tsx`, remove duplicate root geometry from `apps/glitchpad/src/styles.css`, and add `viewport-fit=cover` to `apps/glitchpad/index.html`
- [x] T006 [US1] Merge one generated BrandBuilder governance block into root `AGENTS.md` without replacing human instructions and update `CHANGELOG.md`

## Phase 3: User Story 2 - Android boundaries (P2)

- [x] T007 [US2] Add real-WebView ownership, portrait, landscape, IME, focus, menu, and cutout assertions in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/shell/BrandBuilderAppFrameInstrumentedTest.kt`
- [x] T008 [US2] Wire the evidence through `.github/workflows/ci.yml` and `scripts/run-android-instrumentation.sh` for API 24 and API 36

## Phase 4: User Story 3 - Windows preservation (P3)

- [x] T009 [US3] Extend `scripts/check-shell-layout.mjs` and `scripts/check-windows-package.mjs` for native titlebar separation, keyboard focus, narrow layout, and single root ownership
- [ ] T010 [US3] Run the real Windows Tauri build/package checks and record the exact result in `specs/041-brandbuilder-appframe-adoption/verification.md`

## Phase 5: User Story 4 - Handover (P4)

- [ ] T011 [US4] Record focused checks, actual-host evidence, observations, limitations, recovery, capability gaps, and merge order in `specs/041-brandbuilder-appframe-adoption/verification.md`
- [ ] T012 [US4] Run the documented aggregate validation, encoding, mojibake, diff, and repository-hygiene gates
- [ ] T013 [US4] Commit, push, publish the downstream PR, address every CI/review finding, and request no more than one manual second Codex review round

## Dependencies

- T002 depends on a successful upstream S042 artifact.
- T003 and T004 follow the import and precede production adoption.
- T007 and T009 follow the adopted DOM contract but cover independent hosts.
- T010 through T013 require all implementation tasks.
