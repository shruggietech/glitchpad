# Implementation Plan: Ship Linux Packages

**Branch**: `codex/021-linux-packaging` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/021-linux-packaging/spec.md`

## Summary

Deliver issue #64 as the governed Linux package slice. S021 builds x86_64 AppImage and Debian candidates against a reproducible Ubuntu 22.04 baseline, validates freedesktop desktop/MIME/icon integration against the shared stable capability inventory, binds final bytes to checksums, a CycloneDX SBOM, provenance and closed clean-environment receipts, and exercises both package forms on clean Ubuntu 22.04 and Ubuntu 24.04 environments. Branch and pull-request candidates remain explicitly non-official; repository attestation and publication stay fail-closed behind the release authority boundary.

## Technical Context

**Language/Version**: Rust 1.96.0, TypeScript 5.9.3, Node.js 24.11.0, pnpm 10.28.2, POSIX shell

**Primary Dependencies**: Tauri 2.11.1/CLI 2.11.4, WebKitGTK 4.1, GTK 3, Ayatana AppIndicator, freedesktop desktop-entry/shared-MIME/icon databases, AppImage tooling, dpkg

**Storage**: Native files through the established desktop source boundary; package-owned files under standard Linux prefixes; user preferences and recovery data remain under existing per-user application data conventions

**Testing**: Node test runner for package contracts and assembly, Cargo host and conformance tests, Vitest interface contracts, desktop-file and MIME validation, dpkg inventory/dependency inspection, ELF/glibc inspection, clean-container Xvfb/DBus lifecycle smoke, existing documentation/security/performance gates

**Target Platform**: Linux x86_64, built against Ubuntu 22.04/glibc baseline and exercised on clean Ubuntu 22.04 and Ubuntu 24.04 environments with WebKitGTK 4.1

**Project Type**: Cross-platform desktop application with Linux package and CI delivery infrastructure

**Performance Goals**: Preserve the S018 35 MiB compressed target and 60 MiB hard limit per artifact; preserve the S018 desktop startup reference budget; enforce a 10-second hosted-smoke hard stop without relabeling hosted samples as reference evidence

**Constraints**: Offline application behavior; no bundled browser engine; no planned-format association; no shell interpretation of file arguments; no interface-visible native path; final-byte evidence only; no publication from branch or pull-request contexts; no secrets in artifacts or logs; local Windows execution stays inside hidden Linux containers

**Scale/Scope**: One x86_64 AppImage, one x86_64 Debian package, one stable capability inventory, two clean-environment baselines, two package forms, and issue #64 only

## Constitution Check

### Pre-design gate

- **P1 (file owns viewport)**: Pass. S021 adds delivery and native lifecycle evidence without persistent interface chrome.
- **P2 (local files remain local)**: Pass. Package build, validation, and runtime require no content upload, account, telemetry, or remote service.
- **P3 (cross-platform foundation)**: Pass. Linux receives its native packaging and freedesktop adapter evidence while retaining the shared source and renderer contracts.
- **P4 (untrusted input fails safely)**: Pass. Desktop and file-manager delivery enter the existing native acquisition boundary, package declarations are allowlisted, and native paths remain out of interface state and receipts.
- **P5 (specifications and releases move together)**: Pass. S021 is an unreleased Spec Kit delta with changelog and release-boundary updates; canonical v0.1.0 reconciliation remains issue #67.
- **P6 (verification precedes claims)**: Pass. Unit, contract, package, baseline, clean-environment, accessibility, performance, security, and documentation evidence precede pull-request publication.
- **P7 (explicit and proportional decisions)**: Pass. The slice adds only Linux package delivery and evidence. Android packaging and final release activation remain out of scope.
- **P8 (Apache-2.0 compatibility)**: Pass. Both packages contain license and notice material, SBOM generation remains locked-input based, and dependency policy rejects incompatible or undeclared bundled components.

### Post-design gate

The design passes all eight principles. The pinned Ubuntu 22.04 build target deliberately avoids depending on the hosted `ubuntu-22.04` label, whose announced retirement would otherwise break the declared binary baseline. Clean Ubuntu 22.04 and Ubuntu 24.04 lifecycle environments keep compatibility evidence independent of the build container. No constitutional exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/021-linux-packaging/
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── linux-desktop-integration.md
│   └── linux-package-evidence.md
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
.github/
├── labeler.yml
└── workflows/
    ├── linux-package.yml
    └── release.yml

crates/glitchpad-host/
├── linux/
│   └── glitchpad.desktop.hbs
└── tauri.s021-linux.conf.json

packaging/
├── desktop/capabilities.json
└── linux/
    ├── README.md
    ├── THIRD_PARTY_NOTICES.txt
    ├── clean-environment-receipt.template.json
    ├── mime-map.json
    └── package-contract.json

scripts/
├── check-linux-package.mjs
├── check-linux-package.test.mjs
├── docker/validation.Dockerfile
├── generate-linux-sbom.mjs
└── linux/
    ├── assemble-package.mjs
    ├── assemble-package.test.mjs
    ├── test-package-lifecycle.mjs
    └── test-package-lifecycle.test.mjs
```

**Structure Decision**: Keep Linux policy and evidence beside the existing Windows/macOS packaging families. Reuse the established desktop delivery queue and generic desktop SBOM generator, add only a thin Linux wrapper, and isolate baseline construction plus clean-environment commands in a named Ubuntu 22.04 target of the existing validation Dockerfile.

## Complexity Tracking

No constitutional violations require justification.
