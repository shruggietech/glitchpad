# Quickstart: Ship macOS Package

## Prerequisites

- Use the repository-pinned Node.js, pnpm, Rust, and Tauri versions.
- Run ordinary local repository validation through `scripts/invoke-docker-hidden.ps1` so the interactive Windows desktop never receives child console windows.
- Use a native macOS 15 arm64 build host with Xcode selected and both `aarch64-apple-darwin` and `x86_64-apple-darwin` Rust targets for universal candidate construction.
- Use native macOS arm64 and Intel hosts for execution evidence.
- Treat every branch or pull-request artifact as ad-hoc signed and non-notarized. Official evaluation additionally requires separately authorized Developer ID and notarization credentials.

## Validate the specification and static contract

Run the aggregate repository check in the hidden validation container. Confirm the shared desktop capability inventory, macOS Tauri overlay, scripts, tests, documentation, encoding, and evidence schemas pass before any branch is pushed.

## Build a branch candidate before pull-request publication

Push the implementation branch and let `.github/workflows/macos-package.yml` build the exact commit with `universal-apple-darwin`. The workflow must inspect both executable slices, assemble the canonical DMG and evidence, validate the ad-hoc/non-notarized state, mount and execute the same DMG on native arm64 and Intel hosts, and upload the review bundle.

Do not open the pull request unless that branch run is green. A workflow that only compiles both targets or only inspects a universal header is insufficient.

## Inspect candidate evidence

Verify the canonical DMG name and digest, application inventory, Info.plist identity and document declarations, macOS 13 minimum, ICNS asset, license and notices, CycloneDX SBOM, candidate provenance, explicit ad-hoc signature, explicit non-notarized status, size classification, startup measurement, and both native-host receipts.

## Exercise native lifecycle and accessibility

On each native host, mount the DMG read-only, verify its Applications destination, copy Glitchpad, launch the native slice, deliver supported documents at startup and to the running instance, exercise core document behavior, remove the application, and verify fixture preservation. Complete the dialog, drag-and-drop, Save As, print, keyboard, focus, text scaling, contrast, reduced-motion, VoiceOver, Markdown, and Mermaid checks recorded by [macos-package-evidence.md](contracts/macos-package-evidence.md).

## Evaluate official readiness

In an authorized release context only, sign the application with the expected Developer ID identity, hardened runtime, and secure timestamp; sign and notarize the final DMG; retain the accepted submission and log; staple the ticket; validate the ticket and Gatekeeper result; regenerate evidence over final bytes; create and verify provenance attestations; and rerun the clean-host matrix. Missing authority or any mismatch must fail rather than downgrade to candidate validation.

Record all S020 results and limitations in `verification.md`. Official v0.1.0 activation remains outside this slice.
