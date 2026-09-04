# Implementation Plan: Enforce Performance Budgets

**Branch**: `codex/018-performance-budgets` | **Date**: 2026-09-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-performance-budgets/spec.md`

## Summary

Deliver issue #60 as a versioned performance-governance and runtime-lifecycle slice. S018 adds a single machine-readable budget catalog, governed scenarios, content-free evidence records, deterministic classification and history policy, release-profile collectors, hosted-runner smoke gates, resource ownership accounting, exact boundary/cancellation regressions, and aggregate CI integration. Hardware-sensitive evidence remains distinguishable from hosted smoke evidence, and package metrics activate only when later packaging slices provide real artifacts.

## Technical Context

**Language/Version**: Rust 1.96.0 (edition 2024), TypeScript 6.0.2, JavaScript on Node.js 24.11.0, Kotlin/Java 17 at the existing Android bridge boundary

**Primary Dependencies**: Existing React 19, CodeMirror 6, unified, Mermaid, Tauri 2, Vitest, and Puppeteer; direct worker-safe `decode-named-character-reference` resolution and `sysinfo` process-memory sampling

**Storage**: Versioned JSON catalog and governed fixture corpus in the repository; generated evidence is ephemeral unless a release receipt is intentionally curated

**Testing**: Rust unit/conformance tests, Vitest unit/component tests, Node test runner policy/fixture tests, a single reusable headless Chromium collector, Android instrumentation hooks, and the aggregate `cargo xtask check`/CI gates

**Target Platform**: Shared WebView application on Windows 11, macOS 13+, Ubuntu 22.04+, and Android API 24-36; reference evidence distinguishes desktop and Android profile families

**Project Type**: Cross-platform Tauri desktop/mobile application with shared renderer/domain code, privileged Rust host, narrow Android adapter, repository tooling, and CI workflows

**Performance Goals**: Enforce every table entry in technical specification section 8, including desktop/Android cold shell, first content for 1 MiB text/Markdown/Mermaid, current Mermaid preview, input-to-paint, cancellation, idle memory, suspended-tab overhead, and package size

**Constraints**: Release builds only for release claims; monotonic bounded samples; exact pass/warn/fail boundaries; no document content or native locator in evidence; no telemetry or network dependency; hosted runner timing cannot masquerade as reference-profile evidence; later packaging slices own production artifacts

**Scale/Scope**: Four platform families, up to 32 sessions, representative 1 MiB workloads, text boundaries at 32/256 MiB, Markdown render boundary at 16 MiB, Mermaid render and embedded limits from S015, 100 lifecycle cycles, bounded evidence and history, and one aggregate performance result

## Constitution Check

### Pre-design gate

- **P1 (file owns viewport)**: Pass. S018 adds no permanent product surface; evidence is developer/release tooling and lifecycle changes are invisible except for responsiveness.
- **P2 (local files remain local)**: Pass. Collection and validation are local, content-free, and telemetry-free.
- **P3 (cross-platform foundational)**: Pass. The catalog models desktop and Android explicitly while retaining one shared classification contract and platform-specific collectors.
- **P4 (untrusted input fails safely)**: Pass. Exact source thresholds, cancellation, bounded work, and resource disposal are first-class acceptance gates.
- **P5 (specifications and releases move together)**: Pass. S018 is an unreleased Spec Kit delta; release-profile evidence feeds the later documentation and activation pass.
- **P6 (verification precedes claims)**: Pass. Every metric maps to a runnable check or explicit receipt and incomplete evidence cannot pass.
- **P7 (explicit and proportional decisions)**: Pass. S018 supplies performance governance and repairs lifecycle gaps without taking ownership of platform packaging or adding a generalized telemetry system.
- **P8 (license compatibility)**: Pass. No new dependency is planned; fixtures are original Apache-2.0 material with provenance.
- **Technical constraints**: Pass. Existing Tauri/TypeScript/Rust/Kotlin boundaries remain intact, all added text is UTF-8 without BOM, and any Mermaid diagram uses top-to-bottom flow.

### Post-design gate

Pass. The catalog/evidence contract is platform independent, collectors contain platform details, ephemeral results remain untracked by default, actual artifacts are the only source of package sizes, and the resource ledger is a testable ownership primitive rather than a product-wide monitoring subsystem. No constitutional exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/018-performance-budgets/
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── performance-evidence.md
│   └── resource-lifecycle.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
├── tasks.md
└── verification.md
```

### Source Code (repository root)

```text
apps/glitchpad/src/
├── components/
│   ├── DocumentSurface.tsx
│   ├── MarkdownSurface.tsx
│   ├── MermaidSurface.tsx
│   └── TextEditorSurface.tsx
└── domain/
    ├── performance.ts
    ├── performance.test.ts
    ├── resource-ledger.ts
    ├── resource-ledger.test.ts
    ├── markdown-renderer.ts
    ├── mermaid-adapter.ts
    └── editor-performance.ts

fixtures/performance/
├── budgets.json
├── corpus.json
└── evidence/
    └── policy-cases.json

scripts/
├── check-performance.mjs
├── check-performance.test.mjs
├── run-performance.mjs
└── lib/performance-policy.mjs

crates/glitchpad-core/src/performance.rs
crates/glitchpad-core/tests/contract_schema.rs
crates/glitchpad-host/src/performance.rs
crates/glitchpad-host/tests/performance_conformance.rs
crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/performance/PerformanceInstrumentedTest.kt
crates/xtask/src/main.rs
.github/workflows/ci.yml
package.json
fixtures/provenance.toml
```

**Structure Decision**: Shared threshold, classification, and evidence rules live in the Rust core and matching TypeScript/Node contract surfaces; repository JSON is the canonical data catalog consumed by validation tooling. Renderer clients expose a narrow resource-ledger seam used to prove cancellation/disposal without retaining user data. One Node collector owns headless browser process reuse, desktop working-set collection uses a bounded platform-specific process sampler, and Android PSS collection uses an instrumentation-only `Debug.getPss()` receipt so production code gains no monitoring surface.

## Complexity Tracking

No constitution violation requires justification.
