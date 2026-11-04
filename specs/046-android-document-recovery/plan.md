# Implementation Plan: S046 Android Document Recovery and Standalone Authoring

**Branch**: `codex/046-android-document-recovery` | **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

## Summary

Complete #245/#246/#247/#248/#252 through one source-independent draft lifecycle, one truthful asynchronous action path, native verified destination writes, layered Markdown/root recovery and immutable diagnostic Save/Share. Retain issue-level acceptance and exact tested APK provenance; broader shell/SVG/control-register/release work remains separately tracked.

## Technical Context

**Language/Version**: Existing pinned TypeScript/React, Rust and Kotlin; versions remain authoritative in package manifests, rust-toolchain.toml and Gradle catalogs.

**Primary Dependencies**: Existing Tauri Android source plugin, CodeMirror, Markdown worker, recovery/persistence store and pinned BrandBuilder/AppFrame bundle. Native Share reuses the existing FileProvider; actual WebView identity uses the existing AndroidX WebKit version where required by API24.

**Storage**: Existing bounded recovery store and provider destinations; diagnostic Share uses bounded temporary cache files and read grants.

**Testing**: Vitest/component/contract tests, Rust suites, controlled-provider instrumentation and actual composed WebView journeys on isolated API24/API36 hosted CI; CI-parity aggregate cargo xtask check.

**Target Platform**: Android is the changed native boundary; shared action/recovery regressions cover Windows/macOS/Linux.

**Performance Goals**: Preserve existing resource/time budgets; snapshot on lifecycle suspension and explicit restart using the existing bounded store, without unbounded event or cache growth.

**Constraints**: Offline/local operation, no private content/location diagnostic fields, no invented source authority, no unsafe provider overwrite, UTF-8 without BOM, governed brand vocabulary, hidden Linux-container local execution.

**Scale/Scope**: Five named issues; no new renderer family or general command framework beyond session-bound operation dispatch.

## Constitution Check

P1: Add document and recovery remain compact and contextual. P2: all operations remain local/offline. P3: shared contracts retain Android URI identity in the native host. P4: staged edits, destination independence, bounded input and verified writes preserve integrity. P5: unreleased delta remains in this slice; official version/specification remain v0.2.0 until #255. P6: meaningful automated and exact-package native evidence precedes claims. P7: dated choices and scope boundaries are recorded here. P8: existing licensed dependencies and notices remain governed. Pre-research and post-design checks pass without exception.

## Project Structure

Feature artifacts: spec.md, checklists/, research.md, data-model.md, contracts/document-actions.md, quickstart.md, tasks.md, analysis.md and verification.md under specs/046-android-document-recovery/.

Frontend: apps/glitchpad/src/App.tsx, main.tsx, domain/{commands,contracts,tabs,recovery,android-delivery-gateway,persistence-gateway}.ts, components/{DocumentSurface,MarkdownSurface,ImageSurface,DiagnosticsPanel,AddDocumentMenu}.tsx and their focused tests.

Native: crates/glitchpad-core/src/{source,persistence}.rs, crates/glitchpad-host/src/{lib,android_source/mod}.rs, crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/AndroidSourcePlugin.kt and Android instrumentation under crates/glitchpad-host/gen/android/app/src/androidTest/.

Qualification: .github/workflows/ci.yml, scripts/run-android-connected-tests.sh, scripts/windows/test-portable-lifecycle.ps1 and retained source-bound artifacts.

## 2026-11-03: Decisions and execution

