# Implementation Plan: v0.1.1 Corrective Release

**Branch**: `codex/028-v011-release` | **Date**: 2026-09-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/028-v011-release/spec.md`

## Summary

Promote the merged S027 content-first correction into a consistent v0.1.1 patch release by updating active product and package identities, reconciling the technical specification and public release documentation, preserving the eight-package community trust model, strengthening stale-version regression coverage, and applying the existing S024 time-bounded disposition to the remaining transitive `glib` advisory. The pull request remains non-publishing; one owner-approved post-merge tag starts publication.

## Technical Context

**Language/Version**: Rust 1.96.0, TypeScript on Node.js 24.11+, JavaScript, PowerShell 7.5, YAML, JSON, Markdown

**Primary Dependencies**: Tauri 2.11.5, GitHub Actions, existing community-release and platform package validators

**Storage**: Versioned repository files, immutable GitHub release history, protected Android signing authority

**Testing**: Node test runner, Vitest, Rust workspace tests, cargo-deny, documentation validation, package-policy suites, platform candidate and lifecycle workflows, complete `cargo xtask check`

**Target Platform**: Windows 11 x86_64, macOS 13+ universal, Ubuntu 22.04-compatible Linux x86_64, Android API 24+

**Project Type**: Cross-platform desktop and Android application release automation

**Performance Goals**: Preserve all existing release performance budgets; add no runtime work and no additional package family

**Constraints**: Never mutate v0.1.0 history; never publish from a pull request or manual readiness run; preserve the stable Android key; introduce no paid signing requirement; do not force an incompatible GTK dependency graph; retain exactly eight governed application packages

**Scale/Scope**: One patch version, four platform workflows, eight packages, one release workflow, active version authorities, release documentation, issue #149, and one existing advisory disposition

## Constitution Check

_GATE: Passed before research and passed again after design._

| Principle | Application | Result |
| --- | --- | --- |
| P1 | S027 content-first behavior is preserved; S028 adds no interface chrome | Pass |
| P2 | Release behavior remains local-only with no account, telemetry, or file upload | Pass |
| P3 | All four platform families and the shared package contract remain governed | Pass |
| P4 | Existing untrusted-input, save-integrity, sandbox, and package hardening boundaries remain unchanged | Pass |
| P5 | Product, specification, changelog, release metadata, tag, and package identities move together to 0.1.1 | Pass |
| P6 | Local repository gates, platform candidates, lifecycle checks, and review precede publication | Pass |
| P7 | The change is limited to patch-release alignment and the already-approved advisory decision | Pass |
| P8 | No new dependency is introduced; the existing advisory exception remains explicit and time-bounded | Pass |

## Project Structure

```text
specs/028-v011-release/
├── checklists/requirements.md
├── contracts/release-handoff.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
├── tasks.md
└── verification.md
.github/workflows/
├── android-package.yml
├── linux-package.yml
├── macos-package.yml
├── release.yml
└── windows-package.yml
docs/
├── glitchpad-technical-specification.md
└── releases/
    ├── v0.1.1.md
    ├── v0.1.1-operator-runbook.md
    └── v0.1.1-receipt.md
packaging/
├── android/package-contract.json
├── linux/package-contract.json
├── macos/package-contract.json
├── release/package-contract.json
└── windows/package-contract.json
scripts/
├── assemble-community-release.mjs
├── check-community-release.mjs
├── check-release-readiness.ps1
└── check-version.ps1
```

**Structure Decision**: Update the existing governed release system in place and add version-specific v0.1.1 documentation. Historical v0.1.0 documentation and completed specifications remain unchanged.

## Complexity Tracking

No constitution violations require justification.
