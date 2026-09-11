# Implementation Plan: Markdown Recovery and Reserved Shell Chrome

**Branch**: `codex/s035-markdown-shell-recovery` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

## Summary

Restore reliable Markdown preview and retry after contained failures, constrain recovery controls to intrinsic height, reserve compact in-flow shell chrome for the application menu, and strengthen deterministic browser plus final packaged Windows evidence. The implementation will correct the confirmed S030 regressions, harden concrete Chrome 69 compatibility gaps, and preserve the error boundary while the still-unproven universal renderer trigger is investigated through content-free evidence.

## Technical Context

**Language/Version**: TypeScript 6.0, React 19, CSS, Node.js 24, PowerShell 7.5, Rust 1.96 where host and validation contracts require changes

**Primary Dependencies**: Tauri 2.11, CodeMirror 6.43, unified/remark Markdown pipeline, Testing Library 16.3, Vitest 4.1, Puppeteer, axe-core, Windows UI Automation

**Storage**: Existing local session, preference, recovery, and diagnostic stores; no new storage schema

**Testing**: Vitest component/domain tests, production-build Puppeteer geometry checks, Windows package-policy tests, packaged Windows UI Automation, hosted shared-shell smoke, complete `cargo xtask check`

**Target Platform**: Shared desktop renderer and shell on Windows, macOS, and Linux, with final packaged regression evidence on Windows

**Project Type**: Tauri desktop/mobile application with a React renderer and Rust native host

**Performance Goals**: Preserve the existing 2-second shell response target, keep combined shell chrome at or below 72px, allocate at least 90 percent of ordinary window height to the document, and cause zero document scroll movement or reflow when the menu opens

**Constraints**: Offline-only core behavior; no new runtime dependency; no raw source, filenames, paths, links, or exception messages in diagnostics or receipts; Chrome 69 renderer target compatibility; 32px compact desktop and 44px coarse-pointer targets; non-Git commands run through the hidden Linux validation container; no release publication in this slice

**Scale/Scope**: Two linked issues (#171 and #172), one Markdown recovery state machine, one shared shell row, one production-browser geometry probe, and extensions to the existing Windows final-byte lifecycle gate

## Constitution Check

_GATE: Passed before research and passed again after design._

| Principle | Application | Result |
| --- | --- | --- |
| P1 | Reserves shell chrome outside the document and keeps compact recovery near the document start | Pass |
| P2 | Keeps rendering, retry, layout, and diagnostic behavior local and offline | Pass |
| P3 | Uses one shared shell and recovery contract while placing final-byte evidence at platform boundaries | Pass |
| P4 | Retains document containment, sanitizer authority, explicit source disclosure, and content-free evidence | Pass |
| P5 | Corrects the current stable line without changing versions or publishing a release | Pass |
| P6 | Requires focused, geometry, accessibility, compatibility, aggregate, and packaged gates before handoff | Pass |
| P7 | Corrects existing components and lifecycle harnesses without introducing a new framework or production test backdoor | Pass |
| P8 | Adds no dependency or distributable asset | Pass |

## Project Structure

```text
specs/035-markdown-shell-recovery/
├── checklists/requirements.md
├── contracts/desktop-presentation.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
├── tasks.md
└── verification.md
apps/glitchpad/src/
├── App.test.tsx
├── App.tsx
├── components/
│   ├── ApplicationMenu.test.tsx
│   ├── ApplicationMenu.tsx
│   ├── DocumentErrorBoundary.test.tsx
│   ├── DocumentErrorBoundary.tsx
│   ├── DocumentSurface.test.tsx
│   ├── DocumentSurface.tsx
│   ├── MarkdownSurface.test.tsx
│   └── MarkdownSurface.tsx
├── domain/
│   └── markdown-worker.ts
├── runtime-polyfills.test.ts
├── runtime-polyfills.ts
└── styles.css
scripts/
├── check-shell-layout.mjs
├── check-windows-package.mjs
├── check-windows-package.test.mjs
└── windows/
    ├── test-installer-lifecycle.ps1
    └── test-portable-lifecycle.ps1
.github/workflows/
├── ci.yml
└── windows-package.yml
crates/xtask/src/main.rs
package.json
```

**Structure Decision**: Correct the established Markdown and shell components in place. Keep retry authority at the document boundary, use narrow compatibility primitives rather than a generalized polyfill layer, place the persistent menu in one in-flow shell row beside the conditional tab strip, and extend the existing validation and final-byte lifecycle systems rather than adding a production failure switch or a second native automation harness.

## Complexity Tracking

No constitution violations require justification.
