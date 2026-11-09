<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="brand/logos/png/glitchpad-horizontal-color-1024.png">
  <img src="brand/logos/png/glitchpad-horizontal-light-1024.png" alt="Glitchpad" width="480">
</picture>

# Glitchpad

**A fast, cross-platform viewer and editor for local files.**

[![CI](https://github.com/ShruggieTech/glitchpad/actions/workflows/ci.yml/badge.svg)](https://github.com/ShruggieTech/glitchpad/actions/workflows/ci.yml) [![CodeQL](https://github.com/ShruggieTech/glitchpad/actions/workflows/codeql.yml/badge.svg)](https://github.com/ShruggieTech/glitchpad/actions/workflows/codeql.yml) [![Version](https://img.shields.io/badge/version-0.3.0-6f42c1)](https://github.com/ShruggieTech/glitchpad/releases) [![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE) [![Status](https://img.shields.io/badge/status-community%20release-green)](#status)

</div>

Glitchpad is a minimal desktop and Android application for opening, inspecting, viewing, and selectively editing common local file formats. The interface stays out of the way so attention remains on the active file, while compact tabs make related files easy to keep together.

## Status

Glitchpad v0.2.1 defines the S046/S047 product recovery release: Android New/Open/edit/save/copy/recovery, a compact document shell, truthful document tools, useful inert SVG handling, and verified diagnostic export. It retains bounded image and text-family capabilities. Download the [latest published release](https://github.com/ShruggieTech/glitchpad/releases/latest); the source version alone does not establish publication. Windows packages are unsigned, and macOS is ad-hoc signed and not notarized. See the [release notes](docs/releases/v0.2.1.md) and [preparation receipt](docs/releases/v0.2.1-receipt.md).

Specification and product versions move together. Published releases retain their immutable historical receipts, and each release requires documentation reconciliation and current package/runtime evidence.

## Current and planned capabilities

- Markdown viewing and in-place editing, including Mermaid diagram source, preview, and validation.
- Plain-text and supported source-code viewing and editing with language detection and syntax highlighting.
- Image viewing and inspection, including WebP, SVG, animation and multi-image ICO containers.
- Planned: PDF viewing with page navigation, document outlines, search, and metadata.
- Planned: DOCX and OpenDocument viewing through a safe, read-only rendering pipeline.
- A compact metadata inspector for supported text-family filesystem and document properties; image metadata is included with explicit GPS/location reveal.
- Small, keyboard-friendly tabs without workspace or project-management UI.

Capability claims are promoted from planned to implemented only after their specification, implementation, tests, and platform evidence land together.

## Supported platforms

| Platform | v0.2.1 baseline | Distribution status |
| --- | --- | --- |
| Windows 11 x86_64 | Tauri desktop host | Unsigned NSIS installer and portable ZIP |
| macOS 13+ universal | Tauri desktop host | Ad-hoc-signed application in a non-notarized DMG |
| Ubuntu 22.04/24.04 x86_64 | Tauri desktop host | Repository-attested AppImage and Debian package |
| Android 7.0+ | Tauri Android host | Stable-project-key universal APK, ARM64 APK, and AAB |

Platform support is evidence-based. A platform becomes supported for a release only when its build, smoke-test, packaging, and documentation gates pass for that release.

## Android document tasks

Use Add document for New Markdown, New text file or Open file. New drafts are editable local documents. Save selects a destination; read-only sources offer Edit a copy, and providers without truthful replacement support use Save As. Cancellation or a failed write keeps the draft dirty. Complete text, including its final newline, is retained by bounded process recovery without inventing a source grant.

Document tools holds actions for the current file; Menu holds Preferences, Diagnostics, Help and About. Back dismisses the keyboard or top temporary layer before document navigation. Unsupported previews explain their cause while retaining available source/details access. Diagnostics lets you inspect one frozen redacted preview before native Save or Share.

Android 7/API24 is the minimum OS baseline; Chromium 69-class WebView is the minimum qualified compatibility profile. Actual API24/API36 WebView versions and package-specific task evidence belong to the [release receipt](docs/releases/v0.2.1-receipt.md).

## Development

The shared toolchain is Rust 1.96.0, Node.js 24.11.0, pnpm 10.28.2, PowerShell 7, and Git. Desktop and Android builds add the platform SDKs described in [CONTRIBUTING.md](CONTRIBUTING.md).

```powershell
corepack prepare pnpm@10.28.2 --activate
pnpm install --frozen-lockfile
cargo xtask doctor
cargo xtask check
pnpm tauri dev
```

`cargo xtask check` is the local authority for native checks, frontend checks, documentation validation, brand-canon integrity, website export validation, version consistency, strict UTF-8, Mermaid direction, and public metadata. Run `pnpm check:brand` for the focused brand contract and `pnpm check:site` for the production-equivalent public site.

## Architecture

Glitchpad keeps file interpretation and product behavior independent from platform hosts. The React application provides the shared presentation layer, Tauri provides narrow desktop and Android integration, and Rust owns trusted file and document processing.

```mermaid
flowchart TB
    User[User opens a local file]
    App[Shared React application]
    Host[Tauri desktop or Android host]
    Core[Platform-independent Rust core]
    Adapter[Format adapter]
    View[Viewer or editor surface]

    User --> App
    App --> Host
    Host --> Core
    Core --> Adapter
    Adapter --> View
```

The repository is organized as follows:

- `apps/glitchpad`: shared React application and component tests.
- `crates/glitchpad-core`: platform-independent Rust domain core.
- `crates/glitchpad-host`: Tauri desktop and Android host boundary.
- `crates/xtask`: cross-platform contributor and CI commands.
- `docs`: normative technical documentation.
- `brand`: approved brand canon, governed assets, and integration guidance.
- `site`: the static-exported Glitchpad landing page and public documentation application.
- `specs`: Spec Kit feature specifications, plans, contracts, and tasks.
- `fixtures`: safe document fixtures for format, corruption, and hostile-input testing.

The normative architecture, security model, capability rules, and release requirements live in [the technical specification](docs/glitchpad-technical-specification.md).

## Security and privacy

Glitchpad is local-first. Documents remain on the device unless a future feature explicitly states otherwise and receives its own security review. File content is untrusted input, active content is disabled by default, and host permissions remain deny-by-default.

Do not report vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md) to submit a private report.

## Contributing

Contributions are welcome after the foundation requirements in [CONTRIBUTING.md](CONTRIBUTING.md) are understood. All product changes begin with Spec Kit artifacts, include tests appropriate to their risk, and update the technical specification in the same change when behavior or architecture changes.

For usage questions and design discussions, see [SUPPORT.md](SUPPORT.md). Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Glitchpad is licensed under the [Apache License, Version 2.0](LICENSE). See [NOTICE](NOTICE) for attribution information.

Copyright 2026 ShruggieTech.
