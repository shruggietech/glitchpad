# Feature Specification: Ship Linux Packages

**Feature Branch**: `codex/021-linux-packaging`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "S021: deliver the Linux packaging work slice under the autopilot protocol, covering GitHub issue #64."

## User Scenarios & Testing

### User Story 1 - Install and remove Glitchpad on supported Linux systems (Priority: P1)

A Linux user can download the artifact appropriate to their preference, run the portable package without installing it, or install the distribution package through normal system tooling, then remove Glitchpad without losing documents.

**Why this priority**: AppImage and Debian delivery are the primary user value of this slice and are required before Linux can be treated as a release platform.

**Independent Test**: Build both candidates from the declared baseline, exercise the AppImage and Debian package on clean supported environments, launch Glitchpad, remove it, and verify user documents remain unchanged.

**Acceptance Scenarios**:

1. **Given** a clean supported x86_64 Linux environment, **When** the user makes the AppImage executable and launches it, **Then** Glitchpad starts without installation and exposes the expected product identity and icon.
2. **Given** a clean supported Debian-family environment, **When** the user installs the Debian package through standard package tooling, **Then** Glitchpad appears in the application menu with its declared dependencies satisfied.
3. **Given** either delivered form has been exercised, **When** the user removes the application or package, **Then** application binaries and package-owned integration are removed while user documents remain byte-for-byte unchanged.

---

### User Story 2 - Open only truthfully supported documents (Priority: P1)

A Linux user can choose Glitchpad for stable Markdown, Mermaid, plain-text, and approved source documents through freedesktop application integration, including delivery to an already-running session, without Glitchpad claiming planned formats.

**Why this priority**: Incorrect desktop and MIME declarations mislead users and can route unsupported or sensitive documents into the application.

**Independent Test**: Compare the desktop entry and package MIME declarations with the governed stable capability inventory, then deliver representative supported and forbidden files through command-line, file-manager, dialog, and running-instance paths.

**Acceptance Scenarios**:

1. **Given** an installed Debian package, **When** the desktop environment enumerates applications for a stable supported MIME type, **Then** Glitchpad is offered and its launch command safely accepts one or more file arguments.
2. **Given** Glitchpad is already running with unsaved work, **When** a supported document is opened from a file manager or command line, **Then** that document reaches the active session exactly once without discarding existing state.
3. **Given** a planned image, PDF, office, archive, executable, or mobile-package format, **When** package integration is inspected, **Then** no Glitchpad association or MIME claim exists for that format.
4. **Given** the package is removed, **When** desktop and MIME databases are refreshed, **Then** no package-owned Glitchpad registration remains.

---

### User Story 3 - Use an accessible and responsive native Linux host (Priority: P2)

A Linux user can view and edit the stable text family through the system WebKit host with expected keyboard, focus, scaling, contrast, reduced-motion, assistive-technology, startup, and package-size behavior.

**Why this priority**: A package that launches but fails native accessibility, rendering, or performance expectations is not a usable Tier 1 artifact.

**Independent Test**: Exercise Markdown and Mermaid in each package form on the governed Linux compatibility matrix and record content-free accessibility and performance evidence bound to the exact candidate.

**Acceptance Scenarios**:

1. **Given** either package form on a clean supported host, **When** representative Markdown and Mermaid documents are opened, **Then** both render through the system WebKitGTK host without network access or a bundled browser engine.
2. **Given** keyboard-only navigation and supported accessibility settings, **When** the user operates the installed application, **Then** focus remains visible, actions are named, text scaling works, contrast remains legible, and reduced-motion preferences are honored.
3. **Given** the final artifacts and startup samples, **When** performance policy is evaluated, **Then** each result is truthfully classified and a hard-limit breach fails the candidate.

---

### User Story 4 - Verify official Linux delivery evidence (Priority: P2)

A release operator can verify that the exact AppImage and Debian bytes came from the governed baseline and source commit, contain the required notices and stable declarations, satisfy dependency and size policy, and carry the required repository attestation evidence before publication.

**Why this priority**: Linux has no platform-vendor signing authority comparable to Windows or macOS, so artifact identity and provenance must remain explicit and fail closed.

**Independent Test**: Mutate or omit each governed artifact, declaration, checksum, inventory, dependency, receipt, or attestation fact and verify deterministic rejection; then prove complete branch candidates pass candidate mode but cannot claim official publication authority.

**Acceptance Scenarios**:

1. **Given** a branch or pull-request build, **When** package validation completes, **Then** it produces clearly labeled non-official candidates with checksums, a software bill of materials, provenance, and clean-environment receipts.
2. **Given** missing, stale, mismatched, modified, unauthorized, or incomplete evidence, **When** official validation is attempted, **Then** the gate fails without publishing either artifact.
3. **Given** an explicitly authorized release context with complete repository signature or attestation evidence bound to both final artifacts, **When** official validation runs, **Then** the evidence can satisfy the Linux publication contract.

