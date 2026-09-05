# Verification: Ship Windows Packages

## Traceability

- Work slice: S019
- GitHub issue: #62
- Target: Windows 11 x86_64
- Candidate version: 0.1.0
- Deliverables: current-user NSIS installer and portable ZIP

## Implemented Evidence

- The Tauri packaging overlay is bound to the governed extension inventory, current-user NSIS mode, product icon, license notices, and an explicit WebView2 prerequisite.
- Dialog, file drop, command-line, file association, startup, and single-instance delivery use one bounded Rust queue and serialize only path-free source summaries.
- Native Save As serializes the document's exact text profile, applies the existing 16 MiB save budget, commits atomically, and keeps the document open on cancellation or failure.
- Candidate assembly canonicalizes artifact names, inventories portable contents, hashes final bytes, produces candidate provenance, and refuses destructive output reuse.
- The package validator rejects extension drift, forbidden formats, traversal, case collisions, extra executables, oversized packages, incomplete official evidence, stale signature binding, and secret-shaped data.
- The Windows workflow builds and exercises installer and portable lifecycles before uploading an explicitly unsigned review candidate. The full repository CI workflow also runs on the branch before pull-request publication.
- The release workflow fails closed on an authorized tag when Windows signing authority is absent. Publication remains a separate reviewed action.

## Local Pre-Publication Results

- Rust formatting: passed.
- Rust desktop delivery conformance: passed (1 cross-channel test plus 3 queue tests).
- Rust Save As atomic persistence: passed.
- Rust clippy for `glitchpad-host` with all targets and features: passed.
- Frontend lint and TypeScript checks: passed.
- S019 frontend tests: passed (31 App, gateway, and command tests in the focused run, including native delivery, complete-host detection, and exact-byte Save As).
- Windows package contract tests: passed (7 tests).
- PowerShell package assembly contract: passed in the hidden validation container.
- GitHub Actions syntax: passed actionlint.

The complete frontend run in the Linux validation container reached 221 of 224 passing tests. Three pre-existing Mermaid readiness tests time out in that container even when the affected suite is run alone; the product render operations complete, but the test observer remains at its fallback. This environment-specific result is not accepted as release evidence. The unchanged full suite must pass on the native Windows branch workflow before a pull request can be opened.

## Documentation Impact

No end-user website publication is included in S019. Operator-facing package boundaries and evidence formats are documented under `packaging/windows/` and this Spec Kit slice. Public download documentation remains gated on a separately authorized release publication.
