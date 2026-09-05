# Verification: Ship macOS Packages

## Traceability

- Work slice: S020
- GitHub issue: #63
- Target: macOS 13+ on native arm64 and x86_64 hosts
- Candidate version: 0.1.0
- Deliverable: one universal DMG

## Implemented Evidence

- The Tauri packaging overlay binds the universal application and DMG to macOS 13, the approved icon, required notices, Editor-role Finder associations, and an explicit ad-hoc candidate signature.
- Finder and application open-document events convert only local file URLs and enter the existing bounded, ordered, path-private desktop source queue. Duplicate and unsupported deliveries remain safe results.
- Candidate assembly canonicalizes the DMG name, verifies both native executable slices, reads generated application metadata, inventories application contents with semantic roles, hashes the executable and deterministic bundle inventory, and refuses destructive output reuse.
- Native arm64 and Intel jobs mount the same DMG, verify the Applications link, copy and launch the application, deliver a file to the running instance, preserve the fixture, remove the application, and emit content-free receipts.
- The package validator reads and binds the staged DMG, mounted and staged application inventories, exact notices, checksums, SBOM, provenance, native receipt authority, and Apple trust evidence. It rejects capability drift, forbidden formats, undeclared evidence fields, traversal, case collisions, unexpected executables, oversized packages, incomplete official evidence, stale bindings, and secret-shaped data.
- Candidate evidence records that manual accessibility checks, notarization, stapling, hardened runtime, and trusted timestamps were not performed. It cannot satisfy official mode.
- Official validation requires an authorized tag, Developer ID authority, hardened runtime, timestamp, notarization, stapling, Gatekeeper, native receipts, final-byte checksums, CycloneDX SBOM, provenance, and live digest agreement. Publication remains separately authorized.

## Local Pre-Publication Results

- macOS package contract tests: passed (14 tests).
- Rust desktop delivery tests: passed (7 focused tests).
- Tauri overlay and native host compilation: passed through a non-bundling build.
- Frontend validation: passed (41 files, 230 tests), with deterministic Mermaid component doubles preserving dedicated real parser, sanitizer, scheduler, and performance coverage.
- Site validation: passed (7 unit tests and 29 Chromium browser tests).
- Complete repository formatting, lint, unit, security, documentation, encoding, mojibake, and public-surface validation: passed through `cargo xtask check` in the hidden, self-contained validation container on 2026-09-05.
- The second Spec Kit convergence pass found no remaining coverage gaps and left the 42-task plan byte-for-byte unchanged.
- Universal DMG construction and native arm64/Intel lifecycle evidence are required from the exact branch commit before pull-request publication.

## Documentation Impact

No end-user download publication is included in S020. Operator-facing candidate boundaries and evidence formats are documented under `packaging/macos/` and this Spec Kit slice. Public download documentation remains gated on a separately authorized, signed, notarized, and stapled release.