### Edge Cases

- The AppImage lacks execute permission, its extraction runtime is unavailable, or its final bytes differ from the manifest.
- Debian installation encounters an unsupported architecture, unmet dependency, partial installation, downgrade, or package-manager interruption.
- A desktop entry contains unsafe field-code placement, shell interpretation, an absolute build path, a terminal requirement, or a launch command that drops multiple files.
- A MIME declaration is duplicated, malformed, absent from the stable capability inventory, broader than the supported family, or collides with a forbidden extension.
- An open request contains spaces, Unicode, leading dashes, encoded characters, duplicates, a missing file, a directory, a non-file URI, or arrives during startup.
- A second instance races with initial delivery or forwards multiple documents while the active session has unsaved changes.
- Package removal leaves a desktop entry, MIME package, icon, executable, cache owned by the package, or removes a user document.
- The build environment is newer than the declared baseline or the executable imports a symbol newer than the governed glibc ceiling.
- The runtime WebKitGTK dependency is missing, obsolete, or outside the declared package dependency range.
- A checksum, software bill of materials, provenance record, or clean-environment receipt refers to pre-normalized rather than final artifact bytes.
- A branch candidate implies repository-verified or official publication authority.
- A receipt contains a filename, native path, account name, environment value, document content, or secret despite asserting that it is content-free.

## Requirements

### Functional Requirements

- **FR-001**: S021 MUST produce x86_64 AppImage and Debian package candidates built against the declared Ubuntu 22.04 glibc and WebKitGTK 4.1 baseline.
- **FR-002**: Candidate names MUST be `glitchpad-{version}-linux-x86_64.AppImage` and `glitchpad-{version}-linux-x86_64.deb`, using an explicit nonzero semantic candidate version until release activation.
- **FR-003**: The AppImage MUST run without system installation after the user grants execute permission; the Debian package MUST install and remove through normal package-manager behavior and MUST NOT require application execution as root.
- **FR-004**: Removing either delivered form MUST preserve user-created and user-edited documents; preferences and recovery data MUST follow documented Linux data conventions and MUST never be silently deleted.
- **FR-005**: The package desktop entry and MIME declarations MUST be derived from or checked against one governed stable capability inventory.
- **FR-006**: Package integration MUST declare stable Markdown, Mermaid, plain-text, and only the approved source media types and extensions represented by that inventory.
- **FR-007**: Package integration MUST declare zero image, icon, vector, PDF, office, executable, archive, mobile-package, or other planned or unsupported formats.
- **FR-008**: The desktop entry MUST follow freedesktop conventions, identify a non-terminal graphical application, use safe file argument field codes, reference installed icon resources, and contain no shell interpretation or build-host paths.
- **FR-009**: Debian installation and removal MUST update the applicable desktop, icon, and MIME databases without overriding user-selected default applications.
- **FR-010**: Command-line and file-manager delivery MUST enter the established native acquisition, detection, safety, save, metadata, and recovery boundaries rather than bypassing them.
- **FR-011**: A supported document delivered before startup completes or while Glitchpad is already running MUST reach the active application session exactly once without discarding unsaved work.
- **FR-012**: Delivery MUST preserve exact native paths internally, safely handle spaces, Unicode and leading dashes, reject non-file inputs, and expose no native path to interface state or evidence.
- **FR-013**: Every candidate MUST contain the approved Linux icons, exact product and application identity, exact build version, Apache-2.0 license, project notice, and generated third-party notices.
- **FR-014**: Both package inventories MUST reject missing files, unexpected executable content, traversal, absolute or duplicate archive paths, case-folding collisions where relevant, unsafe links, and version or digest drift.
- **FR-015**: The candidate workflow MUST generate SHA-256 checksums, a CycloneDX software bill of materials, and provenance bound to the exact final AppImage and Debian bytes.
- **FR-016**: The build workflow MUST prove the declared baseline through normalized operating-system, architecture, compiler, linker, glibc, WebKitGTK, and toolchain evidence and MUST reject a newer build baseline.
- **FR-017**: The final executable MUST import no glibc symbol newer than the governed Ubuntu 22.04 ceiling, and the Debian dependency metadata MUST identify the required WebKitGTK 4.1 and GTK runtime families without undeclared bundled substitutes.
- **FR-018**: Clean-environment validation MUST cover AppImage launch and Debian install, launch, command-line and file-manager delivery, read, edit, save, Save As, metadata, recovery, print, removal, registration cleanup, and document preservation on Ubuntu 22.04 and Ubuntu 24.04.
- **FR-019**: Native validation MUST cover WebKitGTK Markdown and Mermaid rendering plus keyboard navigation, visible focus, text scaling, contrast modes, reduced motion, and Linux assistive-technology naming.
- **FR-020**: Each artifact MUST be measured against the established 35 MiB compressed target and 60 MiB hard limit. Hosted startup evidence MUST retain truthful reference-budget classification and fail above a governed 10-second smoke limit; official reference evidence MUST satisfy the established desktop hard limit.
- **FR-021**: Every manual or automated result MUST use a versioned, closed, content-free receipt identifying candidate digests, build and test environment, WebKitGTK version, checks performed, outcomes, and evidence authority without recording document content, filenames, native paths, account names, environment values, or secrets.
- **FR-022**: Branch and pull-request validation MUST produce explicitly non-official Linux candidates and MUST prevent publication or claims of repository-verified provenance.
- **FR-023**: Official validation MUST require repository signature or artifact-attestation evidence bound to both final artifacts, the authorized source commit, repository identity, workflow identity, and release version.
- **FR-024**: Missing, malformed, stale, unauthorized, mismatched, or unverifiable official evidence MUST fail closed, and one invalid artifact MUST block promotion of the complete Linux pair.
- **FR-025**: Release credentials, identity tokens, signing material, and raw authorization responses MUST never be written to artifacts, logs, provenance, fixtures, receipts, or repository files.
- **FR-026**: CI MUST build and validate Linux candidates on every branch push and pull request while keeping official attestation and publication restricted to an explicitly authorized release context.
- **FR-027**: Every acceptance criterion MUST map to an automated check or an explicit clean-environment manual receipt, and incomplete required evidence MUST not pass.

