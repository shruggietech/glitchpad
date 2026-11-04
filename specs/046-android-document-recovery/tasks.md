# Tasks: S046 Android Document Recovery and Standalone Authoring

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts](contracts/document-actions.md).

**Tests**: Meaningful contract, hostile provider, recovery, actual-action and packaged task tests are required before claims.

## Phase 1: Setup

- [x] T001 Resolve S046 branch, selector and installed templates in .specify/feature.json and specs/046-android-document-recovery/.
- [x] T002 Research existing frontend/native boundaries and record choices in research.md and plan.md.

## Phase 2: Foundation

- [x] T003 Define source-independent destination and actual-action result contracts in crates/glitchpad-core/src/source.rs and apps/glitchpad/src/domain/commands.ts (FR-006/010).
- [x] T004 Review requirements and blocking cross-artifact coverage in checklists/ and analysis.md (FR-001 through FR-018).

## Phase 3: US1 Visible Markdown recovery

**Goal**: Open corpus and injected failures terminate visibly. **Independent test**: all three delivery routes and document/root fault cases retain a usable surface.

- [x] T005 [US1] Add worker/projection/root failure regressions in domain/markdown-renderer.test.ts, components/DocumentSurface.test.tsx and bootstrap tests (FR-001/002).
- [x] T006 [US1] Implement plain bootstrap/root fallback, document failure capture and asynchronous Markdown terminal handling in main.tsx, index.html, DocumentSurface.tsx, MarkdownSurface.tsx and domain/markdown-renderer.ts (FR-001/002/015).
- [x] T007 [US1] Extend actual Android/Windows corpus and failure probes in AndroidDeliveryInstrumentedTest.kt and scripts/windows/test-portable-lifecycle.ps1 (FR-016).

## Phase 4: US2 Android standalone authoring

**Goal**: New/Open/edit/save/reopen/recover completes. **Independent test**: both drafts and copies preserve exact bytes and pending/cancelled/failed state.

- [x] T008 [US2] Add hostile destination alias/nonempty/partial-write and independent draft/readback tests in Android controlled-provider suites and core source tests (FR-006/007).
- [x] T009 [US2] Implement guarded source-independent native creation and source-bound Save As in core source.rs, host android_source/mod.rs, host lib.rs and AndroidSourcePlugin.kt (FR-006/007).
- [x] T010 [US2] Add draft/recovery/receipt/race component tests in domain/ and App.test.tsx (FR-003/004/008/009).
- [x] T011 [US2] Implement draft/copy identity, native gateway/receipt transitions and lifecycle recovery in domain/contracts.ts, tabs.ts, recovery.ts and use-recovery.ts (FR-003/006/008/009).
- [x] T012 [US2] Implement Add document and native New/Open/Save/dirty-close integration in components/AddDocumentMenu.tsx and App.tsx (FR-003/004/005/008/009).
- [ ] T013 [US2] Prove actual WebView chooser/draft/save/reopen/cancel/failure/recreation and geometry/font-scale journeys in Android instrumentation (FR-005/016).

## Phase 5: US3 Truthful actions and diagnostic export

**Goal**: One current-document operation and accurate outcome; saved/shared frozen preview has observable native result. **Independent test**: Save/Zoom/clipboard/history/stale action and JSON byte/receiver checks.

- [x] T014 [US3] Add asynchronous action/no-handler/stale/clipboard/history/Zoom regressions in domain/commands.test.ts and renderer/App tests (FR-010/011/012).
- [x] T015 [US3] Implement shared result dispatcher, keyboard routing and renderer providers in domain/commands.ts, App.tsx and TextEditorSurface/MarkdownSurface/MermaidSurface/ImageSurface/LargeTextSurface (FR-010/011/012).
- [x] T016 [US3] Add immutable diagnostic/redaction/clear-failure/native Save/Share tests in persistence suites and Android instrumentation (FR-013/014/015).
- [x] T017 [US3] Implement native diagnostic Save/Share/runtime identity and bounded failure events in persistence schemas, host/plugin and frontend gateways (FR-013/015).
- [x] T018 [US3] Implement frozen preview and truthful pending/cancel/failure/clear outcomes in DiagnosticsPanel.tsx and App.tsx (FR-014/015).

