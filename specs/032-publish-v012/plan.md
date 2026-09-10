# Implementation Plan: Publish v0.1.2

**Branch**: `codex/032-publish-v0-1-2` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/032-publish-v012/spec.md`

## Summary

Promote the merged S029-S031 corrective work into a consistent v0.1.2 patch by updating active product and package identities, reconciling the technical specification and public release documentation, preserving the eight-package community trust model, and strengthening stale-version regression coverage. The pull request remains non-publishing; one owner-approved post-merge tag starts publication and the governed documentation deployment.

## Technical Context

**Language/Version**: Rust 1.96.0, TypeScript on Node.js 24.11+, JavaScript, PowerShell 7.5, YAML, JSON, Markdown

**Primary Dependencies**: Tauri 2.11.5, GitHub Actions, existing community-release and platform package validators

**Storage**: Versioned repository files, immutable GitHub release history, protected Android signing authority

**Testing**: Node test runner, Vitest, Rust workspace tests, cargo-deny, documentation validation, package-policy suites, platform candidate and lifecycle workflows, complete `cargo xtask check`

**Target Platform**: Windows 11 x86_64, macOS 13+ universal, Ubuntu 22.04-compatible Linux x86_64, Android API 24+

**Project Type**: Cross-platform desktop and Android application release automation

**Performance Goals**: Preserve existing release budgets; add no runtime work or package family

**Constraints**: Never mutate v0.1.0 or v0.1.1 history; never publish from a pull request or manual readiness run; preserve the stable Android key; introduce no paid signing requirement; retain exactly eight governed packages; keep physical-device validation post-release

**Scale/Scope**: One patch version, four platform workflows, eight packages, one release workflow, active version authorities, release documentation, and issue #157

## Constitution Check

_GATE: Passed before research and passed again after design._

| Principle | Application | Result |
| --- | --- | --- |
| P1 | S030 content-first corrections are released without new interface chrome | Pass |
| P2 | Release behavior remains local-only with no account, telemetry, or file upload | Pass |
| P3 | All four platform families and the shared package contract remain governed | Pass |
| P4 | Existing untrusted-input, save-integrity, sandbox, and package hardening boundaries remain unchanged | Pass |
| P5 | Product, specification, changelog, release metadata, tag, package, and public identities move together to 0.1.2 | Pass |
| P6 | Local gates, platform candidates, lifecycle checks, security review, and code review precede publication | Pass |
| P7 | The change is limited to corrective-release alignment and publication handoff | Pass |
| P8 | No dependency or license boundary is added; existing notices and provenance remain required | Pass |

## Project Structure

```text
specs/032-publish-v012/
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
├── docs.yml
├── linux-package.yml
├── macos-package.yml
├── release.yml
└── windows-package.yml
docs/
├── glitchpad-technical-specification.md
└── releases/
    ├── v0.1.2.md
    ├── v0.1.2-operator-runbook.md
    └── v0.1.2-receipt.md
packaging/
├── android/package-contract.json
├── linux/package-contract.json
├── macos/package-contract.json
├── release/package-contract.json
└── windows/package-contract.json
scripts/
├── assemble-community-release.mjs
├── check-community-release.mjs
├── check-public-release.mjs
├── check-release-readiness.ps1
└── check-version.ps1
site/
├── app/
├── components/
├── content/
└── tests/
```

**Structure Decision**: Update the existing governed release system in place and add version-specific v0.1.2 handoff documentation. Historical release documents and completed specifications remain unchanged.

## Complexity Tracking

No constitution violations require justification.
