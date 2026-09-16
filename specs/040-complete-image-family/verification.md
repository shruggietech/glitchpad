# Verification: S040 Complete Image-Family Capability

**Started**: 2026-09-15

## Specification and Design

Spec Kit feature/template resolution, setup-plan and setup-tasks commands completed through the hidden Docker launcher. Specification quality is 16/16 pass: four user stories, 16 acceptance scenarios, 24 functional requirements and seven measurable outcomes. Initial/post-design constitution checks evaluate all eight principles with no exception. No extension hooks or separate autopilot file are installed.

Mandated dependency and integration research agents inspected owned decoder APIs, SVG resolver/default-feature traps, actual ICO dimension admission, and original-source export exclusion. Dated decisions are recorded before implementation in [plan.md](plan.md) and [research.md](research.md).

## Scope Traceability

Issues #70/#71/#72/#74 are fully included and must meet every criterion before handoff. #75/#76/#66 and later PDF/office milestones remain incomplete. Official version/public support/associations/intents stay 0.1.3. No merge or release is authorized by this receipt.

## Execution and External Review Ledger

Implementation is complete. Official publication, external reviews and latest-head hosted results are pending. No review request has been posted for S040. Maximum explicit follow-up review requests: one.

## Implementation Decisions and Focused Evidence

The native common-capability test failed against S039 before implementation (one failure, one policy pass). The browser inert-SVG result regression also failed against the S039 validator before extension. Focused native tests now verify inert vector pixels, hostile SVG refusal, node/depth/text ceilings, GIF disposal/transparency/backward replay/frame-count refusal, animated WebP alpha/loop restart, independent ICO PNG/DIB/duplicate/corrupt entries and the approved font digest. Native export tests cover original/hard-link aliases, stale source revisions, destination conflicts, complete commits and staging cleanup. Browser tests cover paused startup, sequential stepping, native eviction scope, export cancellation and bounded presentation projection. The full initial gate reached dependency audit and correctly refused the unmaintained 0.47 font stack; maintained resvg/usvg 0.48.1 replaces that stack without suppression. Cargo deny advisories, bans, licenses and sources all pass; neither flagged package remains in the lock. All four notice bundles include the complete obligations for the 31-package graph delta and the approved Geist OFL.

Task-plan filename consolidation is explicit: T006/T009/T014 tests live together in `crates/glitchpad-core/tests/image_family_decode.rs`; T007/T015 share `crates/glitchpad-core/src/image_family.rs`; T010 lives in its `image_family/animation.rs` submodule. Shared classification and checked PNG delivery justify this consolidation. Issue/scenario ownership remains unchanged.

The original 13 raster digests are retained and the corpus has 18 original fixtures. All 32 family/viewport/touch layout cases pass with >=70% image-pane coverage, >=44px touch actions and no page overflow. Family controls share one horizontal toolbar; bounded policy text remains inspectable in file information.

## Local Validation and Artifact Analysis

The complete `cargo xtask check` finished with exit 0: native workspace tests and clippy, Cargo deny, frontend lint/types/tests/build, original fixture digests, image/shell/layout/metadata/security/performance/package checks, browser delivery/accessibility, configuration, documentation format/lint/links, 47 rendered Mermaid diagrams, official version consistency and UTF-8/BOM/mojibake checks. The confirmation run also finished with exit 0 and includes the new motion/readback regressions. A final focused surface run verifies the clarified original loop-fact label. Native host unit tests pass 56/56, desktop source conformance passes 16/16, native family tests pass 10/10, and frontend tests pass 295/295 across 51 files. Actual Android Kotlin/provider/WebView and Windows/macOS fidelity remain required hosted evidence, never inferred from Linux.

Read-only Spec Kit analyze checked 24 functional requirements, seven buildable outcomes, 16 acceptance scenarios, all 36 tasks and eight constitution principles: 100% mapped coverage, zero ambiguity/duplication/critical findings and no unmapped task. Convergence found one partial evidence gap (dynamic reduced-motion change), appended T036 under Phase 8 without rewriting existing tasks, and implementation added the passing no-subsequent-frame regression. Reassessment finds no remaining application-code gap; publication/review/hosted receipt tasks remain explicitly pending.

The final Android readback audit identified that Kotlin `readBytes(size)` is an allocation hint rather than a byte ceiling. A checked streaming reader now refuses oversized provider readback, with a separate unit regression. Android export deliberately refuses unknown-size or nonempty provider destinations rather than guessing original independence or overwrite consent; its truthful durability is recoverable/non-atomic. Desktop generated export uses exclusive complete-file publication or observed-conflict-checked atomic replacement and never source Save.

## Post-Publication Boundary Correction

Official PR195 opened at initial head `533ea36`. Initial external Codex review is running; no explicit follow-up has been requested. Hosted Android compilation found an undeclared `serde_json` reference in cancellation IPC, replaced by the bridge's typed serializable cancel request without changing dependencies. Adversarial convergence appended T037 because one invalid ICO range incorrectly rejected neighboring valid entries. The new regression failed with `Truncated` before correction, then passes with all rows retained, invalid ranges/sizes classified locally, unknown encoding represented truthfully, and valid-neighbor PNG decoding preserved. Native corpus, desktop conformance, workspace clippy and full frontend checks pass after correction. Header/directory truncation and global resource ceilings remain whole-container refusals.

## Initial Review Remediation

