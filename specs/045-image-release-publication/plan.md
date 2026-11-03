# Implementation Plan: v0.2.0 Image Release Publication

**Branch**: `codex/045-image-release-publication` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/045-image-release-publication/spec.md`.

## Summary

Complete #76 and #10 through exact-source qualification and official publication. Repair the demonstrated Linux provenance network dependency by sharing only Cargo registry/git state across preparation, build, and assembly, prefetching the complete locked graph, and requiring offline final metadata. Update the runbook and release-policy validator together for the owner's explicit publish-before-final-merge authority. Qualify the reviewed S045 branch, publish immutable v0.2.0 at that source, independently read back every official asset and Pages identity, then leave the evidence PR open for owner review and merge.

## Technical Context

**Language/Version**: Existing Rust 1.96.0, Node 24.11.0, pnpm 10.28.2, PowerShell 7.5, workflow YAML. **Primary Dependencies**: Existing Tauri/image graph unchanged; GitHub Actions four-platform package workflows, community assembler, repository attestation, stable Android signing. **Storage**: Job-scoped registry/git caches; immutable Actions/public release artifacts; ignored local readback receipts. **Testing**: Release-policy unit tests, aggregate repository checks, isolated offline metadata boundary with unchanged lock digest, full hosted CI and package lifecycle/Android runtime checks, public asset readback. **Target Platform**: Windows x64, macOS universal with both native architectures, Linux x64 AppImage/deb on Ubuntu 22.04/24.04, Android ARM64 APK/AAB with API24/API36 emulator evidence. **Project Type**: Desktop/mobile app release operation and narrow build/provenance correction. **Performance Goals**: Existing 1500ms reference pass, 2500ms warning, 10000ms hosted startup limit unchanged; report the measured evidence class and retain all failed campaigns. **Constraints**: Hidden Docker execution locally; no physical/manual screen-reader gates; no merged PR without owner; at most two external review rounds; never move published tag or replace retained package bytes; no credentials in source/caches. **Scale/Scope**: #76 and #10, 8 packages, 14 public assets, 4 platforms, release Pages; #66/#239 and deferred upgrades/PDF remain separate.

## Constitution Check

Pre-research and post-design: PASS. P1 owner intent and end-to-end scope preserved. P2 stable image behavior and activation remain unchanged. P3 locked provenance and fail-closed validation preserved. P4 complete evidence precedes claims and publication; no relabeled S044 source. P5 platform contracts and declared trust states preserved. P6 UTF-8/no-BOM and one-line Markdown prose maintained. P7 proportional workflow/runbook changes, no new framework or dependency. P8 Spec-Kit artifacts, issue traceability, explicit decisions and chronological receipt retained.

Custom release checklist has 12 reviewer-owned unchecked items; author assessment finds requirements complete across identity, exception/recovery, evidence, authority, and limitations. Under the explicitly invoked autopilot protocol, proceed without altering reviewer markers. Built-in requirements checklist passes all 16 items.

## Phase 0 Research

Two read-only research agents were dispatched as required by the plan skill. They confirmed the 3-container cache-loss boundary and the runbook/validator merge-first wording. See [research.md](research.md). No unresolved design unknown remains.

## Phase 1 Design

See [data-model.md](data-model.md), [contracts/publication.md](contracts/publication.md), and [quickstart.md](quickstart.md). Source identity is pinned before the annotated tag. If final receipt-only changes follow publication, their CI is separately checked and the release SHA remains immutable.

## Project Structure

### Documentation (this feature)

`specs/045-image-release-publication/` contains spec, plan, research, data-model, quickstart, publication contract, checklists, tasks, and analysis/verification receipts.

### Source Code (repository root)

- `.github/workflows/linux-package.yml`: shared job-local registry/git caches, full locked prefetch, isolated offline graph proof, final offline metadata.
- `scripts/check-community-release.mjs` and `scripts/check-community-release.test.mjs`: release authority/source and Linux provenance invariants with negative cases.
- `docs/releases/v0.2.0-operator-runbook.md` and `docs/releases/v0.2.0-receipt.md`: dated authority/source policy and actual public readback.
- Existing four platform workflows, `release.yml`, assembler and package validators: reuse for official tag campaign, change only if qualification demonstrates a blocker.

**Structure Decision**: Modify the existing release path only. No application implementation or dependency upgrades planned.

## Complexity Tracking

No constitutional violation or added architectural layer. The dated runbook amendment replaces a legacy merge-first operator rule under the owner's explicit newer instruction; it does not grant merge authority or relax qualification.
