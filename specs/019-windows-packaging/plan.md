# Implementation Plan: Ship Windows Packages

**Branch**: `codex/019-windows-packaging` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-windows-packaging/spec.md`

## Summary

Deliver issue #62 as the first platform-package slice. S019 adds a governed v0.1.0 text-family capability inventory, a native-only desktop delivery queue for initial command-line, association, secondary-instance, drag-and-drop, and dialog paths, interface integration that opens acquired summaries without exposing native paths, a current-user NSIS overlay and portable archive assembly, deterministic artifact/evidence validation, unsigned pull-request candidates, and a fail-closed official signing boundary. Windows-specific pre-PR validation runs on a pushed branch before the pull request is opened because the required MSVC/NSIS toolchain cannot run inside the mandated Linux-container desktop boundary.

## Technical Context

**Language/Version**: Rust 1.96.0 (edition 2024), TypeScript 6.0.2, JavaScript on Node.js 24.11.0, PowerShell 7.x for Windows artifact assembly, and GitHub Actions YAML

**Primary Dependencies**: Existing Tauri 2.11.x stack plus official Tauri dialog and single-instance plugins; existing React, source-host, persistence, recovery, metadata, performance, and package-validation surfaces

**Storage**: Process-local native delivery queue, existing application/recovery stores, governed JSON package contracts, ephemeral build staging, and uploaded CI candidates/evidence

**Testing**: Rust unit and desktop conformance tests, Vitest gateway/component tests, Node package-contract tests, PowerShell assembly tests, Tauri release build, NSIS silent install/uninstall smoke on Windows 11, portable smoke, accessibility checklist receipt, S018 artifact sizing, and aggregate repository gates

**Target Platform**: Windows 11 x86_64 with WebView2 Evergreen, current-user NSIS installation, and a portable ZIP; shared desktop delivery code must retain macOS/Linux compatibility

**Project Type**: Cross-platform Tauri desktop/mobile application with shared React interface, Rust native host, narrow platform packaging, repository tooling, and CI workflows

**Performance Goals**: NSIS and portable candidates each target at most 35 MiB and fail above 60 MiB; delivery reaches one existing session exactly once; Windows reference performance remains within S018 hard limits

**Constraints**: No native path reaches interface code; no shell interpretation of delivered paths; no administrator requirement; no planned-format claim; no publication from pull requests; signing credentials are absent from repository and logs; unsigned candidates cannot satisfy official readiness; non-Git desktop tools remain isolated in hidden Linux containers

**Scale/Scope**: Two Windows x86_64 artifact forms, four stable text families, the governed source-extension set, four native delivery channels plus initial/secondary process cases, one package evidence schema, and one clean-machine lifecycle matrix

## Constitution Check

### Pre-design gate

- **P1 (file owns viewport)**: Pass. S019 adds only compact file-open and print commands required for direct document interaction, with no permanent navigation surface.
- **P2 (local files remain local)**: Pass. Native acquisition, package validation, and lifecycle evidence remain local and content-free; no telemetry or upload path is added.
- **P3 (cross-platform foundational)**: Pass. Windows owns package details while desktop delivery uses the existing platform-independent source contract and does not encode Windows paths into interface state.
- **P4 (untrusted input fails safely)**: Pass. All delivery channels construct native acquisitions, preserve bounded reads and content detection, reject links/non-files, and never deserialize a renderer-provided path.
- **P5 (specifications and releases move together)**: Pass. S019 is an unreleased Spec Kit delta and does not change the official v0.0.0 capability claim or publish artifacts.
- **P6 (verification precedes claims)**: Pass. Candidate and official states are separate, every acceptance condition maps to automation or a content-free manual receipt, and branch-level Windows packaging must pass before pull-request publication.
- **P7 (explicit and proportional decisions)**: Pass. The slice adds only Windows packaging and the missing entry seams needed to test it; macOS, Linux, Android, generalized updates, and release activation remain out of scope.
- **P8 (license compatibility)**: Pass. New official Tauri plugins are Apache-2.0/MIT compatible; candidate inventories include the project license, notice, third-party notice, and CycloneDX evidence.
- **Technical constraints**: Pass. Tauri/Rust/TypeScript boundaries remain intact, project-owned Windows process launchers retain hidden/non-interactive behavior, text remains UTF-8 without BOM, and documentation uses no non-TB Mermaid flow.

### Post-design gate

Pass. The native delivery contract prevents path disclosure across all entry routes, the capability inventory makes association drift machine-detectable, the package contract distinguishes unsigned candidates from authorized signed artifacts, and remote branch validation is an explicit platform necessity rather than a substitute for tests after pull-request publication. No constitutional exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/019-windows-packaging/
├── checklists/requirements.md
├── contracts/
│   ├── desktop-delivery.md
│   └── windows-package-evidence.md
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
└── domain/
    ├── desktop-delivery-gateway.ts
    └── desktop-delivery-gateway.test.ts

crates/glitchpad-host/
├── Cargo.toml
├── tauri.s019-windows.conf.json
├── src/
│   ├── desktop_delivery.rs
│   ├── lib.rs
│   └── source/mod.rs
└── tests/desktop_delivery_conformance.rs

packaging/windows/
├── capabilities.json
├── package-contract.json
├── THIRD_PARTY_NOTICES.txt
└── README.md

scripts/
├── check-windows-package.mjs
├── check-windows-package.test.mjs
└── windows/
    ├── assemble-package.ps1
    └── test-assemble-package.ps1

.github/workflows/windows-package.yml
```

**Structure Decision**: Native delivery normalization, acquisition, deduplication, and queue ownership stay in the Rust host. The React interface receives only safe source summaries through one narrow gateway. Windows bundle policy lives in an explicit overlay so ordinary cross-platform debug builds remain unbundled. Repository tooling validates contracts without launching nested processes; Windows artifact assembly is a non-interactive PowerShell file-operation script run by the native package workflow.

## Complexity Tracking

No constitution violation requires justification.