- Reuse Kotlin ACTION_CREATE_DOCUMENT write/sync/readback below a new source-independent host request rather than fabricate a source ID. Keep source-bound Save As revision checks for provider inputs.
- Route Android Save to verified Save As while the source contract is save_as_only. Do not claim revision-checked durable in-place overwrite that the provider contract cannot establish.
- Reuse image-export destination independence/nonempty checks for generic writes; open with write access only after validating destination, and delete only a newly independent destination written by this operation.
- Define Promise-aware typed action results and execute renderer-specific handlers behind one current-session/revision dispatcher. Availability validation cannot yield performed success.
- Keep a plain DOM bootstrap fallback, a root recovery boundary and document containment. Persist recoverable state before controlled restart where possible; explicitly explain persistence failure.
- Capture only allowlisted bounded failure component/stage/reason/correlation values. Runtime identity is sourced from native build/Android/WebView facts or explicitly unavailable.
- Retain the actual installed/tested APK and its digest/source/runtime receipt. Existing source-equivalent debug evidence is not relabeled as release-byte qualification.
- User explicitly authorizes automatic push and official PR; no pre-push approval remains pending. At most two external review rounds; merge/tag/publication remain owner-controlled.

## Dependencies and parallel work

Run specify, clarify, checklist, plan, tasks and blocking analyze before code. Native create/write/environment/share implementation and renderer/root/action-provider implementation may proceed in parallel because they own distinct files; root integration in App.tsx and shared contracts is sequential after their contracts agree. Exact-APK qualification follows integrated implementation. Final tasks reconcile documentation, checks, two-round review ledger and issue/project evidence.

## 2026-11-04: Validation environment repair

The exact recovered BrandBuilder verifier requires an SVG renderer and PDF inspection tools that the qualification image omitted. Add pinned @resvg/resvg-js 2.6.2 and poppler-utils to the reusable Dockerfile target instead of installing packages repeatedly in command containers. Run kit verification on a temporary copy because probe/verify generate evidence files; preserve shipped brand assets and prior receipts. The first failed missing-tool observation remains in operator logs.

## 2026-11-04: Packaged fault injection

Enable a narrowly compiled VITE_GLITCHPAD_RECOVERY_PROBES flag only for the hosted instrumented debug APK so actual worker/parser/projection/root failures can be exercised through the composed application. Normal builds must not expose the activation seam. Retain the flag, exact tested APK/source/runtime and debug-versus-release distinction in evidence; this does not qualify other release bytes. Use actual controls for recovery and retain generated source independently.

## 2026-11-04: Stable Add document disclosure

Keep the persistent Add document label stable across expanded/collapsed state. aria-expanded announces disclosure and the expanded menu retains a labeled Close action. This prevents a wrapped replacement label from growing the persistent control and changing document clearance at maximum text scale. Reserve actual measured control height through the existing AppFrame overlay contract.

## 2026-11-04: Round 1 desktop-copy and keyboard decisions

Expose Save As for editable desktop copies without requiring a destination source ID. Preserve the existing destination-export result contract; do not invent source authority or an unrelated desktop draft lifecycle. Carry an optional protected original source/revision from copy_source into the native desktop Save As boundary so selecting that original or an alias is rejected before replacement. Existing unprotected Save As behavior remains governed by its existing contract. Auxiliary editable controls retain their native editing shortcuts, while document CodeMirror content retains the shared document action route. These repairs implement FR-007/010/011/012 and the two external round-1 findings.

## 2026-11-04: Final-review selection and renderer-modal ownership

Rendered Markdown Copy resolves a nonempty browser selection only when it belongs to the current renderer content, then uses the existing awaited clipboard operation; absent/foreign selection keeps the established whole-document fallback. Android committed Back delegates active renderer modal dismissal through one optional synchronous handle method before search/document close, while IME and shell-owned layers retain their existing priority. Reuse existing Cancel/Escape/focus behavior and add no new advertised command or overlay registry. These decisions address the two final external-review findings without expanding the product scope.

## 2026-11-04: API24 installed-file read fallback

Keep installed-byte capture separate from Gradle's package cleanup and use only bytes read from the device. After reinstall and a failed adb pull, allow one bounded exec-out run-as read of the same Package Manager path, retaining both method diagnostics and an explicit unknown cause. Require exact built-byte equality before the source-bound receipt; no retry may substitute build output as observed installed bytes. The [API24 run-as implementation](https://android.googlesource.com/platform/system/core/+/refs/tags/android-7.0.0_r1/run-as/run-as.c) checks installed/debuggable package authority before executing under its application identity; actual access is still established by the read, not assumed from that contract.

