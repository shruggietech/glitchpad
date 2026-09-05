# Quickstart: Ship Windows Packages

## Prerequisites

- Use the repository-pinned Node.js, pnpm, Rust, and Tauri versions.
- Run ordinary repository validation through `scripts/invoke-docker-hidden.ps1` so the interactive Windows desktop never receives child console windows.
- Use Windows 11 x86_64 with MSVC, Windows SDK, NSIS tooling selected by Tauri, and WebView2 Evergreen for native package validation.
- Treat every pull-request or branch artifact as an unsigned candidate. Official evaluation additionally requires the separately authorized signing environment.

## Validate the specification and static package contract

Run the aggregate repository check in the hidden validation container. Confirm the Windows capability inventory, Tauri overlay, scripts, tests, documentation, encoding, and package evidence schema all pass before any branch is pushed.

## Build branch candidates before pull-request publication

Push the implementation branch, dispatch the Windows package workflow against that exact ref, and wait for completion. The workflow must build the release executable and NSIS candidate, assemble the portable ZIP, generate final-byte checksums and candidate evidence, measure both compressed artifacts, execute package contract tests, and upload an explicitly unsigned validation bundle.

Do not open the pull request unless that branch run is green. A workflow that merely compiles the host or uploads an intermediate executable is insufficient.

## Inspect candidate evidence

Verify both canonical artifact names, final SHA-256 digests, size classifications, package inventory, stable-only associations, license and notices, CycloneDX SBOM, candidate provenance, and explicit unsigned status. Confirm no path, source content, credential, account, or environment secret appears in any receipt.

## Exercise Windows lifecycle behavior

On a clean Windows 11 x86_64 environment, run the governed silent install and uninstall automation, portable launch smoke, association inspection, and path-delivery tests. Complete the interactive dialog, drag-and-drop, Save As, print, keyboard, focus, scaling, forced-colors, and screen-reader checks recorded by [windows-package-evidence.md](contracts/windows-package-evidence.md).

## Evaluate official readiness

In an authorized release context only, sign the final application executable and NSIS installer, verify Authenticode trust and timestamp results, regenerate evidence over the signed final bytes, create and verify GitHub provenance attestations, and rerun the clean-machine matrix. Missing credentials or any mismatch must fail rather than downgrade to candidate validation.

Record all S019 results and limitations in `verification.md`. Official v0.1.0 activation remains outside this slice.
