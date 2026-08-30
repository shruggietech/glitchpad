# Implementation Plan: Mermaid Viewing and Editing

**Branch**: `003-mermaid-view-edit` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-mermaid-view-edit/spec.md`

## Summary

Promote Mermaid from an embedded Markdown enhancement to a first-class editable text format while retaining the existing embedded use case. Standalone `.mmd` and `.mermaid` documents use the shared text round-trip, save, recovery, tab, search, and metadata contracts, then add a tightly permissioned Mermaid adapter for validation, rendering, accessibility, zoom, and pan. Fenced Mermaid blocks remain owned by their Markdown document and receive independent bounded render results. All rendering is local, revision-keyed, sanitized, resource-limited, and unable to invoke the native bridge or network.

## Technical Context

**Language/Version**: Rust 1.96.0; TypeScript 6.x on Node.js 24 LTS; Kotlin only through the pinned Tauri Android bridge

**Primary Dependencies**: Tauri 2.x, React 19.x, CodeMirror 6, unified/remark/rehype, `rehype-sanitize`, Mermaid 11.x, and a dedicated SVG sanitization policy; exact patch versions and transitive dependencies are locked by the repository manifests before implementation

**Storage**: Existing desktop files and Android document URIs; private crash-recovery records for dirty Mermaid source; ephemeral revision-keyed render results only; no database or remote storage

**Testing**: TypeScript unit and contract tests, Vitest and Testing Library, Playwright and axe-core, renderer security fixtures, Mermaid parser/render golden fixtures, host save/recovery tests, package association tests, and physical Android smoke tests

**Target Platform**: Windows 11 x86_64, macOS 13+ universal, Linux x86_64 with the declared glibc baseline, and Android 7.0+ (`minSdk 24`) targeting the repository-pinned API; every platform shipping the Markdown/text core must ship the same Mermaid contract

**Project Type**: Cross-platform local desktop and Android document viewer/editor with a Rust source core, Tauri host, shared TypeScript renderer layer, and narrow Kotlin Android bridge

**Performance Goals**: Representative 1 MiB source to first render within 1.5 seconds desktop and 2.5 seconds Android at p95; 300 ms preview debounce within the specified 250–500 ms window; updated normal preview within 1 second at p95; no stale render commits; cancellation acknowledgement within 250 ms

**Constraints**: Compact content-first interface, exact source preservation, offline operation, untrusted input, strict local rendering, no active links or callbacks, no user-file direction rewriting, one render per document, bounded app-wide concurrency, Apache-2.0-compatible distribution, and no export or cloud surface

**Scale/Scope**: Standalone render eligibility through 1 MiB source and 2,000 edges; source editing through the shared 32 MiB text limit; embedded blocks through 256 KiB each, 64 blocks and 1 MiB Mermaid source per Markdown document; 8 MiB sanitized SVG output; 5 second render timeout; up to 32 document tabs

## Constitution Check

_GATE: Passed before research and re-checked after design._

| Principle | Plan evidence | Result |
| --- | --- | --- |
| P1. The file owns the viewport | Rendered/source toggle and diagram navigation are compact contextual controls; no permanent navigator or workspace surface is added | Pass |
| P2. Local files remain local | Source, validation, rendering, metadata, recovery, and diagnostics are local; rendering has no network route | Pass |
| P3. Cross-platform behavior is foundational | One renderer contract and fixture corpus apply to desktop and Android; host differences remain inside existing source adapters | Pass |
| P4. Untrusted input fails safely | Immutable security configuration, isolated rendering, final SVG sanitization, source/edge/output/time limits, and non-destructive fallbacks contain hostile source | Pass |
| P5. Specifications and releases move together | This numbered feature slice records the unreleased behavior; the technical baseline and release matrix receive a documentation reconciliation before capability activation | Pass |
| P6. Verification precedes claims | Association and support claims remain gated by renderer contract, security corpus, accessibility, round-trip, performance, and four-platform evidence | Pass |
| P7. Decisions are explicit and proportional | The design reuses text and Markdown infrastructure, adds one renderer adapter, and explicitly excludes export, collaboration, cloud, callbacks, and plugins | Pass |
| P8. Apache-2.0 and license compatibility | Mermaid and every added sanitizer/runtime dependency require locked provenance, license review, notices, SBOM inclusion, and release-gate approval | Pass |

## Project Structure

### Documentation (this feature)

```text
specs/003-mermaid-view-edit/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── mermaid-renderer.md
└── checklists/
    └── requirements.md
```

### Planned Source Code (repository root)

```text
apps/glitchpad/src/
├── document/
│   ├── formats/
│   │   └── mermaid.ts
│   └── session/
├── renderers/
│   ├── markdown/
│   └── mermaid/
│       ├── adapter.ts
│       ├── controls.tsx
│       ├── diagnostics.ts
│       ├── limits.ts
│       ├── preview.tsx
│       ├── sanitizer.ts
│       └── state.ts
├── services/
│   └── render-scheduler.ts
├── workers/
│   └── mermaid-render-context.ts
└── tests/
    ├── contract/
    ├── integration/
    └── security/

crates/glitchpad-core/src/
├── detection/
└── metadata/

