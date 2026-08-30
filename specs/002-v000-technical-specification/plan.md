# Implementation Plan: Complete the v0.0.0 Technical Specification

**Branch**: `002-v000-technical-specification` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-v000-technical-specification/spec.md`

## Summary

Replace the approved outline with the complete release-versioned technical baseline for Glitchpad. The document fixes the product boundary, cross-platform architecture, language and framework rationale, document and renderer contracts, file-integrity rules, security posture, contributor environment, testing model, packaging inventory, Apache-2.0 dependency policy, Spec Kit workflow, and release documentation gate. v0.0.0 is the foundation release and contains no application binaries; the first binary release is v0.1.0 after its required feature slices and four-platform artifact gates pass.

## Technical Context

**Language/Version**: Rust 1.96.0; TypeScript 6.x on Node.js 24 LTS; Kotlin as generated and pinned by the Android project

**Primary Dependencies**: Tauri 2.x, React 19.x, Vite 8.x, CodeMirror 6, unified/remark/rehype with `rehype-sanitize`, Mermaid, PDF.js, Mammoth, Rust `image`, `kamadak-exif`, `ico`, `resvg`, `zip`, and `quick-xml`; exact patch versions are locked by manifests and lockfiles created by the repository-foundation slice

**Storage**: Local source files and Android document URIs; versioned JSON preferences; private recovery records and bounded renderer caches; no database

**Testing**: Rust unit/integration/property/fuzz tests; Vitest and Testing Library; Playwright and axe-core; Android JVM/instrumentation tests and physical-device smoke tests; package installation tests; Markdown, Mermaid, link, encoding, license, vulnerability, SBOM, and version-consistency gates

**Target Platform**: Windows 11 x86_64; macOS 13+ universal; Linux x86_64 with Ubuntu 22.04 glibc baseline; Android 7.0+ (`minSdk 24`) targeting API 36; all four are release-blocking for v0.1.0

**Project Type**: Cross-platform local desktop and Android document viewer/editor with a Rust core, Tauri host, shared WebView interface, and narrow Kotlin Android bridge

**Performance Goals**: Cold interactive shell in 1.5 seconds desktop and 2.5 seconds Android at p95; 1 MiB text first content in 300 ms and rendered Markdown in 800 ms at p95; input-to-paint below 50 ms at p95; bounded per-renderer memory and cancellation within 250 ms

**Constraints**: Content-first minimal interface; offline core; no accounts, telemetry requirement, generalized workspace, public plugin API, remote renderer, or Electron; hostile files; exact text preservation; one compact tab surface; Apache-2.0 distribution; top-to-bottom Mermaid; release/specification version lockstep

**Scale/Scope**: One active application window per process, up to 32 open tabs, text editing through 32 MiB, large-text read-only mode through 256 MiB, bounded image/PDF/archive processing, four platform families, six renderer families, and one release train

## Constitution Check

_GATE: Passed before research and re-checked after design._

| Principle | Plan evidence | Result |
| --- | --- | --- |
| P1. The file owns the viewport | Compact tabs and contextual controls; no permanent navigation or workspace surface | Pass |
| P2. Local files remain local | Core source, rendering, editing, metadata, and recovery are offline; renderer network access is denied | Pass |
| P3. Cross-platform behavior is foundational | Desktop paths and Android URIs implement one capability contract; all four target families are planned from foundation | Pass |
| P4. Untrusted input fails safely | Signature-based detection, parser budgets, sanitization, archive limits, scoped native handles, conflict-safe persistence | Pass |
| P5. Specifications and releases move together | v0.0.0 baseline, v0.1.0 binary gate, version consistency, and mandatory documentation reconciliation | Pass |
| P6. Verification precedes claims | Capability activation and artifact publication require mapped automated or documented manual evidence | Pass |
| P7. Decisions are explicit and proportional | Research records firm choices and rejected alternatives; no public plugin or cloud architecture is introduced | Pass |
| P8. Apache-2.0 and license compatibility | Apache-2.0 project license, allowlist, notice generation, provenance, SBOM, and prohibited-license gate | Pass |

## Project Structure

### Documentation (this feature)

```text
specs/002-v000-technical-specification/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── document-host.md
│   ├── release-gates.md
│   └── renderer.md
└── checklists/
    └── requirements.md
```

### Planned Source Code (repository root)

```text
apps/
└── glitchpad/
    ├── src/
    │   ├── app/
    │   ├── components/
    │   ├── document/
    │   ├── renderers/
    │   ├── services/
    │   ├── styles/
    │   └── workers/
    ├── tests/
    └── package.json
