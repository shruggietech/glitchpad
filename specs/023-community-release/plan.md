# Implementation Plan: v0.1.0 Community Release

**Branch**: `codex/023-community-release` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

## Summary

Promote the completed Windows, macOS, Linux, and Android package work into the first official Glitchpad release without paid trust programs. Synchronize every version authority at 0.1.0, replace paid Windows and Apple gates with explicit community trust states, retain repository attestations for Linux and a stable project-owned Android update key, assemble release documentation and evidence, and add a fail-closed tag workflow that publishes exactly the governed assets only after merge.

## Technical Context

**Language/Version**: Rust 1.96.0, Node.js 24.11+, pnpm 10.28.2, PowerShell 7, GitHub Actions YAML

**Primary Dependencies**: Tauri 2.11, existing package validators and assemblers, GitHub artifact attestations, GitHub CLI

**Storage**: Versioned repository files, workflow artifacts, GitHub Releases, external encrypted Android keystore secrets

**Testing**: Node test runner, Vitest, Cargo tests and Clippy, PowerShell contract checks, `cargo xtask check`, platform package workflows

**Target Platform**: GitHub Actions plus Windows 11 x86_64, macOS 13+ universal, Ubuntu 22.04/24.04 x86_64, Android 10+

**Project Type**: Cross-platform desktop/mobile application and release automation

**Performance Goals**: Preserve S019-S022 package size and startup budgets; add no runtime work

**Constraints**: No paid Windows or Apple trust dependency; no publication from pull requests; no private signing material in repository, logs, or artifacts; exactly eight distributable artifacts; post-release manual validation does not block v0.1.0

**Scale/Scope**: One release, four platform families, eight distributable artifacts, their governed evidence, and one publication transaction

## Constitution Check

_GATE: Passed before research and passed again after design._

| Principle | Application | Result |
| --- | --- | --- |
| P1 | Existing save-integrity tests remain mandatory | Pass |
| P2 | Release notes list only completed capability families | Pass |
| P3 | Package assembly and Android keys stay outside renderer code | Pass |
| P4 | All four promised platform families are governed | Pass |
| P5 | Versions, specification, changelog, notes, contracts, and workflow move together | Pass |
| P6 | Local validation precedes the PR; publication remains post-merge | Pass |

## Project Structure

```text
specs/023-community-release/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
.github/workflows/{release,windows-package,macos-package,linux-package,android-package}.yml
packaging/{windows,macos,linux,android}/
scripts/{check-community-release.mjs,check-community-release.test.mjs,check-release-readiness.ps1,check-version.ps1}
docs/{glitchpad-technical-specification.md,releases/}
package.json
Cargo.toml
CHANGELOG.md
```

**Structure Decision**: Extend existing release, packaging, and documentation authorities in place. A new cross-platform validator owns release invariants; platform validators remain responsible for artifact evidence.

## Complexity Tracking

No constitution violations require justification.
