# Implementation Plan: Android task completion and qualification

**Branch**: `codex/047-android-task-completion` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

## Summary

Complete #249/#250/#251/#253/#254 as one integrated document-task increment. Use the existing shared React/Tauri architecture, bounded native adapters and AppFrame environment ownership. Qualify ordinary and fault-probe APKs separately, retain all attempts, and stop at an unmerged PR ready for owner review. #244/#255 and unrelated milestones remain open.

## Technical Context

**Language/Version**: Rust 1.96.0, Node 24.11.0, pnpm 10.28.2; repository authorities remain the version source. React 19.3.1, TypeScript 6.0.2, Tauri host 2.11.6/API 2.11.1, CodeMirror search 6.7.2/view 6.43.15 and usvg/resvg 0.48.1.

**Dependencies**: Retain pins. Add the governed exact radix-ui 1.6.7 dependency only for bounded product task surfaces. Explicit direct edges to already locked CSS/SVG parsing crates are permissible for parsed-reference validation; no incidental upgrades. Retain Mermaid12.0.0 with the documented three-file CSSOM compatibility patch for the required minimum WebView; keep native construction where supported and isolate the fallback stylesheet from the active page. Regenerate applicable license projections and record patch provenance.

**Storage**: Existing local session/source/draft/preference stores; no new remote storage or account subsystem.

**Testing**: Vitest behavior/contracts, Rust parser/render tests, composed React/AppFrame browser geometry and isolated hosted Android API24/API36 WebView/provider journeys. Preserve affected desktop/native/package checks.

**Constraints**: Hidden Linux Docker for local non-Git commands; approved hidden VCS wrapper; UTF-8 without BOM; pinned generated brand bytes unchanged; one inset/focus authority; original-source integrity; no implicit resource resolution/upload; existing bounds, two native attempts and two external review rounds unchanged.

**Scope**: Five issues, 28 FR, eight SC, 21 scenarios, all119 literal control rows in24 groups, ten end-to-end journeys. The report-declared150 variants and154 literal label chunks are attributed separately in contracts/control-register-source.json.

## Constitution Check

Initial and post-design gates pass. P1: compact document-focused chrome and dismissible task surfaces. P2: offline core tasks and notices, explicit outbound links without content upload. P3: shared frontend contracts with narrow native projections and Android URI authority retained. P4: bounded parsed SVG validation, no external resolvers, typed failures and intact source/write rules. P5: unreleased S047 behavior lives here; #255 owns release reconciliation. P6: required actual package/runtime/byte evidence blocks completion. P7: dated bounded decisions in research.md, no general UI/process framework. P8: pinned compatible dependencies, generated fixtures and notice regeneration. No exception is proposed.

## Phase 0: Research decisions

R1-R4 are resolved in [research.md](research.md). The owner report is supplied and all literal rows imported. Research distinguishes existing source evidence from future candidate evidence. The original incident bytes/hash/trace remain unavailable.

## Phase 1: Architecture and contracts

### Shell and task surfaces

App owns destination/disclosure state and Back priority. Compose a bounded product TaskSurface from pinned Radix primitives/tokens inside AppFrame's existing overlay root; use controlled open/change and normal focus containment/restoration. Do not patch generated recipes, synthesize global Escape/clicks or introduce another viewport service. The brand contract explicitly leaves product screens/navigation outside its grammar. Phone task surfaces are modal. A wide metadata inspector may remain explicitly nonmodal.

Use available usable width/height and existing environment/crop facts for composition. Compact behavior applies below768 CSS px usable width or below480 usable height (a product composition threshold, not a brand token). Wide tabs remain; compact title/count switcher is visible even for one document. Application destinations are separate from document More. Compact Menu, Document tools, file identity/count and Add share one header; the existing Add choices and task dialogs remain in AppFrame’s overlay. The compact draft status shares that title row, and no floating dock consumes a full-width source strip. Wide layouts retain inline primary actions and tabs. Secondary tools disclose without horizontal scrolling. Below320px usable height, the existing image/diagram More control uses a48px corner overlay; Fit/Zoom retain Document tools and keyboard routes, with direct local buttons in other frames. Keyboard/system obstruction is applied only as the existing canonical remaining intersection, never counted twice.

About/Help uses a narrow read-only installed application-info projection plus lazy platform notice text. Package/version/build/channel are native facts or explicitly unavailable, never inferred from frontend package.json. Official repository/docs/company links use the existing explicit external-link gateway. Full license/notice text remains available offline. Contained renderer/root/bootstrap failures retain a bounded About/Help route without depending on the failed document.

