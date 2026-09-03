# Implementation Plan: Text and Source Editor

**Branch**: `codex/013-text-source-editor` | **Date**: 2026-09-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-text-source-editor/spec.md`

## Summary

Deliver issue #52 as the first production-grade editable renderer: a CodeMirror 6 document surface for bounded text and source sessions, a platform-independent Rust policy for size and language evidence, exact round-trip text serialization integrated with S012 revisions and recovery, and a source-backed virtual read-only surface for 32–256 MiB inputs. The implementation uses explicit editor extensions and lazily imported language packages, retains all native authority behind existing opaque source handles, and exposes no IDE or execution behavior.

## Technical Context

**Language/Version**: TypeScript 6.0.2, React 19.2.8, Rust 1.96.0 (edition 2024)

**Primary Dependencies**: CodeMirror 6.0.2 core bundle with explicit `@codemirror/*` modules, `@codemirror/language-data` 6.5.2 for lazy language descriptions, existing Tauri 2.11.5 boundary, existing React shell

**Storage**: Existing document sources and S012 private recovery store; no new durable store. Large-text indexes and editor state are session-scoped and regenerable.

**Testing**: Rust unit/schema/contract tests, Vitest and Testing Library, deterministic property-style TypeScript corpora, axe-core, full `cargo xtask check`, local Android debug build and retained platform CI matrices

**Target Platform**: Windows, macOS, Linux, and Android through the shared WebView renderer and existing platform-specific opaque source adapters

**Project Type**: Tauri desktop and Android application with a shared React renderer, Rust domain core, and narrow native source hosts

**Performance Goals**: 1 MiB UTF-8 first content p95 at or below 300 ms; input-to-paint p95 at or below 50 ms with no repeated 100 ms stalls; cancellation acknowledgment p95 at or below 250 ms; no full decoded allocation in large-text mode

**Constraints**: Fully editable and highlighted through 32 MiB; any line above 2 MiB disables parsing; 32–256 MiB is source-backed read-only plain text; above 256 MiB is refused; exact encoding/BOM/newline/terminal-newline preservation; local-only operation; no IDE, workspace, execution, or network capability

**Scale/Scope**: One active editor per text session, up to 32 shell sessions, bounded language registry matching existing detection families, 256 KiB large-source reads, sparse index anchors every 1,024 lines with at most 65,536 anchors, copy operations capped at 1 MiB, visible windows capped at 512 KiB, search results capped at 10,000 retained matches, fixture matrices at both size thresholds, and repeatable 1,000-sequence state/round-trip tests

## Constitution Check

_GATE: Passed before Phase 0 research and re-checked after Phase 1 design._

- **P1, file owns the viewport**: The editor replaces the document surface. Status and command affordances remain compact and contextual.
- **P2, local files remain local**: Language modules are bundled application dependencies. No content-triggered request, telemetry, or remote service is introduced.
- **P3, cross-platform foundation**: Size, language, transaction, and serialization policies are shared. Native code supplies only opaque bounded reads already modeled per platform.
- **P4, untrusted input fails safely**: Byte, line, memory, cancellation, lossy-save, stale-result, and capability limits are explicit and directly tested.
- **P5, specifications and releases move together**: S013 remains an unreleased Spec-Kit delta with a changelog fragment. No stable capability or product version is changed.
- **P6, verification precedes claims**: Every acceptance path maps to automated evidence or a documented manual performance/accessibility check before publication.
- **P7, decisions explicit and proportional**: The editor is document-local. Execution, IDE, workspace, persistent override, and generalized extension systems remain excluded.
- **P8, license compatibility**: New CodeMirror packages and transitive dependencies are MIT licensed, recorded through the lockfile, and must pass `cargo deny` plus repository license gates.

No exception or complexity waiver is required.

## Project Structure

### Documentation (this feature)

```text
specs/013-text-source-editor/
├── checklists/requirements.md
├── contracts/editor-renderer.md
├── contracts/large-text-source.md
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
apps/glitchpad/
├── package.json
└── src/
    ├── components/
    │   ├── DocumentSurface.tsx
    │   ├── LargeTextSurface.tsx
    │   └── TextEditorSurface.tsx
    ├── domain/
    │   ├── commands.ts
    │   ├── contracts.ts
    │   ├── language.ts
    │   ├── large-text-gateway.ts
    │   └── text-document.ts
    ├── App.tsx
    └── styles.css

crates/glitchpad-core/
├── src/
│   ├── detection.rs
│   ├── editor.rs
│   ├── lib.rs
│   └── session.rs
└── tests/contract_schema.rs

fixtures/editor/
fixtures/provenance.toml
changelog.d/52.added.md
```

**Structure Decision**: Extend the existing shared core, shell, and host boundaries. The core owns stable editor policy and evidence; the React domain owns exact text transactions and renderer state; components own CodeMirror and virtual-view lifecycles; existing host range commands remain the only native read authority.

## Complexity Tracking

No constitution violations require justification.
