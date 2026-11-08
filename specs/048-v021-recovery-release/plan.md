# Implementation Plan: v0.2.1 product-recovery release

**Branch**: `codex/048-v021-recovery-release` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Owner-approved S048, #255 and the final release criterion of #244. Publication is a later owner action.

## Summary

Reconcile merged S046/S047 behavior into one v0.2.1 release definition, qualify the identified current source and package bytes, and hand back an unmerged PR. Reuse current release/package contracts and native lifecycle suites. Add the missing minified Android operational campaign and an exact staged-input publisher path; do not rebuild accepted payloads during later publication. Historical v0.2.0 and S045-S047 receipts remain immutable.

## Technical Context

**Language/Version**: Existing Rust 1.96.0, Node 24.11.0, pnpm 10.28.2, PowerShell 7, TypeScript/React/Tauri and Android Kotlin/Java authorities. No incidental dependency/toolchain upgrade.

**Primary Dependencies**: Current lockfiles, pinned Tauri/Radix/Mermaid/WebView compatibility patches, AGP 8.11 and Android SDK 36/NDK 28.2.13676358. BrandBuilder 2.0.3 and brand 1.1.1 remain independently pinned.

**Storage**: Existing source/draft/preference stores unchanged. Release evidence uses retained Actions artifacts and a small S048 index. Existing package-contract.json is the target version/tag authority, not publication authorization.

**Testing**: Focused current release/public/package/version/metadata tests, exact source compatibility/geometry aggregate, normal four-role/API Android matrix, additional actual minified release-runtime API24/API36 campaign, all affected native/package lifecycle suites and independent archive/payload readback.

**Target Platform**: Windows 11 x86_64, macOS 13+ universal, Ubuntu 22.04/24.04 x86_64, Android API24/API36 with the existing minimum WebView contract.

**Project Type**: Shared Tauri desktop/Android product and existing GitHub release pipeline.

**Performance Goals**: Preserve existing action/deadline, memory/package and reference/hosted-smoke budgets. No threshold relaxation or new performance claim.

**Constraints**: Hidden approved VCS; interactive desktop non-Git tooling only in approved Linux virtualization, otherwise isolated hosted CI. Docker daemon unavailable and WSL lacks required toolchain/networking, so actual Spec-Kit/tool execution uses hosted Linux. UTF-8 without BOM, one physical line per Markdown paragraph, TB Mermaid. At most two external review rounds. No merge/tag/release/deployment this session.

**Scale/Scope**: Seventeen FR, six SC and twelve scenarios; six #255 criteria plus the final #244 criterion; eight distributable payloads; four debug ordinary/fault role/API campaigns plus separately scoped installed-release campaigns. Existing 119-control/459-case dispositions are referenced at their historical source rather than regenerated.

## Constitution Check

Initial and post-design gates pass. P1: no new permanent product chrome. P2: core local/offline behavior and explicit outbound actions retained. P3: shared contracts, native/source authority and all four platforms retained. P4: no production debuggability/permissions/keep rules added for tests; existing parsed-input/write bounds unchanged. P5: product/specification candidate version 0.2.1 reconciled on an unmerged preparation branch; published v0.2.0 records remain immutable, and publication remains separately authorized. P6: exact source/actual installed package/byte evidence precedes claims; incomplete required evidence blocks handoff. P7: narrow release identity, staging and runtime additions, with decisions in research.md. P8: current compatible pins, source notices, actual SBOM version and exact delivered brand verification. No constitution exception or amendment.

## Phase 0: Research decisions

R1-R13 in [research.md](research.md) resolve all technical unknowns. Three read-only research agents inventoried current release identity, Android release instrumentation/capture and evidence/publication authority under the plan skill. Findings are grounded in current repository code and official Android test/signature documentation. The hosted plan wrapper's unset PowerShell native exit variable caused one infrastructure failure after successful template creation; initialize it before invocation, retain that failed log, and make no product/test relaxation.

## Phase 1: Architecture and contracts

### Current release identity and copy

Read version/tag/artifact names from packaging/release/package-contract.json through a small Node helper; PowerShell checks read the same JSON. Continue checking independent product manifests and package contracts. Update only own workspace lock entries, not unrelated third-party versions. Reconcile scripts/check-config.mjs, check-version.ps1, check-public-surface.ps1, current package guards, SBOM defaults and desktop promotion metadata. Do not substitute S048 text into immutable prior release documents or historical Spec-Kit files.

Use phase-neutral current source wording for v0.2.1 behavior and /releases/latest for user downloads. A preparation receipt states its dated unpublished state; source copy must also remain true when the same accepted bytes later publish. Site prebuild regenerates only its existing tracked introduction/metadata/manifest outputs; generated numbered sections remain ignored. Postbuild distinguishes preview download metadata from an explicitly authorized published-tag deployment. Keep the published-tag/source verification and Pages authorization strict.

### Staging before native qualification

Each platform workflow gains a false-by-default, manual-only stage_release path. Validate trusted repository/non-fork context; ordinary PR/push candidates retain existing behavior. Desktop community metadata promotion runs before native receipt capture so receipt manifest hashes bind the exact staged manifest. Linux stages its attestation through the existing job permissions. Android's manual staging restores the existing stable project key and validates its configured certificate. A stable signature or eligible official trust class means staged/unpublished, not a public release. Build/native/frontend source metadata use the same selected actual SHA.

