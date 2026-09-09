# Tasks: Android File Opener Correction

**Input**: Design documents from `/specs/031-android-file-opener/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/android-file-opener.md

**Tests**: Automated policy, parser, installed-package resolver, cold/warm delivery, final-package, privacy, and API-level tests are required by FR-007 through FR-012.

## Phase 1: Setup

- [x] T001 Record the active S031 directory in `.specify/feature.json`
- [x] T002 [P] Record Android resolver correction and generic-provider limits in `docs/releases/v0.1.2.md`

## Phase 2: Foundational resolver policy

- [x] T003 Add explicit resolver filter groups and generic-type boundaries to `packaging/android/intent-map.json`
- [x] T004 Add failing grouped-filter parser and policy tests in `scripts/check-android-package.test.mjs`
- [x] T005 Preserve normalized intent-filter groups while parsing source and final manifests in `scripts/check-android-package.mjs`
- [x] T006 Reject merged filter semantics that weaken or silently disable governed matching in `scripts/check-android-package.mjs`

## Phase 3: User Story 1 - Select Glitchpad from Open with (Priority: P1)

**Goal**: Every governed exact type resolves for opaque content URIs while negative formats remain excluded.

**Independent Test**: Query the installed package manager on API 24 and API 36 with the complete positive and negative matrix.

- [x] T007 [US1] Replace ineffective suffix-coupled opener declarations with exact-type content opener declarations in `crates/glitchpad-host/gen/android/app/src/main/AndroidManifest.xml`
- [x] T008 [US1] Add opaque exact-type, caller-wildcard, and negative resolver matrix tests in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidResolverInstrumentedTest.kt`
- [x] T009 [US1] Require universal and ARM64 final APK grouped-filter equivalence in `scripts/check-android-package.mjs` and `scripts/check-android-package.test.mjs`

## Phase 4: User Story 2 - Open the selected document (Priority: P1)

**Goal**: Resolved cold and warm intents display the correct controlled document.

**Independent Test**: Stop Glitchpad, deliver the first provider fixture, deliver a second fixture to the running single task, and assert visible filename and marker identity after each transition.

- [x] T010 [US2] Add safe cold and warm delivery fixtures in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/FixtureDocumentsProvider.java`
- [x] T011 [US2] Add resolved cold-start and warm-delivery assertions in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidResolverInstrumentedTest.kt`
- [x] T012 [US2] Add redacted resolver and delivery evidence output in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidResolverInstrumentedTest.kt`

## Phase 5: User Story 3 - Handle generic provider types honestly (Priority: P2)

**Goal**: Generic provider behavior is bounded, deterministic, and documented.

**Independent Test**: Query suffix-bearing and opaque generic-type cases and confirm both reject outcomes match the machine-readable policy and release note.

- [x] T013 [US3] Add suffix-bearing and opaque generic-type rejection probes in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidResolverInstrumentedTest.kt`
- [x] T014 [US3] Add generic-provider documentation and policy consistency assertions in `scripts/check-android-package.test.mjs`

## Phase 6: CI and final-package integration

- [x] T015 Run resolver and delivery instrumentation in the API 24 and API 36 matrix in `.github/workflows/ci.yml`
- [x] T016 Inspect final universal and ARM64 APK resolver groups in `.github/workflows/android-package.yml`
- [x] T017 Upload redacted resolver receipts with existing Android evidence in `.github/workflows/ci.yml` and `.github/workflows/android-package.yml`

## Phase 7: Polish and verification

- [x] T018 Run focused Android policy and parser checks from `specs/031-android-file-opener/quickstart.md`
- [x] T019 Run all locally available format, lint, unit, documentation, security, and package gates and record results in `specs/031-android-file-opener/verification.md`
- [x] T020 Mark every completed task, verify UTF-8 without BOM and mojibake absence, and reconcile S031 against issue #159 in `specs/031-android-file-opener/tasks.md`

## Dependencies and execution order

T001-T006 establish the feature context and grouped policy. US1 corrects and proves resolver eligibility. US2 depends on successful US1 resolution and proves the document reaches the viewport. US3 extends the same policy with bounded generic behavior. T015-T017 integrate final evidence after all stories pass. T018-T020 run last.

## Parallel opportunities

T002 can proceed independently of the resolver policy. Test fixtures in T010 may be prepared while US1 parser tests are developed, but delivery assertions depend on the corrected manifest. CI wiring can be drafted after the instrumentation class and final-package command contract are stable.

## Implementation strategy

First make filter semantics explicit and testable, then correct exact-type eligibility, follow resolution through cold and warm delivery, document bounded generic behavior, and finally bind the same evidence to final package roles and the complete repository gate.
