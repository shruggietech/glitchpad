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

- [x] T032 Replace unsupported browser-command typing in Android instrumentation with public native WebView InputConnection selection/commit and strict native editing-representation and semantic visible-editor readback; retain actual packaged qualification per FR-006/008/009/016.
- [x] T033 Retain bounded native warm-intent callback/queue/notification observations alongside failed identity assertions without private document facts or new IPC grants per FR-001/004/015/016.

- [x] T034 Re-notify the existing delivery channel after the actual Activity resumes when native work remains queued; coalesce/cancel the owned frame callback and preserve immediate notification, queue bounds and permissions per FR-001/004/016/017.

- [x] T035 Use semantic document selection bounds while verifying the complete native editing representation, align the deliberate write-refusal expectation with the existing Save-specific failure contract, and retain bounded chooser-failure observations in AndroidDeliveryInstrumentedTest.kt per FR-006/008/016.

- [x] T036 Align native dirty-close cancellation qualification with the existing cancelled transition by checking the dismissed dialog, retained editable/unsaved draft and exact semantic source before the subsequent verified Save/readback per FR-008/009/016.

- [x] T037 Await the newly selected visible draft and completed Add-menu dismissal/focus restoration before native editor input, reuse the readiness contract across controlled New journeys, and retain bounded native/browser focus-failure facts in AndroidDeliveryInstrumentedTest.kt per FR-003/005/006/016.

- [x] T038 Trigger the three unblocked native chooser/Share controls with one premeasured native pointer tap, await actual system-window and returned MainActivity readiness, and preserve strict pending-write/cancellation/receiver/byte assertions plus bounded handoff-failure facts in AndroidDeliveryInstrumentedTest.kt per FR-005/008/013/016.

- [x] T039 Freeze the native post-commit expected buffer only from one coherent current-editor observation with exact semantic source and matching public editing representation; retain existing deadlines and exact native cursor/text assertions, and add bounded phase/expected-selection/failure facts in AndroidDeliveryInstrumentedTest.kt per FR-006/008/016.

- [x] T040 Honor stale dirty-close Save/Save As admission before native I/O in App.tsx, retain red-first withheld-receipt/stale-editor regression coverage and existing feedback in App.test.tsx, and distinguish actual pending button values from callback-evaluation failures in AndroidDeliveryInstrumentedTest.kt per FR-008/009/010/016.

- [x] T041 Apply the pinned single-owner keyboard-inset contract in App.tsx for the native-resized Android WebView, retain red-first default-layout and visual-only inset regressions, and verify exact Chromium69 editor/target geometry without changing generated brand assets or native input assertions per FR-005/006/016/017.

- [x] T042 Align BrandBuilderAppFrameInstrumentedTest.kt keyboard qualification with the pinned single-owner inset contract using independent before/show/hide native/browser bounds and real IME facts, preserving actual keyboard input, focus, strict geometry, restoration and existing deadlines per FR-005/016/017.

- [x] T043 Separate real system-picker cancellation from actual held native-write pending qualification in AndroidDeliveryInstrumentedTest.kt and the existing test-only FixtureDocumentsProvider.java/FixtureGrantProvider.java; preserve one chooser, strict disabled/rejected-Discard state, bounded entry, deliberate pre-open refusal, cleanup, dirty/original preservation and exact final UTF-8 readback per FR-008/009/016.

- [x] T044 Require the requested marker and clean JUnit terminal success in scripts/run-android-instrumentation.sh, preserve adb/explicit failure outcomes, and add meaningful marker-only/crash/assertion/transport/missing-marker policy regressions per FR-016/018 and Constitution P6.

- [x] T045 Strengthen AndroidDeliveryInstrumentedTest.kt single native activation with actual visible-window/IME occlusion and coherent coordinate readiness, one justified keyboard dismissal, one DOWN/UP attempt and bounded failure facts; use it at the held-write Save As boundary and retain actual provider-state/pending/refusal/byte assertions per FR-005/008/016.

- [x] T046 Give dedicated Tauri UI instrumentation supported terminal ownership: stop owned scenarios at CREATED in AndroidDeliveryInstrumentedTest.kt, BrandBuilderAppFrameInstrumentedTest.kt and PerformanceInstrumentedTest.kt, set waitForActivitiesToComplete=false only for those invocations in the journey driver/CI, retain lifecycle/body/process assertions and add affected runner policy coverage per FR-009/016/018 and Constitution P6.

