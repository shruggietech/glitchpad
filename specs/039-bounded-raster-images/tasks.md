# Tasks: S039 Bounded Raster Viewing and Metadata

**Input**: `specs/039-bounded-raster-images/` design documents.

**Prerequisites**: Specification quality passes; plan, research, data model, and contracts are complete.

**Tests**: Explicitly required by FR-019 and every bundled issue acceptance criterion. Write failure-first tests before the corresponding implementation; inspect real validation exit status.

## Phase 1: Setup

- [x] T001 Verify hidden execution, ignore policies, feature prerequisites, and clean baseline in `AGENTS.md`, `.gitignore`, `.dockerignore`, and `.specify/feature.json` (FR-005, FR-022).
- [x] T002 Add reviewed explicit image/EXIF/XML dependencies, license policy, and lockfile in `Cargo.toml`, `crates/glitchpad-core/Cargo.toml`, `Cargo.lock`, and `deny.toml` (FR-020).
- [x] T003 Create reproducible original raster/metadata corpus and provenance under `fixtures/images/` (FR-019, FR-020).

## Phase 2: Foundational Contracts

- [x] T004 Add failure-first family/capability/admission tests in `crates/glitchpad-core/tests/image_contract.rs` for raster, animation, SVG, ICO, version, failure/degradation categories, and immutable limits (FR-001 through FR-004, US3/AC5).
- [x] T005 Implement shared image schema, checked budgets, signature identification, and capability states in `crates/glitchpad-core/src/images.rs` and `lib.rs` (FR-001 through FR-004).
- [x] T006 Add typed optional image session/request/result contracts and failure-first validation tests in `apps/glitchpad/src/domain/image-contract.ts`, `image-contract.test.ts`, and `contracts.ts` (FR-005, FR-018).

## Phase 3: US1 Raster Viewing

**Goal**: Open the five raster codecs through native source flows, preview safely, and operate compact image controls.

**Independent Test**: Each valid codec opens without text decoding; expected orientation/pixels and unchanged source digests pass; read-only viewport actions pass keyboard/touch tests.

- [x] T007 [US1] Add failure-first codec/orientation/color/thumbnail/invalid-input tests in `crates/glitchpad-core/tests/image_decode.rs` (FR-006 through FR-009, FR-011; US1/AC1, AC2, AC4, AC5).
- [x] T008 [US1] Implement explicit-codec dimension admission, bounded raster decode, orientation, color fallback, thumbnail-only degradation, and bounded PNG delivery in `crates/glitchpad-core/src/images.rs` (FR-007 through FR-009, FR-011).
- [x] T009 [US1] Add failure-first source/revision/admission/cancellation tests in `crates/glitchpad-host/src/images.rs` (FR-004, FR-006, FR-018).
- [x] T010 [US1] Implement async narrowly scoped image commands, source reads/revalidation, retained admission permit, and cancellation in `crates/glitchpad-host/src/images.rs`, `lib.rs`, `source/mod.rs`, and `android_source/mod.rs` (FR-004, FR-006, FR-018).
- [x] T011 [US1] Add failure-first image routing/materialization tests in desktop/Android gateway test files and `apps/glitchpad/src/domain/image-gateway.test.ts` (FR-005, FR-006; US1/AC1, AC4).
- [x] T012 [US1] Integrate content-verified image materialization in `image-gateway.ts`, `desktop-delivery-gateway.ts`, `android-restoration-gateway.ts`, and native chooser routing in `desktop_delivery.rs` (FR-005, FR-006, FR-021).
- [x] T013 [US1] Add failure-first viewport/read-only/mobile/pan-recovery tests in `apps/glitchpad/src/components/ImageSurface.test.tsx` (FR-010; US1/AC3).
- [x] T014 [US1] Implement inert owned preview, compact accessible fit/actual-size/zoom/reset/pan/background controls in `ImageSurface.tsx`, `DocumentSurface.tsx`, and application CSS (FR-009 through FR-011).

## Phase 4: US2 Metadata Inspection

**Goal**: Inspect useful image facts with provenance and independent parser statuses without accidental sensitive exposure.

