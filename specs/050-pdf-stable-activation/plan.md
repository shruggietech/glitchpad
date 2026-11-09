# Implementation Plan: PDF conformance and stable activation

**Branch**: `codex/050-pdf-stable-activation` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Owner-approved S050, #81/#82 and #11 reconciliation.

## Summary

Complete the existing PDF family through canonical native activation, full conformance and exact staged-package proof, then prepare v0.3.0 for owner review. Reuse S049 renderer/source/print behavior and the S048 accepted-byte release pipeline. Front-load the actual minified Android PDF path before the broad campaign. Publication remains later owner work.

## Technical Context

**Language/Version**: Existing Rust1.96, TypeScript6.0.2/React19.3.1, Node24.11.0/pnpm10.28.2, Tauri2.11.6/Wry0.55.1 and existing Android SDK36/NDK/Gradle authorities.

**Primary Dependencies**: Keep exact pdfjs-dist6.5.438, core-js3.50.0, static decoder transport and all application pins. Existing qualification tools Pillow12.3.0/fonttools4.65.0 generate original codec/font assets. Add one pinned OFL Noto Hebrew fixture font with original/derivative provenance; no app runtime or brand dependency expansion.

**Storage**: Existing source handles/private PDF spool and print staging; additive conformance JSON, fixture resources and prepared release receipts. No new application persistence model.

**Testing**: Positive native registration/resolver and negative source-policy tests; real production-worker codec/RTL/hostile/limit/fuzz corpus; timing/resource and strict aggregate tests; minified API24/Chrome69 then API36 PDF preflight; full debug regression roles and actual final staged Windows/macOS/Linux/Android PDF/core workflows. Full format/docs/security/notices/SBOM/brand/package gates and independent accepted-byte assembler rehearsal.

**Target Platform**: Existing Windows11x86_64, macOS universal/native arm64+x86_64, Ubuntu22.04/24.04 AppImage/deb, Android API24/API36 minimum/current WebViews. Native tests use isolated hosted desktops, never owner focus.

**Project Type**: Existing shared Tauri desktop/Android application plus governed release pipeline.

**Performance Goals**: Existing512/256MiB source,10000pages,200/96MiB active surfaces,250ms cancellation and repeated50ms interaction-task rules. Record first-page/search/navigation/thumbnail measurements without inventing an unrelated reference threshold; identify every measurement scope.

**Constraints**: No advanced PDF editing/form submission/attachment launch or document-controlled network/native authority. Preserve source bytes, passwords in memory, existing waivers and #66/#239 dispositions. UTF-8/noBOM, single-line prose/MermaidTB, pinned BrandBuilder2.0.3/brand1.1.1. At most two external rounds; stop ready/unmerged/auto-merge off.

**Scale/Scope**:24FR,6SC,16acceptance scenarios,8child criteria and4epic criteria. One formal implementation slice, followed by later authorized publication through the existing release operation.

## Constitution Check

Pre-research and post-design gates pass all8principles. P1: existing compact PDF/AppFrame surfaces stay dominant. P2: local/offline PDF and fixed packaged resources; no upload/account service. P3: shared PDF contract plus exact native declarations/URI semantics and four-platform proof. P4: bounded hostile/codec parsing, denied execution, source preservation and current resource/cancellation limits. P5: one v0.3.0 documentation pass and version/claim/package authority, with actual v0.2.1 public links until publication. P6: every criterion has scoped current tests/evidence or explicit publication-only/manual disposition. P7: twelve dated decisions before implementation, proportional extensions to current generators/probes/assembler. P8: original fixtures/OFL font/exact licenses, existing pins/notices and brand verifier. No constitution exception or amendment.

## Phase 0: Research decisions

[research.md](research.md) records R01-R12. Three mandatory read-only agents mapped activation/native Android, conformance/corpus/metrics and release identity/accepted staging. Clarification found all taxonomy categories clear; the built-in16-item quality checklist is sufficient, so no additional reviewer-owned custom checklist is generated. Actual plan initializer42569624158 supplied the active template against0933b9747988c5112d1c1090628d0d773b475dc6.

## Phase 1: Design and contracts

Activation remains driven by packaging/desktop/capabilities.json, existing Tauri overlays, Linux MIME map/package contract and Android intent-map/source manifest. Add PDF to GOVERNED_EXTENSIONS and positive resolver tests; retain content detection, read grants and still-unsupported negatives. Use the existing generator/validators so canonical rows and derived declarations agree.

Android pdfCompatibility must become release-safe: resolved cold/warm PDF intents, framework/reflection WebView observation, actual public native printing and test-owned JSON/raw-PDF/screenshot/APK capture. Add pdf diagnostic runtime mode and require PDF in full signed/minified campaigns. Native-store internals remain debug-only proof. The default full campaign keeps all existing core cases plus PDF; no success marker replaces clean JUnit/ADB or installed-byte validation.