## 2026-11-04: Ordinary native build provenance

Native diagnostic build identity prefers the explicit GLITCHPAD_BUILD_COMMIT override, then GitHub's compile-time GITHUB_SHA when provided by an ordinary native CI build, and otherwise remains unavailable. Forward that nonsecret source fact through the Linux package container at its build boundary. Do not spawn Git, infer a revision from runtime user data, or fabricate a local commit. This closes the normal-build identity gap independently of the instrumented debug job's explicit source injection.

## Packaged Android exact-length completion

The hosted API24 snapshot observes a 300-byte governed Markdown document in LargeTextSurface with zero Markdown semantic elements. Native range reads report endOfSource only after a short read. Filling an exactly sized request therefore does not establish EOF; the frontend must verify completion with bounded lookahead rather than invent a large-source classification. Metadata underreporting, unknown size and configured byte limits remain covered. This observation explains the governed corpus routing failure, not the unavailable original incident.

## Chrome 69 overlay positioning

Actual API24 geometry exposes the Add document target outside the viewport. Logical inset declarations and max() cannot be the only positioning/target-size authorities for the supported Chromium 69 baseline. Add physical-offset and minimum-size fallbacks in consumer-owned CSS while retaining the pinned generated brand contract and strict geometry assertions.

## Android listener namespace alignment

The API36 campaign exposes delivery fallback polling and missing native Back acknowledgement. The generated ACL manifest names glitchpad-android-source while runtime/frontend event registration names android-source. Verify the exact Tauri command resolver, then align runtime and frontend names with the existing generated permission namespace. Keep the App layer priority and its acknowledgement contract; add a controlled callback regression and retain actual packaged Back proof as a separate requirement. The editing harness must establish real native WebView focus before browser editing and retain strict document-byte assertions.

## Headless listener ACL qualification

The Windows host test binary exits before the test harness starts with STATUS_ENTRYPOINT_NOT_FOUND after the listener regression constructs a Wry runtime plugin. The missing DLL/symbol is unavailable in retained logs. Keep the plugin name as a shared production contract consumed by Builder and validate it against the actual generated ACL resolver without constructing GUI runtime types. Retain both valid listener grants, stale-name refusal and the exact two private grants on all platforms. Preserve the Windows hosted check; do not skip the regression or alter permissions.

## Package failure observation

A current Windows lifecycle timeout lacks the precise named-wait call site, and Linux bundling exposes only a linuxdeploy failure. Retain bounded content-free call-site context and enable the existing Tauri build verbosity for the next candidate. Keep package assertions, budgets and toolchain policy unchanged; do not infer a product cause from either opaque failure.

## Governed Chromium 69 dedicated worker

The verified HeadlessChrome/69.0.3497.0 constructor rejects the current module-worker request before loading its bundled script. The same IIFE worker constructed as classic returns the expected rendered heading and marker without diagnostics. Align the production constructor with its IIFE format and retain the supported development-worker path, off-thread parsing, cancellation and resource ownership. Do not substitute synchronous parsing or infer a parser/polyfill cause. Retain the exact browser/version, constructor result and semantic corpus evidence, then qualify the packaged Android routes again.

## Native IME input qualification

The API36 harness records valid native/window/document/editor focus and user activation, but browser selectAll/insertText remain disabled. Current CodeMirror source supports EditContext on this Android/WebView generation. A controlled built-app reproduction observes active EditContext and the same disabled commands, while native browser input preserves exact multiline Unicode. Use WebView onCreateInputConnection and InputConnection selection/commit on its handler, then require exact native extracted text and visible CodeMirror text. This exercises native editing without assigning application state or DOM text. The actual updated APK result remains a separate requirement.