### Key Entities

- **Desktop capability inventory**: The authoritative stable document families, extensions, media types, renderer ownership, association eligibility, and forbidden formats.
- **Linux package contract**: Canonical artifact identities, build baseline, architecture, required package contents, dependency policy, size policy, candidate state, and official evidence requirements.
- **Linux package manifest**: Normalized final-byte inventory and digest record for the AppImage and Debian candidates.
- **Build-baseline evidence**: Content-free facts proving the candidate was built in the governed Ubuntu 22.04 x86_64 environment with the pinned toolchain and allowed imported runtime symbols.
- **Clean-environment receipt**: Closed evidence for one artifact and one target environment, bound to the candidate manifest and source authority.
- **Repository attestation evidence**: Normalized verification facts binding both artifacts to the authorized repository, commit, workflow, and version.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Both Linux artifacts build from locked inputs and pass 100% of automated name, version, architecture, inventory, desktop-entry, MIME, icon, notice, checksum, software-bill-of-materials, provenance, baseline, dependency, and digest-consistency checks.
- **SC-002**: The exact AppImage and Debian bytes complete 100% of the governed clean-environment lifecycle matrix on Ubuntu 22.04 and Ubuntu 24.04, including removal and document preservation.
- **SC-003**: Every declared extension and media type belongs to the governed stable text-family inventory, and zero planned or unsupported formats appear in either package or installed registration.
- **SC-004**: Supported documents reach the intended session exactly once through command-line, file-manager, dialog, drag-and-drop, startup-race, and running-instance paths without losing unsaved work.
- **SC-005**: The native WebKitGTK and accessibility matrix passes every governed renderer, keyboard, focus, scaling, contrast, reduced-motion, and assistive-technology check.
- **SC-006**: Each compressed artifact remains at or below the 35 MiB target and fails above 60 MiB; hosted startup evidence fails above 10 seconds, while official release evidence remains blocked unless reference-profile startup satisfies the existing desktop hard limit.
- **SC-007**: The build-baseline gate detects 100% of governed newer-distribution, wrong-architecture, unexpected runtime-dependency, and too-new glibc-symbol cases.
- **SC-008**: The official Linux gate rejects 100% of governed missing, stale, modified, mismatched, unauthorized, incomplete, or unverifiable repository signature and attestation cases.
- **SC-009**: Every official candidate pair has matching SHA-256 checksums, a CycloneDX software bill of materials, provenance, license, notices, exact version and baseline evidence, clean-environment receipts for both package forms and both supported environments, and repository attestation evidence bound to final bytes.

## Assumptions

- S021 implements GitHub issue #64 only. Android packaging, cross-platform conformance, and final v0.1.0 release activation remain owned by issues #65 through #67.
- GitHub issues #46 and #61 satisfy the source-host and brand-asset prerequisites declared by issue #64.
- Version `0.1.0` is the explicit candidate identity for this slice; it does not activate or publish the release.
- Ubuntu 22.04 remains the binary-compatibility build baseline even after its hosted-runner label is retired; a pinned containerized build environment preserves that baseline independently of runner availability.
- Ubuntu 24.04 is the current compatibility environment. Additional Linux distributions and ARM64 delivery remain outside S021.
- Standard Debian package installation may require package-manager elevation. Glitchpad itself runs as the invoking user and never requires root privileges.
- Linux has no mandatory platform-vendor application signature. Official authority is supplied by repository-controlled signature or artifact-attestation evidence and remains inactive until the release workflow is separately authorized.
- Existing S018 desktop size and startup budgets remain authoritative and are not silently relaxed for Linux.