### SVG and renderer controls

Retain UTF-8/XML and existing depth/node/path/text/pixel/time budgets, no DTD and deny both image resolvers. Validate XML namespaces, parsed CSS and local references before usvg's pre-parsed-tree API. Support inert inline/internal presentation styles, namespaced SVG and bounded local fragment reuse. Reject active/unsupported, external, missing/cyclic or expansion-over-budget references with stable distinct outcomes. Match usvg href precedence and first-ID ownership. Existing cooperative time checks remain; no claim of hard preemption inside an uninterruptible renderer call.

Propagate finite preview failure categories across core/host/gateway/UI. Deterministic refusal offers compatibility/source and metadata, while source-read/transport failures may retry. Loading/no-preview cannot report successful viewport actions.

Use one measured effective viewport scale for image/diagram local/menu/keyboard/gesture actions. Fit is min(1, availableWidth/naturalWidth, availableHeight/naturalHeight). Pan from Fit retains scale; zoom multiplies it; Actual size is1. Reset only clears pan/zoom to Fit. Clamp pan to actual extents, retain selected frame/icon/background, track pointer ownership and image readiness. Validate actual exported ICO PNG bytes/pixels through the native destination.

### Remaining controls

Adapt actual installed CodeMirror search markup, with labelled reachable query/replace/option controls and announced counts/no-match/invalid regex. Read-only modes hide replacement; history availability reflects real history. Numeric inputs retain editable empty drafts until validation/commit. Preserve exact edits and mode/focus/position. CodeMirror’s actual generated search panel uses its documented external panel container inside the managed Find and replace task; rendered Markdown/Mermaid searches use the same bounded task composition. Document details and source-bound large-text tools open from Document tools, keeping their editors/viewers mounted. Make large-text section navigation/search/goto/copy outcomes truthful. Metadata copies await clipboard and preserve sensitive confirmation; checksum cancellation follows dismissal. Preferences validate font fallback, size8-72/tab1-16, separate default/document wrap, preserve current unsaved Markdown when default changes and await scoped reset.

The119-row ledger records source owner, every named case, issue owner, mounted/passive/absent disposition and candidate evidence separately from inherited S046 proof. CTRL-114 is unmounted/remove or deliberately reused with proof, CTRL-115 read-only checked/unchecked; unsupported page navigation remains absent until a valid provider exists.

### Qualification

CI matrix API24/API36 × ordinary/fault_probe gives four isolated jobs and separate artifacts. Ordinary tasks execute the real composed app without compiled fault listeners/save getter. Probe tasks exercise guarded renderer/root, genuine same-origin missing-module startup and actual absent-native-command rejection; each package has its own captured installed bytes and role. Build-role DOM metadata derives from the same compile-time guard. No new global activation/getter seam.

Keep the single AndroidX Back consumer. Passive bounded native counters allow positive observation of actual API36 edge start/progress/cancel without consuming another callback. Explicit packaged predictive-Back opt-in; cancellation has zero commit/request/delegation and preserves exact draft/layers. Button/commit dismiss one eligible layer. API24 predictive progress is explicitly N/A, with button behavior required.

Each of ten journey rows records actual APK/instrumentation SHA, source, package/version/channel, compiled role, API/WebView, native/CSS viewport, text/nav profile, screenshots/logs, attempts and observed results. All required variants must pass; missing/duplicate/mismatched rows fail the validator. Keep existing30s action deadlines, two process attempts and clean-positive JUnit/marker/adb/crash gates. Save/reopen, ICO PNG and frozen Diagnostics receiver bytes require readback. No native-process-loss or signed/minified release claim is inherited from debug candidates.

## Project Structure

- apps/glitchpad/src: App shell, bounded task surfaces, document components/domain and composed tests.
- crates/glitchpad-core/src: image-family validation/outcomes and minimized generated fixtures.
- crates/glitchpad-host: typed image/runtime projections, installed metadata/notices and existing Android bridge.
- crates/glitchpad-host/gen/android/app/src/androidTest: actual delivery/task/predictive-Back tests.
- scripts and .github/workflows: composed geometry, candidate receipt validation and four-role/API jobs.
- specs/047-android-task-completion: research, data model, contracts, tasks, issue/control evidence and handoff.

## Execution and documentation

