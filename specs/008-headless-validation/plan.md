# Implementation Plan: Headless Windows Validation

**Branch**: `codex/008-headless-validation` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-headless-validation/spec.md`

## Summary

Replace the per-file and per-diagram PowerShell-to-`pnpm` validation loops with direct Node.js validators that remain inside one long-lived validator process. Link checks will use the installed programmatic library with per-file base URLs and deterministic aggregated diagnostics. Mermaid checks will extract all repository diagrams and reuse one explicitly launched Puppeteer browser with the installed Mermaid renderer. Node tests and configuration contracts will prove source attribution, failure propagation, browser reuse, deterministic selection, and the absence of prohibited nested launchers.

## Technical Context

**Language/Version**: Node.js 24.11.x, JavaScript ESM; Rust 1.92.x orchestration unchanged

**Primary Dependencies**: `markdown-link-check` 3.15.0, `@mermaid-js/mermaid-cli` 11.16.0, Puppeteer 25.9.0, Node.js standard library

**Storage**: Repository Markdown and JSON configuration; no persistent runtime storage

**Testing**: Node.js built-in test runner, repository configuration checks, `cargo xtask docs`, `cargo xtask check`, hosted GitHub Actions

**Target Platform**: Windows contributor workstations and hosted Linux CI

**Project Type**: Monorepo developer tooling

**Performance Goals**: Validator process count remains constant as file and diagram counts grow; one reusable browser per Mermaid run; deterministic traversal and diagnostics

**Constraints**: Zero visible or focus-stealing Windows console descendants; no shell interpolation; behavior parity across Windows and Linux; exact source diagnostics; UTF-8 without BOM; no new dependency

**Scale/Scope**: Approximately 100 Markdown files and 27 Mermaid blocks at planning time; two validator entry points, one shared traversal helper, one test suite, configuration contracts, contributor guidance

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle | Pre-design evaluation | Post-design evaluation |
| --- | --- | --- |
| P1. The file owns the viewport | Pass. Repository tooling only; product viewport is unchanged. | Pass. No application surface changes. |
| P2. Local files remain local | Pass. Validation reads repository files and performs the same declared external link checks as the baseline. | Pass. No product data flow or telemetry is introduced. |
| P3. Cross-platform behavior is foundational | Pass. Windows and Linux behavior parity is an explicit requirement. | Pass. Direct Node APIs replace platform-specific shell orchestration while preserving CI support. |
| P4. Untrusted input fails safely | Pass. Markdown is treated as validation input with controlled parsing and no shell interpolation. | Pass. Browser and validation failures are isolated, attributed, and propagated. |
| P5. Specifications and releases move together | Pass. S008 has a complete unreleased Spec-Kit record and no release-version change. | Pass. Tooling guidance and changelog fragment are included; the normative product specification is unaffected. |
| P6. Verification precedes claims | Pass. Automated and explicit observed Windows checks are specified. | Pass. Unit, configuration, documentation, full repository, and hosted gates are planned. |
| P7. Decisions are explicit and proportional | Pass. The change is confined to the two proven nested launchers and their contract. | Pass. One shared helper and programmatic APIs are the smallest coherent repair. |
| P8. Apache-2.0 and license compatibility | Pass. Existing pinned ISC and MIT-compatible tooling is reused. | Pass. No dependency or distributed artifact is added. |

No constitution violations require complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/008-headless-validation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── validation-cli.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json
scripts/
├── check-config.mjs
├── check-links.mjs
├── check-mermaid.mjs
├── check-validation.test.mjs
└── validation-files.mjs

CONTRIBUTING.md
changelog.d/
└── 101.fixed.md
```

**Structure Decision**: Keep validation in the existing repository-owned `scripts/` tooling surface. Replace the two PowerShell entry points rather than adding another package, preserve `cargo xtask` as the outer orchestrator, and place regression tests beside the scripts they protect.

## Design Decisions

### One direct Node entry point per validator

`package.json` invokes each validator directly with Node. Neither validator starts `pnpm`, PowerShell, `cmd.exe`, another Node process, or a per-item browser. This removes the descendant-console boundary that the Rust parent's `CREATE_NO_WINDOW` flag cannot control.

### Programmatic link validation with one deliberate correctness improvement

The validator calls the installed link-check library inside its own process and supplies each file's URL base explicitly. Selection and configuration remain equivalent to the prior script. S008 deliberately treats both dead-link and link-check error results as failures; the previous CLI wrapper could report an error-status result without failing the outer run. This deviation is proportional because silent validation errors violate FR-008 and P6.

### One explicitly owned Mermaid browser

The Mermaid validator launches Puppeteer once only when at least one diagram exists, passes the same CI launch arguments, renders every extracted diagram through `renderMermaid`, and closes the browser in `finally`. The renderer owns individual pages and closes each one while the validator owns the reusable browser lifetime.

### Executable process-topology contract

The configuration check asserts the exact direct Node scripts and rejects process-spawning imports or prohibited launcher tokens in the validator sources. Unit tests inject link, launcher, browser, and renderer doubles to prove deterministic coverage, source diagnostics, failure propagation, zero-browser empty input, and exactly one browser for multiple diagrams.

## Complexity Tracking

No entries. The design introduces no new subsystem, dependency, service, or product behavior.