## Warm-intent observation continuity

The exact API36 stack locates the failure in the first warm delivery after cold semantic rendering, link-modal Back, focus and navigation checks passed. Native logs show the intent reaching the existing Activity, then no delivery drain. Generated SDK dispatch and project onNewIntent source contain no stale plugin-key lookup. Retain bounded callback/queue/notification facts plus UI state at this failure boundary before assigning a cause or changing App ordering. Keep the required warm route and original identity assertion.

## Activity-resume delivery wake

The C15 API24 snapshot proves one warm candidate queued with its native listener present and notification returned, while drain_count remains at the initial drain and pending_count is one. A later clean retry passes all warm corpus cases. This demonstrates a notification delivery gap; its exact SDK internal cause is unclaimed. Wry resumes its WebView during Activity onResume, while SDK plugin resume follows ProcessLifecycleOwner and can omit a brief warm Activity pause/resume. Observe the actual Activity lifecycle and post one coalesced, owned WebView frame callback after resume. Re-notify only when resumed with pending candidates/rejections; cancel on pause/destroy and retain the original immediate notification. Do not add polling or change source identity, grants, queue limits or acceptance waits.

## API24 native selection and Save failure assertions

The D724 API24 artifact verifies exact native editing text, then exposes a selection boundary mismatch: CodeMirror maps the non-Tile filler BR to semantic document end, so selecting the rendered placeholder LF can settle at zero rather than the requested one. Request native selection over the actual semantic document length while continuing to compare the complete extracted native text with its editing representation. Keep exact post-commit semantic text, cursor and UTF-8 destination checks. The write-refusal journey must expect the existing Save-specific failure contract, rather than the generic non-Save action message. Retain bounded chooser failure context for future mismatches; do not change product outcomes or weaken byte assertions.

## Dirty-close native cancellation qualification

After a cancelled native Save from dirty Close, the existing reducer clears the pending transition and the shell returns to the still-dirty editable draft with its Save-cancelled outcome. Qualification must assert that actual state instead of waiting for the dismissed resolution dialog and clicking an absent Cancel action. Keep pending-choice disabling, rejected Discard, one native chooser, exact retained semantic source and subsequent verified-save readback. This is an instrumentation correction; no product transition changes.

## New-draft native typing readiness

The 5eb API24 campaign reaches dirty-close setup after exact draft/copy writes, then fails before its fourth native editor commit because browser focus is absent. Its earlier helper calls await a new draft identity, while dirty-close setup can still see the prior editor. A public composed Chromium69 probe reproduces the old-editor interval immediately after New selection, followed by a new editor and Add-menu trigger focus restoration. Observe the new current surface, visible expected unsaved draft, empty semantic source and completed menu dismissal/focus restoration before native touch. Reuse that readiness contract for controlled New selections that precede typing; preserve strict native focus, input and byte assertions. Retain bounded active-element/geometry facts on failure. The missing actual APK focused element remains unclaimed.

## Real native handoff observation

The API36 artifact shows CREATE_DOCUMENT launch and MainActivity pause before the test receives its two-second JavaScript click acknowledgement; the picker becomes displayed after that deadline. This establishes an unsuitable post-launch acknowledgement dependency, without proving JavaScript suspension or a product launch failure. For the three unblocked native handoffs (dirty-close Save As and real Share launches), measure and hit-test the existing control before launch, then inject one native pointer tap without a post-launch script acknowledgement. Observe the actual system picker/accessibility window and actual MainActivity resumed/focused readiness on return. Preserve blocked ActivityMonitor result paths and every pending-disable, no-Discard, single-chooser, cancellation, retained-source and byte/readback assertion. Do not force lifecycle state, change product behavior or relax timeouts.

## Coherent post-commit editing observation

