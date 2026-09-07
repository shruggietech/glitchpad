# Tasks: Ship Android Packages

**Input**: Design documents from `specs/022-android-packaging/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Automated package, assembly, manifest, ABI, signing, SBOM, provenance, and regression tests are required and precede their corresponding implementations. Manual and physical-device validation is deferred until after v0.1.0 publication.

**Organization**: Tasks are grouped by user story so each Android delivery concern remains independently testable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish governed Android package inputs and the reusable hidden build environment.

- [x] T001 Create Android package policy, intent map, notice, and operator guide in `packaging/android/`
- [x] T002 [P] Add the Android-only Tauri candidate overlay in `crates/glitchpad-host/tauri.s022-android.conf.json`
- [x] T003 [P] Add a pinned reusable `android-package` target to `scripts/docker/validation.Dockerfile`
- [x] T004 [P] Register Android package commands and validation routing in `package.json`, `crates/xtask/src/main.rs`, and `.github/labeler.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define failing package, assembly, and supply-chain contracts before implementation.

- [x] T005 Add failing package-contract, manifest, ABI, permission, size, authority, and evidence tests in `scripts/check-android-package.test.mjs`
- [x] T006 [P] Add failing final-byte naming, copy, checksum, inventory-binding, and provenance tests in `scripts/android/assemble-package.test.mjs`
- [x] T007 Add failing Android-inclusive CycloneDX tests in `scripts/check-android-package.test.mjs`
- [x] T008 Implement ignored release-signing input loading and fail-closed partial-input handling in `crates/glitchpad-host/gen/android/app/build.gradle.kts`

**Checkpoint**: New contract tests fail only for missing Android packaging implementation while the existing Android source and desktop package behavior remains unchanged.

---

## Phase 3: User Story 1 - Obtain installable Android release packages (Priority: P1) MVP

**Goal**: Produce one universal APK, one ARM64 APK, and one AAB with consistent v0.1.0 identity.

**Independent Test**: Build and inspect all three candidates from one source revision, proving package identity, API levels, build mode, ABI composition, final names, and size classification.

- [x] T009 [US1] Configure v0.1.0 Android identity and release settings in `crates/glitchpad-host/tauri.s022-android.conf.json` and `crates/glitchpad-host/gen/android/app/build.gradle.kts`
- [x] T010 [US1] Implement universal and split ARM64 final-byte assembly in `scripts/android/assemble-package.mjs`
- [x] T011 [US1] Implement APK/AAB metadata, ABI, build-mode, and size inspection in `scripts/check-android-package.mjs`
- [x] T012 [US1] Add the governed candidate build and artifact upload path in `.github/workflows/android-package.yml`
- [x] T013 [US1] Build the reusable Android image and produce the actual three-artifact candidate locally before push

**Checkpoint**: All three canonical candidates exist and pass identity, API, ABI, build-mode, and size checks without device execution.

---

## Phase 4: User Story 2 - Receive truthful Android document intents (Priority: P1)

**Goal**: Package only stable text-family view and single-item share declarations without broad storage access.

**Independent Test**: Extract merged manifests from final APK/AAB bytes and compare every exported component, action, category, scheme, media type, extension, permission, cleartext, and backup declaration with the governed contract.

- [x] T014 [US2] Add exact stable text-family view and single-item share filters to `crates/glitchpad-host/gen/android/app/src/main/AndroidManifest.xml`
- [x] T015 [US2] Implement cross-contract intent and forbidden-format validation in `scripts/check-android-package.mjs`
- [x] T016 [US2] Verify package-private provider, backup posture, no broad storage permission, release cleartext denial, and non-debuggable output in `scripts/check-android-package.mjs`
- [x] T017 [US2] Add mutation cases for merged-manifest broadening and prohibited component/permission claims in `scripts/check-android-package.test.mjs`

**Checkpoint**: Final package manifests expose exactly the stable text-family surface and reject every governed broadening mutation.

---

## Phase 5: User Story 3 - Verify Android artifact identity and provenance (Priority: P2)

