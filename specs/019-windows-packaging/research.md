# Research: Ship Windows Packages

## Decision 1: Use a separate Windows packaging overlay

**Decision**: Keep the foundation Tauri configuration unbundled and add an explicit S019 Windows overlay that enables only the NSIS target, current-user install mode, stable text-family associations, approved icons, and non-bundled WebView2 prerequisite behavior for a caller-supplied candidate version.

**Rationale**: Ordinary debug and cross-platform builds must not silently become distributable packages or change the official v0.0.0 version. Tauri supports merging a separate distribution configuration and documents current-user NSIS installation as the non-administrative mode.

**Alternatives considered**: Enable bundling in the main configuration (changes every platform build); create a custom NSIS template (unnecessary maintenance); use MSI (not the required artifact); bundle WebView2 (violates the declared system-runtime boundary and size goals).

## Decision 2: Govern associations with one v0.1.0 capability inventory

**Decision**: Add a machine-readable capability inventory for Markdown, Mermaid, plain text, and the source extensions already recognized by the stable editor. Validate the Tauri overlay and interface dialog filters against that inventory and maintain an explicit forbidden extension set for planned image, PDF, office, executable, and archive families.

**Rationale**: The technical specification forbids associations derived from roadmap intent. A checked inventory prevents the Tauri configuration, dialog filters, tests, and later platform packages from drifting independently.

**Alternatives considered**: Hand-maintain each consumer (drift-prone); associate every text-like extension (false capability claim); omit source associations (does not satisfy issue #62).

## Decision 3: Keep every desktop path inside the native host

**Decision**: Initial arguments, secondary-instance arguments, associations, file drops, and native-dialog selections are normalized and acquired by trusted Rust handlers. A bounded process-local queue exposes only safe `DesktopSourceSummary` values and stable path-free errors to the interface.

**Rationale**: S006 intentionally prohibits renderer operations from accepting native paths. The official dialog documentation also recommends a dedicated command when security matters. Reusing `DesktopSourceHost::acquire` preserves identity, symlink, permission, detection, and path-redaction invariants for every delivery route.

**Alternatives considered**: Pass paths through JavaScript (breaks the source contract); add broad filesystem scope (unnecessary authority); create separate acquisition logic for each entry channel (inconsistent safety and deduplication).

## Decision 4: Use the official single-instance plugin first in builder order

**Decision**: Register the official Tauri single-instance plugin before every other plugin on desktop. Its callback normalizes secondary-process arguments against that process's working directory, enqueues safe acquisitions in the existing host, and focuses the main window after delivery.

**Rationale**: Tauri documents first registration as necessary for reliable interception. One host registry makes strong native identity deduplication authoritative and avoids opening the same source twice.

**Alternatives considered**: Allow multiple processes (risks competing saves and duplicated recovery); implement a Windows-only named-pipe protocol (duplicates a maintained official plugin); forward raw arguments to the interface (path disclosure).

## Decision 5: Use the official dialog plugin only from Rust

**Decision**: Register the official Tauri dialog plugin on desktop, invoke it from a dedicated host command, apply filters from the governed capability inventory, and acquire selected paths before returning safe summaries. Save As uses the same native-only selection boundary and bounded durable-write rules.

**Rationale**: The plugin supplies native Windows dialogs while its Rust API lets Glitchpad avoid returning paths to JavaScript. This preserves the source-handle model while adding the entry flow needed for clean-machine validation.

**Alternatives considered**: JavaScript dialog API (returns paths and broadens scope); a new native dialog dependency (duplicates the official plugin); HTML file inputs (copy semantics and no native source authority).

## Decision 6: Separate candidate evidence from official release authority

**Decision**: Pull requests and branch validation build explicitly unsigned candidates, assemble both artifact forms, and validate all non-signature contracts. Official readiness additionally requires valid Authenticode results for the application executable and NSIS installer, an authorized release context, and evidence bound to the final digests; absent credentials fail closed.

**Rationale**: This repository currently has no Windows signing environment or secrets. Tauri documents Windows signing through configured certificate or custom signing commands, but unavailable credentials cannot be fabricated or treated as optional. The distinction keeps ordinary validation useful without making a false official claim.

**Alternatives considered**: Self-sign pull-request artifacts (does not establish publisher identity); skip signature validation (violates the release contract); place a certificate in the repository (secret disclosure); require secrets on untrusted pull requests (unsafe).

## Decision 7: Bind supply-chain evidence to final candidate bytes

**Decision**: Assemble final artifacts first, then generate SHA-256 checksums, a CycloneDX SBOM, package inventory, and content-free provenance for candidate validation. Authorized release workflows replace candidate provenance with GitHub artifact attestations and verify them against the repository identity before publication.

**Rationale**: Evidence generated before the final bytes can attest to the wrong object. GitHub documents artifact attestations as a release-oriented provenance mechanism and advises against attesting frequent test builds, so S019 does not issue cryptographic attestations for pull-request candidates.

**Alternatives considered**: Hash intermediate outputs (stale evidence); attest every pull request (contrary to platform guidance); embed mutable evidence inside the object whose digest it declares (circular and unverifiable).

## Decision 8: Require branch-level native Windows evidence before opening the pull request

**Decision**: Run all cross-platform/static tests locally inside the mandated hidden Linux container, then push the implementation branch and dispatch the Windows packaging workflow before creating the pull request. The workflow performs release-mode MSVC/NSIS construction, portable assembly, package checks, and non-interactive lifecycle smoke; only a passing branch run permits PR publication.

**Rationale**: The interactive desktop policy requires non-Git tools to run in Linux containers, while Tauri recommends native Windows or CI for its supported MSVC installer path. Branch validation supplies the platform evidence before review and avoids using the pull request as the first test run.

**Alternatives considered**: Run visible Windows tools locally (prohibited); cross-compile NSIS from Linux (officially described as less-tested and a last resort); open the pull request before native validation (repeats the failure mode the user explicitly rejected).
