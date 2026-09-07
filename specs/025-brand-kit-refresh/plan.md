# Implementation Plan: Brand Kit Refresh

**Branch**: `codex/025-brand-kit-refresh` | **Date**: 2026-09-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/025-brand-kit-refresh/spec.md`

## Summary

Replace the obsolete canon 1.0.0 Glitchpad delivery with the verified brand 1.1.0/canon 1.2.1 kit published for upstream commit `1681fcd`, propagate approved assets to every repository, site, desktop, and Android consumer, and strengthen validation so release packaging cannot regress to foundation resources.

## Technical Context

**Language/Version**: Existing Node.js 24, TypeScript, Rust, JSON, CSS, SVG, Android XML, and binary platform assets

**Primary Dependencies**: Existing Tauri packaging, Next.js public site, Node validation scripts, and the upstream manifest and platform icon manifests

**Storage**: Versioned repository files only

**Testing**: Brand integrity checks, Node unit checks, site build/browser checks, Android package checks, platform packaging checks, and `cargo xtask check`

**Target Platform**: GitHub renderers, modern browsers, Windows, macOS, Linux, and Android

**Project Type**: Existing cross-platform desktop/mobile application and static documentation site

**Performance Goals**: No material runtime or bundle-size regression beyond replacement first-party assets

**Constraints**: Exact upstream asset bytes; one documented README link correction for the embedded repository layout; no local asset generation; no paid signing changes; no capability or release publication changes; UTF-8 without BOM; hidden Docker validation only

**Scale/Scope**: One complete brand delivery, repository/site identity copies, four platform icon integrations, validation, and provenance documentation

## Constitution Check

| Principle | Result | Evidence |
| --- | --- | --- |
| P1. The file owns the viewport | PASS | Only identity tokens and assets change; application layout and document priority remain unchanged. |
| P2. Local files remain local | PASS | All assets are bundled first-party files with no runtime network dependency. |
| P3. Cross-platform behavior is foundational | PASS | Windows, macOS, Linux, and Android packaging inputs update together. |
| P4. Untrusted input fails safely | PASS | No document parsing or native capability changes are introduced. |
| P5. Specifications and releases move together | PASS | S025 records an unreleased brand delta and leaves publication to the release slice. |
| P6. Verification precedes claims | PASS | Focused and aggregate checks run before push and PR publication. |
| P7. Decisions are explicit and proportional | PASS | The plan replaces one governed delivery and its direct consumers only. |
| P8. Apache-2.0 and license compatibility | PASS | The verified delivery includes font licenses, brand terms, provenance, and manifest checksums. |

Post-design review remains PASS with no exceptions.

## Project Structure

```text
brand/                                      # complete verified upstream delivery and project receipt
site/public/                                # exact website identity copies
crates/glitchpad-host/icons/                # exact desktop and Android packaging copies
crates/glitchpad-host/gen/android/app/src/main/res/
scripts/check-brand.mjs                     # delivery and integration enforcement
scripts/check-brand.test.mjs                # validator regressions
specs/025-brand-kit-refresh/                 # S025 authority and evidence
```

**Structure Decision**: Preserve the existing canonical `brand/` boundary and explicit project copies. The upstream delivery remains immutable, while the project-owned receipt and validation script describe and enforce integration.

## Complexity Tracking

No constitution violations require justification.