Codex completed initial review of `533ea36` with three P2 comments: entry-local ICO ranges (discussion4021205262), Android cancellation before export registration (discussion4021205266), and replay after one-play completion (discussion4021205275). ICO isolation is fixed in `982fbd1`. The cancellation registry now synchronizes registration/early markers, bounds UUID tombstones to 64, preserves active cancellation and cannot cancel a newer request when old cleanup arrives. Kotlin regressions cover early, active, late, bounded and invalid-ID cases; actual hosted execution is pending. Play from the final frame now restarts frame zero; the native-eviction browser regression verifies natural completion and explicit replay. Native family corpus passes 11/11, host unit/source conformance 72/72, workspace clippy and all 295 frontend tests/types/lint/build pass.

T038 additionally closes transient encoded-buffer accounting: preflight sanitized vectors reserve only source capacity, shared cursor ownership retains the original vector allocation without a payload copy, and three encoded buffers plus fixed/surface/delivery overhead are admitted. The original GIF with a 4 MiB comment block passed the old insufficient-headroom admission (regression red), and is now refused before sanitization under the constrained peak. All existing golden GIF/WebP frames still pass. Android-target plugin compilation passes in the Linux container after the typed cancellation fix.

## Hosted Export Evidence Completion

T039 closes a platform-evidence gap beyond pure guards: API 24/36 delivery instrumentation now drives explicit export through the real WebView, Rust command, Kotlin bridge and controlled document provider. An instrumentation activity monitor returns native PNG chooser results for cancellation, original-source refusal, successful selected DIB export and existing-destination conflict. Independent original PNG pixel comparison proves selected DIB output; the provider source and conflicting destination bytes must remain unchanged. The controlled test provider alone accepts PNG creation, with unique destinations deleted and both read/write fixture grants revoked. Actual hosted execution remains pending. Shared native PNG/DIB golden comparison passes locally.

## Final Generated-Export Guard

The post-review complete `cargo xtask check` finished with exit 0 at `575f64a`, including all native/frontend/browser/performance/documentation/encoding gates. Hosted Android debug APK also passes that head. Android documents can implement `w` with truncation, so T040 requires non-truncating `rw`, an actual empty seekable descriptor, and cancellation/source-registration checks inside the opened descriptor before writing. The provider corpus now deliberately reports zero metadata size for a nonempty independent document and requires its original bytes to survive refusal. Providers without a verifiable empty seekable destination fail safely; general source Save As remains unchanged. Actual API 24/36 round-trip and cancellation-registry test execution remain pending.

## Nested WebP Admission Correction

T041 closes a concrete decoder boundary found in image-webp 0.2.4 source: lossy VP8 allocates using embedded bitstream dimensions before comparing them with ANMF dimensions. Preflight now validates every nested VP8/VP8L header, alpha/image ordering, bounded subchunk ranges and actual dimensions before creating the decoder. The regression failed against the old constructor, then passes for oversized nested VP8L, VP8 and ALPH/VP8 headers without attempting the oversized allocation. All ten decoder tests, workspace clippy, 56 host unit tests and 16 desktop source conformance tests pass with exit 0. Together with the two family contract tests, the native family suite now contains 12 tests. Hosted checks and external follow-up remain pending.

## Permitted Follow-up Review

The complete local `cargo xtask check` passed with exit 0 at `60e4566`, including 964 UTF-8 text files. Exactly one explicit follow-up was requested in comment5689892192 against that head; Codex completed it at 2026-09-16T00:12:10Z with two P2 playback findings (discussion4021351270 and discussion4021351271). No third review will be triggered. Convergence appended T042/T043. Three browser assertions failed before correction; retained reduced-motion state now blocks Play and scheduling while preserving manual stepping, and completed-loop progress survives pause/resume until explicit natural-completion restart. Regressions cover both GIF repeat and WebP total-loop semantics, including pause/resume at the final frame. All 14 image-surface tests and the full frontend lint/types/298-test/build gate pass. Replies/resolution and hosted API 24/36 evidence remain pending.

## Android Inventory Evidence Correction

The complete local gate also passed with exit 0 at `d9c3ef4`. All five review findings now have pushed fixes, replies and resolved threads; API 36 completed plugin `testDebugUnitTest` and the instrumentation APK build, with API 24 subsequently passing the same build/unit step. API 24 then failed at test line83, before export, because the body-innerText inventory assertion did not expose all requested native select-option text. T044 queries every option directly and asserts all four rows plus DIB/duplicate facts from returned JSON; visible export-button, selected pixels and provider round trips remain required. The downloaded device evidence contains the same line83 failure on both delivery attempts. All non-Android hosted checks are green (33 successful checks plus intentional Pages skip); corrected API 24/36 runtime evidence remains pending.

## Native Chooser Visibility Correction

At `0e03436`, API 24 passed the direct four-entry/DIB/duplicate inventory and selected DIB pixels, then failed awaiting the first chooser-cancellation receipt. The device log confirms `exportImage` was invoked, MainActivity paused for its chooser and resumed, and visibility cleanup sent cancellation. T045 separates explicit export lifetime from preview visibility and retains its receipt independently of preview regeneration; source, selection and session disposal still abort export. The new hide/resume regression failed against the old cleanup and passes after correction, alongside the existing selection-change cancellation test (15 surface tests total). Instrumentation waits for regenerated selected pixels and verifies the export action is enabled before each native chooser. Complete local `cargo xtask check` passes with exit 0, including all 299 frontend tests, browser/layout/performance checks, 47 Mermaid diagrams, 419 linked Markdown files and 964 UTF-8 text files; version remains 0.1.3. Actual API 24/36 provider evidence remains pending.
