# Tasks: Android Source Lifecycle

**Input**: Design documents from `specs/011-android-source-lifecycle/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: S011 requires test-first Rust, Kotlin JVM, controlled-provider instrumentation, and API 24/API 36 CI evidence.

**Organization**: Tasks are grouped by user story. Story tests are written and observed failing before the matching implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an incomplete task.
- **[Story]**: Maps the task to a user story in [spec.md](spec.md).

## Phase 1: Setup

**Purpose**: Establish the private mobile-plugin project and Android test structure without changing product behavior.

- [x] T001 Add the private `glitchpad-android-source` workspace member and Tauri mobile-plugin build configuration in `Cargo.toml`, `crates/glitchpad-android-source/Cargo.toml`, and `crates/glitchpad-android-source/build.rs`
- [x] T002 Add the Android plugin library skeleton and pinned Kotlin/Android configuration in `crates/glitchpad-android-source/android/build.gradle.kts` and `crates/glitchpad-android-source/android/src/main/AndroidManifest.xml`
- [x] T003 [P] Configure Android JVM and instrumentation dependencies, runner, test manifest, and private-state backup exclusion in `crates/glitchpad-host/gen/android/app/build.gradle.kts`, `crates/glitchpad-host/gen/android/app/src/androidTest/AndroidManifest.xml`, `crates/glitchpad-host/gen/android/app/src/main/AndroidManifest.xml`, and `crates/glitchpad-host/gen/android/app/src/main/res/xml/backup_rules.xml`

---

## Phase 2: Foundational Contracts

**Purpose**: Correct cross-platform metadata assumptions and define typed Android bridge values before provider operations.

- [x] T004 Write failing shared contract and schema tests for optional provider byte length, Android grant state, delivery kind, restoration status, and safe serialization in `crates/glitchpad-core/src/source.rs` and `crates/glitchpad-core/tests/contract_schema.rs`
- [x] T005 Implement the portable Android source, grant, picker, restoration, and Save As value contracts and change shared byte lengths to explicit optional values in `crates/glitchpad-core/src/source.rs`
- [x] T006 Update desktop source construction and conformance expectations to populate optional lengths without changing desktop semantics in `crates/glitchpad-host/src/source/mod.rs`, `crates/glitchpad-host/src/source/identity.rs`, and `crates/glitchpad-host/tests/desktop_source_conformance.rs`
- [x] T007 [P] Define URI-free typed plugin request and result models plus stable native result codes in `crates/glitchpad-android-source/src/models.rs` and `crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/Models.kt`
- [x] T008 Implement mobile plugin registration and the Rust plugin handle in `crates/glitchpad-android-source/src/lib.rs` and `crates/glitchpad-android-source/src/mobile.rs`

**Checkpoint**: Shared contracts represent unknown Android facts without fabrication, desktop tests remain unchanged in meaning, and the private plugin compiles.

---

## Phase 3: User Story 1 - Open content delivered by Android (Priority: P1) MVP

**Goal**: Acquire safe provider-native sources from inbound view/share deliveries and Glitchpad-initiated Open picker results.

**Independent Test**: Controlled initial and redelivered intents plus Open picker results yield one safe source summary or deterministic rejection without exposing URI/path authority.

### Tests for User Story 1

- [x] T009 [P] [US1] Write failing Kotlin JVM tests for inbound action normalization, duplicate share compatibility, distinct multi-item rejection, picker-result classification, grant intersection, and redaction in `crates/glitchpad-android-source/android/src/test/java/com/shruggietech/glitchpad/source/DeliveryPolicyTest.kt`
- [x] T010 [P] [US1] Write failing Rust host tests for strong/weak Android identity, session deduplication, capability derivation, stable errors, and delivery queue bounds in `crates/glitchpad-host/tests/android_source_contract.rs`
- [x] T011 [P] [US1] Create failing instrumentation acquisition scenarios and the controlled provider metadata fixtures in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/FixtureDocumentsProvider.kt` and `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidSourceInstrumentedTest.kt`

### Implementation for User Story 1

