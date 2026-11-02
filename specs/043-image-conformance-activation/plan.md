# Implementation Plan: S043 Image Conformance and Activation

**Branch**: `codex/043-image-conformance-activation` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

## Summary

Qualify the existing image implementation and text-core contracts through reproducible hostile/property/fuzz coverage, resource measurements and current hosted native results. Prepare the complete v0.2.0 activation candidate and synchronize release documentation and package inputs. Preserve independent evidence classes and stop before owner merge/tag/publication.

## Technical Context

**Language/Version**: Repository-pinned Rust 1.96.0, Node 24.11.0, pnpm 10.28.2, TypeScript/React, Kotlin and PowerShell 7.

**Primary Dependencies**: Existing image/resvg decoder graph, native Tauri source boundary, frontend tests, bundled BrandBuilder 2.0.3, existing platform package workflows; cargo-fuzz only for development qualification.

**Storage**: Original fixture corpus, minimized fuzz corpus and qualification receipts; no new runtime persistence.

**Testing**: Native unit/contract tests, bounded fuzz campaign, image resource measurement, axe/keyboard/touch/reduced-motion tests, API 24/36 provider/WebView instrumentation, three desktop native jobs, package policy/lifecycle, aggregate `cargo xtask check`.

**Target Platform**: Windows, macOS, Linux and Android.

**Project Type**: Shared file viewer/editor and native host adapters.

**Performance Goals**: Retain the technical specification's image decode/cache/source budgets and measure representative original fixtures; report process peak memory separately from algorithmic allocation admission and browser surface eviction.

**Constraints**: No active-workstation UI; all local commands through hidden Docker/VCS launchers; no manual screen-reader or physical-device requirement or validation claim; no PDF/office activation; no automatic merge/tag/release.

**Scale/Scope**: #66/#75 qualification and #76 candidate preparation, ten image extensions, eight image families, one official PR and at most two external review rounds.

## Constitution Check

| Principle | Pre-design | Post-design | Evidence |
| --- | --- | --- | --- |
| P1 File viewport | PASS | PASS | Reuse compact image surface and inspector. |
| P2 Local files | PASS | PASS | Bundled local engines; no file-content network route. |
| P3 Cross-platform | PASS | PASS | Shared contracts and hosted native evidence on all four platforms. |
| P4 Untrusted input | PASS | PASS | Bounded fuzz/resource coverage and unchanged source authority. |
| P5 Release lockstep | PASS | PASS | v0.2.0 candidate documentation pass; published deployment remains separate. |
| P6 Evidence | PASS | PASS | Current automated evidence required; unavailable physical/manual testing is explicitly removed by owner decision without a pass claim. |
| P7 Proportionality | PASS | PASS | Extend existing engines, fixtures and package flows. |
| P8 Licensing | PASS | PASS | Existing graph/notices retained; qualification tools are development-only. |

## Project Structure

- `crates/glitchpad-core/`: decoder contracts, original-fixture qualification and resource campaign.
- `fuzz/`: development-only bounded harnesses and reproducible regression inputs.
- `fixtures/`: image provenance and qualification budgets.
- `scripts/`: qualification report, release/version/public-surface validators.
- `packaging/`, `crates/glitchpad-host/`: stable associations, MIME declarations, native chooser and Android delivery.
- `docs/`, `site/`, `.github/workflows/`: release documentation pass and exact-candidate checks.
- `specs/043-image-conformance-activation/`: specification, research, contracts, tasks, analysis and verification ledger.

## Decisions

### 2026-11-02: Owner-amended evidence policy

The owner explicitly removes unavailable physical-device and manual screen-reader requirements. Amend active v0.2.0 requirements and reachable validators accordingly. Automated accessibility and hosted/emulated native contracts remain mandatory. Do not edit historical receipts to invent evidence or weaken input/resource/source checks. Other unrelated manual checks retain their actual status.

### 2026-11-02: Candidate versus publication

Prepare v0.2.0 product and specification identities together in this PR. Public deployment must continue to verify the published release until the later release ritual. #76 and #10 cannot close on pre-publication preparation alone. Automatic push/PR publication is explicitly authorized; merge, tag and release are not.

### 2026-11-02: Reuse qualification boundaries

Research agents found strong S039/S040 decoder and hosted source tests, but no standalone fuzz harness or image process-memory/latency campaign. Add those missing obligations and a unified core/issue evidence matrix. Reuse existing platform and browser suites rather than adding a parallel application or test framework.

## Implementation and Validation

Run specify, clarify, checklist, plan, tasks and read-only analyze before implementation. Write focused regressions before changing activation or evidence validation. Run focused checks first, then aggregate checks, then current-head hosted native/platform/package checks. Complete convergence, review remediation and the final receipt without exceeding one explicitly requested follow-up review.

## Complexity Tracking

No constitution exception or runtime architecture expansion is required.

### 2026-11-02: Release-blocking dependency remediation

The unchanged advisory gate found RUSTSEC-2026-0386 in Tokio 1.53.1 and retired zbus 5 names/wire crates through the existing Linux plugins. Patch Tokio to 1.53.3 and retain exact licensed plugin sources with a localized zbus 6 async migration. Published plugin updates still use zbus 5; a manifest-only bump cannot compile because blocking APIs were removed. Keep all native behavior, use the persistent Tauri runtime, retain provenance/notices and require real session-bus plus Linux package forwarding evidence. No advisory suppression is introduced.

### 2026-11-02: Preserve upstream documentation verbatim

The link inventory includes the two newly vendored upstream prose trees, which contain historical dead links. Exclude only their exact directory names from network link validation; retain `vendor/README.md`, provenance, source encoding, licenses and all project-owned documentation checks. A focused regression requires the local provenance document to remain in the checked set.