Preserve every accepted payload byte. Record actual manifest/provenance source, run/attempt, artifact ID/creation time/archive digest and payload digests. Do not infer source from PR run.head_sha: PR package manifests may identify a temporary merge commit. Final staging dispatches on the exact public branch head, while PR checks remain separately recorded.

### Android minified runtime

Keep existing ci.yml four debug ordinary/fault-probe campaigns. Add a separate release-runtime path to android-package.yml that downloads the canonical staged minified universal APK and matching AndroidTest APK. Opt into the release AndroidTest variant using a validated Gradle property (default debug). Sign test and target with the same staged keystore. The production release stays nondebuggable and minified; only the test application is explicitly debuggable/test-only.

A release-test-only ALL-scoped CLASSES transform isolates Kotlin/tracing callers and complete runtime seeds from AGP's unfiltered compile classpath before app mapping. A standalone ABI regression and separately named startup diagnostics precede complete campaigns; product keep rules and artifacts remain untouched.

Reuse existing cold/warm delivery/images/ICO-export, standalone authoring/save/copy/Diagnostics and exact seed/verify process recovery flows. Add observable Back/About/source/channel assertions without reflecting R8-private plugin fields. Keep required timeouts, bounded two process attempts, strict JUnit/marker/crash gates and actual destination readback. The release campaign's scope is explicit and separate from full S047 debug geometry/native counter coverage.

Release target run-as is unavailable. Stream installed target/test APK bytes, JSON and PNGs through the existing test-owned FixtureDocumentsProvider and descriptors, with fixed evidence APK MIME/name allowance. Capture from the debuggable test package through bounded ADB streaming with independent capture-byte validation, before reset. No production storage permission, debug flag, external upload or unbounded Binder payload. Independently hash the captured installed bytes and compare with the canonical accepted package.

### Future publisher and owner boundary

A small validated accepted-staging input record identifies the exact accepted source, target version/tag, four platform runs, immutable artifact sets and eight payload digests. The later owner-authorized annotated tag carries that record. The tag publisher resolves and verifies those selected retained inputs and downloads them by exact ID, then runs the existing strict official-source/native-receipt assembler. It must not build replacement payloads or fall back from a current failed/mismatched artifact. Preserve the non-official/disposable-key rejection gates.

After owner merge, compare main's tree with the accepted candidate only to verify merged contents. Tag the accepted candidate SHA; manifest/About/provenance retain that identity even after a squash merge. No tree-equivalence source relabelling. Publishing the accepted files and deploying the site require later authorization and actual independent release/readback. This session only tests that path and prepares operator instructions.

### Handoff and retained limitations

Add docs/releases/v0.2.1.md, v0.2.1-receipt.md and v0.2.1-operator-runbook.md, a new S048 campaign/checkpoint index and an issue-acceptance map. Keep specs/047/control-ledger and candidate-evidence unchanged. The new record attributes 98 supplemental-only cases, CTRL114 unmounted, CTRL115 passive and conditional animation honestly. Preserve original incident unavailability, physical/manual-screen-reader/reference waivers, other unrun manual GUI/VoiceOver rows and separate #66/#239 dispositions.

Use a tracked implementation/checkpoint receipt plus a final PR confirmation to avoid inserting a commit's own SHA into its contents. Final handoff binds current source, all selected artifacts, actual checks, expected skips, native evidence and review state. Both issues remain open at PR review; no closing keywords until future publication criteria are complete. Count external review requests exactly, never a third round or implicit auto-merge.

## Project Structure

Feature artifacts: specs/048-v021-recovery-release/{spec,plan,research,data-model,quickstart,tasks}.md and contracts/.

Current identity/copy: root and app/site manifests, Cargo manifests/own lock entries, README/CHANGELOG, technical specification, site generation/current content and packaging contracts/readmes.

Release control: scripts/lib/release-identity.mjs, current release/public/version/package/SBOM/promotion validators and tests, accepted-staging input validation, .github/workflows/{release,docs,android,windows,linux,macos}-package definitions as applicable.

Native runtime evidence: Android Gradle/test manifest, existing AndroidDeliveryInstrumentedTest.kt and FixtureDocumentsProvider.java, bounded release runner/validator, android-package workflow. Existing production source behavior is not redesigned.

## Execution and documentation

Complete Spec-Kit tasks/analysis before product edits. Run meaningful focused policy/fixture checks first on isolated Linux and validate the Android release helper on each required API before a complete final campaign. Retain every failed attempt. Then obtain final branch-source CI, full debug matrix, staged package/native campaigns, browser aggregate and exact artifact readbacks. Apply formatting before final publication and requalify changed observed inputs. Finish read-only convergence with a byte-identical tasks file when clean, publish the PR automatically, monitor CI/review findings within the cap, and stop ready for owner review.

## Complexity Tracking

No unjustified constitution violations. The bounded release-runtime capture and staged-input publisher close demonstrated current release gaps; they do not introduce a general release service, account, product permission or design system.
