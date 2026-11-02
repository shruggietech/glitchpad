# Verification: S043 Image Conformance and Activation

**Started**: 2026-11-02

## Scope and owner decisions

The slice includes #66, #75 and #76 candidate preparation. #76 and epic #10 retain final publication obligations. The owner explicitly removes unavailable physical-device and manual screen-reader testing as required gates. Neither evidence class is performed or claimed. Automated accessibility, hosted native source/provider behavior, package lifecycles, source integrity and advisory/license checks remain required.

## Spec Kit workflow

The installed skills and Linux prerequisite/setup scripts resolve the same S043 feature directory and selector. Specify/clarify pass the built-in quality checklist 16/16. The ten custom reviewer-owned questions remain unchecked and do not represent implementation evidence; the explicit autopilot kickoff authorizes continuation. Blocking read-only analysis maps all 12 FR and five SC to 21 tasks with no unresolved blocker. Research agents investigated qualification and activation contracts.

## Core requirement traceability

| Obligation | Check or explicit roadmap disposition |
| --- | --- |
| TS-FR-001 | Desktop source/delivery conformance; Android provider/resolver/delivery instrumentation |
| TS-FR-002 | Native source identity; domain/tabs and restoration tests |
| TS-FR-003 | check-shell-layout and hosted geometry evidence |
| TS-FR-004 | Tabs, TabStrip and application keyboard tests |
| TS-FR-005 | MetadataInspector, metadata-gateway and metadata provenance tests |
| TS-FR-006 | Core detection unit tests plus bounded fuzz detector invariants |
| TS-FR-007 | Editor conformance; native text round-trip/source tests |
| TS-FR-008 | Desktop source, editor and Android provider conflict tests |
| TS-FR-009 | Recovery conformance, close/reload/revocation and Android restoration |
| TS-FR-010 | Renderer capability and DocumentSurface/ImageSurface tests |
| TS-FR-011 | Native image resource/refusal tests and frontend cancellation/disposal |
| TS-FR-012 | Markdown conformance/sanitizer/network-denial tests |
| TS-FR-013 | TextSurface/editor conformance and lazy-language tests |
| TS-FR-014 | Image family corpus, controls, metadata privacy and generated ICO export (#75) |
| TS-FR-015 | Not assigned to v0.1/v0.2: planned PDF work #77-#82 |
| TS-FR-016 | Not assigned to v0.1/v0.2: planned office work #83-#96 |
| TS-FR-017 | Native external-link authorization and browser scheme denial |
| TS-FR-018 | Mermaid/Markdown asset and image network-denial tests |
| TS-FR-019 | Recovery quotas/expiry/corruption/save/discard tests |
| TS-FR-020 | Source/detection stable error and image hostile-input corpus |
| TS-FR-021 | Four platform package inventory/lifecycle/SBOM/provenance workflows |
| TS-FR-022 | S043 specify/clarify/plan/tasks/analyze and documentation pass |
| TS-FR-023 | Standalone/embedded Mermaid pipeline, sanitization and source-integrity tests |

Each automated row requires its actual current-candidate local/hosted result below. The two future format rows retain their existing issues and introduce no support claim. Native/package results are not inferred from shared browser tests.

## Qualification and remediation ledger

- The activation regression failed against the original text-only matrix. The completed matrix has 31 extensions (21 text/source plus ten images) with image Viewer roles, native chooser admission, Windows backup/restore hooks, Linux MIME registration and Android exact-type resolver declarations.
- Focused activation/community-release/macOS tests pass 33/33. Native image-family decode tests pass 10/10. The frontend gate passes 305 tests across 51 files, with lint, types and production build.
- Historical pre-review fuzz campaigns completed without process failures but had incomplete JPEG/GIF pixel coverage because cancellation/selection were derived from payload bytes. Review comment 4445989730 exposed the JPEG gap. The corrected shared library always decodes frame/entry zero uncancelled, tests arbitrary selection separately and independently asserts cancellation. The valid JPEG/GIF/animated-WebP/SVG/ICO seed regression failed before correction and passes afterward. The corrected campaign completes 167825 runs in 61 seconds with exit 0 and no crash/timeout/OOM; its source/library and lock digests are retained in `evidence/fuzz-summary.json`.
- Native resource qualification samples process resident memory every 5 ms and measures 20 iterations for original image fixtures plus a generated 1MP BMP. The first Linux result is 28127232 sampled peak bytes; generated BMP p95 is 469886 microseconds. This campaign is not maximum-input peak-memory proof. Current-head hosted measurements are retained independently.
- The aggregate advisory gate refused Tokio 1.53.1 and retired zbus names/wire crates. Tokio 1.53.3 and exact licensed plugin sources with scoped Linux zbus 6 migration remove those findings. The unchanged gate now reports advisories/bans/licenses/sources all OK.
- The real session-bus regression passes: the persistent Tauri runtime serves repeated calls from a nested runtime context, releases its bus name, and permits a new owner. Hosted Linux package lifecycle verifies actual secondary application forwarding on both Ubuntu releases and package forms.
- The site campaign initially passed 72/73 browser cases; its one failure was the deliberately corrected latest-published download URL expectation. The final complete run passes all 73 cases. Historical roadmap routes are preserved while generated documentation advances.

## Issue acceptance map

| Issue | Criteria and evidence | Disposition |
| --- | --- | --- |
| #66 | 23-row core map; hostile-source tests; three native desktop hosts/API24/API36; package and accessibility aggregate results | Automated baseline delivered; retain #66 for non-waived manual package-flow results, with current hosted outcomes below |
| #75 | Original/hostile/fuzz corpus; measured resources and suspension assertions; automated static/animation/SVG/ICO accessibility; four-platform classifiers; unchanged advisory/license and package budgets | Automated acceptance satisfied at application head 50ba55b; final receipt-head CI remains required |
| #76 | v0.2.0 identity/docs/capabilities and candidate package inputs; final tag, official packages, provenance/readback and publication receipt | Candidate preparation; publication remains pending |
| #10 | Every image child plus release completion | Remains open until #76 completes |

## Current verification

The complete `cargo xtask check` rerun finished with exit 0. It includes 305 frontend tests, 73 site browser cases, native workspace tests/clippy, advisory/license gates, package policies, links in 461 Markdown files, 47 rendered Mermaid diagrams, v0.2.0 identity checks and 1890 UTF-8/BOM/mojibake text checks. The additional official-Windows policy regression passes with the screen-reader row explicitly unavailable. Exact bundled BrandBuilder recovery passes 31 verifier checks and zero glyph failures in the completed validation image. A failed, missing or skipped check is not a passing result. Local command logs and real exit markers are retained under the ignored `.tmp/s043-*` namespace. Hosted artifacts and reviews bind the application qualification head below; the final receipt-head gate is recorded on the PR before owner handoff.

## External review ledger

Official [PR #238](https://github.com/shruggietech/glitchpad/pull/238) was automatically published non-draft at initial head `ba354f5035c95da31b5b0b6873786cde40cae68e`. The initial external Codex code review completed with no findings. The single authorized follow-up was requested as a dedicated security review in comment 6584595465; the service returned it as a manual code review, with one P2 finding (4445989730). The correction and failing-then-passing seed regression are complete. No separate security-review receipt is inferred. Explicit follow-up requests used: 1 of 1. No further review trigger is permitted. Total permitted rounds: 2. No merge, tag, release or third review request is authorized.

## Convergence

Convergence checked 12 functional requirements, five outcomes, eight scenarios, the plan decisions and all eight constitution principles. It appended T022/T023 for exact upstream documentation exclusion and stale Android deferred-policy wording; both are implemented with a failing-then-passing link-boundary regression (21/21 validator tests). Reassessment finds no remaining application-code gap. The received external finding is resolved and application-head native/package evidence is complete. #66 retains non-waived manual rows, and #76/#10 retain publication. The final receipt-head CI gate must still finish before owner handoff.

The single follow-up finding was fixed and pushed at `50ba55b6d9687ac09bf6cc0b8841a391cd3a66ec`. Review comment 4445989730 has a regression/campaign reply and its inline thread is resolved. No further review trigger is permitted. Application-head CI and branch-head native package jobs pass; final receipt-head checks must pass before handoff.

## Read-back hosted qualification

CI run [41499171232](https://github.com/shruggietech/glitchpad/actions/runs/41499171232) binds branch head `50ba55b6d9687ac09bf6cc0b8841a391cd3a66ec` to tested PR merge revision `41a77cac6a0eb44d3de7f81f77d24946874cfdd8`. GitHub reports the identical tree `cf41ca7212a59144b74ce03b39a1f064860a2383` for both revisions. The downloaded archives match the retained SHA-256 digests in [hosted-image-qualification.json](evidence/hosted-image-qualification.json). Native Linux/Windows/macOS tests and measurements, the fuzz seed regression and the hosted 405405-input/61-second fuzz campaign all pass. Native sampled peaks are Linux 28278784, Windows 29011968 and macOS 28917760 bytes; generated 1MP BMP p95 is respectively 1042942, 1149706 and 772718 microseconds, within the explicit budgets. Both Android API24/API36 campaigns pass their runtime assertions. The read-back [Android receipt](evidence/android-hosted-qualification.json) retains eight connected tests per API with zero failures/errors/skips, all image/export/delivery assertion markers, actual Tauri AppFrame evidence and passing idle PSS (99485696 and 157320192 bytes). These are hosted x86_64 debug/emulator results; idle PSS is not per-image peak-memory evidence.

The branch-head Linux package run [41499155097](https://github.com/shruggietech/glitchpad/actions/runs/41499155097) passes AppImage/Debian lifecycle on clean Ubuntu 22.04 and 24.04, including startup/running-instance delivery, registration, cleanup and document preservation. Its receipts explicitly retain `not_run_candidate` for several installed GUI/manual flows. The native contract tests separately cover read/edit/save/metadata/recovery; they do not turn the unperformed installed-GUI rows into passes. The unavailable physical-device and manual screen-reader requirements are removed by owner decision. Other non-waived manual package-flow criteria in #66 remain open; the Linux receipts list dialog, drag/drop, Save As, print, keyboard, focus, text scaling, increased contrast, reduced motion, and Markdown/Mermaid WebKitGTK checks as not run. This slice does not claim to close those manual rows.

## Criterion dispositions

| Criterion | Evidence and disposition |
| --- | --- |
| #66 core obligations | All 23 rows are assigned above; PDF/office remain explicitly planned under existing issues. Native/shared checks and both Android runtime campaigns pass; the terminal receipt-head CI join is required before handoff. |
| #66 hostile authority boundaries | Existing native source/export/recovery tests, sanitizer and external-link tests, content detection and the corrected fuzz campaign cover implicit network/script/native/silent-write boundaries. |
| #66 four-platform results | Three desktop native results, four platform package manifests and API24/API36 instrumentation are retained independently. Manual package-flow rows remain unperformed, so #66 is not closed. |
| #66 aggregate omissions | Unperformed manual rows and candidate-only package authority are explicit here and in the original machine receipts. Existing #66 remains the actionable owner for its non-waived outstanding criteria; removed physical/screen-reader checks are not defects. |
| #75 hostile/corpus | Native image contract/decode/metadata/family suites on three desktop hosts, Android provider delivery for every family and hostile SVG, corrected seeded fuzz regression and bounded campaign. Both API24/API36 runtime campaigns pass. |
| #75 accessibility | 305 shared frontend tests include axe for static/GIF/SVG/ICO critical controls, keyboard/touch/reduced motion/metadata and suspended-surface disposal. No manual screen-reader pass is claimed. |
| #75 equivalent classifications | Shared native golden/refusal tests, exact native capability/MIME validators and Android resolver/viewer/provider instrumentation. Await final Android join. |
| #75 supply chain | Unchanged cargo-deny and dependency review pass; all four package jobs generate SBOM/provenance and carry required notices. Eight package byte-count/digest readbacks are retained in [package-readback.json](evidence/package-readback.json). |
| #76 all children | Image implementation and #75 qualification are prepared; #76 and parent #10 retain their publication obligations. |
| #76 conformance | Automated checks are the S043 result, with the owner's physical/manual-screen-reader amendment and actual unperformed scope stated above. |
| #76 advertised formats | Capability validators require the ten image and 21 text/source extensions; PDF/DOCX/ODT remain unadvertised. |
| #76 version/artifacts/tag | Product/specification/package identities are v0.2.0. Tag, publication and final official release readback remain unperformed and unauthorized in this slice. |

## Application qualification and final handoff gate

At application head `50ba55b6d9687ac09bf6cc0b8841a391cd3a66ec`, the complete [CI join](https://github.com/shruggietech/glitchpad/actions/runs/41499171232), [CodeQL](https://github.com/shruggietech/glitchpad/actions/runs/41499171443), [site](https://github.com/shruggietech/glitchpad/actions/runs/41499171429), branch-head [Windows package](https://github.com/shruggietech/glitchpad/actions/runs/41499155094), [Linux package and four clean lifecycle jobs](https://github.com/shruggietech/glitchpad/actions/runs/41499155097), branch-head [macOS universal package and both native architectures](https://github.com/shruggietech/glitchpad/actions/runs/41499155051), and [Android signed candidate inventory](https://github.com/shruggietech/glitchpad/actions/runs/41499171394) finish successfully. Merge-revision results use the verified identical tree described above. Superseded old-head jobs are not represented as passing final-head evidence.

Mac native lifecycle assertions pass, but its retained hosted cold-start p95 observations are 2942 ms on ARM64 and 3605 ms on x86_64. They pass the existing 10000 ms hosted-smoke limit and exceed the separate 2500 ms reference threshold. Their original `failure` reference classifications remain in [package-readback.json](evidence/package-readback.json); [#239](https://github.com/shruggietech/glitchpad/issues/239) tracks baseline comparison and attribution. No reference performance pass or demonstrated product regression is inferred. The image-specific decode/resource and package-size budgets pass independently.

This receipt commit changes documentation, evidence and an obsolete Android test comment. It makes no application behavior change. Final delivery requires all applicable checks on that commit to finish successfully, all received review threads to remain resolved and the PR to remain open/unmerged. The final PR handoff comment binds that actual SHA and terminal check results without a self-referential receipt commit. #75 is eligible to close on merge under the owner-amended evidence policy. #66 remains open for non-waived manual results, #239 retains the startup investigation, and #76/#10 remain open until publication. No third review request, merge, tag or release is performed.
