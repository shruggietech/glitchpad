# Feature Specification: Ship macOS Package

**Feature Branch**: `codex/020-macos-packaging`

**Created**: 2026-09-05

**Status**: Draft

**Input**: User description: "S020 implements issue #63 by producing a macOS 13+ arm64/x86_64 universal DMG with truthful document integration, native-host evidence, and a fail-closed official signing and notarization boundary."

## User Scenarios & Testing

### User Story 1 - Install and remove Glitchpad cleanly (Priority: P1)

A macOS 13 or newer user opens one disk image, copies Glitchpad to Applications, launches it through normal macOS security checks, uses the stable document capabilities, and later removes the application without losing documents.

**Why this priority**: A trustworthy direct-distribution package must install and leave the system clean using familiar macOS conventions.

**Independent Test**: Mount the candidate on a clean supported Mac, copy the application into a clean Applications directory, launch it, exercise the stable document lifecycle, remove it, and verify the application is gone while user documents remain unchanged.

**Acceptance Scenarios**:

1. **Given** a clean macOS 13+ account, **When** the user mounts the DMG and copies Glitchpad to Applications, **Then** the universal application launches on either Apple Silicon or Intel without administrator access.
2. **Given** an installed candidate, **When** the user opens, edits, saves, inspects metadata, recovers, and prints supported content, **Then** each action preserves the established stable-core behavior.
3. **Given** documents created or edited by Glitchpad, **When** the user removes the application, **Then** application binaries and document registrations no longer remain active while those documents are preserved.

---

### User Story 2 - Open only truthfully supported files (Priority: P1)

A macOS user can open stable Markdown, Mermaid, plain-text, and approved source files through the file picker, drag and drop, Finder Open With, or an open-document application event without Glitchpad claiming unsupported formats.

**Why this priority**: Finder metadata is a public product claim, and macOS open-document events must enter the same safe source boundary as every other acquisition path.

**Independent Test**: Compare every dialog filter and application document declaration with the governed stable capability inventory, then deliver representative files through each macOS entry path and verify the intended source reaches the running application exactly once.

**Acceptance Scenarios**:

1. **Given** an installed candidate, **When** Finder sends a registered stable text-family document to Glitchpad, **Then** the application opens it through the established native source-safety boundary.
2. **Given** Glitchpad is already running, **When** macOS sends another supported open-document event, **Then** the active application session receives it exactly once without losing current work.
3. **Given** the application metadata, **When** its document declarations are inspected, **Then** no image, PDF, office-document, executable, archive, or other planned or unsupported format is claimed.

---

### User Story 3 - Use an accessible native macOS host (Priority: P2)

A keyboard or assistive-technology user can complete the stable document workflow in WKWebView with platform-correct shortcuts, focus, scaling, contrast, and accessible names.

**Why this priority**: The macOS artifact is incomplete without evidence from its actual native WebView and accessibility environment.

**Independent Test**: Run the governed WKWebView and macOS accessibility matrix against the installed universal application on a supported native Mac and record a content-free receipt bound to the exact candidate.

**Acceptance Scenarios**:

1. **Given** the installed application, **When** a user navigates by keyboard and uses the documented macOS shortcuts, **Then** every core document action remains reachable and visible focus is retained.
2. **Given** increased text size, reduced motion, increased contrast, or VoiceOver inspection, **When** the user exercises the stable document workflow, **Then** content remains usable and controls expose accurate names, roles, values, and states.
3. **Given** Markdown and Mermaid fixtures in WKWebView, **When** view and source modes are exercised, **Then** safe rendering, accessible fallback, edit, and save behavior match the shared renderer contract.

---

### User Story 4 - Verify an official macOS artifact (Priority: P2)

A release operator can distinguish an ad-hoc candidate from an official Developer ID signed and Apple-notarized DMG and verify its architecture, identity, contents, size, checksums, software bill of materials, notices, provenance, signatures, notarization, and clean-host evidence.

**Why this priority**: A candidate without complete Apple trust and supply-chain evidence must never be presented as an official release.

**Independent Test**: Build and validate an ad-hoc universal candidate from locked inputs, exercise absent and invalid release credentials, and verify only a Developer ID signed, notarized, stapled, Gatekeeper-accepted artifact with complete bound evidence can satisfy official mode.

**Acceptance Scenarios**:

1. **Given** the locked source and toolchain, **When** a macOS candidate is built, **Then** both executable slices, the universal application, the DMG, its inventory, and all digests are machine-checkable.
2. **Given** missing, invalid, or unauthorized signing or notarization inputs, **When** the official macOS gate runs, **Then** it fails closed without exposing secrets or relabeling an ad-hoc candidate as official.
3. **Given** valid release authority and complete evidence, **When** the official macOS gate runs, **Then** it verifies the nested application signature, DMG signature, hardened runtime, secure timestamps, accepted notarization, stapled tickets, Gatekeeper assessment, checksums, bill of materials, provenance, notices, size, startup, and clean-host receipt.

