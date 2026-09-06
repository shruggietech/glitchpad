# Research: Ship Linux Packages

## Decision 1: Preserve the Ubuntu 22.04 baseline in a named container target

**Decision**: Build Linux candidates inside a named Ubuntu 22.04 x86_64 target in `scripts/docker/validation.Dockerfile`, with the repository-pinned Rust, Node.js, pnpm, native library, AppImage, Debian, desktop-entry, MIME, and headless-display toolchain. CI may run that target on a current Linux host, and local validation builds it once through the hidden Docker launcher.

**Rationale**: Tauri documents that Linux binaries must be built on the oldest supported distribution because a newer glibc can make them unusable on older systems. The technical specification names Ubuntu 22.04 as the release baseline. GitHub has announced deprecation of the `ubuntu-22.04` hosted image beginning 2026-09-17 and retirement in 2027, so pinning the environment rather than the runner label preserves the contract.

**Alternatives considered**: Build on `ubuntu-latest` (violates the baseline and can import newer glibc symbols); bind the workflow directly to `ubuntu-22.04` (short-lived infrastructure); cross-compile from Windows or macOS (unsupported and unnecessary).

## Decision 2: Use Tauri's AppImage and Debian bundlers with a Linux-only overlay

**Decision**: Add `tauri.s021-linux.conf.json` with AppImage and Debian targets, approved Linux icons, stable file associations, license resources, explicit package metadata, and a reviewed desktop-entry template. Preserve the shared base configuration for application and security behavior.

**Rationale**: Tauri 2 provides native AppImage and Debian outputs and supports Linux-specific package files and custom Debian desktop templates. A separate overlay matches the established S019/S020 pattern and prevents candidate package metadata from leaking into foundation builds.

**Alternatives considered**: Hand-build both archive formats (duplicates Tauri's dependency and layout work); edit the shared Tauri configuration (activates packaging in unrelated builds); add Snap, Flatpak, or RPM (outside issue #64).

## Decision 3: Govern freedesktop claims with an explicit Linux MIME map

**Decision**: Add a Linux MIME map keyed to stable families and extensions in `packaging/desktop/capabilities.json`. Validate that every advertised desktop MIME type and every package-owned glob maps to a stable extension, that no forbidden extension appears, and that the desktop entry uses a safe multi-file field code without shell execution or default-application priority.

**Rationale**: Freedesktop desktop entries advertise media types, while the existing cross-platform inventory primarily governs extensions. A Linux-specific mapping makes the relationship testable without broadening the stable capability set. The shared MIME specification requires package XML updates to be integrated through `update-mime-database`; the desktop-entry specification places user default priority outside the application file.

**Alternatives considered**: Advertise only `text/plain` (too broad and omits recognized source types); infer mappings from a mutable host MIME database (not deterministic); claim every source extension through a new private MIME type (needlessly overrides established ecosystem types).

## Decision 4: Treat AppImage and Debian bytes as one promotion unit

**Decision**: Normalize and rename both final artifacts, generate one manifest that binds their individual hashes and inventories, write one checksum file, generate a Linux CycloneDX SBOM plus candidate provenance, and require both artifacts and all receipts before official validation can succeed.

**Rationale**: Issue #64 defines both forms as the Linux delivery. Independent promotion could leave users with divergent contents, versions, or declarations. Binding both final artifacts in one manifest enforces completeness and makes later repository attestations unambiguous.

**Alternatives considered**: Separate manifests per package (allows partial promotion); record pre-renamed Tauri outputs (not final-byte evidence); sign only the AppImage internally (AppImage does not enforce embedded signature verification and the technical specification requires repository signature or attestation authority).

## Decision 5: Exercise packages in clean, headless Ubuntu 22.04 and 24.04 environments

**Decision**: Run lifecycle validation under Xvfb and a private D-Bus session in clean Ubuntu 22.04 and Ubuntu 24.04 containers. Exercise the AppImage in extraction-run mode when FUSE is unavailable, and install the Debian candidate with package tooling. Bind each result to the candidate manifest, exact distribution, WebKitGTK version, package form, and governed native test suites.

**Rationale**: Containers supply reproducible clean filesystems and let the same workflow prove baseline and current compatibility without desktop interaction. Extraction-run is an AppImage-supported fallback for environments where mounting through FUSE is unavailable; the manifest still binds the exact outer AppImage bytes.

**Alternatives considered**: Test only archive contents (does not prove launch); test only the build environment (misses newer compatibility); rely on manual desktop testing as the first evidence (too late and non-repeatable).

## Decision 6: Reuse S018 size and startup policy without authority inflation

**Decision**: Apply the existing 35 MiB target and 60 MiB hard limit independently to AppImage and Debian artifacts. Candidate clean-environment samples are `hosted_smoke`, retain their truthful classification against the S018 reference thresholds, and fail above 10 seconds. Official evidence must identify a governed reference environment and satisfy the S018 desktop hard limit.

**Rationale**: Platform packaging must not silently relax established product budgets. Hosted and containerized timing is useful regression evidence but is not equivalent to a controlled reference device.

**Alternatives considered**: Treat container timing as release reference evidence (false precision); add a Linux-only relaxed reference budget (unsupported by measurements); defer size/startup validation (violates issue #64).

## Decision 7: Keep official repository authority fail-closed

**Decision**: Branch and pull-request workflows create non-official candidates only. Official validation requires authorized tag context plus GitHub artifact-attestation or repository-signature verification bound to repository, source commit, workflow identity, release version, and both final digests. S021 adds the contract and authority preflight but does not publish.

**Rationale**: Linux lacks a universal vendor trust chain. GitHub artifact attestations provide repository and workflow identity, but identity-token access and publication authority belong only in the release path.

**Alternatives considered**: Claim official status from checksums alone (no publisher identity); store GPG material in repository settings during candidate builds (unnecessary exposure); publish from the package workflow (outside S021 and issue #67).
