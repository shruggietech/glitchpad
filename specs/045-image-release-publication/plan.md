# Implementation Plan: v0.2.0 Image Release Publication

**Branch**: `codex/045-image-release-publication` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/045-image-release-publication/spec.md`.

## Summary

Complete #76 and #10 through exact-source qualification and official publication. Repair the demonstrated Linux provenance network dependency by sharing only Cargo registry/git state across preparation, build, and assembly, prefetching the complete locked graph, and requiring offline final metadata. Update the runbook and release-policy validator together for the owner's explicit publish-before-final-merge authority. Qualify the reviewed S045 branch, publish immutable v0.2.0 at that source, independently read back every official asset and Pages identity, then leave the evidence PR open for owner review and merge.

## Technical Context

**Language/Version**: Existing Rust 1.96.0, Node 24.11.0, pnpm 10.28.2, PowerShell 7.5, workflow YAML. **Primary Dependencies**: Existing Tauri/image graph unchanged; GitHub Actions four-platform package workflows, community assembler, repository attestation, stable Android signing. **Storage**: Job-scoped registry/git caches; immutable Actions/public release artifacts; ignored local readback receipts. **Testing**: Release-policy unit tests, aggregate repository checks, isolated offline metadata boundary with unchanged lock digest, full hosted CI and package lifecycle/Android runtime checks, public asset readback. **Target Platform**: Windows x64, macOS universal with both native architectures, Linux x64 AppImage/deb on Ubuntu 22.04/24.04, Android ARM64 APK/AAB with API 24/API 36 emulator evidence. **Project Type**: Desktop/mobile app release operation and narrow build/provenance correction. **Performance Goals**: Existing 1500 ms reference pass, 2500 ms warning, 10000 ms hosted startup limit unchanged; report the measured evidence class and retain all failed campaigns. **Constraints**: Hidden Docker execution locally; no physical/manual screen-reader gates; no merged PR without owner; at most two external review rounds; never move published tag or replace retained package bytes; no credentials in source/caches. **Scale/Scope**: #76 and #10, 8 packages, 14 public assets, 4 platforms, release Pages; #66/#239 and deferred upgrades/PDF remain separate.

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

**Structure Decision**: Modify the existing release path only. A fixed opt-in native/JS validation hook is required by the demonstrated evidence blocker below; no product capability or dependency upgrade is added.

## Complexity Tracking

No constitutional violation or added architectural layer. The dated runbook amendment replaces a legacy merge-first operator rule under the owner's explicit newer instruction; it does not grant merge authority or relax qualification.

## 2026-11-02: Qualification remediation

The independent candidate readback exposed a false-evidence branch: --official converts Linux's unperformed read/edit/save/metadata/recovery rows to pass, while macOS hardcodes them. A second plan research pass with the two read-only agents confirmed that S021 FR-018 forbids substituting separately executed source suites. Add a bounded opt-in packaged bridge workflow on a fixed disposable document, using production materialization, text transaction/reducer, save, metadata and recovery APIs. Native begin/complete commands accept no filesystem path; only the existing explicitly enabled probe root, an exact one-shot request and a fixed synthetic fixture authorize it. A fresh completion marker follows exact saved-byte verification. A separate harness launch runs after startup sampling and never edits the startup fixture. Candidate and official receipts derive the same five passes from observed proof, and final release assembly requires it. No thresholds, required results, physical/manual gates, or product-use restrictions change.

This necessary release-blocker fix changes application validation hooks and requires a new exact-source campaign. Both permitted external rounds already completed without findings before this discovery (last reviewed SHA 184c762); no third request is authorized. Perform an internal critical review of the remediation and disclose the external coverage boundary in the final receipt. The owner still performs final PR review/merge.

## 2026-11-03: Owner startup eligibility amendment

Internal review found the older S021 FR-020/SC-006 reference-hardware prerequisite was not explicitly retired by S044/S045. The owner approved retiring it for v0.2.0 and using the existing automated hosted checks. Linux tag validation now uses the unchanged 10000 ms hosted ceiling while preserving actual 1500/2500 ms classifications. A focused regression first failed with the old gate; the approved behavior accepts a truthful 2600 ms reference classification failure as hosted smoke and still rejects 10001 ms. #239 remains open, and no reference-hardware pass is inferred. See [reference-gate-decision.md](reference-gate-decision.md).

## 2026-11-03: Production destination verifier correction

The approved homepage and generated project facts link to releases/latest, while the production verifier hardcodes a version-tag anchor. The published f6a1515 site is deployed with correct version/source provenance, but this stale literal rejects it. Correct only the operational verifier: accept the approved latest destination only when its redirect resolves to the exact expected repository/tag, and retain all existing source/version/documentation/brand checks. Add negative destination/redirect/status tests before implementation. Do not change published product/site content, move v0.2.0, replace assets, alter environment protection or request another external review. Independent production verification from the corrected operator code and final-head CI will close the gap; historical failed verifier runs remain retained.

Implementation uses scripts/lib/site-release-destination.mjs and its focused tests, imported by scripts/verify-site-deployment.mjs and integrated through package.json check:public-release. A quote/raw-text-aware tokenizer preserves the standalone built-in-only operator command; no dependency or product/site-content change is introduced. Internal review findings for quoted-attribute and script-text fake anchors are resolved by the 19-case suite and live verification.
