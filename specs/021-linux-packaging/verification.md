# Verification: Ship Linux Packages

## Traceability

- Work slice: S021
- GitHub issue: #64
- Target: x86_64 Linux systems compatible with the governed Ubuntu 22.04 baseline
- Candidate version: 0.1.0
- Deliverables: one AppImage and one Debian package

## Implemented Evidence

- The governed Ubuntu 22.04 package image pins Rust 1.96.0, Node.js 24.11.0, pnpm 10.28.2, WebKitGTK 4.1 build dependencies, lifecycle tooling, and a maximum imported GLIBC version of 2.35.
- The Tauri Linux overlay, reviewed desktop entry, shared MIME inventory, icon, notices, and Debian maintainer scripts declare only the 21 stable extensions and 12 stable media types in the product contract.
- Candidate assembly canonicalizes both filenames, verifies architecture and imported GLIBC symbols, inventories package contents, rejects bundled system WebKitGTK and GTK runtimes, emits final-byte checksums and provenance, and refuses identity or workflow drift.
- The AppImage repack step preserves the upstream AppImage runtime and Tauri application layout while removing overbundled system libraries so the candidate consumes the supported host GTK and WebKitGTK runtime.
- Clean-environment lifecycle validation exercises the final AppImage and Debian bytes independently on Ubuntu 22.04 and Ubuntu 24.04. Each path validates installed desktop and MIME state, performs five launches, proves initial and running-instance exact-once document delivery, preserves the source document, removes the package, validates registration cleanup, and emits a content-free receipt.
- Candidate SBOM and authority evidence bind locked Rust, JavaScript, native-package, artifact, inventory, and lifecycle facts without claiming release authority. Official mode remains fail-closed without authorized live attestation and release context.
- The release workflow performs Linux authority preflight only. Branch and pull-request artifacts remain explicit non-official candidates and cannot publish.

## Local Pre-Publication Results

1. The initial focused test run failed as intended because the Linux package validator, assembler, and lifecycle implementation modules did not yet exist (three missing-module failures).
2. The implemented focused Linux suite passed all 14 tests, followed by the static package-contract validator.
3. The actual Tauri build completed inside the governed Ubuntu 22.04 image and produced both package forms.
4. Final-byte validation rejected the initial 83,823,096-byte AppImage because it exceeded the 35 MiB hard limit and bundled host runtime libraries. The corrected thin AppImage is 7,432,696 bytes; the Debian package is 6,516,174 bytes.
5. ELF inspection recorded x86_64 architecture and a maximum imported GLIBC symbol version of 2.34, within the declared 2.35 baseline.
6. SBOM generation, candidate assembly, checksums, manifests, provenance, package inventories, and evidence validation passed against the final bytes.
7. The clean-environment matrix passed for Ubuntu 22.04 AppImage, Ubuntu 22.04 Debian, Ubuntu 24.04 AppImage, and Ubuntu 24.04 Debian. Every case completed five startups plus running-instance delivery and package cleanup.
8. The complete repository formatting, lint, unit, security, documentation, encoding, mojibake, public-surface, frontend, site, Rust, Android, Windows-package, macOS-package, and Linux-package validation passed through `cargo xtask check` in the hidden self-contained validation container on 2026-09-05. The frontend portion passed 41 files and 231 tests; all Rust test suites passed.
9. First-round external review identified four defects before merge: pull-request workflow refs were rejected, official mode did not enforce the complete evidence set, candidate receipts overstated unexercised operations, and the MIME XML duplicated platform-owned definitions. Five focused regressions reproduced the findings. The corrections accept only canonical pull-request merge refs, validate every official evidence file and its bindings, report unexercised candidate operations truthfully, and install MIME definitions only for package-owned types.
10. The first rebuilt Ubuntu 22.04 AppImage lifecycle rerun exposed a teardown race after three successful launches. A bounded 250 ms settle interval now allows single-instance DBus ownership to clear after process exit. The rebuilt final bytes subsequently passed all five launches, running-instance delivery, removal, and cleanup for both package forms on Ubuntu 22.04 and Ubuntu 24.04.

## Conditional and Dynamic Coverage

- Existing desktop delivery conformance already covers the Linux delivery behavior exercised by the package lifecycle, so no platform-specific host-code regression patch was required for T018.
- `scripts/validation-files.mjs` dynamically discovers Spec Kit Markdown and did not require a Linux-specific edit. `.github/labeler.yml` explicitly registers the new Linux package and workflow paths for T031.

## Documentation Impact

No end-user download publication is included in S021. Operator-facing installation, removal, data-preservation, baseline, desktop-integration, candidate-authority, and official-evidence behavior is documented under `packaging/linux/` and this Spec Kit slice. Public download documentation remains gated on a separately authorized release.
