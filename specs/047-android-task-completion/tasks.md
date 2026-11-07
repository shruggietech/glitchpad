# Tasks: Android task completion and qualification

**Input**: specs/047-android-task-completion/{spec,plan,research,data-model}.md and contracts/. **Tests**: Requested by the accepted spec/issues. Record RED observations before corresponding behavior changes and real GREEN exits. Task checks mean completed work, not inferred runtime success. **Organization**: Setup, blocking foundation, five independently testable P1 stories, integrated qualification and handoff.

## Phase 1: Setup

- [x] T001 Recheck branch/base/selector, authority, hidden containers and five issue snapshots in .specify/feature.json and specs/047-android-task-completion/spec.md (FR-001-028).
- [x] T002 Resolve R1-R4 and import all119literal rows with source digest in specs/047-android-task-completion/research.md and contracts/control-register-source.json (FR-020/021/028).
- [x] T003 Complete design/model/contracts and27-criterion map in specs/047-android-task-completion/plan.md, data-model.md and contracts/issue-acceptance-map.md (FR-001-028).

## Phase 2: Blocking foundation

- [x] T004 Review requirements checklists and run installed cross-artifact analysis; retain result in specs/047-android-task-completion/analysis.md, resolving blockers before source edits (all FR/SC).
- [x] T005 Verify ignore/encoding/pinned generated manifest and baseline tooling, recording results in specs/047-android-task-completion/validation.md (FR-009/026/028).
- [x] T006 Define candidate control ledger cases/owner/source/status without invented passes in specs/047-android-task-completion/contracts/control-ledger.json (FR-020/021, SC-001/008).

**Checkpoint**: T004-T006 complete before source behavior changes. Story work may then proceed on explicitly disjoint files. App.tsx and dependency/lock changes remain root-owned.

## Phase 3: US1 compact document shell (P1)

**Goal**: Visible document identity, reachable app destinations, coherent modality/Back and installed About. **Independent test**: Actual composed shell empty/single/many/error; compact/wide/keyboard geometry, focus and one-layer Back; offline About facts.

- [x] T007 [P] [US1] Add failing composed shell/task-surface/focus tests in apps/glitchpad/src/components/TaskSurface.test.tsx and apps/glitchpad/src/App.test.tsx (FR-001-006/015/027, SC-002/007).
- [x] T008 [P] [US1] Add failing installed-info/notice projection contracts in crates/glitchpad-host/src/lib.rs and apps/glitchpad/src/domain/application-info.test.ts (FR-003/027, SC-007).
- [x] T009 [US1] Add exact governed Radix dependency/notices and bounded controlled TaskSurface in apps/glitchpad/package.json, pnpm-lock.yaml and apps/glitchpad/src/components/TaskSurface.tsx, using existing AppFrame portal/native viewport (FR-005/015).
- [x] T010 [US1] Compose compact title/count switcher, separated app/document destinations and bounded primary/secondary tools in apps/glitchpad/src/App.tsx, components/ApplicationMenu.tsx, TabStrip.tsx and styles.css (FR-001/002/006).
- [x] T011 [US1] Integrate single-layer Back, controlled disclosures/modal focus and retained recovery Help/About in apps/glitchpad/src/App.tsx, bootstrap-recovery.ts and components/ApplicationRecoveryBoundary.tsx (FR-003-006/026).
- [x] T012 [US1] Implement installed application-info/offline notice projection and explicit approved destinations in crates/glitchpad-host/src/lib.rs, AndroidSourcePlugin.kt, apps/glitchpad/src/domain/application-info.ts and components/AboutPanel.tsx (FR-003/027).
- [x] T013 [US1] Prove actual shell geometry/focus/contrast across required frames with scripts/check-app-layout.mjs and retained results in specs/047-android-task-completion/validation.md (FR-015/023, SC-002/007).

## Phase 4: US2 practical inert SVG (P1)

**Goal**: Representative inert exports render; deterministic failures are precise with valid alternatives. **Independent test**: Generated corpus crosses core/host and native delivery; exact pixels/reasons/source integrity.

