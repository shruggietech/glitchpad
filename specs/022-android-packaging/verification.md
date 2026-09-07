# Verification: Ship Android Packages

**Date**: 2026-09-06

**Scope**: Automated pre-pull-request verification for S022 and issue #65. Manual, physical-device, TalkBack, touch, rotation, background/restore, low-memory, and real-world provider validation remain explicitly deferred until after v0.1.0 publication.

## Package receipts

The reusable `android-package` validation image built the release host with Android SDK Platform 36, Build Tools 36.0.0, NDK 28.2.13676358, Java 17, bundletool 1.18.3, Rust ARM64, and Rust x86_64 support. The first cold build identified and corrected a missing native compiler dependency in the image before pull-request publication.

| Role | Final candidate size | SHA-256 | ABI inventory |
| --- | --: | --- | --- |
| Universal APK | 25,167,916 bytes | `9af8329155eb85e6c16a4435dfee765f46067b0cb7bd42ab77aaba18decd3499` | `arm64-v8a`, `x86_64` |
| ARM64 APK | 14,259,720 bytes | `dc5f1cde85d9730f2e2cc169fa7bfce099f339924f455be176431f643a01c7e5` | `arm64-v8a` |
| Play AAB | 13,002,564 bytes | `a5172c198a04d19a8fdeef2a28565ff3c629a276630705e27cd085a74ec964d1` | `arm64-v8a`, `x86_64` |

All three candidates verified against disposable certificate SHA-256 `5805D9C8560F625DC6BAD7C785306C80BD1CA80A57C2D40E36E938A40063D1C1`. Candidate authority is marked `blocked_candidate` and cannot satisfy official publication authority. The universal APK is within the 40 MiB target.

## Automated gates

- `pnpm run check:android-package` passed 13 package, assembly, signing, manifest, ABI, posture, evidence-mutation, and Android SBOM tests plus the source-manifest policy gate.
- Both Tauri Android release builds completed successfully and produced the universal APK, ARM64 APK, and universal AAB from the same working tree.
- Final-byte inspection passed application identifier, version name/code, API range, ABI, release hardening, public intent surface, file-provider, backup-resource, signature, checksum, inventory, SBOM, provenance, license, notice, and authority checks.
- Canonical package assembly generated a 657-component CycloneDX SBOM and passed the strengthened final-directory tamper-evidence validator.
- `cargo xtask check` passed the complete repository gate, including Rust formatting, linting, tests, dependency policy, frontend lint/typecheck/tests/build, documentation, and Android package policy. The frontend portion passed 41 test files and 231 tests.
- All repository commands ran through the approved hidden Docker launcher with bounded resources. No direct Windows build or test tooling was used.

## Deferred post-release validation

No manual or physical-device product claim is made by S022. Issue #66 remains the post-release intake boundary for device, accessibility, provider, lifecycle, memory-pressure, and interaction defects after the v0.1.0 release is available.
