# Implementation Plan: Ship macOS Package

**Branch**: `codex/020-macos-packaging` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/020-macos-packaging/spec.md`

## Summary

Deliver issue #63 as a distinct native-platform slice. S020 promotes the stable desktop association inventory out of the Windows package boundary, adds a macOS 13+ universal Tauri overlay and native open-document event ingress, builds one arm64/x86_64 DMG on an Apple Silicon runner, verifies the same DMG on native Apple Silicon and Intel runners, produces final-byte supply-chain evidence, and makes official Developer ID signing and notarization fail closed outside an authorized release context. Pull-request and branch candidates remain explicitly ad-hoc signed and non-notarized.

## Technical Context

**Language/Version**: Rust 1.96.0 (edition 2024), TypeScript 6.0.2, JavaScript on Node.js 24.11.0, POSIX shell on macOS, and GitHub Actions YAML

**Primary Dependencies**: Existing Tauri 2.11.x stack, WKWebView, macOS `RunEvent::Opened`, Apple `codesign`, `lipo`, `plutil`, `hdiutil`, `spctl`, `notarytool`, and `stapler`

**Storage**: Existing native delivery queue and application/recovery stores, governed JSON package contracts, ephemeral DMG staging, and uploaded candidate/evidence artifacts

**Testing**: Rust unit and desktop-delivery conformance tests, Node package-contract tests, shell safety tests, universal Tauri release build, DMG mount/copy/remove and native launch smoke on macOS 15 arm64 and Intel hosts, WKWebView/accessibility receipt validation, S018 size/startup measurement, and aggregate repository gates

**Target Platform**: macOS 13 or newer, arm64 and x86_64 in one universal application, distributed in one DMG; CI evidence uses current macOS 15 native arm64 and Intel runners

**Project Type**: Cross-platform Tauri desktop/mobile application with shared React interface, Rust native host, narrow platform packaging, repository tooling, and CI workflows

**Performance Goals**: DMG target at most 35 MiB and hard failure above 60 MiB; candidate cold startup is retained as hosted-smoke evidence and official reference-profile startup stays within the S018 desktop hard limit; open-document delivery reaches one active session exactly once

**Constraints**: No native path reaches interface state; only local file URLs enter native acquisition; no planned-format declaration; no publication from branch or pull-request contexts; ad-hoc candidates cannot satisfy official readiness; release credentials never enter repository artifacts or logs; local Windows execution stays inside the hidden Linux validation container

**Scale/Scope**: One universal DMG, two native architectures, four stable text families, one shared desktop capability inventory, one macOS open-document channel, one package evidence schema, and one clean-host lifecycle matrix

## Constitution Check

### Pre-design gate

- **P1 (file owns viewport)**: Pass. S020 changes native delivery and packaging only and adds no persistent application chrome.
- **P2 (local files remain local)**: Pass. Open-document acquisition, validation, and evidence remain local and content-free; no telemetry or remote document path is added.
- **P3 (cross-platform foundational)**: Pass. macOS owns package and event details while consuming the same path-private desktop source contract; the stable association inventory becomes shared instead of being copied from Windows.
- **P4 (untrusted input fails safely)**: Pass. Only file URLs become native paths, governed extensions remain a claim filter rather than a trust decision, and all content still enters bounded detection and acquisition.
- **P5 (specifications and releases move together)**: Pass. S020 is an unreleased Spec Kit delta and does not alter the official v0.0.0 version or publish a release.
- **P6 (verification precedes claims)**: Pass. Candidate and official states are distinct; native arm64 and Intel evidence, final-byte checks, and fail-closed Apple trust verification precede any official claim.
- **P7 (explicit and proportional decisions)**: Pass. The slice is limited to macOS packaging, the required open-document ingress, and a small correction that promotes S019's accidentally Windows-scoped capability inventory to its actual desktop authority.
- **P8 (license compatibility)**: Pass. No new runtime dependency or distributable third-party asset is introduced; license and notice material remains included and verified.

### Post-design gate

- All eight principles remain satisfied by the contracts below.
- The native event adapter converts only `file:` URLs, queues path-free results, and rejects every other scheme.
- Official mode requires live Apple verification over final bytes and cannot be simulated by fixture data or ad-hoc signing.
- Native-host evidence is split across Apple Silicon and Intel because architecture is a platform boundary, not inferred from universal metadata alone.
- No exception or complexity waiver is required.

## Project Structure

### Documentation (this feature)

```text
specs/020-macos-packaging/
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── desktop-delivery.md
│   └── macos-package-evidence.md
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
.github/workflows/
├── macos-package.yml
└── release.yml

packaging/
├── desktop/
│   └── capabilities.json
└── macos/
    ├── README.md
    ├── THIRD_PARTY_NOTICES.txt
    ├── clean-host-receipt.template.json
    └── package-contract.json

crates/glitchpad-host/
├── src/
│   ├── desktop_delivery.rs
│   └── lib.rs
└── tauri.s020-macos.conf.json

scripts/
├── check-macos-package.mjs
├── check-macos-package.test.mjs
├── generate-macos-sbom.mjs
├── generate-windows-sbom.mjs
├── validation-files.mjs
└── macos/
    ├── assemble-package.mjs
    └── test-package-lifecycle.mjs
```

**Structure Decision**: Keep macOS policy and evidence under `packaging/macos`, share only the stable desktop capability inventory, isolate native event conversion in the existing Rust host boundary, and use one native workflow for package construction plus both-architecture clean-host validation.

## Complexity Tracking

No constitution violations or complexity exceptions are required.