Extend the original PDF fixture writer with additive version, asymmetric JPX/JBIG2 image-only, Hebrew CID/ToUnicode, mixed-box/rotation, hostile/truncated and exact10000page inputs. A narrow Python asset producer uses pinned Pillow/fonttools, while the existing JS writer owns PDF serialization. Preserve S049 bytes. Actual production-worker pixels/text/direction/search and no-Wasm/no-network observations must prove the transformed decoders and real RTL behavior. Add bounded recognized-seed mutation cases with actual successful controls, cancellation and stable failure witnesses.

Extend existing reading/native receipts with identified raw timing/resource observations. Surface/range/cache counters and actual cleanup are distinct from sampled host/process RSS/PSS, optional main-realm heap and unavailable worker heap. Long-task and fallback measurement methods stay explicit; RAF data is never claimed as task-duration profiling. The narrow aggregate requires every current source/profile/case, latest terminal applicable attempt and actual source/package/fixture/runtime binding, retaining all failed attempts and rejecting stale/missing/newer-failed inputs.

Prepare0.3.0 through existing releaseIdentity and mirrored manifests/contracts/workflows, with monotonic Android release code1006. Complete technical spec/changelog/help/site/README/fidelity limits, retain public /releases/latest and historical receipts. Add declared PDF release scope and prepared documentation-pass JSON/validator. Bind its immutable digest/PR number to accepted preparation; the tag-only publisher later verifies actual merge metadata/tree and emits external approval evidence, without changing accepted source.

Final staged package/native archives must carry PDF observations bound to the actual accepted payload/manifest/installed bytes. Extend current consumer/assembler to require these facts and to reject wrong/newer failed/missing records. Four fresh complete stage_release:true campaigns on the frozen source feed independent8-payload/installed/output readback and unpublished assembler rehearsal. A green partial retry with old artifacts cannot become an accepted full attempt.

## Project Structure

Design artifacts: specs/050-pdf-stable-activation/{spec,plan,research,data-model,quickstart,tasks,validation,handoff}.md and contracts/{activation,conformance,release-preparation,issue-acceptance}.md.

Activation: packaging/desktop/capabilities.json; packaging/{windows,macos,linux,android}/package-contract.json, Linux mime-map.json, Android intent-map.json; crates/glitchpad-host/tauri.s019-windows.conf.json through tauri.s022-android.conf.json, src/desktop_delivery.rs and gen/android/app/src/main/AndroidManifest.xml; existing package/activation/resolver tests.

Conformance: scripts/generate-pdf-fixtures.mjs plus narrow conformance-assets producer; fixtures/pdf and provenance.toml; scripts/check-pdf-runtime.mjs, pdf-reading-journey.js, run-pdf-native-journey.mjs and current platform probes; new focused PDF conformance validator/tests; current PDF controller/resource tests only where needed.

Android proof: existing AndroidDeliveryInstrumentedTest.kt and fixture provider, run-android-release-tests.sh/validate-android-release-evidence.mjs with tests, android-package.yml and existing offline/capture helpers.

Release: canonical Cargo/package/Tauri/Gradle versions/lock entries, active package/workflow targets, docs/releases/v0.3.0*, README/CHANGELOG/S050 fragment, technical spec, site canonical/generator outputs; scripts/check-community-release.mjs, documentation-pass validation, accepted-release-inputs.mjs, assemble-community-release.mjs and existing tag-only publisher.

## Execution and verification sequence

Finish tasks and blocking cross-artifact analysis before product edits. Add failing activation/release-proof/evidence tests, implement declaration promotion and release-safe PDF preflight, then prove actual minified API24 and API36 early. Fix compatibility/fixture/transport defects at that boundary before broad matrices. Add licensed corpus/measurements/aggregate and complete release documents/staged-package PDF proof. Format/regenerate and run focused standard gates, publish the PR, resolve at most two external rounds, then freeze all tracked inputs. Run final exact-head full CI and four complete accepted staging attempts, independently verify bytes/native facts and rehearse the actual assembler. Complete present-code convergence, issue/project/review readback and one authoritative external receipt; stop unmerged.

## Source freeze and execution records

Complete source changes, focused regressions, retained integration diagnostics and review fixes before freezing tracked inputs. Execute one complete final current-source qualification after that freeze. The authoritative external PR receipt records execution-only completion (including T022, T025, T028 and T030-T034) without editing their own qualified source. Unchecked freeze-time execution boxes are pending until that receipt supplies the required actual proof. No pending observation is treated as passed, and no earlier source or partial campaign qualifies the final candidate. This avoids rebuilding unchanged packages merely to update task checkboxes.

## Complexity Tracking

No constitution violations. Additive fixture assets, one narrow PDF aggregate and existing receipt/publisher extensions close demonstrated release gaps. No new renderer, service, approval workflow, platform promise or general validation infrastructure is introduced.