**Goal**: Bind signed final bytes to complete content-free release evidence while keeping candidate and official authority distinct.

**Independent Test**: Mutate or omit each artifact, signature, checksum, inventory, SBOM, provenance, notice, authority, and freshness fact and prove deterministic rejection.

- [x] T018 [US3] Implement candidate and official APK/AAB signing verification plus same-certificate enforcement in `scripts/check-android-package.mjs`
- [x] T019 [US3] Implement normalized inventories, exact checksum file, package manifest, and provenance in `scripts/android/assemble-package.mjs`
- [x] T020 [US3] Implement Cargo, production JavaScript, and Maven dependency coverage in `scripts/generate-android-sbom.mjs`
- [x] T021 [US3] Enforce evidence completeness, final-byte binding, sensitive-data exclusion, and candidate-versus-official authority in `scripts/check-android-package.mjs`
- [x] T022 [US3] Generate disposable pull-request signing authority and upload only non-official candidates in `.github/workflows/android-package.yml`
- [x] T023 [US3] Add Android official-authority preflight without publication to `.github/workflows/release.yml`

**Checkpoint**: Candidate mode validates three consistently signed final artifacts without authority inflation, while official mode fails closed without repository-provisioned signing inputs and authorized tag context.

---

## Phase 6: Polish and Cross-Cutting Concerns

**Purpose**: Complete documentation, traceability, regression protection, and pre-publish evidence.

- [x] T024 [P] Record the Android package increment and deferred manual-validation policy in `changelog.d/65.added.md` and `packaging/android/README.md`
- [x] T025 [P] Document automated candidate commands and S023 handoff in `specs/022-android-packaging/quickstart.md`
- [x] T026 Run focused Node, Kotlin, Rust, frontend, formatting, manifest, package, signing, SBOM, provenance, and documentation checks in approved hidden containers
- [x] T027 Inspect the actual universal APK, ARM64 APK, and AAB final bytes locally and record content-free results in `specs/022-android-packaging/verification.md`
- [x] T028 Run the complete `cargo xtask check` repository gate in `glitchpad-validation:local`
- [x] T029 Check changed text for UTF-8 without BOM and mojibake, then finalize `specs/022-android-packaging/verification.md`
- [x] T030 Mark every implemented task complete in `specs/022-android-packaging/tasks.md` and verify spec, plan, contracts, implementation, and evidence agree

---

## Dependencies and Execution Order

- **Setup**: Starts immediately.
- **Foundational**: Depends on setup and blocks implementation.
- **US1**: Depends on foundational signing and contract tests and produces the final artifact set.
- **US2**: Depends on US1 package outputs for merged-manifest inspection but can implement source declarations alongside late US1 work.
- **US3**: Depends on final signed bytes and normalized inventories from US1 plus the exact public surface from US2.
- **Polish**: Depends on all stories; focused and aggregate gates must pass before push or pull-request publication.

## Parallel Opportunities

- T002, T003, and T004 affect independent setup surfaces.
- T006 and T007 define separate assembly and SBOM failure contracts after the central package test begins.
- T014 and T018 affect separate manifest and signing surfaces after base artifacts build.
- T024 and T025 are independent documentation updates after behavior stabilizes.

## Implementation Strategy

1. Establish the package contract, intent map, overlay, reusable Android image, and failing tests.
2. Add secret-safe signing configuration and build the three artifact roles.
3. Inspect final package metadata, ABI contents, release posture, and intent surface.
4. Generate final-byte checksums, inventories, SBOM, provenance, and authority evidence.
5. Run focused checks, build actual candidates locally, then run the complete repository gate.
6. Push and publish the pull request only after local checks are green.

## Notes

- S022 includes issue #65 only.
- Automated tests precede implementation for each new package contract.
- The Android package image is built once and reused; do not install its toolchain repeatedly in disposable containers.
- Branch and pull-request artifacts remain non-official and cannot publish.
- Manual and physical-device validation is post-release and must not delay S022 closure or v0.1.0 publication.
