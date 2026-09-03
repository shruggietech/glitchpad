# Implementation Plan: Local Markdown Viewing and Editing

**Branch**: `codex/014-markdown-view-edit` | **Date**: 2026-09-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-markdown-view-edit/spec.md`

## Summary

Implement issue #53 as one local, source-preserving Markdown renderer layered over the S013 text lifecycle. A worker-backed unified pipeline parses CommonMark, GFM, and footnotes, converts raw HTML nodes to inert text, projects safe semantic output, and applies a final versioned sanitation schema. A Markdown surface owns rendered/source modes, revision-safe preview scheduling, outline and rendered search, deliberate link confirmation, print presentation, and bounded degradation. The original text document remains the only save and recovery authority.

## Technical Context

**Language/Version**: TypeScript 6.0.2 and React 19.2.8 in the shared renderer; Rust 1.96.0 at the privileged host boundary

**Primary Dependencies**: unified 11.0.5, remark-parse 11.0.0, remark-gfm 4.0.1, remark-rehype 11.1.2, rehype-sanitize 6.0.0, unist-util-visit 5.1.0, CodeMirror 6, Tauri 2.11.1

**Storage**: Existing in-memory session projection, source adapter, and recovery store; sanitized render trees and indexes are regenerable and never persisted

**Testing**: Vitest, Testing Library, axe-core, existing Rust contract suites, Playwright site checks, cargo xtask aggregate validation, deterministic fixture and performance harnesses

**Target Platform**: Windows 11 x86_64, macOS 13+ universal, Linux x86_64 at the declared glibc baseline, and Android 7.0+ at minSdk 24

**Project Type**: Tauri desktop and Android application with a shared React renderer and Rust native boundary

**Performance Goals**: Representative 1 MiB Markdown reaches first rendered content within 800 ms at desktop p95; preview scheduling begins after 100 ms; superseded work accepts no stale result; repeated interaction work stays below the existing 50 ms hard threshold

**Constraints**: Fully offline; no document-content network requests; no raw DOM injection; 16 MiB render limit; 32 MiB edit limit; 256 MiB view limit; cancellation within 250 ms; source bytes remain authoritative; no Mermaid rendering in this slice

**Scale/Scope**: CommonMark, GFM tables/task lists/strikethrough/autolinks, footnotes, headings, outline, search, mode switching, deliberate links, print CSS, hostile fixtures, and 100-revision stale-result validation for one active Markdown document at a time

## Constitution Check

_GATE: Passed before research and re-checked after design._

| Principle | Result | Design Evidence |
| --- | --- | --- |
| P1. The file owns the viewport | Pass | Rendered and source content occupy the document surface; controls are compact and contextual; split view is excluded. |
| P2. Local files remain local | Pass | The pipeline is bundled and offline; remote resources, telemetry, accounts, and document-content requests are denied. |
| P3. Cross-platform behavior is foundational | Pass | Parser, sanitizer, contracts, and UI are shared; no path-shaped Android abstraction or new platform privilege is introduced. |
| P4. Untrusted input fails safely | Pass | Raw HTML becomes inert text, generated nodes pass a final allowlist, link activation is classified and confirmed, and parsing is bounded and cancellable. |
| P5. Specifications and releases move together | Pass | S014 is an unreleased specification delta; product version and stable-format claims remain 0.0.0. |
| P6. Verification precedes claims | Pass | Every acceptance criterion maps to automated or explicit manual evidence; the complete aggregate gate runs before PR publication. |
| P7. Decisions are explicit and proportional | Pass | One Markdown surface composes existing text/session facilities; Mermaid, split view, conversion, and generalized extension points are excluded. |
| P8. Apache-2.0 and license compatibility | Pass | All new direct packages are MIT licensed, pinned, lockfile-controlled, and covered by the existing dependency policy. |

Post-design re-check: Pass. The data model stores no rendered content durably, contracts deny undeclared capabilities, the worker boundary is bounded, and every planned dependency is license-compatible.

## Project Structure

### Documentation (this feature)

```text
specs/014-markdown-view-edit/
├── checklists/requirements.md
├── contracts/
│   ├── markdown-renderer.md
│   └── markdown-navigation.md
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
    │   ├── MarkdownSurface.test.tsx
    │   └── MarkdownSurface.tsx
    ├── domain/
    │   ├── commands.ts
    │   ├── contracts.ts
    │   ├── markdown-contract.ts
    │   ├── markdown-pipeline.test.ts
    │   ├── markdown-pipeline.ts
    │   ├── markdown-renderer.test.ts
    │   ├── markdown-renderer.ts
    │   ├── markdown-url.test.ts
    │   ├── markdown-url.ts
    │   ├── markdown-worker.ts
    │   └── tabs.ts
    └── styles.css

fixtures/markdown/
├── corpus.json
└── sources/

specs/014-markdown-view-edit/
└── verification.md
```

**Structure Decision**: Keep Markdown inside the existing shared application. Pure pipeline and URL policy code lives under `domain`, worker orchestration is isolated behind a renderer contract, and React renders only an allowlisted structured tree without `dangerouslySetInnerHTML`. The Markdown surface composes `TextEditorSurface` in source mode. A narrow cross-platform Rust command backed by `tauri-plugin-opener` performs independent scheme validation after explicit confirmation; automatic plugin link interception stays disabled and no generalized opener permission is granted to Markdown.

## Complexity Tracking

No constitution violations require justification.

## Delivery Phases

1. Pin the compatible parsing/sanitizing dependencies and define the renderer, result, navigation, and link contracts.
2. Build the pure hostile-input-safe Markdown pipeline and URL classifier with test-first boundary coverage.
3. Add worker orchestration with revision, cancellation, timeout, disposal, and direct-test fallback behavior.
4. Build the Markdown surface with rendered/source modes, outline, search, link confirmation, print presentation, accessibility, and size degradation.
5. Integrate with renderer-driven commands, session state, and the lossless text editor lifecycle.
6. Add fixtures, performance evidence, platform-neutral conformance, verification documentation, and complete repository validation.
