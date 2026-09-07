# Implementation Plan: v0.1.0 Release Publication

**Branch**: `codex/026-v010-release` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

## Summary

Finish the reviewed v0.1.0 handoff by adding a fail-closed Android secret-presence gate to the existing non-publishing readiness job, extending release-policy tests to enforce the gate, and updating the runbook and receipt through S026. The tag and public release remain prohibited until owner approval and merge.

## Technical Context

**Language/Version**: YAML, POSIX shell, JavaScript on Node.js 24.11+, Markdown

**Primary Dependencies**: GitHub Actions, existing community-release validator, Node test runner

**Storage**: Versioned repository files and protected GitHub Actions repository secrets

**Testing**: Node test runner, community-release policy check, documentation gates, complete `cargo xtask check`

**Target Platform**: GitHub Actions release automation for Windows, macOS, Linux, and Android packages

**Project Type**: Cross-platform application release automation

**Performance Goals**: Add less than one minute to readiness and no runtime application work

**Constraints**: Never expose secret values; never publish from a pull request or manual readiness dispatch; require no paid signing program; preserve exactly eight governed packages

**Scale/Scope**: One release workflow, five secret names, one runbook, one receipt, and the S026 Spec Kit artifacts

## Constitution Check

_GATE: Passed before research and passed again after design._

| Principle | Application | Result |
| --- | --- | --- |
| P1-P4 | No runtime or file-interaction behavior changes | Pass |
| P5 | Release metadata, receipt, workflow, and tag boundary remain consistent | Pass |
| P6 | Automated secret-presence and repository gates precede publication claims | Pass |
| P7 | Scope is limited to the final release handoff | Pass |
| P8 | No dependency or licensing change is introduced | Pass |

## Project Structure

```text
specs/026-v010-release/
├── checklists/requirements.md
├── contracts/readiness-contract.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
├── tasks.md
└── verification.md
.github/workflows/release.yml
scripts/check-community-release.mjs
scripts/check-community-release.test.mjs
docs/releases/v0.1.0-operator-runbook.md
docs/releases/v0.1.0-receipt.md
```

**Structure Decision**: Harden the existing S023 release path in place. No new release system, credential store, runtime component, or publication event is introduced.

## Complexity Tracking

No constitution violations require justification.