**Independent Test**: Deterministic EXIF/XMP/IPTC fixtures, duplicates, malformed blocks, redacted raw/copy output, and accessible inspector/revision updates pass.

- [x] T015 [US2] Add failure-first bounded EXIF/XMP/IPTC/container/status/privacy tests in `crates/glitchpad-core/tests/image_metadata.rs` (FR-012 through FR-016; US2/AC1 through AC3).
- [x] T016 [US2] Implement checked bounded container metadata extraction and EXIF normalized/original facts in `crates/glitchpad-core/src/image_metadata.rs` (FR-012, FR-013, FR-015).
- [x] T017 [US2] Implement namespace-aware inert XMP subset and bounded IPTC records with encoding/status rules in `image_metadata.rs` (FR-012, FR-015, FR-016).
- [x] T018 [US2] Strip GPS/location/unknown raw payloads before serialization and retain deterministic duplicate/conflict evidence in `image_metadata.rs` (FR-013 through FR-016).
- [x] T019 [US2] Add failure-first image catalog/provenance/sensitivity/copy tests in `apps/glitchpad/src/domain/metadata.test.ts` and inspector tests (FR-012 through FR-016; US2/AC1 through AC3, AC5).
- [x] T020 [US2] Project only registered typed image metadata into the existing inspector in `metadata.ts` and the inspector component (FR-012 through FR-016; US2/AC5).
- [x] T021 [US2] Add failure-first same-session external image refresh and stale-result tests in `tabs.test.ts`, `image-gateway.test.ts`, and `ImageSurface.test.tsx` (FR-017; US2/AC4).
- [x] T022 [US2] Implement atomic image-only source revision/preview/metadata refresh in `tabs.ts`, `App.tsx`, and `ImageSurface.tsx` without changing text behavior (FR-005, FR-017).

## Phase 5: US3 Hostile Inputs and Resource Lifecycle

**Goal**: Bound hostile inputs and prevent suspended/obsolete image work from accumulating resources.

**Independent Test**: Pixel/byte/corpus boundaries, scheduling cancellation, stale completion, admitted-worker accounting, suspension/replacement/close, and zero owned resources pass.

- [x] T023 [US3] Add exact 100/200 MP, overflow, byte/peak/output, and malformed metadata boundary tests in `crates/glitchpad-core/tests/image_contract.rs`, `image_decode.rs`, and `image_metadata.rs` (FR-007, FR-008, FR-015; US3/AC1, AC2).
- [x] T024 [US3] Add native retained-permit/cancel/revoke/stale read tests in `crates/glitchpad-host/src/images.rs` (FR-004, FR-018; US3/AC3).
- [x] T025 [US3] Add background/close/replacement/object-URL/disposal and inert-result tests in `ImageSurface.test.tsx` and `image-gateway.test.ts` (FR-016, FR-018; US3/AC3, AC4).
- [x] T026 [US3] Enforce remaining checked budgets and decode/metadata failure isolation in `images.rs` and `image_metadata.rs` (FR-007, FR-008, FR-015, FR-016).
- [x] T027 [US3] Integrate scheduling cancellation, bounded busy retry, revision rejection, idempotent cleanup, and foreground-only preview ownership in native/frontend image modules (FR-017, FR-018).
- [x] T028 [US3] Extend existing platform evidence entry points with generated raster/metadata contract probes without changing public association/intent activation in `.github/workflows/ci.yml`, platform lifecycle scripts, and Android instrumented tests as needed (FR-019, FR-021; SC-001, SC-002).

## Phase 6: Validation, Convergence, and Review

