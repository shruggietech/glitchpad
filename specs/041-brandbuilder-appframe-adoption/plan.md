# Implementation Plan: BrandBuilder AppFrame Adoption

**Branch**: `codex/041-brandbuilder-appframe-adoption` | **Date**: 2026-09-19 | **Spec**: `specs/041-brandbuilder-appframe-adoption/spec.md`

## Summary

Import the exact CI-verified S042 Glitchpad kit, adopt its generated full-bleed AppFrame and dependency-free environment bridge at the React root, then prove the ownership contract in the actual Android WebView and Windows Tauri hosts. Preserve product-local shell behavior beneath the generated root and retain human repository instructions while installing the generated governance block.

## Technical Context

**Language/Version**: TypeScript/React 19, Rust stable, Kotlin/Android instrumentation

**Primary Dependencies**: Tauri 2, Vite, Vitest, AndroidX test, generated BrandBuilder Web/React adapter

**Storage**: Local files only, no new persistence

**Testing**: Vitest, static shell contract checks, Android instrumentation on API 24/API 36, Windows Tauri build/package smoke

**Target Platform**: Windows desktop and Android WebView, with shared browser renderer

**Project Type**: Cross-platform desktop/mobile application

**Constraints**: Offline core behavior, exact upstream artifact, one root web geometry owner, no identity changes, no browser substitute for host evidence

**Scale/Scope**: One production shell root, two host evidence classes, one complete governed brand kit

## Constitution Check

- P1 passes: AppFrame uses a full-bleed application-shell mode and preserves the document-first viewport.
- P2 passes: the generated adapter and recovery contract are local and introduce no runtime network dependency.
- P3 passes: shared TypeScript owns web geometry while Tauri host boundaries remain explicit.
- P4 passes: viewport and host geometry are treated as untrusted runtime capability input and bounded by tests.
- P5 passes: this unreleased change is recorded in Spec Kit and the changelog, with release reconciliation deferred to the mandatory release pass.
- P6 passes: each acceptance criterion maps to automated or explicit host evidence.
- P7 passes: the bounded adoption closes a measured upstream capability gap without redesigning the product shell.
- P8 passes: generated kit provenance and dependency boundaries remain documented and Apache-2.0 compatible.

## Architecture Decision

The generated AppFrame owns the web document root, safe-area variables, root scroll lock, and visual viewport/IME variables. Glitchpad owns its application shell inside that frame. Tauri owns native titlebar regions and reports capabilities without adding equivalent web padding. This avoids split or duplicate geometry authority.

## Project Structure

```text
apps/glitchpad/
  index.html
  src/App.tsx
  src/App.test.tsx
  src/main.tsx
  src/styles.css
brand/
  enforcement/
  web/react/
crates/glitchpad-host/gen/android/app/src/androidTest/
scripts/
  check-shell-layout.mjs
  check-windows-package.mjs
  run-android-instrumentation.sh
  sync-brand-kit.mjs
specs/041-brandbuilder-appframe-adoption/
```

## Delivery Order

1. Land or identify the successful upstream S042 verified-kit workflow artifact.
2. Import and verify the complete artifact with an immutable receipt.
3. Add failing consumer and host contract tests.
4. Adopt AppFrame and merge agent governance.
5. Run focused and aggregate checks, then publish the downstream PR.
6. Merge upstream first and downstream second after owner review.