The 2ef API24 artifact verifies the first Markdown draft input and write/reopen, then reaches native commit in the second text draft. Its semantic equality check passes while the following captured editing representation is still one LF; the helper freezes that one-character buffer with a required semantic cursor of 30, an internally impossible pair. Require one coherent post-commit public observation of the same focused surface/editor, exact semantic source and matching EditContext text or legacy editing prefix before freezing the complete native expected buffer. Integrate this into the existing post-commit readiness deadline, retaining exact native text/cursor checks, no trimming/normalization and no input retry. Capture phase, expected selection and bounded pre-wait/failure state. Do not claim the unavailable actual post-commit snapshot or assign a Chrome/CodeMirror/connection cause.

## Dirty-close save admission and pending observation

A withheld-receipt App regression confirms ordinary pending Save disables every resolution choice. A separate red-first late-editor-transaction case exposes a product gap: the reducer refuses a stale decision and refreshes it, but App still launches native Save unconditionally. Read the live transition/session and honor the existing revision admission rule before I/O, exposing the reducer's existing review-current-edits announcement. Preserve exact source, pending guards and receipt behavior. The hosted pending wait folds evaluation errors into false, so its old artifact does not prove enabled buttons or establish this race as the cause. Retain bounded true/false/evaluation-failure counters, resolution button/status facts, visible revision and native-window context on the unchanged strict wait.

## 2026-11-04: Native-resized keyboard inset ownership

The AF API24 capture shows the native WebView contracting from 640 to 370 pixels while the focused editor scroller collapses to zero height; semantic source remains 30 characters but its public editing representation is only one newline. An exact Chromium69 production-DOM reproduction proves that App's Android-default layoutResizeCanBeIme setting publishes another 270-pixel AppFrame obstruction after the native resize. Removing only that duplicate obstruction restores the 232-pixel scroller, exact editing buffer and editor hit target. The pinned consumer implementation requires that the same inset never be applied in both native and web layers. Default the consumer layout-resize inference to false for the existing native-resized host, preserving explicit opt-in, genuine visual-viewport-only obstruction handling, rotation and all geometry/input assertions. Do not edit generated brand assets, force minimum heights, change input predicates or claim this establishes the separately uncaptured first-attempt body timeout or the original incident cause.

## 2026-11-04: Native keyboard ownership qualification

The existing AppFrame instrumentation simultaneously requires native adjustResize and an unconditional positive web IME inset. That contradicts the proven single-owner contract: a native-resized layout correctly needs no second web subtraction, and a zero inset alone cannot prove that the keyboard has hidden. T042 retains native touch/show/hide operations, focus, all AppFrame geometry assertions and existing observation deadlines, while independently capturing before/show/after native WebView, visible-window, browser layout/visual-viewport and available real IME visibility/bottom facts. Show must establish a real keyboard and native layout contraction or genuine visual-only obstruction; the canonical inset must equal the actual remaining visual obstruction. Hide must establish restored bounds, hidden IME where exposed and cleared inset before rotation. The existing keyboard probe cleanup uses Chromium69-compatible conditional access while retaining its exact blur/remove action; no unsupported optional-chaining syntax may prevent the native hide observation. Generated brand assets and product lifecycle remain unchanged.

## 2026-11-04: Observable pending native write qualification

AF API36 records fourteen and fifteen callback timeouts with no button-value samples while DocumentsUI owns the native window and MainActivity is CREATED. ActivityScenario allows the nondestroyed Activity and does not resume it, while retaining the same hidden WebView would remove no demonstrated boundary. T043 therefore separates two real native observations: preserve the unblocked system-picker/one-launch/Back/cancelled-source journey, then verify unchanged pending-disabled and rejected-Discard assertions during actual foreground native I/O. The existing test provider gains an exact-destination barrier controlled through its test-only grant provider; native write work runs on ioExecutor, so holding before writable descriptor open leaves the App UI observable. One existing 30-second pending deadline covers barrier entry and strict DOM observation. Release deliberately refuses before destructive open, preserving the empty destination and dirty source, then the existing normal Save independently verifies exact UTF-8 bytes. Cleanup always releases the barrier and retains the original assertion on failure. Verify fixture process ownership; add no product IPC, manifest capability, forced lifecycle/state, timeout relaxation or claim about the unavailable background callback cause.