### Edge Cases

- The build host is Apple Silicon or Intel, but one Rust target or one architecture slice is absent.
- The application or DMG reports the wrong architecture, minimum operating-system version, bundle identifier, version, icon, or document declarations.
- macOS sends a file URL with percent encoding, Unicode normalization, spaces, shell-significant characters, or a non-file scheme.
- Several open-document URLs arrive together, the same document arrives twice, or an event races application startup.
- A file has a registered extension but contradictory, malformed, oversized, symlinked, or inaccessible content.
- Finder metadata includes a stable uniform type whose extension set expands beyond the governed capability inventory.
- Candidate generation succeeds but the application is unsigned, ad-hoc signed, modified after signing, signed without hardened runtime or a secure timestamp, or signed with an unexpected identity.
- Notarization is rejected, times out, returns warnings, refers to different bytes, or succeeds without a stapled and validated ticket on the distributed DMG.
- A checksum, software bill of materials, provenance statement, notarization log, signature record, or clean-host receipt is missing, stale, inconsistent, or contains a native path or secret.
- The DMG exceeds the 35 MiB target or 60 MiB hard limit, or cold startup exceeds the established desktop reference budget.

## Requirements

### Functional Requirements

- **FR-001**: S020 MUST produce one macOS 13+ universal DMG candidate containing an application whose main executable includes both arm64 and x86_64 slices.
- **FR-002**: The candidate name MUST be `glitchpad-{version}-macos-universal.dmg`, using an explicit nonzero semantic candidate version until release activation.
- **FR-003**: The mounted DMG MUST present Glitchpad and an Applications destination, and copying the application MUST not require administrator access.
- **FR-004**: Removing the copied application MUST preserve user-created and user-edited documents; preferences and recovery data MUST follow documented macOS conventions and MUST never be silently deleted.
- **FR-005**: File-dialog filters and macOS document declarations MUST be derived from or checked against one governed stable capability inventory.
- **FR-006**: The application MUST declare stable Markdown (`.md`, `.markdown`), Mermaid (`.mmd`, `.mermaid`), plain text (`.txt`), and only approved source extensions represented by that inventory.
- **FR-007**: The application MUST declare zero image, icon, vector, PDF, office, executable, archive, or other planned or unsupported extensions.
- **FR-008**: Finder Open With and macOS open-document events MUST enter the established native acquisition, detection, safety, save, metadata, and recovery boundaries rather than bypassing them.
- **FR-009**: A supported document delivered before startup completes or while Glitchpad is already running MUST reach the active application session exactly once without discarding unsaved work.
- **FR-010**: Open-document handling MUST accept only local file URLs, preserve exact decoded paths, reject every other URL scheme, and expose no native path to interface state or evidence.
- **FR-011**: Every candidate MUST embed the approved macOS icon, exact product and bundle identity, exact build version, macOS 13 minimum version, Apache-2.0 license, project notice, and generated third-party notices.
- **FR-012**: The application and DMG inventories MUST reject missing files, unexpected executable content, traversal, absolute or duplicate paths, case-folding collisions, and version or digest drift.
- **FR-013**: The candidate workflow MUST generate SHA-256 checksums, a CycloneDX software bill of materials, and candidate provenance bound to the exact final DMG and application bytes.
- **FR-014**: Pull-request and branch validation MAY use an explicit ad-hoc application signature but MUST label the result as a non-notarized candidate that cannot satisfy official mode.
- **FR-015**: Official signing MUST use the expected Developer ID Application identity, hardened runtime, and secure timestamps, and MUST finish before the outermost DMG is submitted for notarization.
- **FR-016**: Official notarization MUST submit the final DMG through Apple's current notarization service, retain the accepted submission result and log, staple the ticket to the final DMG, and validate the stapled ticket and Gatekeeper assessment.
- **FR-017**: Missing, malformed, expired, untrusted, mismatched, modified, rejected, unstapled, or unverifiable signing or notarization evidence MUST fail the official macOS gate closed.
- **FR-018**: Signing certificates, private keys, passwords, API keys, Apple identifiers, team identifiers, and other secrets MUST never be written to artifacts, logs, provenance, fixtures, or repository files.
- **FR-019**: The compressed DMG MUST be measured as an actual artifact against the 35 MiB target and 60 MiB hard limit, and native cold startup MUST be measured against the established desktop reference budget.
- **FR-020**: Clean-host validation MUST cover mount, copy-to-Applications, first launch, Finder and running-instance delivery, dialog, drag and drop, open, edit, save, Save As, metadata, recovery, print, removal, and document preservation.
- **FR-021**: Native-host validation MUST cover WKWebView Markdown and Mermaid rendering plus keyboard navigation, visible focus, text scaling, contrast modes, reduced motion, and VoiceOver naming.
- **FR-022**: Every manual or automated result MUST use a versioned, content-free receipt identifying candidate digests, host architecture and operating-system version, WKWebView version, checks performed, outcomes, and evidence authority without recording document content, filenames, native paths, account names, or secrets.
- **FR-023**: CI MUST build and validate ad-hoc universal macOS candidates on branch pushes and pull requests and MUST prevent publication from either context.
- **FR-024**: Official Developer ID signing, notarization, and publication MUST remain restricted to an explicitly authorized release context and MUST not be activated by S020 alone.
- **FR-025**: Every acceptance criterion MUST map to an automated check or an explicit clean-host manual receipt, and incomplete required evidence MUST not pass.