fixtures/documents/mermaid/
fixtures/hostile/mermaid/
```

**Structure Decision**: Implement Mermaid as one internal renderer adapter shared by standalone documents and Markdown block projections. The standalone renderer composes the existing text editor and source lifecycle. Markdown extracts fenced blocks and submits them to the same adapter without transferring ownership of the surrounding document. The adapter cannot import host or Tauri APIs, and only the existing document session may request reads, saves, recovery, or native actions.

## Design Decisions

### D1. Mermaid is a first-class text format and an embedded Markdown language

The detector recognizes `.mmd` and `.mermaid` as Mermaid candidates and verifies a bounded source prefix for a supported diagram declaration. The Markdown pipeline recognizes fenced `mermaid` blocks. A standalone document receives Mermaid-specific view/edit controls; an embedded block remains part of Markdown and never becomes an independently saved source.

### D2. One adapter owns parse, render, sanitize, and accessibility normalization

The shared adapter invokes the bundled Mermaid package with `startOnLoad: false`, `securityLevel: 'strict'`, immutable secure keys, bounded text and edge limits, deterministic identifiers, bundled fonts, and no callbacks. Generated SVG passes through an application-owned allowlist after Mermaid's own sanitization. The final tree rejects scripts, `foreignObject`, event attributes, external URLs, navigation, remote style/font/image references, and unsafe CSS before insertion.

### D3. Rendering is isolated, revision-keyed, and disposable

Render work runs in a dedicated restricted context that has no Tauri bridge, storage authority, network route, opener, forms, downloads, or top-level navigation. Requests and replies cross a typed message boundary. Every request includes session, block, source-revision, theme, and cancellation identities. Timeout, context failure, tab suspension, and supersession dispose or recycle the context; only the newest matching revision can commit output.

### D4. The editor buffer remains the only source authority

CodeMirror owns responsive edit state while the document session owns source revision, round-trip profile, dirty state, recovery, and save preconditions. Rendering never serializes back into the editor. Theme changes, fit state, zoom, pan, diagnostics, and generated accessibility labels are projections and cannot alter source bytes.

### D5. Limits preserve editing when rendering is unsafe or impractical

Standalone rendering accepts at most 1 MiB of decoded source, 2,000 edges, 8 MiB of sanitized SVG, 5 seconds of wall time, and one in-flight request for the document. Markdown accepts at most 256 KiB per block, 64 blocks and 1 MiB of aggregate Mermaid source per document, subject to the same per-render edge/output/time caps and an app-wide limit of two active render contexts. Documents above render limits retain source view/edit/search/copy/save through the shared text thresholds.

### D6. Errors retain the last valid preview and expose exact state

Parse and render errors are normalized into malformed, unsupported, resource-limit, cancelled, and internal categories. Diagnostics carry bounded safe text plus line and column when Mermaid supplies them. A failed source revision leaves its source editable and keeps the last valid preview visibly marked as stale; it never presents stale output as the current valid render.

### D7. Accessibility metadata is authored first and generated second

Mermaid `accTitle` and `accDescr` values flow into SVG title, description, and ARIA relationships after sanitization. When absent, Glitchpad supplies a localized fallback label containing the diagram type and filename or block position, plus a source-mode route. Zoom, pan, mode changes, errors, and stale-preview state are keyboard, touch, and screen-reader operable without trapping focus inside SVG.

### D8. Stable activation joins the v0.1.0 Markdown/text gate

Mermaid ships with the initial stable text core only after standalone associations, Markdown integration, source round trips, hostile fixtures, accessibility, performance, package smoke, and four-platform behavior pass. Until then, `.mmd` and `.mermaid` remain absent from public stable claims and platform associations.

## Implementation Ordering

1. Add Mermaid detection evidence, format identifiers, support-matrix declarations, fixture provenance, and renderer contract tests.
2. Add standalone Mermaid session state by composing the shared editable-text source, recovery, save, conflict, search, and metadata behavior.
3. Implement the isolated render boundary, immutable configuration, limits, cancellation, SVG allowlist, diagnostics, and accessibility normalization.
4. Add rendered/source mode, stale-preview handling, fit/zoom/pan controls, keyboard/touch behavior, and compact metadata facts.
5. Route Markdown fenced blocks through the same adapter with independent block identities, failures, and document budgets.
6. Complete security, round-trip, performance, accessibility, host, association, package, and physical Android evidence before stable activation.

## Open Risks

| Risk | Containment | Blocking gate |
| --- | --- | --- |
| Mermaid diagram types and browser layout engines produce cross-platform SVG differences | Semantic golden assertions, bounded visual baselines per platform, bundled fonts, and explicit parser/runtime lock | Renderer conformance on all release platforms |
| A render consumes the UI thread or ignores cancellation | Preflight limits, isolated disposable context, one-current-revision commit rule, timeout recycling, and interaction latency tests | Performance and cancellation gate |
| Mermaid or sanitizer behavior changes after an upgrade | Exact lockfile, security-advisory review, hostile corpus, output allowlist tests, and reviewed golden update | Dependency update gate |
| Accessibility varies by diagram type | Authored annotation fixtures for every enabled type, fallback labels, source route, and manual assistive-technology matrix | Accessibility release gate |
| File extensions collide with unrelated text formats | Extension is candidate evidence only; bounded content declaration and explicit user override settle ambiguity | Detection contract gate |

## Post-Design Constitution Check

Phase 1 preserves every pre-research result. The isolated context is a proportional security boundary for hostile text-to-SVG generation, not a plugin or service platform. No constitution exception or complexity waiver is required.
