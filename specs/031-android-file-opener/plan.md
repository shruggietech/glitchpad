# Implementation Plan: Android File Opener Correction

**Branch**: `codex/031-android-file-opener` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

## Summary

Replace the flattened Android intent inventory with explicit resolver-filter groups, correct the main activity's exact-type `ACTION_VIEW` declarations for opaque content URIs, connect the native delivery queue to the frontend through a permission-scoped plugin event and bounded materialization gateway, define a bounded generic-provider policy, exercise installed-package resolution and cold/warm delivery on API 24 and API 36, validate equivalent universal and ARM64 final manifests, and record the v0.1.2 behavior delta.

## Technical Context

**Language/Version**: Kotlin/JVM 1.8 target, Java 17 build runtime, TypeScript/Node.js 24 package validation, Rust 1.96 and TypeScript 6.0 for existing host and renderer verification

**Primary Dependencies**: Android SDK 36 with minimum SDK 24, AndroidX Test 1.6, Espresso 3.6, Tauri 2.11, Android package manager, existing controlled DocumentsProvider fixtures

**Storage**: Existing scoped `content://` grants and private restoration records; no new storage

**Testing**: Node package-contract tests, Android local unit tests, installed-package instrumentation on API 24 and API 36, final universal and ARM64 APK inventory comparison, complete repository gate

**Target Platform**: Android 7.0/API 24 through Android 16/API 36; universal and ARM64 v0.1.2 packages

**Project Type**: Tauri desktop/mobile application with a narrow Kotlin Android source bridge

**Performance Goals**: Resolver matrix completes within the existing instrumentation job budget; cold and warm delivery reach visible fixture evidence within 30 seconds per delivery

**Constraints**: No wildcard or broad media family, `file://`, broad storage permission, unsupported format claim, private-data diagnostic, new runtime dependency, manual validation gate, product version change, or release publication

**Scale/Scope**: One P0 issue (#159), one manifest, one machine-readable intent policy, one package parser/validator, controlled Android fixtures and instrumentation, two API levels, two final APK roles, one release-delta update

## Constitution Check

_GATE: Passed before research and passed again after design._

| Principle | Application | Result |
| --- | --- | --- |
| P1 | Restores the operating-system path that puts the requested file directly in the viewport | Pass |
| P2 | Uses local provider URIs and synthetic offline fixtures with no account, telemetry, or upload | Pass |
| P3 | Models Android content URIs and lifecycle delivery directly at the native platform boundary | Pass |
| P4 | Retains scoped grants, explicit types, negative resolver cases, and bounded diagnostics | Pass |
| P5 | Records an unreleased v0.1.2 delta without changing current release authority | Pass |
| P6 | Requires package-manager, visible-delivery, final-manifest, platform, and repository gates before publication | Pass |
| P7 | Corrects the existing manifest and package harness without generalized file-association infrastructure | Pass |
| P8 | Adds no dependency or distributable asset | Pass |

## Project Structure

```text
specs/031-android-file-opener/
├── checklists/requirements.md
├── contracts/android-file-opener.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
├── tasks.md
└── verification.md
packaging/android/intent-map.json
crates/glitchpad-host/gen/android/app/src/
├── main/AndroidManifest.xml
└── androidTest/
    ├── AndroidManifest.xml
    └── java/com/shruggietech/glitchpad/source/
        ├── AndroidDeliveryInstrumentedTest.kt
        ├── AndroidResolverInstrumentedTest.kt
        └── FixtureDocumentsProvider.java
scripts/
├── check-android-package.mjs
└── check-android-package.test.mjs
.github/workflows/
├── android-package.yml
└── ci.yml
docs/releases/v0.1.2.md
```

**Structure Decision**: Correct the established Android manifest and controlled-provider test boundary in place. Add the missing Android frontend delivery gateway beside the existing restoration gateway, use Tauri's permission-scoped mobile plugin event with a legacy-WebView fallback drain, and isolate the MainActivity delivery proof from provider tests because AndroidX closes activities after every test. Preserve both grouped filter semantics and aggregate inventory in package evidence so policy can detect Android's cross-element merging without replacing the existing release pipeline.

## Complexity Tracking

No constitution violations require justification.
