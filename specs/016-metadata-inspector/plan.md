# Implementation Plan: Contextual Metadata Inspector

**Branch**: `[codex/016-metadata-inspector]` | **Date**: 2026-09-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-metadata-inspector/spec.md`

## Summary

Implement issue #58 as one shell-owned, nonmodal metadata inspector backed by a centralized typed catalog and revision-safe snapshots. Rust extends the path-free source contract and owns bounded, cancellable, revision-bound SHA-256 operations. TypeScript owns catalog labels and formatting, safe copy policy, incremental source/text/detection/renderer projections, responsive presentation, accessibility, and stale-contribution rejection. Mermaid's renderer-local metadata panel is replaced by the shared inspector.

## Technical Context

**Language/Version**: Rust 1.96.0 (edition 2024), TypeScript 5.9.3, React 19.2.4, Kotlin/JVM through the existing Android bridge

**Primary Dependencies**: Existing Tauri 2.10.3 host boundary, React shell, `sha2` 0.10.9, Web Clipboard API through an injected gateway; no new production dependency

**Storage**: No new persistence. Metadata is bounded per-session state; checksum operations are ephemeral host state.

**Testing**: Rust unit and host conformance tests, Vitest 4.1.0 with Testing Library and axe, Android controlled-provider tests, existing `cargo xtask check` aggregate gate

**Target Platform**: Windows 11 x86_64, macOS 13+ arm64/x86_64, Ubuntu 22.04-baseline x86_64, Android API 24 through 36

**Project Type**: Tauri desktop/mobile application with shared React renderer and Rust domain/native host

**Performance Goals**: Inspector open/dismiss p95 under 100 ms; host refresh visible within one second of an observed event; checksum work advances in at most 1 MiB chunks; repeated UI tasks remain below 50 ms

**Constraints**: Offline-only, no raw paths or Android authorities in the interface, 360-pixel maximum desktop sheet, responsive phone bottom sheet, revision-bound async publication, explicit sensitive disclosure, UTF-8 without BOM

**Scale/Scope**: Stable-core source/text/Markdown/Mermaid/detection/capability catalog, at most 256 MiB per checksum request, bounded fact counts and strings, 100-cycle cancellation and disposal evidence

## Constitution Check

_GATE: Passed before research and after design._

- **P1**: Pass. One dismissible nonmodal sheet preserves document context; no permanent sidebar is introduced.
- **P2**: Pass. Metadata and integrity work are local with no account, telemetry, or network dependency.
- **P3**: Pass. One shared catalog consumes path-free desktop and Android observations; Android URIs remain native-only.
- **P4**: Pass. Values, errors, copies, fact counts, checksum reads, and async contributions are bounded and revision checked.
- **P5**: Pass. Behavior is recorded as an unreleased S016 delta with a changelog fragment for release reconciliation.
- **P6**: Pass. Every acceptance path maps to an automated test or explicit platform/accessibility receipt.
- **P7**: Pass. The design reuses existing boundaries and excludes persistence and generalized framework work.
- **P8**: Pass. No new dependency or external asset is introduced.

## Project Structure

### Documentation (this feature)

```text
specs/016-metadata-inspector/
├── checklists/requirements.md
├── contracts/metadata-catalog.md
├── contracts/source-integrity.md
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
├── App.tsx
├── App.test.tsx
├── components/{DocumentSurface,MetadataInspector,MarkdownSurface,MermaidSurface}*.tsx
├── domain/{contracts,metadata,metadata-gateway,tabs}*.ts
└── styles.css
crates/glitchpad-core/src/{source,metadata}.rs
crates/glitchpad-core/tests/contract_schema.rs
crates/glitchpad-host/src/{lib,source/mod,android_source/mod}.rs
crates/glitchpad-host/tests/{desktop_source_conformance,android_source_contract}.rs
crates/glitchpad-android-source/android/src/{main,androidTest}/
fixtures/metadata/
```

**Structure Decision**: Extend the existing ports-and-adapters boundaries. Rust emits trusted path-free observations and integrity receipts. The TypeScript domain centralizes product catalog policy and merges contributions into `ShellSession`. A single shell sibling renders every format's inspector.

## Design Decisions and Deviation

- The inspector is shell-owned rather than renderer-owned. This deliberately replaces S015's Mermaid-local panel because retaining it would duplicate provenance, copy, layout, and accessibility policy.
- Catalog keys, labels, groups, sensitivity, and copy policy are application policy and are never accepted from native hosts or renderers.
- SHA-256 uses cooperative host commands (`start`, bounded `advance`, `cancel`) rather than an unbounded invocation or frontend buffering. Final publication requires external-revision revalidation.
- Unknown provider length remains eligible only when authoritative EOF occurs within the 256 MiB cap. Exhausting the cap without EOF yields a limit result and no digest.
- Created and accessed timestamps are optional platform observations and are never synthesized from modification time.
- Phone geometry uses a compact bottom sheet with explicit expansion; the nonmodal inspector does not trap focus.

## Complexity Tracking

No constitution violation requires an exception.
