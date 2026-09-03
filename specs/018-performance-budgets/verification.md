# S018 Verification

**Date**: 2026-09-03

**Scope**: GitHub issue #60, versioned v0.1.0 performance budgets, representative collectors, resource disposal, native memory seams, and aggregate regression gates.

## Automated evidence

| Requirement group | Evidence | Result |
| --- | --- | --- |
| FR-001 through FR-010 | Canonical catalog and provenance validation, exact classification boundaries, hostile evidence rejection, warning-history and missing-receipt gates, production browser smoke | Pass |
| FR-011 through FR-014 | Existing operation cancellation suites, cooperative-scheduler cancellation and slice tests, exact text/Markdown/Mermaid boundary corpus, stale-publication tests | Pass |
| FR-015 through FR-016 | Closed resource ledger, content-free renderer measurements, 100 lifecycle cycles, strict-mode-safe disposal, native lease snapshots, suspended-tab relative classification | Pass |
| FR-017 through FR-018 | Bounded cross-platform resident-memory sampler, Android instrumentation-only PSS receipt, actual artifact stat collector, inactive pre-packaging status | Pass |
| FR-019 through FR-021 | Bounded allowlisted evidence schema, local loopback/off-origin browser policy, xtask and CI integration, documented reference commands and applicability | Pass |
| Frontend quality | `pnpm --filter @shruggietech/glitchpad check` (39 files, 216 tests, lint, typecheck, production build) | Pass |
| Focused native quality | `cargo test -p glitchpad-host --test performance_conformance --locked` (2 tests) | Pass |
| Containerized frontend quality | Pinned Node 24.11.0 and pnpm 10.28.2 validation image (39 files, 216 tests, lint, typecheck, production build) | Pass |
| Containerized Rust quality | Pinned Rust 1.96.0 validation image, formatting, workspace Clippy with warnings denied, and complete workspace tests | Pass |
| Hosted browser smoke | Cold desktop shell 275.36 ms p95; Mermaid current preview 423.91 ms p95; editor input paint 70.50 ms p95 warning; text first content 275.85 ms p95; Markdown first content 611.46 ms p95; desktop Mermaid first content 709.40 ms p95 | Pass with one non-blocking warning |
| Aggregate repository quality | `cargo xtask check`, including Rust, frontend, fixture, documentation, encoding, and public-surface gates | Pass |

## Applicability and release activation

Pull requests run deterministic catalog, fixture, policy, boundary, cancellation, disposal, and evidence tests plus production-build hosted Chromium smoke. Hosted results may block hard regressions but never satisfy desktop or Android reference-profile claims.

Desktop and Android timing and memory metrics remain release-required receipts on their named reference profiles. A maintainer collects desktop resident-memory conformance with `cargo test -p glitchpad-host --release --test performance_conformance --locked -- --nocapture`; Android API 24 and API 36 instrumentation emits content-free `Debug.getPss()` samples through `PerformanceInstrumentedTest`.

Desktop installer and universal Android APK size metrics remain inactive until the packaging slices produce real compressed artifacts. At that point the release workflow passes the actual artifact and matching metric to `node scripts/run-performance.mjs`; absence then becomes a blocking missing receipt rather than a fabricated value.

## Implementation deviations

The initial plan expected no new dependencies. Implementation deliberately added the worker-safe entity decoder as a direct existing JavaScript dependency after the production collector proved that the prior Markdown worker crashed on a DOM-only transitive export. It also added `sysinfo` to the native host for a safe cross-platform resident-memory API because repository policy forbids handwritten unsafe platform calls. Both changes are narrowly scoped, locally validated, and covered by the repository dependency gates.

The final Linux validation exposed an existing Unix-only test compilation defect: `expect_err` imposed an unnecessary `Debug` bound on `RecoveryStore`. S018 changes that assertion to `.err().expect(...)`, preserving the exact behavior while allowing the pinned Rust workspace suite to compile on Linux.

After Windows child processes repeatedly produced visible desktop consoles, the user directed the project to codify isolated execution. S018 therefore adds hidden Docker and WSL launchers plus mandatory agent policy. Docker Desktop is the primary validated boundary: all development processes run in Linux containers while the Windows broker uses `CreateNoWindow`, hidden window style, redirected I/O, and non-interactive arguments.

## Manual inspection

- Confirmed performance evidence retains no source content, filename, native path, provider identifier, environment map, command line, or raw log.
- Confirmed generated fixtures are exact UTF-8 byte sequences with governed SHA-256 digests and original Apache-2.0 provenance.
- Confirmed all package metrics are inactive until actual artifacts exist, hosted smoke evidence cannot be promoted to a reference claim, and every required desktop or Android reference profile must provide its own receipt.

## Spec Kit convergence

The final convergence pass reconciled all 21 functional requirements, 12 success criteria, acceptance scenarios, contracts, and 43 implementation tasks. No unresolved clarification, constitution conflict, coverage gap, or follow-up task remains in S018. Hardware-reference receipts remain intentionally activation-gated as documented above and cannot be substituted with hosted smoke evidence.
