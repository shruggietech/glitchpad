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
- Initial fuzz campaign completed 334706 runs in 61 seconds. The second campaign adds core detection, language and SaveRequest deserialization. The final campaign uses the current product-seeded dependency lock and completes 224945 runs in 61 seconds with exit 0 and no crash/timeout/OOM. These are bounded 64 KiB input campaigns, not exhaustive proofs.
- Native resource qualification samples process resident memory every 5 ms and measures 20 iterations for original image fixtures plus a generated 1MP BMP. The first Linux result is 28127232 sampled peak bytes; generated BMP p95 is 469886 microseconds. This campaign is not maximum-input peak-memory proof. Current-head hosted measurements are retained independently.
- The aggregate advisory gate refused Tokio 1.53.1 and retired zbus names/wire crates. Tokio 1.53.3 and exact licensed plugin sources with scoped Linux zbus 6 migration remove those findings. The unchanged gate now reports advisories/bans/licenses/sources all OK.
- The real session-bus regression passes: the persistent Tauri runtime serves repeated calls from a nested runtime context, releases its bus name, and permits a new owner. Hosted Linux package lifecycle still must verify actual secondary application forwarding.
- The site campaign initially passed 72/73 browser cases; its one failure was the deliberately corrected latest-published download URL expectation. The final complete run passes all 73 cases. Historical roadmap routes are preserved while generated documentation advances.

## Issue acceptance map

| Issue | Criteria and evidence | Disposition |
| --- | --- | --- |
| #66 | 23-row core map; hostile-source tests; three native desktop hosts/API24/API36; package and accessibility aggregate results | Await final current-head evidence |
| #75 | Original/hostile/fuzz corpus; measured resources and suspension assertions; automated static/animation/SVG/ICO accessibility; four-platform classifiers; unchanged advisory/license and package budgets | Await final current-head evidence |
| #76 | v0.2.0 identity/docs/capabilities and candidate package inputs; final tag, official packages, provenance/readback and publication receipt | Candidate preparation; publication remains pending |
| #10 | Every image child plus release completion | Remains open until #76 completes |

## Current verification

The complete `cargo xtask check` rerun finished with exit 0. It includes 305 frontend tests, 73 site browser cases, native workspace tests/clippy, advisory/license gates, package policies, links in 461 Markdown files, 47 rendered Mermaid diagrams, v0.2.0 identity checks and 1890 UTF-8/BOM/mojibake text checks. The additional official-Windows policy regression passes with the screen-reader row explicitly unavailable. Exact bundled BrandBuilder recovery passes 31 verifier checks and zero glyph failures in the completed validation image. A failed, missing or skipped check is not a passing result. Local command logs and real exit markers are retained under the ignored `.tmp/s043-*` namespace. CI, final artifacts and reviews will bind exact candidate heads below.

## External review ledger

PR not yet published. Initial review: pending publication. Explicit follow-up requests used: 0 of 1. Total permitted rounds: 2. No merge, tag, release or third review request is authorized.

## Convergence

Convergence checked 12 functional requirements, five outcomes, eight scenarios, the plan decisions and all eight constitution principles. It appended T022/T023 for exact upstream documentation exclusion and stale Android deferred-policy wording; both are implemented with a failing-then-passing link-boundary regression (21/21 validator tests). Reassessment finds no remaining application-code gap. Publication, current-head native/package evidence and external review tasks remain pending and cannot be represented as complete.