- [x] T014 [P] [US2] Add failing namespace/style/reference/cycle/expansion and malformed/category tests with provenance fixtures in crates/glitchpad-core/src/image_family.rs and fixtures/images (FR-007-010, SC-004).
- [x] T015 [US2] Implement parsed inert SVG profile, namespace/CSS/local-reference validation and unchanged bounds in crates/glitchpad-core/src/image_family.rs and Cargo.toml/Cargo.lock if direct locked edges are needed (FR-007-009).
- [x] T016 [US2] Propagate finite outcome/action categories through crates/glitchpad-host/src/images.rs and apps/glitchpad/src/domain/image-gateway.ts, with actual transport/read distinction and original-source access (FR-008/010/014).
- [x] T017 [US2] Document accepted/refused SVG profile and fixture provenance in specs/047-android-task-completion/contracts/svg-profile.md; run actual core/host GREEN and source-integrity tests (FR-007-010, SC-004).

## Phase 5: US3 image/diagram tools (P1)

**Goal**: Shared truthful viewport/actions and reachable bounded controls preserve document state. **Independent test**: Composed actual Fit→pan/zoom, local/menu/keyboard/gesture routes, animation/icon and destination PNG.

- [x] T018 [P] [US3] Add RED effective-scale, readiness, pointer-ownership, Reset-state and no-preview action tests in apps/glitchpad/src/components/DiagramViewport.test.tsx, ImageSurface.test.tsx and domain/image-contract.test.ts (FR-011/012/014, SC-005).
- [x] T019 [US3] Implement measured shared viewport math and truthful action readiness in apps/glitchpad/src/components/DiagramViewport.tsx, ImageSurface.tsx and domain/image-contract.ts (FR-011/012/014).
- [x] T020 [US3] Reflow/reveal image/diagram/animation/icon tools without horizontal hunting and preserve keyboard/pointer state in apps/glitchpad/src/components/DiagramViewport.tsx, ImageSurface.tsx and styles.css (coordinate root CSS section ownership; FR-002/012/015).
- [x] T021 [US3] Prove multiplicative Fit zoom, pan continuity, Actual/Reset, selected frame/icon and all exposed routes in scripts/check-image-layout.mjs using actual React/AppFrame; retain results in specs/047-android-task-completion/validation.md (FR-011-015, SC-002/005).
- [x] T022 [US3] Extend actual ICO selected-PNG export readback and SVG/action task coverage in AndroidDeliveryInstrumentedTest.kt with independent destination pixels/original integrity (FR-013/024, SC-005/006).

## Phase 6: US4 remaining control register (P1)

**Goal**: Exact editor/Markdown/Mermaid/large-text/meta/preferences results and complete truthful register. **Independent test**: Every assigned literal control case has observable exact text/state/focus/clipboard/validation outcome.

- [x] T023 [P] [US4] Add RED editor/search/history/read-only/mode/focus and numeric-draft tests in apps/glitchpad/src/components/TextEditorSurface.test.tsx, PreferencesPanel.test.tsx and MarkdownSurface.test.tsx (FR-016/017/019).
- [x] T024 [P] [US4] Add RED large-text search/navigation/goto/copy and metadata confirmation/current-value tests in apps/glitchpad/src/components/LargeTextSurface.test.tsx and MetadataInspector.test.tsx (FR-018/019).
- [x] T025 [US4] Adapt actual CodeMirror6.7.2 search markup, labels/status/validation/readonly and actual history availability in apps/glitchpad/src/components/TextEditorSurface.tsx and domain/commands.ts (coordinate App wiring with root; FR-016).
- [x] T026 [US4] Complete Markdown/Mermaid Read/Edit/fallback/outline/search/links/embedded-context behavior in apps/glitchpad/src/components/MarkdownSurface.tsx and MermaidSurface.tsx, with the pinned minimum-WebView CSSOM fix in `patches/mermaid@12.0.0.patch` (FR-017/026).
- [x] T027 [US4] Implement large-text section labels, validated goto, bounded progress/cancel and truthful clipboard in apps/glitchpad/src/components/LargeTextSurface.tsx and ../domain/large-text-gateway.ts (FR-018).
- [x] T028 [US4] Implement metadata cancellation/copy/confirmation and validated scoped preferences with awaited reset in apps/glitchpad/src/components/MetadataInspector.tsx and PreferencesPanel.tsx (FR-019/027).
- [x] T029 [US4] Reconcile all119IDs/all named options, passive115/unmounted114/absent unsupported page controls and overlapping ownership in specs/047-android-task-completion/contracts/control-ledger.json; retain candidate evidence separately from inherited S046 (FR-020/021, SC-001/008).

## Phase 7: US5 installed qualification (P1)

