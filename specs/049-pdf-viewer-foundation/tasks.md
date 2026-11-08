# Tasks: PDF viewer foundation

**Input**: specs/049-pdf-viewer-foundation design documents; actual setup-tasks run42520436826 against a5f339b. Tests are required by the approved spec.

**Format**: Sequential TIDs; [P] marks independent files only, not permission to skip dependencies. Story tasks retain issue-level traceability through contracts/issue-acceptance.md.

## Phase 1: Setup

Shared source-bound tooling and dependency preparation.

- [ ] T001 Record source-bound hosted execution and early compatibility phases in .github/workflows/ci.yml and specs/049-pdf-viewer-foundation/validation.md. (FR-019,020,023)
- [ ] T002 Pin pdfjs-dist6.5.438 without incidental upgrades in apps/glitchpad/package.json and pnpm-lock.yaml; verify existing .gitignore/.dockerignore/format/lint ignores. (FR-018,023)
- [ ] T003 Generate allowlisted CMaps/BSD symbol resources, version/hash-anchored static decoder transform and shipped notices in scripts/prepare-pdf-assets.mjs, apps/glitchpad/vite.config.ts and THIRD-PARTY-NOTICES.md. (FR-003,018)

## Phase 2: Foundational

Shared contracts and deterministic inputs precede composed UI.

- [ ] T004 [P] Add self-authored PDF fixture generator/corpus and provenance in scripts/generate-pdf-fixtures.mjs, fixtures/pdf/ and fixtures/provenance.toml, including hostile links/actions, structured navigation, encrypted/malformed and limits. (FR-018,020)
- [ ] T005 Define versioned document/capability/error/source/lifecycle contracts and conformance tests in apps/glitchpad/src/domain/pdf-contract.ts and pdf-contract.test.ts. (FR-001,003,005,016,017)
- [ ] T006 Implement classic worker entry, compatibility imports, fixed resource factory and real-worker handshake in apps/glitchpad/src/domain/pdf-worker.ts and pdf-resources.ts; reject fake fallback. (FR-003,004,018,019)
- [ ] T007 Apply exact emitted worker response CSP and preserve single configured main-window setup in crates/glitchpad-host/src/lib.rs and tauri.conf.json; add isolation assertions. (FR-003,017)

## Phase 3: US1 - Open and read a local PDF

Independent test: actual source-to-canvas/selectable-text journey, limits/password/errors/cancel/reopen; all four native families qualify in US4.

- [ ] T008 [P] [US1] Add range/revision/limit/cancel/error controller tests in apps/glitchpad/src/domain/pdf-controller.test.ts and pdf-source-gateway.test.ts. (FR-002,005,006,008,009)
- [ ] T009 [US1] Add bounded source gateway and PDF detection/materialization before whole-text allocation in apps/glitchpad/src/domain/pdf-source-gateway.ts, desktop-delivery-gateway.ts, android-restoration-gateway.ts and crates/glitchpad-core/src/detection.rs. (FR-002,006,017)
- [ ] T010 [US1] Add bounded cancellable revision-bound Android private disk spool in crates/glitchpad-host/src/pdf_cache.rs using existing bounded stream leases and narrow cancellation in crates/glitchpad-host/src/android_source/mod.rs. (FR-002,005,006,008,009)
- [ ] T011 [US1] Implement PDF controller load/password/error, ownership and real task disposal in apps/glitchpad/src/domain/pdf-controller.ts and contracts.ts. (FR-001,005,008,009,016)
- [ ] T012 [US1] Add minimal readable canvas/text PdfSurface and DocumentSurface integration in apps/glitchpad/src/components/PdfSurface.tsx and DocumentSurface.tsx. (FR-004,007,016)
- [ ] T013 [US1] Run actual installed ordinary API24 worker/load/render/isolation/cancel preflight through AndroidDeliveryInstrumentedTest and scripts/run-android-connected-tests.sh, then API36; retain attempts in specs/049-pdf-viewer-foundation/validation.md before broad UI. (FR-019,020)
- [ ] T014 [US1] Complete virtualized visible/adjacent canvas/text layers, fit/zoom/rotation/layout/labels/page controls and compact state in apps/glitchpad/src/components/PdfSurface.tsx and apps/glitchpad/src/domain/pdf-controller.ts. (FR-004,005,007,012)
- [ ] T015 [US1] Wire suspend/resume/close/revision cleanup and session-only navigation through apps/glitchpad/src/App.tsx and domain/tabs.ts using actual worker/canvas cancellation before resource accounting. (FR-008,009,017)
- [ ] T016 [US1] Verify source/page/surface boundaries, reduced-cache/refusal, encrypted/malformed/revoked and stale work in apps/glitchpad/src/domain/pdf-controller.test.ts and scripts/check-pdf-runtime.mjs. (FR-005,008,009,020)

## Phase 4: US2 - Find and navigate PDF content

Independent test: ordered cancellable search plus all compact navigation flows, malformed targets, keyboard/touch/semantic accessibility and source-neutral persistence.

- [ ] T017 [P] [US2] Add search/outline/destination/thumbnail/accessibility tests in apps/glitchpad/src/domain/pdf-navigation.test.ts and components/PdfSurface.test.tsx. (FR-010,011,012)
- [ ] T018 [US2] Implement ordered cancellable search, page context and match selection in apps/glitchpad/src/domain/pdf-controller.ts and components/PdfSurface.tsx. (FR-010)
- [ ] T019 [US2] Implement bounded outline/named destinations/internal links and lazy thumbnails with reduced-cache disable in apps/glitchpad/src/domain/pdf-controller.ts. (FR-005,011)
- [ ] T020 [US2] Complete dismissible search/outline/thumbnail tools with keyboard/touch/focus/current-page semantics using existing TaskSurface and tokens in apps/glitchpad/src/components/PdfSurface.tsx and styles.css. (FR-012,016,018)
- [ ] T021 [US2] Measure reduced-cache responsiveness and validate source hashes/session-only navigation in scripts/check-pdf-runtime.mjs and existing Android instrumentation. (FR-008,011,012,017,020,021)