- [x] T012 [US1] Implement pure inbound/picker delivery normalization and grant-mode policy in `crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/DeliveryPolicy.kt`
- [x] T013 [US1] Implement the native-private URI registry, initial intent load, `onNewIntent` queue, Open picker launch/result, provider metadata query, document identity, grant verification, and stable redaction in `crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/AndroidSourcePlugin.kt`
- [x] T014 [US1] Implement Rust Android acquisition policy, public source registry, queue draining, capability mapping, identity deduplication, and host-safe errors in `crates/glitchpad-host/src/android_source/policy.rs` and `crates/glitchpad-host/src/android_source/mod.rs`
- [x] T015 [US1] Register the private plugin, Android host state, and renderer-facing acquisition commands only on Android builds in `crates/glitchpad-host/src/lib.rs` and `crates/glitchpad-host/Cargo.toml`

**Checkpoint**: View, single-item share, and Open picker acquisition are independently functional and tested; no raw URI or path crosses the bridge.

---

## Phase 4: User Story 2 - Read and survive Android lifecycle changes (Priority: P1)

**Goal**: Provide bounded provider reads, explicit seek/stream capability, revalidation, grant revocation, and safe restoration after activity or process recreation.

**Independent Test**: Controlled seekable, pipe, missing-metadata, renamed, failed, revoked, persisted, and temporary provider fixtures return bounded values and explicit lifecycle states on both required API levels.

### Tests for User Story 2

- [x] T016 [P] [US2] Extend Rust tests with failing boundary/property cases for range and stream budgets, optional metadata, revalidation, lease invalidation, restoration limits, and revoked/unavailable mapping in `crates/glitchpad-host/tests/android_source_contract.rs`
- [x] T017 [P] [US2] Extend instrumentation fixtures with failing seekable, pipe, missing-metadata, rename, mutation, provider-failure, persistence-rejection, and revoked-grant scenarios in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/FixtureDocumentsProvider.kt` and `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidSourceInstrumentedTest.kt`
- [x] T018 [P] [US2] Write failing two-phase process-restoration instrumentation and force-stop driver assertions in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/RestorationInstrumentedTest.kt` and `.github/workflows/ci.yml`

### Implementation for User Story 2

- [x] T019 [US2] Implement cancellation-aware off-main-thread descriptor reads, seek probing, bounded stream leases, metadata refresh, revalidation, and close in `crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/AndroidSourcePlugin.kt`
- [x] T020 [US2] Implement bounded application-private restoration records for actually persisted grants, held-permission reconciliation, activity reload handling, and native registry replacement in `crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/RestorationStore.kt`
- [x] T021 [US2] Implement Rust range/stream/metadata/revalidation/restoration/close policy, public stream leases, and Android command wiring in `crates/glitchpad-host/src/android_source/mod.rs` and `crates/glitchpad-host/src/lib.rs`
- [x] T022 [US2] Complete the controlled provider behavior needed for real descriptor, grant, metadata, and lifecycle evidence in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/FixtureDocumentsProvider.kt`

**Checkpoint**: Android sources remain provider-native, bounded, revalidated, and explicit across temporary, persisted, revoked, renamed, unavailable, and restored states.

---

## Phase 5: User Story 3 - Save through Android providers without silent loss (Priority: P1)

**Goal**: Deliver safe Save As through `ACTION_CREATE_DOCUMENT` while refusing unproven generic in-place replacement.

**Independent Test**: Controlled cancellation, read-only, stale, revoked, successful create/write, short-write, close-error, and provider-failure fixtures issue a receipt only for a completely verified new destination.

### Tests for User Story 3

- [x] T023 [P] [US3] Write failing Rust tests for Save As payload bounds, caller-owned byte preservation, forbidden direct update, receipt verification, and close cleanup in `crates/glitchpad-host/tests/android_source_contract.rs`
- [x] T024 [P] [US3] Write failing instrumentation Save As scenarios for picker cancellation, success, short write, provider exception, close error, read-back mismatch, persisted result, and new-source acquisition in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidSourceInstrumentedTest.kt`

### Implementation for User Story 3