## Phase 6: Qualification and handoff

- [ ] T019 Retain exact installed/tested APK hash, source/package/runtime and per-journey evidence in .github/workflows/ci.yml, scripts/run-android-connected-tests.sh and verification.md (FR-016).
- [ ] T020 Update unreleased behavior/decisions and run CI-parity, brand, encoding, security and affected package checks via cargo xtask check (FR-017/018).
- [ ] T021 Push/open official PR, complete at most two external review rounds, reconcile final SHA/checks/threads/issue evidence and stop for owner merge in verification.md (FR-018).

## Dependencies & Execution Order

T001-T004 precede implementation. Native contracts/writer (T008-T009/T017) and renderer containment/providers (T005-T006/T014-T015) can run in parallel on distinct files after contract agreement. App/shared schema edits are coordinated sequentially by the root agent. T010-T013/T016-T018 follow applicable contracts; T019-T021 require integrated behavior. Parallel examples: native writer tests alongside Markdown response tests; diagnostic panel tests alongside provider receiver tests. No task completion substitutes for its required package evidence. All five issues remain included; no MVP-only stop is authorized.

## Phase 7: Convergence

- [x] T022 Capture bounded correlated external-delivery rejection, chooser/drain/subscription and materialization failure events at their source delivery/read boundaries in App.tsx; add component redaction/outcome regressions without logging raw rejection details per FR-001/FR-015 (partial).

## Phase 8: Convergence

- [x] T023 Drain pending captured failure writes before taking the native diagnostic preview snapshot in domain/use-persistence.ts; retain delayed-success, frozen-preview and subsequent-event regressions per FR-013/FR-015 (partial).

## Phase 9: Final external-review repairs

- [x] T024 Preserve current-renderer text selection through Markdown Copy menu/keyboard execution with real clipboard result and foreign-selection/denial regressions in MarkdownSurface.tsx/tests per FR-010/FR-011/FR-012 (round-2 comment 4464666149).
- [x] T025 Dismiss the active renderer's modal before Android Back attempts document close, using a narrow optional handle method and modal/focus/native-ack regressions in TextEditorSurface.tsx, MarkdownSurface.tsx, App.tsx/tests and governed Android APK/fixture suites per FR-005/FR-009 (round-2 comment 4464666156).

## Phase 10: Native build identity completeness

- [x] T026 Expose the available ordinary CI source commit through native diagnostics after the explicit build override, preserve unavailable local identity, forward source metadata through the Linux package build container, and add native provenance regressions in host lib.rs/tests and linux-package workflow per FR-015.

## Phase 11: Packaged Android findings

- [x] T027 Correct bounded Android text materialization for native exact-length reads that do not signal EOF; verify completion with bounded lookahead and preserve unknown/large-source limits in domain/android-source tests per FR-001/004/016.
- [x] T028 Add consumer-owned Chrome 69 physical positioning and target-size fallbacks for the Add document overlay without modifying pinned generated brand assets; retain strict viewport/target/scroll assertions per FR-003/005/017.

- [x] T029 Align the Android event plugin runtime/frontend registration namespace with its generated ACL manifest; verify native listener registration and Add-layer Back acknowledgement without broadening permissions per FR-004/005/015/016.

- [x] T030 Remove GUI runtime construction from the cross-platform listener ACL regression while retaining one production plugin-name contract, generated ACL resolution, both valid/stale listener checks and the exact private grant count per FR-017/018.

- [x] T031 Use the supported classic dedicated-worker construction for the governed Chromium 69 production IIFE bundle, retaining off-thread Markdown parsing, worker ownership/cancellation and modern development behavior; prove the exact old-browser failure and repaired semantic corpus per FR-001/002/016/017.

- [x] T032 Replace unsupported browser-command typing in Android instrumentation with public native WebView InputConnection selection/commit and strict native-buffer/visible-editor readback; retain actual packaged qualification per FR-006/008/009/016.
- [x] T033 Retain bounded native warm-intent callback/queue/notification observations alongside failed identity assertions without private document facts or new IPC grants per FR-001/004/015/016.