### Key Entities

- **macOS Package Candidate**: A versioned universal DMG and contained application produced from a specific locked source revision before official-release authorization.
- **Universal Application**: The application bundle whose main executable contains verified arm64 and x86_64 slices and whose metadata declares the supported baseline and document roles.
- **Capability Inventory**: The governed stable file families, extensions, descriptions, and association eligibility used to validate dialog and Finder claims.
- **Package Inventory**: The normalized names, roles, versions, byte lengths, and digests of files included in the application and DMG.
- **Apple Trust Evidence**: Live verification facts for Developer ID signatures, hardened runtime, secure timestamps, notarization submission, log, stapled tickets, and Gatekeeper assessment.
- **Supply-Chain Evidence Set**: Checksums, software bill of materials, provenance, license, notices, version facts, architecture facts, and package inventory bound to final candidate digests.
- **Clean-Host Receipt**: A content-free record of the supported Mac, exact candidate, lifecycle, WKWebView, accessibility, and performance checks.
- **macOS Package Gate**: The deterministic aggregate that distinguishes candidate validation from official readiness and rejects missing, inconsistent, stale, or invalid evidence.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The universal application and DMG build from locked inputs and pass 100% of automated name, version, minimum-system, architecture, inventory, document-declaration, notice, checksum, bill-of-materials, provenance, and digest-consistency checks.
- **SC-002**: Both arm64 and x86_64 slices are present in the final application executable, and zero required application resources differ by architecture.
- **SC-003**: Clean macOS 13+ testing completes 100% of the governed mount, install, launch, stable document workflow, removal, and document-preservation scenarios without administrator access or stale active registrations.
- **SC-004**: Every declared extension belongs to the governed stable text-family inventory, and zero planned or unsupported extensions appear in the application metadata or file dialog.
- **SC-005**: Supported document delivery succeeds through dialog, drag and drop, Finder, and open-document events in 100% of governed path, startup-race, and running-instance cases without duplicate opens or lost unsaved work.
- **SC-006**: The native WKWebView and accessibility matrix passes every governed renderer, keyboard, focus, scaling, contrast, reduced-motion, and VoiceOver check.
- **SC-007**: The DMG remains at or below the 35 MiB target and fails above 60 MiB, while measured cold startup remains within the existing desktop reference hard limit.
- **SC-008**: The official macOS gate rejects 100% of governed missing, invalid, mismatched, modified, stale, untrusted, rejected, unstapled, and unauthorized signing or notarization cases.
- **SC-009**: Every official candidate has matching SHA-256 checksums, a CycloneDX software bill of materials, provenance, license, notices, exact version and architecture evidence, accepted notarization evidence, validated stapled tickets, Gatekeeper acceptance, and a clean-host receipt bound to final bytes.

## Assumptions

- S020 implements GitHub issue #63 only. Linux, Android packaging, cross-platform release conformance, and final publication remain owned by issues #64 through #67.
- Issues #46 and #61 satisfy the native source-host and brand dependencies. S018 supplies the package-size and desktop startup contracts consumed here, while S019 supplies the governed stable desktop capability inventory and shared delivery queue.
- The canonical product version remains the unreleased foundation version until the release documentation and activation slice; S020 validates with candidate version `0.1.0` without changing the official repository version.
- Pull requests do not possess Apple release credentials. They produce an ad-hoc signed, explicitly non-notarized candidate and exercise the official gate's fail-closed behavior.
- Official notarization uses an authorized Developer ID Application identity and Apple's current notarization service on a native Mac. S020 implements the verification contract without creating, importing, or exposing credentials.
- The universal artifact is built on a native macOS runner with both Rust Apple targets. Cross-compiling or combining Windows binaries is prohibited.
- Preferences and recovery data follow macOS application-support conventions and are preserved when the application bundle is removed; user documents are never removed by package lifecycle operations.
