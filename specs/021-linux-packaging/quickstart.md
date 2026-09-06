# Quickstart: Ship Linux Packages

## Prerequisites

- Docker Desktop is available to the hidden Windows launcher.
- The repository-owned `glitchpad-validation:local` image is current.
- Git and GitHub operations use `scripts/invoke-vcs-hidden.ps1`.
- Non-Git commands use `scripts/invoke-docker-hidden.ps1`.

## 1. Build the governed Linux package environment

Build the named Linux packaging target from `scripts/docker/validation.Dockerfile` as `glitchpad-linux-package:local`. Reuse this image for all S021 package construction and lifecycle checks rather than installing tools in disposable containers.

Expected outcome: the image reports Ubuntu 22.04 x86_64, the pinned Rust/Node/pnpm versions, WebKitGTK 4.1 development packages, AppImage tooling, Debian tooling, desktop/MIME validators, Xvfb, and D-Bus support.

## 2. Validate contracts before building

Run the Linux package Node test suites and static validator in `glitchpad-validation:local`, then run the focused desktop source, delivery, recovery, and interface suites.

Expected outcome: malformed contracts, broader MIME claims, unsafe desktop entries, newer baselines, too-new glibc imports, dependency drift, missing evidence, and official-authority inflation all fail deterministically.

## 3. Build and assemble the candidate pair

Inside `glitchpad-linux-package:local`, install locked JavaScript dependencies, run the governed Tauri AppImage and Debian build, and assemble final-byte artifacts plus baseline, checksum, SBOM, provenance, and manifest evidence under `artifacts/linux/`.

Expected outcome: exactly the canonical AppImage and Debian names exist, both are bound by the manifest and `SHA256SUMS`, and candidate validation passes with `official: false`.

## 4. Exercise the clean-environment matrix

Run the lifecycle harness for each package form in clean Ubuntu 22.04 and Ubuntu 24.04 environments under Xvfb and a private D-Bus session. Use extraction-run mode for AppImage only when FUSE mounting is unavailable.

Expected outcome: all four receipts bind the exact candidate manifest; installation or extraction, desktop/MIME state, launch, startup and running-instance delivery, document workflow, performance, removal, registration cleanup, and document preservation pass.

## 5. Run the complete repository gate

Run `cargo xtask check` in `glitchpad-validation:local` and verify UTF-8 without BOM plus absence of mojibake in new artifacts.

Expected outcome: formatting, lint, tests, docs, links, Mermaid, validation boundaries, security, license, and package checks complete with exit status zero.

## 6. Validate official fail-closed behavior

Attempt official Linux validation without live repository attestations for the authorized tag, then with mutated and incomplete evidence fixtures.

Expected outcome: every attempt fails without publishing artifacts. The validator invokes GitHub attestation verification for both unchanged final files with the repository, signer workflow, release tag, source commit, and hosted-runner policy pinned; only then does it write the normalized attestation receipt and validate the complete evidence set.
