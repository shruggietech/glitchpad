# Verification Evidence: Repository Foundation

**Date**: 2026-08-30

## Completed local gates

| Gate | Result |
| --- | --- |
| Frozen pnpm install | Passed; `pnpm-lock.yaml` SHA-256 remained `E2C68373144606B3D11F737C3D845D4C1933F931C592009D2FD3E535B06B774B` |
| Locked Cargo test graph | Passed; `Cargo.lock` SHA-256 remained `028C2B2831DEC6063FA36DE5D2E87BCB94A8777D1319879419163967DB2BCDB1` |
| Rust formatting, Clippy, unit tests, and doctests | Passed on Windows with Rust 1.96.0 |
| Cargo advisories, licenses, sources, and dependency policy | Passed with the reviewed Tauri transitive exceptions in `deny.toml` |
| ESLint, TypeScript, Vitest, and Vite production build | Passed with Node.js 24.11.0 and pnpm 10.28.2 |
| JSON, YAML, and TOML parse validation | Passed |
| Prettier and markdownlint | Passed with one physical line per prose paragraph |
| Link validation | Passed across 40 project-authored Markdown files |
| Mermaid validation | Parsed and rendered 16 diagrams; project-authored flowcharts use top-to-bottom direction |
| Encoding validation | Passed across 173 text files as UTF-8 without BOM or common mojibake markers |
| Version and public-surface validation | Passed at v0.0.0 |
| Windows Tauri development build | Passed; distribution bundling remained disabled |
| Initial snapshot scan | Passed with no prohibited artifact, signing file, local SDK path, private-key marker, token marker, or configured remote |

## Android evidence

Tauri generated the Android Studio project with application ID `com.shruggietech.glitchpad`, compile and target SDK 36, minimum SDK 24, NDK 28.2.13676358, and all four Rust Android targets installed locally. The aarch64 Rust host library compiled and linked successfully through the Tauri Android command.

The local Gradle packaging process did not complete because this Windows host rejected Gradle's loopback connection before project configuration. The repository CI uses Temurin 17 on Ubuntu, installs the pinned SDK and NDK, builds the aarch64 validation APK with a transient package-version override, and uploads that ignored APK for seven days. The first official binary version remains v0.1.0; no v0.0.0 package or signing material exists.

## Release boundary

The release workflow is read-only and fail-closed. Version 0.0.0 cannot publish artifacts, and later versions require matching tags, an approved brand kit, a release receipt, the complete verification matrix, and separate reviewed authorization for signing and publication.