crates/
├── glitchpad-core/
│   ├── src/
│   └── tests/
├── glitchpad-host/
│   ├── src/
│   ├── capabilities/
│   └── gen/android/
└── xtask/
    └── src/
docs/
├── adr/
├── brand/
└── glitchpad-technical-specification.md
fixtures/
├── documents/
├── hostile/
└── provenance.toml
scripts/
specs/
```

**Structure Decision**: Use one monorepo with a shared TypeScript application, a platform-independent Rust core, a Tauri host crate, generated Android host material, and a Rust `xtask` command surface. Renderer modules depend on shared contracts and cannot import native adapters. The Tauri host depends on the Rust core and exposes narrow handle-based commands. The Kotlin bridge is contained within the generated Android project and communicates through the Tauri mobile-plugin boundary.

## Decisions

### D1. Rust, TypeScript, React, Tauri, and narrow Kotlin form one application stack

Rust owns untrusted-byte handling, document source capabilities, detection, metadata normalization, revision checks, persistence, and recovery. TypeScript owns the shared shell, tab/session projection, editor integration, renderer presentation, and workers. React owns component composition only; document state remains in explicit services and reducers. Kotlin owns Android intents, `ContentResolver`, URI grants, file-descriptor access, and activity lifecycle callbacks. Tauri owns packaging and the permissioned command boundary.

### D2. v0.0.0 is the foundation release and v0.1.0 is the first binary release

The current release establishes architecture and governance without claiming executable capabilities. Format and platform rows cannot become stable before binaries and their acceptance evidence exist. v0.1.0 must ship Windows, macOS, Linux, and Android artifacts with Markdown/text core, tabs, metadata inspector, and crash recovery.

### D3. The document source is capability-based, not path-shaped

Every source advertises read, seek, metadata, watch, persistence, and write capabilities independently. Desktop paths and Android content URIs remain distinct concrete source types. Native source handles are opaque to the WebView and are scoped to one document session.

### D4. Renderer capabilities drive the shell

The shell asks the active renderer which commands it supports and renders only compact contextual controls. Renderers are internal modules loaded on demand; they receive bounded byte providers and declarative host services rather than broad native APIs.

### D5. Stable text behavior precedes broad format support

Markdown and text/source viewing and editing, tabs, metadata, source integrity, and four-platform delivery form v0.1.0. Image inspection follows in v0.2.0, PDF navigation in v0.3.0, DOCX semantic viewing in v0.4.0, and ODT semantic viewing in v0.5.0. A later slice may combine releases only after all individual gates pass.

### D6. Release automation is tag-driven and documentation-gated

The operator creates a reviewed release commit that reconciles changelog fragments and the technical specification, then pushes `vX.Y.Z`. The pipeline verifies versions and documentation before building, fans out to native hosts, smoke-tests artifacts, signs, checksums, generates SBOM/provenance, and publishes only after the required matrix joins.

## Ordering

1. Complete and validate this technical specification and its Spec Kit design artifacts.
2. Establish repository manifests, locks, license files, `xtask`, documentation checks, and CI skeleton.
3. Implement Rust domain/source contracts and desktop plus Android host adapters.
4. Implement the shared shell, compact tabs, session state, recovery, and metadata inspector.
5. Implement Markdown and text/source renderers and v0.1.0 packaging gates.
6. Implement each additional renderer in its own Spec Kit slice and promote its support row only after conformance and platform evidence pass.

## Open Risks

| Risk | Containment | Blocking gate |
| --- | --- | --- |
| System WebView behavior differs across four platforms | Shared browser tests plus native artifact smoke matrix and renderer fallbacks | v0.1.0 platform acceptance |
| Android providers omit seek, timestamps, or persistent grants | Capability-based source contract and bounded private-cache fallback | Android host contract tests |
| Complex DOCX and ODT documents exceed semantic fidelity | Explicit semantic-readability contract, unsupported-feature report, corpus-based fidelity scoring | Renderer activation slice |
| Hostile parser inputs exhaust memory or CPU | Byte, pixel, page, entry, expansion, time, and cancellation limits with fuzz corpus | Security and renderer conformance gates |
| Release signing resources are unavailable | Unsigned development artifacts remain possible; official artifacts require credentials and cannot be claimed without signatures | Release publication join |

## Post-Design Constitution Check

Phase 1 contracts preserve every pre-research result. No constitution exception or complexity waiver is required.