## 2026-11-04: Terminal instrumentation authority

The 72960 artifacts demonstrate that a positive functional marker can precede INSTRUMENTATION_RESULT shortMsg=Process crashed and an absent JUnit completion. The wrapper currently discards adb status and accepts either stdout or logcat markers, and its policies explicitly accept marker-only output. T044 requires both the requested evidence marker and clean positive JUnit completion, preserves adb failure and explicit instrumentation failure/crash rejection, and retains every attempt. Marker-only or crashed output remains diagnostic functional evidence and cannot qualify a campaign. Correct test-owned lifecycle completion separately; add no crash whitelist or assertion bypass.

## 2026-11-04: Native tap visibility and acknowledgement ownership

Both 72960 API24 ACTION_DOWN events are rejected because their actual target is the InputMethod window, not DocumentsUI. Retain the correct uniform width-derived CSS scale, and require coherent whole-target DOM hit plus actual native visible-window/WebView bounds and a mapped app-visible screen point immediately before the single touch. If the measured control is covered by the actual IME, issue one public keyboard-hide request on the app token, then remeasure inside the same existing readiness deadline. Keep one DOWN/UP attempt and capture bounded phase/mapping/window facts on failure; add no injection permission or automatic re-tap. The API36 held-write Save As control matches one blocked chooser and leaves MainActivity resumed/focused, but its post-click JavaScript acknowledgement times out before provider-entry observation. Use the same single native control activation at that one site, preserve all actual writer-entry/strict pending/refusal/byte assertions, and capture actual provider state even when activation fails. Do not assign the second attempt's native RenderThread failure to an unproven New-choice acknowledgement cause or change that site without further evidence.

## 2026-11-04: Test-owned Tauri lifecycle completion

The retained API36 failures occur after the test flow has already failed or emitted its functional marker: AndroidX ActivityFinisher destroys the last Tauri Activity, Tao calls std::process::exit and HWUI finalization can fault before JUnit reports its terminal result. Exact runner1.7.0/monitor1.8.0/core1.7.0 sources support waitForActivitiesToComplete=false only when tests stop their owned activities themselves. T046 tracks each scenario and moves it to CREATED in class-owned after-test cleanup on success or failure, asserting actual onPause/onStop without forcing last-Activity destruction before terminal reporting. Apply the supported argument only to the three actual Tauri UI classes (delivery, AppFrame and performance), preserving all body assertions and existing outer process resets/recovery boundaries. Use no custom runner, production ExitRequested override or crash whitelist. Keep the earlier native teardown faults diagnostically; this corrects test ownership and does not claim a production last-Activity shutdown repair.

## 2026-11-04: Nonblocking Android interactive command dispatch

The pinned Tauri2.11.6/Wry0.55.1 command path proves a product scheduling gap behind the foreground held-write failure. Android disables the custom IPC protocol and calls the synchronous JavaScript interface directly; Wry invokes the handler inline under its IPC lock, the default Tauri command macro calls the synchronous host function inline, and run_mobile_plugin blocks on its receiver until the picker/write callback. This stalls the originating JavaScript invocation and its evaluation acknowledgement even while the Activity is resumed. T047 makes only S046's interactive Open, source-bound Save As, independent Create and diagnostic Share command handlers asynchronous and moves the existing blocking native operations to spawn_blocking with an owned AppHandle. Resolve the same managed host inside that worker, retain existing contracts/receipts/guards/cancellation errors and use a static bounded error only for worker scheduling failure. Add no parallel command framework or fake success; the actual held-provider test must observe pending state before release. A gated-worker scheduling regression supplements, and never replaces, fresh Android bridge/runtime evidence.