- [x] T047 Dispatch S046 interactive Android Open/Save As/Create/Share host commands asynchronously with existing native work on spawn_blocking, retain owned state and all receipt/error/cancellation/authority checks, add meaningful gated-worker scheduling/error regressions and compile affected host/Android paths per FR-004/008/010/013/016/017.

- [x] T048 Use owner-verified UiAutomation Back DOWN/UP only for intentional system document-picker and Share cancellation in AndroidDeliveryInstrumentedTest.kt; preserve app-owned Back, one chooser, native return/cancel/preview/source checks and existing deadlines, with bounded failure facts and focused policy/SDK verification per FR-005/008/013/016.

- [x] T049 Make external picker/Share cancellation observe actual IME and window layers in AndroidDeliveryInstrumentedTest.kt, use at most one Back pair per observed layer with verified ownership and one existing absolute return deadline, reuse native window observations and preserve cancel/source/preview/count assertions per FR-005/008/013/016.

## Phase 12: Convergence

- [x] T050 Fit the diagnostic sheet to actual native-visible WebView bounds through the existing optional diagnostic environment read and asynchronous host scheduling, preserve frozen payload identity and inset ownership, correct local stacking, and prove all controls plus first/final preview lines remain reachable across scaled/short/rotated layouts and fresh APK journeys per FR-013/014/016/017 (partial, HIGH F3).

## Phase 13: Convergence

- [x] T051 Capture bounded native picker/result/Rust completion stages and failure-only dirty-close status/dialog/pending/identity observations before instrumentation cleanup, retain strict cancellation/source/byte/deadline assertions and qualify the actual failing boundary before a product repair per FR-001/008/015/016/018 (partial verification, HIGH F4).

## Phase 14: Packaged cancellation completion

- [ ] T052 Trace and repair the observed cancelled-save completion loss after the async native host has returned an error while the current draft and dirty-close dialog remain pending; retain a meaningful Activity-return/response regression, existing source/receipt/error/gesture/deadline contracts and fresh actual APK confirmation per FR-008/009/010/016/018 (partial execution, HIGH F5).

## Phase 15: Packaged theme readability

- [x] T053 Pair S046 dirty-close and Diagnostics foreground/background/status/action colors through existing canonical consumer tokens in styles.css, preserve selected-theme dominance without changing generated brand/AppFrame or broader shell scope, retain the actual screenshot/red browser evidence and add composed-browser contrast regressions across OS and explicit/system theme combinations per FR-005/009/014/016/017 (partial, HIGH F6).

## Phase 16: Provider fixture continuity and duplicate cleanup

- [x] T054 Preserve canonical fixture bytes and modification metadata across provider recreation when expected content is identical, update missing/changed fixtures deliberately, and add focused initialization plus actual recreation coverage in FixtureDocumentsProvider.java and affected instrumentation per FR-001/016/018 (partial verification, HIGH F7).
- [x] T055 Retain sources already owned by an open session or copy reference when a strong duplicate fails materialization in App.tsx, preserve exactly-once cleanup for unowned failures, and add red-first ownership/error regressions per FR-001/008/009/016/017 (partial execution, HIGH F8).

## Phase 17: Native dispatch and physical Add visibility

- [ ] T056 Repair the locked Tao Android poll/wake contract and truthful queue admission with exactly-once/source/exit ordering regressions, preserve dependency versions/provenance/licenses and non-Android source, remove temporary diagnosis-only Tauri vendoring while retaining its evidence, and qualify the normal reply path on fresh APKs per FR-008/010/016/017/018 (partial execution, HIGH F9).
- [x] T057 Fit Add document to the actual native-visible parent using the existing viewport observer/intersection policy, preserve canonical inset ownership and document clearance, strengthen physical native trigger/choice assertions and retain old/modern browser default/scaled/rotated regressions per FR-003/005/016/017 (partial execution and verification, HIGH F10).

## Phase 18: External native cancellation coherence

- [ ] T058 Establish coherent actual IME/window readiness for external picker cancellation in AndroidDeliveryInstrumentedTest.kt, preserve the existing absolute deadline and per-observed-layer gesture cap, add meaningful late-IME scheduling regressions and bounded failure capture, and retain actual APK cancellation/source assertions per FR-005/008/013/016/018 (partial verification, HIGH F11).

## Phase 19: Android timed-poll classification

- [ ] T059 Preserve raw Android poll timeout versus wake/callback classification before native-source projection in the locked Tao WaitUntil arm, retain existing public StartCause/deadline and dispatch semantics, and add exact-source plus actual-run_return regression cases without expanding dependencies per FR-008/010/016/017/018 and plan T056 (partial execution, HIGH F12).
