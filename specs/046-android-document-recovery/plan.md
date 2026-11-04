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