**Goal**: Actual ten-row ordinary/probe candidate evidence with all attempts and independent result bytes. **Independent test**: Four isolated role/API jobs, installed hash/role checks and validator rejecting incomplete or false passes.

- [x] T030 [P] [US5] Add RED receipt-validator/matrix tests in scripts/test-android-recovery-evidence.mjs and scripts/tests/test_android_instrumentation_runner.py (FR-022/025/028, SC-003/008).
- [x] T031 [US5] Add same-guard build role, genuine one-shot missing-module startup and actual absent-native-invoke host probes in apps/glitchpad/src/domain/recovery-probes.ts, main.tsx and image-gateway.ts (coordinate gateway owner; FR-022/025/026).
- [x] T032 [US5] Add explicit predictive-Back packaged contract and passive existing-callback counters in AndroidManifest.xml and AndroidSourcePlugin.kt, without a second consumer (FR-004/026).
- [x] T033 [US5] Extend ordinary full tasks and probe variants with positive actual API36 cancel/commit, rotation/IME/200%/short-frame semantics and About in AndroidDeliveryInstrumentedTest.kt (FR-001-006/015/022-028, SC-002/003/006/007).
- [x] T034 [US5] Implement ten-row source/APK/instrument/runtime/profile/attempt receipts and strict aggregator in scripts/run-android-connected-tests.sh, run-android-instrumentation.sh and validate-android-recovery-evidence.mjs, preserving all limits/gates (FR-022-025/028).
- [x] T035 [US5] Expand .github/workflows/ci.yml to API24/API36 × ordinary/fault_probe isolated jobs with exact role/artifact identity and ordinary guard absence checks (FR-022/023/025).
- [ ] T036 [US5] Compile affected native source/instrumentation and prove actual hosted full matrix, destination/receiver readbacks and all ten rows against final candidate bytes; record in specs/047-android-task-completion/validation.md (FR-022-028, SC-003/006/008).

## Phase 8: Integrated validation and owner handoff

- [ ] T037 Run aggregate cargo xtask check, policy/brand/glyph/generated-manifest/notice/encoding checks and affected platform/package gates; resolve failures and retain exact exits in specs/047-android-task-completion/validation.md (all FR/SC).
- [ ] T038 Publish branch and PR automatically with concrete behavior/validation and issue-level traceability, then monitor exact final-head applicable CI/package jobs; retain all failed attempts in specs/047-android-task-completion/validation.md (SC-008).
- [ ] T039 Complete at most two external review rounds, resolve actionable findings, requalify changed final bytes and run installed speckit-converge; record review count/evidence in specs/047-android-task-completion/handoff.md (all FR/SC).
- [ ] T040 Reconcile119control records/27criteria, terminal exact-head checks, tested artifact digests and limitations; hand off unmerged PR with auto-merge off in specs/047-android-task-completion/handoff.md (SC-001-008).

## Dependencies and parallel execution

Setup → foundation → story work → integrated native qualification → aggregate/review/handoff. US1 provides task-surface composition to US3/US4 integration. US2 core validation and US4 component tests can proceed independently after foundation; US3/US2 share image gateway and must serialize that file. US5 instrumentation may be prepared in parallel, but executed evidence depends on all integrated stories. T036/T038/T039 must rerun affected final-head checks after changes.

Parallel examples: US1 TaskSurface test and host metadata contract use separate files; US2 parser tests can run alongside US1 shell; US3 viewport tests run alongside US4 preference tests; US4 large-text and editor work use distinct files; US5 receipt validator can be prepared alongside UI work. Assign explicit file owners and serialize App.tsx, styles.css sections, dependencies/locks, AndroidSourcePlugin.kt and image-gateway.ts. No simultaneous mutations of shared owners.

## Implementation strategy

Validate each story independently as an intermediate checkpoint, then complete all five as the approved single slice. US1 is the earliest useful demo, not an authorized reduction of scope. Checklists validate written requirements only. Candidate and issue closure remain blocked until all required real task evidence exists. No merge/tag/release/deployment.

## Phase 9: Convergence

- [ ] T041 Resolve current-source actual task-control geometry failures in AndroidDeliveryInstrumentedTest.kt and the affected task layout: retain exact failing CSS/native bounds, distinguish transient frame movement from persistent clipping inside the existing action budget, preserve every visibility/48dp/contrast/semantic gate, and rerun the complete required API24/API36 profiles per FR-015/023, SC-002 and US5/AC1/3 (partial).