- [x] T025 [US3] Implement create-document picker launch/result handling, complete-payload staging, bounded provider write, close/error detection, read-back verification, grant acquisition, and bridge receipts in `crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/AndroidSourcePlugin.kt`
- [x] T026 [US3] Implement Rust Save As operation state, one-use Tauri invoke authorization, payload retention on failure, verified receipt construction, direct-update refusal, and new-source registration in `crates/glitchpad-host/src/android_source/mod.rs`
- [x] T027 [US3] Register Android Save As commands and safe serialized results in `crates/glitchpad-host/src/lib.rs` and update the TypeScript contract projection in `apps/glitchpad/src/domain/contracts.ts`

**Checkpoint**: Save As is complete and verifiable; unknown providers cannot silently opt into unsafe in-place replacement.

---

## Phase 6: Cross-Cutting Verification and Delivery

**Purpose**: Prove the complete issue acceptance matrix and prepare an official reviewable change.

- [x] T028 Add independent headless x86_64 API 24/API 36 emulator jobs, immutable action pins, bounded timeouts, and failure artifacts while retaining the ARM64 package job in `.github/workflows/ci.yml`
- [x] T029 Add static repository checks for Android path derivation, raw URI disclosure, Kotlin policy creep, required test fixtures, and API matrix configuration in `crates/xtask/src/main.rs`
- [x] T030 [P] Add issue-linked changelog and unreleased technical delta documentation in `changelog.d/47.added.md` and `docs/glitchpad-technical-specification.md`
- [x] T031 [P] Update Android validation commands and environment guidance where necessary in `CONTRIBUTING.md` and `specs/011-android-source-lifecycle/quickstart.md`
- [ ] T032 Run focused Rust, Kotlin JVM, Android debug build, available local instrumentation, formatting, lint, schema, documentation, dependency/license, encoding, mojibake, and `pnpm check` gates; record any hardware-only API evidence as a CI-required check in `specs/011-android-source-lifecycle/tasks.md`

Validation note: Rust workspace tests, clippy, Android Rust cross-compilation, frontend, site, dependency policy, Markdown, links, Mermaid, UTF-8, mojibake, and static Android architecture checks pass locally. This Windows host cannot start Gradle because both installed JDKs fail while establishing Gradle's loopback selector before project compilation; the official API 24/API 36 Linux emulator matrix is therefore the required Kotlin, APK, controlled-provider, and force-stop restoration evidence for T032.

---

## Dependencies & Execution Order

### Phase dependencies

- Setup precedes all source work.
- Foundational contracts depend on Setup and block every user story.
- User Story 1 establishes acquisition and must complete before User Story 2 or User Story 3 integrates with a source.
- User Story 2 and User Story 3 may proceed after User Story 1; their tests and implementation touch different provider behaviors but share the plugin file and therefore merge sequentially.
- Cross-cutting verification depends on all three stories.

### Within each story

- Test tasks must be written and observed failing before implementation tasks.
- Kotlin native mechanics precede Rust host integration for the same operation.
- Rust policy and public command wiring precede story completion.
- Every checkpoint must pass focused tests before the next phase.

### Parallel opportunities

- T003 can proceed independently from the plugin crate skeleton.
- T007 can proceed while shared Rust contracts are being corrected.
- T009, T010, and T011 are separate US1 test surfaces.
- T016, T017, and T018 are separate US2 test surfaces.
- T023 and T024 are separate US3 test surfaces.
- T030 and T031 are independent documentation updates after behavior stabilizes.

## Implementation strategy

1. Establish the private plugin and portable contracts.
2. Deliver inbound and Open picker acquisition as the MVP.
3. Add bounded reads, restoration, and revalidation.
4. Add verified Save As and keep generic direct update disabled.
5. Prove API 24/API 36 behavior and the existing aggregate repository gates.

## Notes

- No task adds released MIME intent filters, editor policy, dirty-state recovery, or format rendering.
- The existing generated `MainActivity.kt` remains unchanged unless Tauri's documented plugin forwarding is empirically disproven; any deviation requires a dated plan update.
- Every completed implementation task must be marked `[x]` only after its stated tests pass.