## Phase 5: US3 - Inspect, follow links and print deliberately

Independent test: known metadata facts, no automatic network/execution/opener call, explicit link handoff and actual native print path outcomes.

- [ ] T022 [P] [US3] Add metadata/link/action/print state and bounds tests in apps/glitchpad/src/domain/pdf-metadata.test.ts, pdf-print-gateway.test.ts and native Android print tests. (FR-003,013,014,015,016)
- [ ] T023 [US3] Contribute all PDF metadata fact groups with provenance/availability through apps/glitchpad/src/domain/pdf-metadata.ts and metadata.ts. (FR-013,017)
- [ ] T024 [US3] Integrate read-only link/form representation and explicit scheme-validated opener actions in apps/glitchpad/src/components/PdfSurface.tsx and domain/markdown-gateway.ts; never dispatch executable actions. (FR-003,014,016)
- [ ] T025 [US3] Implement bounded source/revision-bound print snapshot staging and truthful desktop dialog handoff in apps/glitchpad/src/domain/pdf-print-gateway.ts, components/PdfSurface.tsx and crates/glitchpad-host/src/lib.rs. (FR-005,008,015,016)
- [ ] T026 [US3] Implement validated chunked raster job storage and custom Android PrintDocumentAdapter in crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/PdfPrintStore.kt, PdfPrintAdapter.kt and narrow Rust/Kotlin model/command registration. (FR-005,008,015)
- [ ] T027 [US3] Run actual supported native selected/all-page print smoke plus cancel/failure/unavailable cases and security corpus through scripts/check-pdf-runtime.mjs, desktop probes and Android instrumentation; record outcomes in specs/049-pdf-viewer-foundation/validation.md. (FR-003,014,015,020)

## Phase 6: US4 - Review a complete traceable candidate

Independent test: reconcile all16 issue criteria, unchanged source/session contracts, actual four-platform candidate evidence, package/license/brand and owner PR boundary.

- [ ] T028 [P] [US4] Extend actual Windows/macOS/Linux package probes to await PDF canvas/text/navigation/metadata/isolation and source identity in scripts/windows/test-portable-lifecycle.ps1, scripts/macos/test-package-lifecycle.mjs, scripts/linux/test-package-lifecycle.mjs and apps/glitchpad/src/domain/package-workflow-probe.ts. (FR-004,017,020; SC-002)
- [ ] T029 [US4] Complete Android PDF keyboard/touch/navigation/metadata/links/lifecycle/print candidate journeys on API24/API36 in AndroidDeliveryInstrumentedTest and scripts/run-android-connected-tests.sh. (FR-004,020,021; SC-002)
- [ ] T030 [US4] Run full contract/source/session/text/image regression and hostile-input/budget/accessibility/compatibility suites, binding source/run/attempt/artifact/runtime facts in specs/049-pdf-viewer-foundation/validation.md. (FR-017,019,020; SC-003,004,005)
- [ ] T031 [US4] Verify package resources/notices/security/dependency/brand gates and exact delivered kit conformance in existing CI/scripts and specs/049-pdf-viewer-foundation/validation.md. (FR-018,020,021; SC-005)
- [ ] T032 [US4] Reconcile each criterion with concrete current evidence in specs/049-pdf-viewer-foundation/contracts/issue-acceptance.md and handoff.md; preserve #81/#82 scope and literal unrun/waived observations. (FR-021,022; SC-001)

## Phase 7: Polish and owner handoff

Freeze only after generated/format checks; no merge/publication.

- [ ] T033 [P] Document unreleased PDF behavior/limits and changelog in docs/glitchpad-technical-specification.md, relevant user documentation and changelog.d/S049.md without changing released0.2.1 authority. (FR-022)
- [ ] T034 Format, check encoding/mojibake and freeze final source; qualify all applicable exact-source checks and independently read artifacts in specs/049-pdf-viewer-foundation/validation.md. (FR-020,023; SC-005)
- [ ] T035 Push/open PR automatically, keep auto-merge off, monitor CI and resolve findings within two external rounds; record reviewed/final heads and issue/project state in specs/049-pdf-viewer-foundation/handoff.md. (FR-024; SC-006)
- [ ] T036 Run formal present-code convergence and final PR/readback audit, leave ready/unmerged and report owner boundary in specs/049-pdf-viewer-foundation/handoff.md. (FR-020,024; SC-001,006)

## Dependencies and implementation strategy

Setup → foundational contracts/resources/worker policy → US1 minimal read → actual API24 then API36 preflight → complete US1 → US2 → US3 → US4 → final freeze/PR/convergence. US2 and US3 share the US1 controller; serialize edits to that file. Earliest internal MVP is the real local read path, but the authorized delivered slice includes all four stories.

## Parallel opportunities

US1 source test fixtures can be authored independently of the controller tests once contracts exist. US2 destination corpus and UI semantics tests are separate files after US1. US3 metadata facts and print-model tests are separate files after the document contract. US4 platform probe edits are independent after product behavior freezes. These are file-level opportunities; this run executes without unrequested implementation-agent delegation.
