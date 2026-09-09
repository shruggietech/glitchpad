# Implementation Plan: Desktop Rendering and Shell Corrections

**Branch**: `codex/030-desktop-corrections` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

## Summary

Contain Markdown presentation failures inside the active document, replace pending raw source with a stable accessible status, harden session and revision alignment across sequential opens, make the application menu a fixed-size left-anchored trigger with an independently positioned popup, expand packaged Windows regression evidence, and remove the redundant README badge.

## Technical Context

**Language/Version**: TypeScript 6.0, React 19, CSS, PowerShell 7.5, Rust 1.96 where host contracts require verification

**Primary Dependencies**: Tauri 2.11, CodeMirror 6.43, unified/remark Markdown pipeline, Testing Library 16.3, Vitest 4.1, axe-core, Windows UI Automation

**Storage**: Existing local session, preference, recovery, and diagnostic stores; no new storage

**Testing**: Vitest component/domain tests, deterministic renderer doubles, axe-core, CSS geometry browser coverage, Windows packaged lifecycle policy and UI Automation tests, complete `cargo xtask check`

**Target Platform**: Shared desktop renderer and shell on Windows, macOS, and Linux, with final packaged regression evidence on Windows

**Project Type**: Tauri desktop/mobile application with a React renderer and Rust native host

**Performance Goals**: Preserve the existing 2-second shell response target; pending, success, and failure transitions complete within one render cycle after state settles; menu disclosure causes zero document reflow

**Constraints**: Offline-only core behavior; no new runtime dependency; no private-content diagnostics; no weakened sanitizer, source authority, recovery, or save behavior; non-Git local commands run through the hidden validation container; no release publication in this slice

**Scale/Scope**: Four linked issues (#160-#163), one Markdown surface, one document containment boundary, one application-menu geometry correction, one Windows packaged lifecycle gate, one README badge deletion

## Constitution Check

_GATE: Passed before research and passed again after design._

| Principle | Application | Result |
| --- | --- | --- |
| P1 | Removes source flash and layout movement so the file retains the viewport | Pass |
| P2 | Keeps rendering, failure handling, tests, and diagnostics local | Pass |
| P3 | Preserves one shared presentation contract while placing packaged evidence at the Windows boundary | Pass |
| P4 | Contains untrusted-input failures without weakening sanitization or exposing source implicitly | Pass |
| P5 | Records an unreleased v0.1.2 delta without changing release versions | Pass |
| P6 | Requires deterministic component, geometry, accessibility, corpus, and packaged gates before the pull request | Pass |
| P7 | Corrects the existing surface and menu in place without a new shell or generalized framework | Pass |
| P8 | Adds no dependency or distributable asset | Pass |

## Project Structure

```text
specs/030-desktop-corrections/
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
├── components/
│   ├── ApplicationMenu.test.tsx
│   ├── ApplicationMenu.tsx
│   ├── DocumentErrorBoundary.test.tsx
│   ├── DocumentErrorBoundary.tsx
│   ├── DocumentSurface.tsx
│   ├── MarkdownSurface.test.tsx
│   └── MarkdownSurface.tsx
└── styles.css
scripts/
├── check-windows-package.mjs
├── check-windows-package.test.mjs
└── windows/
    └── test-portable-lifecycle.ps1
docs/releases/v0.1.2.md
README.md
```

**Structure Decision**: Correct the established renderer and shell components in place. Add one narrow reusable document boundary, keep Markdown lifecycle authority in the existing client and session model, express menu stability through independent fixed geometry, and extend the existing Windows package harness instead of creating a browser or PowerShell test system that the repository does not otherwise use.

## Complexity Tracking

No constitution violations require justification.
