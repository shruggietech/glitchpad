# Implementation Plan: Ship Android Packages

**Branch**: `codex/022-android-packaging` | **Date**: 2026-09-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/022-android-packaging/spec.md`

## Summary

Deliver issue #65 as the final platform packaging slice before v0.1.0 release assembly. S022 adds a governed Android package contract, truthful text-family intent declarations, release signing configuration, universal and ARM64 APK plus AAB build paths, canonical final-byte assembly, package inspection, checksums, Android-inclusive CycloneDX output, provenance, candidate-versus-official authority handling, and a reusable hidden Linux Android toolchain. Manual and physical-device validation is documented as post-release and is not a completion gate.

## Technical Context

**Language/Version**: Rust 1.96.0, TypeScript 5.9.3, Node.js 24.11.0, Kotlin 2.2.20, Java 17

**Primary Dependencies**: Tauri 2.11.1/CLI 2.11.4, Android Gradle Plugin 8.11.0, Gradle 8.14.3, Android SDK Platform 36, Build Tools 36.0.0, NDK 28.2.13676358, bundletool 1.18.3

**Storage**: Final candidates under ignored `artifacts/android/`; signing inputs under runner/container temporary storage and ignored `gen/android/keystore.properties`; no user document storage changes

**Testing**: Node contract and mutation tests for package policy, manifest parsing, ABI inventory, signing classification, assembly, checksums, SBOM, and provenance; Gradle Kotlin unit tests; actual release APK/AAB construction and Android-native artifact inspection; existing Rust/frontend/documentation/security gates

**Target Platform**: Android 7.0/API 24 minimum, API 36 target, ARM64 direct delivery, ARM64+x86_64 universal delivery, Google Play AAB

**Project Type**: Cross-platform Tauri application with a generated Android host and private Kotlin source plugin

**Performance Goals**: Universal APK at or below 40 MiB target and 65 MiB hard limit; deterministic evidence generation for three artifacts; no repeated Android toolchain installation during local validation

**Constraints**: Offline product behavior; no broad storage permission; stable text-family intents only; no raw URI or document content in evidence; final-byte checksums after signing; secrets remain outside source and logs; branch candidates cannot claim official authority; local Windows execution remains inside the approved hidden Docker launcher

**Scale/Scope**: Three Android artifact roles, two native ABIs, one package identity, one stable intent map, one candidate signing path, one official signing boundary, and issue #65 only

## Constitution Check

### Pre-design gate

- **P1 (file owns viewport)**: Pass. S022 changes packaging and Android declarations only and adds no permanent interface chrome.
- **P2 (local files remain local)**: Pass. Package construction and evidence contain no user document content, account, telemetry, or network-dependent runtime behavior.
- **P3 (cross-platform foundation)**: Pass. Android receives native package delivery around the existing provider-native source adapter while the shared renderer and document contracts remain unchanged.
- **P4 (untrusted input fails safely)**: Pass. Intent filters remain allowlisted, require provider-oriented content delivery, request no broad storage permission, and do not broaden native capabilities.
- **P5 (specifications and releases move together)**: Pass. S022 is an unreleased Spec Kit delta. S023 owns the mandatory canonical documentation and version reconciliation before tagging.
- **P6 (verification precedes claims)**: Pass. Automated build, artifact, intent, ABI, signature-path, checksum, SBOM, provenance, dependency, documentation, and encoding checks precede merge. Manual and physical-device claims are not made by S022 and are explicitly deferred under the current issue authority.
- **P7 (explicit and proportional decisions)**: Pass. The slice is limited to Android packaging and its direct repository integration. Post-release behavior validation and release publication remain separate.
- **P8 (Apache-2.0 compatibility)**: Pass. Android runtime dependencies join the SBOM, distributed notices accompany artifacts, and signing/build tools are pinned without being bundled as application code.

### Post-design gate

The design passes all eight principles. Deferring manual validation changes the prior release-evidence plan but does not create a hidden claim: S022 records the product-owner decision, retains automated artifact checks, labels pull-request artifacts as non-official, and assigns canonical documentation reconciliation to S023. No constitutional exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/022-android-packaging/
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── android-intent-surface.md
│   └── android-package-evidence.md
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
├── android-package.yml
└── release.yml

crates/glitchpad-host/
├── gen/android/app/
│   ├── build.gradle.kts
│   └── src/main/AndroidManifest.xml
└── tauri.s022-android.conf.json

packaging/android/
├── README.md
├── THIRD_PARTY_NOTICES.txt
├── intent-map.json
└── package-contract.json

scripts/
├── android/assemble-package.mjs
├── android/assemble-package.test.mjs
├── check-android-package.mjs
├── check-android-package.test.mjs
├── docker/validation.Dockerfile
└── generate-android-sbom.mjs
```

**Structure Decision**: Follow the established Windows/macOS/Linux package-family layout. Keep Android policy in `packaging/android`, final-byte transforms under `scripts/android`, cross-contract validation at `scripts/check-android-package.mjs`, platform overlay configuration beside the existing Tauri configs, and CI delivery in a dedicated workflow.

## Complexity Tracking

No constitutional violations require justification.