- [x] T029 Validate dependency licenses/advisories/notices and corpus provenance using repository policies; record in `verification.md` (FR-020).
- [x] T030 Run focused native/frontend/corpus/accessibility/revision/resource tests and record measured results in `verification.md` (FR-019; SC-001 through SC-005).
- [x] T031 Run complete repository gate, UTF-8/BOM/mojibake and diff checks through completion; record in `verification.md` (FR-005, FR-019; SC-002 through SC-006).
- [x] T032 Audit every bundled issue criterion and requirement/scenario against implementation using Spec Kit convergence; append any remaining work to `tasks.md` and implement it (FR-019; SC-006).
- [x] T033 Record unreleased documentation delta and explicit incomplete #74/#75/#76/#66 status in `verification.md` and PR body; preserve public authority (FR-021).
- [x] T034 Commit, automatically push, and publish official S039 PR with #68/#69/#73 traceability using the hidden VCS launcher (FR-022).
- [x] T035 Wait for first external reviews/reactions, remediate and respond to every comment, and resolve satisfied threads; record review ledger in `verification.md` (FR-022).
- [ ] T036 Request at most one explicit second `@codex review` if justified, handle every result, converge after remediation, and wait for all latest required CI/security/docs/platform checks (FR-022; SC-007).
- [ ] T037 Hand the reviewed green PR to the owner for final review/merge; keep it unmerged and report incomplete future issues accurately (FR-022; SC-006, SC-007).

## Dependencies & Execution Order

Setup precedes foundational contracts. US1 depends on foundation, US2 integrates with US1 while its pure parser tests remain independently runnable, and US3 validates both boundaries. Validation/review follows all three stories. Test tasks precede implementation; same-file tasks are sequential. No artificial one-issue slices are created.

## Parallel Opportunities

Research-agent dependency/source inspection can proceed while specification/design is authored. Independent Rust and frontend test invocations may be batched once their implementations are ready. US1 viewport test design and US2 pure metadata fixture design affect separate files after foundation, but mutations sharing native/core integration remain sequential. No parallel marker is applied to dependent tasks.

## Implementation Strategy

First prove US1's five-codec read-only preview end-to-end; then add independently failing metadata subsets and redaction; then complete hostile/lifecycle evidence. All three included issues must be complete before PR handoff. Deferred animation/SVG/ICO/full-controls/conformance/activation work is never closed implicitly.

## Phase 7: Convergence

- [x] T038 Preserve bounded embedded-thumbnail orientation, apply a source-orientation fallback, retain original descriptor facts, and add independent pixel assertions per FR-009 and US1/AC2 (partial).
- [x] T039 Preserve complete bounded XMP scalar text and numeric EXIF/TIFF original arrays, prevent unknown/RDF namespace leakage, and add typed-fact/privacy tests per FR-013, FR-014, and US2/AC1 (partial).

## Phase 8: Convergence

- [x] T040 Preserve GPS sensitivity through every TIFF descendant/sibling and shared IFD independent of traversal order, with failure-first serialization regressions (FR-014; US2/AC2).
- [x] T041 Distinguish exact-limit Android unknown-size streams from oversized input with one bounded EOF byte, retain cleanup/revision checks, and test the real shared stream-drain logic (FR-006, FR-008; US3/AC1).

## Phase 9: Convergence

- [x] T042 Restrict TIFF preview orientation to its primary IFD so later-page tags cannot rotate the first-page preview, and verify unchanged expected first-page pixels with a failure-first test (FR-009, FR-011; US1/AC2).

## Phase 10: Convergence

- [x] T043 Apply the bounded GPS-aware IFD graph classification to embedded EXIF facts across JPEG/PNG/WebP, retain primary-only facts and private thumbnail extraction, and prove that shared GPS-linked EXIF capture-time payloads never serialize (FR-014; US2/AC2).

## Phase 11: Convergence

- [x] T044 Correct hosted Android image evidence to check the visible background label separately from its accessible selector name, retaining strict inert pixel and unchanged-source assertions (FR-019; SC-001; partial).
- [x] T045 Separate Android APK/provider compilation from emulator execution and suppress unrelated Google service startup in the ephemeral validation emulator, retaining the complete provider/delivery/restoration/performance gates and existing retry limits (FR-019; SC-001, SC-002; partial).

## Phase 12: Convergence

- [x] T046 Use the official AOSP API 36 emulator image and precompile the instrumentation APK before emulator startup, preserving API 24 Chrome coverage and every provider/delivery/restoration/performance gate (FR-019; SC-001, SC-002; partial).
- [x] T047 Require each Android raster preview to match its delivered source filename and emit bounded pixel/status diagnostics on failure without logging raw source bytes or provider URIs (FR-019; SC-001; partial).