Setup/requirements review and cross-artifact analysis precede source edits. Tests precede corresponding behavior changes. Disjoint parser/native/renderer tasks may proceed in parallel with explicit file ownership; App integration remains serialized. Run aggregate/brand/encoding checks, publish PR, monitor exact-head CI, resolve findings within two review rounds, retain final evidence and stop unmerged. No deployment, release tag or official-spec version bump.

## Complexity Tracking

No constitution exception. Bounded product composition is permitted by the pinned implementation contract and is not a second generated design system. Native observation is passive and private; fault activation stays inside the existing compiled guard.

## Qualification corrections (2026-11-06 UTC)

Actual hosted failures require bounded corrections inside the existing contracts: baseline DOM startup fallback on Chrome69, reuse of the owned Android activity for composed root recovery, current mounted document labels, a complete bounded Markdown source flex chain and exclusion of a failed rendered subtree during source recovery. Normal Read/Edit preserves the current source/history and rendered article position. Hardware Enter with an attached EditContext delegates once to the existing editor command only for focused editable current content; composition, modifiers and withdrawn authority retain their existing input route. Native Add viewport observation remains active while interaction is temporarily disabled so opening tools does not clamp document scroll. These changes introduce no new public bridge or parallel UI authority.

Native qualification uses the already pinned AndroidX intent monitor/stubber because the previous framework monitor override is unavailable on API24. It verifies an outgoing exact explicit intent without attached document content; external website loading is outside that observation. Input preparation requires a coherent hit-tested target, one native tap and the complete exact public InputConnection buffer within the original action deadline. Fixed test-owned shell scripts use a whitespace-free encoded argument because Runtime.exec tokenization does not honor shell quotes. API36 setup journals before mutation, verifies the gestural resource value and restores the complete previous overlay vector/resource, including all-off base state. Each Find menu/keyboard/local alias now prepares an exact current-source selection assertion.

The Windows driver checks the actual declaring UI Automation API immediately after checkout and reads unlabeled recovery prose through TextPattern while retaining source/Retry/marker assertions. Failed clean-launch evidence remains diagnostic until an exact branch-head run passes. Android jobs retain compilation caches after failure to avoid rebuilding unchanged dependencies; macOS unit jobs use two workers to limit host contention. These process changes retain the original deadlines, attempt limits and required task/byte/geometry gates. Final candidate qualification remains an execution gate, independent of these source decisions.

The next installed fault probe first settles the current native SVG, then uses the existing guarded recovery generation to request its image render. ImageSurface observes that same generation already passed through DocumentSurface for other renderers. This keeps the existing absent-command invocation inside one owned current-image lifecycle instead of arming it across picker/visibility/source transitions; Retry still uses the actual native renderer and preserves original SVG bytes. No new global activation or bridge is added.

Metadata polling tests hold the next native query until the initial cached-state assertions finish, then release its actual rejection explicitly. Inspector controls are queried in their owning complementary region, the Close action remains in the surrounding task header and application status remains global. This removes a timer race and unnecessary full-shell queries while preserving cancellation, stale-result, unavailable-state and original time-budget assertions.

Actual ordinary-job failures require native fixture corrections: Zoom checks compare the same source-owned viewport with exact125% and156.3% labels, Replace all re-enters its current replacement draft after panel recreation, and native select changes observe and activate the actual enabled option in the focused popup. Neutral Open cancellation checks exact retained drafts and source rather than waiting for a message that Android Open does not publish. The source-read fixture allows the five acquisition/identification descriptor opens before denying preview I/O; the required current image identity and distinct source_read outcome remain gates.

API24 shell transport now uses three-digit octal escapes in the printf format, because the pinned Android7 printf consumes the leading zero as part of its three-digit %b escape. The source-extracted commands pass both the actual Java Runtime.exec(String) boundary and pinned Android7 mksh/printf byte checks, including Unicode, whitespace, empty output and nonzero status. A new installed instrumentation test independently enforces the command contract. These local checks are not installed runtime qualification.

The Android task job budget is90minutes after the previous60-minute hosted job expired during image tasks, after compilation and emulator setup consumed most of its budget. Each action still has its original30-second deadline, each task has at most two process attempts, and every required row and byte/geometry assertion remains mandatory. The fixture and CI keep the emulator awake and require an unlocked interactive device before app interaction; failed focus checks retain strict behavior and add fixed power/keyguard/window diagnostics.
