# Implementation Plan: Content-First Desktop Hotfix

**Branch**: `codex/027-content-first-hotfix` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

## Summary

Replace the fixture-driven production shell with a zero-session start, condition tabs on true multi-document state, consolidate secondary commands behind one compact menu, integrate search and panels into a coherent overlay model, and strengthen the Windows portable lifecycle probe so it validates visible TXT and Markdown content from clean packaged state.

## Technical Context

**Language/Version**: TypeScript 6.0, React 19, CSS, PowerShell 7.5, Rust 1.96 where native lifecycle contracts require adjustment

**Primary Dependencies**: Tauri 2.11, CodeMirror 6.43, Testing Library 16.3, Vitest 4.1, Windows UI Automation

**Storage**: Existing local preference, session-projection, diagnostic, and recovery stores; no new storage

**Testing**: Vitest component/domain tests, axe-core, TypeScript and ESLint gates, Rust workspace checks, Windows packaged lifecycle PowerShell tests, complete `cargo xtask check`

**Target Platform**: Windows desktop hotfix with shared shell behavior preserved for macOS, Linux, and Android

**Project Type**: Tauri desktop/mobile application with a React renderer and Rust native host

**Performance Goals**: First completed desktop delivery becomes visible within the existing 2-second shell target; tab and menu state changes complete within one render cycle; no additional startup process

**Constraints**: Offline-only core behavior; no new dependency; no fixture state in production; no bypass of recovery or atomic-save safeguards; all local validation runs in the hidden repository container; Windows package validation remains bounded and non-interactive

**Scale/Scope**: Seven linked defects (#141-#147), one shared shell, text and Markdown first-run paths, conditional multi-document tabs, one compact menu, renderer search surfaces, and one Windows portable lifecycle gate

## Constitution Check

_GATE: Passed before research and passed again after design._

| Principle | Application | Result |
| --- | --- | --- |
| P1 | Removes permanent fixture tabs and command rows, restores content ownership, and permits tabs only when they reduce concurrent-document detours | Pass |
| P2 | Keeps file content, preferences, diagnostics, and validation local | Pass |
| P3 | Implements shared shell semantics while adding Windows-specific packaged evidence at the native boundary | Pass |
| P4 | Preserves bounded decoding, source authority, recovery, and durable-save transitions | Pass |
| P5 | Records the v0.1.1 shipped-behavior delta without prematurely publishing a release | Pass |
| P6 | Adds component, accessibility, delivery, and packaged visible-outcome gates before claims | Pass |
| P7 | Replaces a contradicted design explicitly and avoids workspace, IDE, or generalized window-management expansion | Pass |
| P8 | Adds no dependency or distributable asset | Pass |

## Project Structure

```text
specs/027-content-first-hotfix/
├── checklists/requirements.md
├── contracts/shell-presentation-contract.md
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
│   ├── DocumentSurface.tsx
│   ├── MarkdownSurface.tsx
│   ├── MermaidSurface.tsx
│   ├── TabStrip.test.tsx
│   ├── TabStrip.tsx
│   └── TextEditorSurface.tsx
├── domain/
│   ├── desktop-delivery-gateway.test.ts
│   └── tabs.test.ts
├── main.tsx
├── styles.css
└── test/fixtures.ts
scripts/windows/
├── test-portable-lifecycle.ps1
└── test-portable-lifecycle.tests.ps1
docs/releases/v0.1.1-delta.md
```

**Structure Decision**: Correct the existing shell in place. Move synthetic session construction into test-only code, preserve the established session and delivery domains, introduce one focused menu component, and extend the existing Windows portable lifecycle gate instead of creating a second UI architecture or test harness.

## Complexity Tracking

No constitution violations require justification.
