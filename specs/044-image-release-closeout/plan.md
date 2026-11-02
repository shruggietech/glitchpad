# Implementation Plan: S044 Image Release Convergence and Closeout

**Branch**: `codex/044-image-release-closeout` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

## Summary

Converge the release-relevant dependency graph, repair demonstrated macOS startup evidence/cleanup defects, add a paired historical-package comparison and bounded Windows/Android readiness diagnostics, then qualify an exact eight-package candidate and official PR. Stop before owner merge/tag/publication.

## Technical Context

**Language/Version**: Rust 1.96.0, Node 24.11.0, pnpm 10.28.2, PowerShell 7, TypeScript/React and Kotlin at repository pins.

**Primary Dependencies**: Existing Tauri/image source graph, native lifecycle scripts and package workflows. No new runtime framework or measurement service.

**Storage**: Content-free incremental startup JSON, final package inventories and qualification receipts.

**Testing**: Injected sampler failures, budget boundaries, paired-order/provenance tests, diagnostic allowlist checks, existing image/fuzz/source tests, aggregate check, all native/platform package CI.

**Target Platform**: Windows, macOS ARM64/Intel, Linux and Android API24/API36 hosted runners.

**Project Type**: Shared local file viewer/editor and existing build/release machinery.

**Performance Goals**: Preserve launch-request to shell-ready measurement, five or more attempts per package, reference 1500/2500 ms thresholds, hosted-smoke 10000 ms ceiling. Record later document-ready separately.

**Constraints**: Hidden Docker/VCS locally; native UI isolated in hosted CI; no raw UI/path/environment diagnostics; no waived physical/manual-screen-reader requirements; two review rounds maximum.

**Scale/Scope**: #240 integration, #226 assessed/partly integrated, #239 investigation/repair, #66 automated follow-ups, #76/#10 preparation only; eight candidate packages.

## Constitution Check

| Principle | Pre-design | Post-design | Evidence |
| --- | --- | --- | --- |
| P1 File viewport | PASS | PASS | No new product surface. |
| P2 Local files | PASS | PASS | No runtime network dependency; comparison fetches only pinned public release assets. |
| P3 Platforms | PASS | PASS | Native matrices retained, Mac comparison on both architectures. |
| P4 Untrusted input | PASS | PASS | Existing limits and hostile/source tests unchanged. |
| P5 Release lockstep | PASS | PASS | v0.2.0 candidate; published v0.1.4 remains publication authority. |
| P6 Verification | PASS | PASS | Failure receipts retained; all actual manual/publication states explicit. |
| P7 Proportionality | PASS | PASS | Reuse native harness; no product architecture expansion. |
| P8 Licensing | PASS | PASS | Locked graph/notices/SBOM gates; retain licensed vendored plugins. |

## Project Structure

- `scripts/macos/`: reusable sampler, paired comparison, lifecycle integration and regression tests.
- `scripts/windows/`: fixed-field portable startup diagnostics.
- `crates/glitchpad-host/gen/android/`: content-free AppFrame callback diagnostics.
- `Cargo.toml`, `Cargo.lock`, `fuzz/Cargo.lock`, workspace package manifests/lock: compatible selected dependency changes.
- `.github/workflows/macos-package.yml`: pinned historical baseline readback, native comparison, always-upload failed evidence.
- `docs/releases/`, `changelog.d/`, `specs/044-image-release-closeout/`: decisions, runbook and final candidate handoff.

## Decisions

### 2026-11-02: Dependency scope

Integrate all six #240 Cargo updates, retaining exact Linux plugin patches. Reconcile fuzz lock with root graph. From #226 select compatible application patch fixes (DOMPurify, React/ReactDOM and CodeMirror patch releases) for this candidate; defer unrelated site/build-tool minor migrations and Mermaid runtime changes until separately qualified. Do not close a partially integrated group implicitly. Existing SVG depth preflight already rejects depth above128 before DOM parsing; the parser patch is relevant hardening, not evidence of demonstrated application exposure.

### 2026-11-02: Native evidence corrections

Research identifies two demonstrated Mac harness defects: classification can throw before receipt persistence, and PID ownership occurs after readiness waits. Extract an injected sampler that persists each phase/failure, owns the process immediately after discovery, and cleans it in finally. Keep endpoint and budgets unchanged. Record first launch separately from later cache-warm process restarts. Run interleaved AB/BA pairs against the exact published v0.1.4 DMG, pinned by SHA256, using the same corrected sampler and native host. Retain raw samples and phase timings; environmental attribution must follow measured results.

### 2026-11-02: Diagnostics and authorization

Windows and Android observations are unproven product faults. Add only bounded allowlisted diagnostic state, without increasing timeouts/retries or relaxing assertions. The custom requirements checklist remains reviewer-owned; the autopilot requirements review found all eight criteria satisfied and proceeds under explicit unattended authorization without changing its markers. Automatic push and official PR are authorized; tag/release/deployment and owner merge remain outside this run.

## Implementation and Validation

Run installed specify/clarify/checklist/plan/tasks/analyze/implement phases. Extension hooks are absent. Research was dispatched to two read-only agents as required by the planning skill. Focused regressions precede implementation. Run foreground focused and aggregate checks through the persistent hidden Docker host, then final-source hosted CI and package readback. Resolve every review thread and do not trigger a third round. Complete cross-artifact convergence and record unresolved publication/manual obligations honestly.

### 2026-11-02: Final-head receipt binding

Retain the machine-readable final-source inventory at `.tmp/s044-candidate-handoff.json` and post its data to the official PR conversation after final checks. This avoids a self-referential source hash in a tracked receipt commit, which would otherwise change the source it claims to bind. Committed verification records link the external handoff authority; only actual final-head results are marked complete.

### 2026-11-02: Complete JavaScript advisory coverage

The candidate audit found50 advisories across site/build tooling (2 critical,16 high,25 moderate,7 low). Expand the selected #226 integrations to patched Next16.4.3, Vite8.3.5, Vitest5.0.5, ESLint10.14.0, markdownlint-cli2 0.24.0, Zod4.6.7 and Puppeteer25.16.0 (whose maintained BiDi dependency uses Zod4). Pin compatible patched transitive versions and preserve package runtime contracts. basic-ftp6.2.1 retains its CommonJS Client entry; minimatch11.0.1 supports the pinned Node24 engine. Qualify their actual consumers rather than suppressing advisories. The resulting complete workspace audit reports zero findings. Keep the Docker browser pin synchronized with Puppeteer25.16.0. Add a full JavaScript audit at the existing moderate-or-higher dependency-review threshold to aggregate and shared CI, addressing the coverage gap that allowed pre-existing advisory paths to survive introduced-dependency review. No advisory suppression is added.

## Complexity Tracking

### 2026-11-02: Validation browser parity

The aggregate gate passed Rust and frontend checks, then failed because the Docker image pinned Puppeteer25.10.0 while the workspace uses25.12.0 and expects a different browser. Align the Dockerfile browser package pin and rebuild the reusable qualification image; do not bypass the browser gate or use Windows tooling.

No constitution exception is required. The comparator extends the existing package harness and uses published baseline bytes rather than rebuilding historical source.
