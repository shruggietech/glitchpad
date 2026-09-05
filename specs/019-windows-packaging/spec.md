# Feature Specification: Ship Windows Packages

**Feature Branch**: `codex/019-windows-packaging`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "S019 implements issue #62 by producing Windows 11 x86_64 NSIS and portable ZIP artifacts with truthful associations, signing, supply-chain evidence, and clean lifecycle validation."

## User Scenarios & Testing

### User Story 1 - Install and remove Glitchpad cleanly (Priority: P1)

A Windows 11 user installs Glitchpad for their own account, launches it, uses the stable text capabilities, and later removes the application without losing documents they created.

**Why this priority**: The installer is the primary Windows distribution path and must not leave broken registrations or damage user content.

**Independent Test**: Install the candidate on a clean Windows 11 x86_64 environment, exercise launch and core document actions, uninstall it, and verify application files and registrations are removed while user documents remain unchanged.

**Acceptance Scenarios**:

1. **Given** a clean supported Windows account, **When** the user runs the installer, **Then** Glitchpad installs for that user without administrator access and launches successfully.
2. **Given** an installed candidate, **When** the user opens, edits, saves, inspects, recovers, and prints supported content, **Then** each action preserves the existing stable-core behavior.
3. **Given** documents created or edited by Glitchpad, **When** the user uninstalls the application, **Then** application registrations and installed binaries are removed and those documents are preserved.

---

### User Story 2 - Open only truthfully supported files (Priority: P1)

A Windows user can open stable Markdown, Mermaid, plain-text, and approved source files through the file picker, drag and drop, command line, or registered file association without Glitchpad claiming unsupported formats.

**Why this priority**: Incorrect associations create false product claims and can route hostile or unsupported files into the wrong workflow.

**Independent Test**: Compare every dialog filter and registered association with the v0.1.0 capability matrix, then deliver representative files through each Windows entry path and verify the running application receives the intended source exactly once.

**Acceptance Scenarios**:

1. **Given** an installed candidate, **When** the user invokes a registered stable text-family file, **Then** Windows routes it to Glitchpad and the application opens it through the established source-safety boundary.
2. **Given** Glitchpad is already running, **When** another supported file is delivered by association or command line, **Then** the existing application session receives the file without losing current work or creating a duplicate open action.
3. **Given** the published package metadata, **When** associations are inspected, **Then** no image, PDF, office-document, executable, archive, or other planned/unsupported format is claimed.

---

### User Story 3 - Run the portable distribution (Priority: P2)

A Windows user can extract the portable ZIP and run Glitchpad without installing it or changing file associations.

**Why this priority**: The portable package is an official v0.1.0 artifact and must behave predictably without pretending to be an installed application.

**Independent Test**: Extract the ZIP into a fresh user-writable directory, verify its inventory, run the application, exercise the stable core through dialog, drag-and-drop, and command-line entry, then remove the extracted directory.

**Acceptance Scenarios**:

1. **Given** a clean Windows 11 x86_64 account, **When** the user extracts and launches the portable package, **Then** Glitchpad runs without installation or administrator access.
2. **Given** the portable package, **When** the user opens stable content through non-association entry paths, **Then** behavior matches the installed package.
3. **Given** the portable package has been used, **When** its directory is removed, **Then** no machine-level or per-user file association remains.

---

### User Story 4 - Verify an official Windows artifact (Priority: P2)

A release operator can distinguish an unsigned candidate from an official signed Windows package and verify its identity, contents, size, checksums, software bill of materials, notices, and provenance before publication.

**Why this priority**: A package without complete, verifiable evidence must never be presented as an official release.

**Independent Test**: Build candidate artifacts from the locked workspace, validate their inventories and evidence, then exercise both absent/invalid and valid signing inputs to prove only correctly signed artifacts can satisfy the official-release gate.

**Acceptance Scenarios**:

1. **Given** the locked source and toolchain, **When** Windows candidates are built, **Then** their names, architecture, version, contents, and digests are deterministic and machine-checkable.
2. **Given** missing or invalid signing credentials, **When** the official Windows gate runs, **Then** it fails closed without exposing secrets or relabeling an unsigned candidate as official.
3. **Given** valid release signing and complete evidence, **When** the official Windows gate runs, **Then** it verifies the installer signature, portable executable signature, checksums, bill of materials, provenance, notices, size budget, and clean-machine receipt.

### Edge Cases

- The target account lacks administrator rights or the installer encounters a locked prior installation.
- An upgrade, repair, or uninstall is attempted while Glitchpad is running or a supported file is open.
- A delivered path contains spaces, non-ASCII characters, a long path, a relative path, or shell-significant characters.
- Several supported paths arrive in one invocation, or a second invocation races application startup.
- A file has a supported extension but contradictory or invalid content.
- WebView2 Evergreen is missing, obsolete, or cannot be installed because the environment is offline.
- Package generation succeeds but signing is absent, invalid, expired, untrusted, or applied before the final artifact bytes are produced.
- An artifact, checksum, bill of materials, provenance statement, or clean-machine receipt is missing, stale, or refers to a different build.
- An installer or portable archive exceeds the 60 MiB hard limit, or a validation receipt contains a native path or secret.

## Requirements

### Functional Requirements

- **FR-001**: S019 MUST produce an x86_64 current-user Windows installer candidate and an x86_64 portable ZIP candidate from the locked workspace.
- **FR-002**: Candidate artifact names MUST follow `glitchpad-{version}-windows-x86_64.{ext}`, with an unambiguous installer extension and `.zip` for the portable archive.
- **FR-003**: The installer MUST support installation, launch, upgrade or repair, and uninstall without requiring administrator access under the supported Windows baseline.
- **FR-004**: Uninstall MUST remove Glitchpad application files and registered associations while preserving user-created or user-edited documents.
- **FR-005**: Any option to remove preferences or recovery data MUST be explicit, default to preservation, and disclose exactly what will be removed.
- **FR-006**: The portable ZIP MUST run from a user-writable extracted directory without installation, administrator access, or association registration.
- **FR-007**: Installed associations and file-dialog filters MUST be derived from or checked against one governed v0.1.0 capability inventory.
- **FR-008**: Association and dialog metadata MUST include stable Markdown (`.md`, `.markdown`), Mermaid (`.mmd`, `.mermaid`), plain text (`.txt`), and only the approved source extensions represented by the stable capability inventory.
- **FR-009**: Association and dialog metadata MUST exclude image, icon, vector, PDF, office, executable, archive, and every other planned or unsupported format.
- **FR-010**: Association, command-line, dialog, and drag-and-drop delivery MUST enter the established source acquisition, detection, safety, save, metadata, and recovery boundaries rather than bypassing them.
- **FR-011**: A supported file delivered while Glitchpad is already running MUST reach the active application session exactly once without discarding unsaved work.
- **FR-012**: The package workflow MUST preserve exact path arguments containing spaces, Unicode, long-path syntax, relative segments, and shell-significant characters without command interpretation.
- **FR-013**: Every candidate MUST embed the approved Windows icon assets, exact product identity, exact build version, Apache-2.0 license, project notice, and generated third-party notices.
- **FR-014**: The portable ZIP MUST contain the executable and all runtime files required by the package contract plus license and notice material, with a governed inventory that rejects missing or unexpected files.
- **FR-015**: The package workflow MUST generate SHA-256 checksums, a CycloneDX software bill of materials, and provenance metadata bound to the exact final candidate bytes.
- **FR-016**: Signing MUST occur after the final executable and installer bytes are produced, and signature verification MUST bind the artifact identity, digest, signer, and timestamp result used by the release gate.
- **FR-017**: Missing, malformed, expired, untrusted, mismatched, or unverifiable signing evidence MUST fail the official Windows gate closed, while ordinary pull requests MAY produce explicitly labeled unsigned candidates for validation.
- **FR-018**: Signing credentials and secret values MUST never be written to artifacts, logs, provenance, test fixtures, or repository files.
- **FR-019**: The compressed NSIS installer and portable ZIP MUST each be measured as actual artifacts against the 35 MiB target and 60 MiB hard limit.
- **FR-020**: The Windows package gate MUST reject wrong names, architecture, versions, icons, associations, inventories, digests, evidence links, or size classifications.
- **FR-021**: Clean-machine validation MUST cover install, first launch, dialog, drag-and-drop, command-line, association, open, edit, save, Save As, metadata, recovery, print, upgrade or repair, uninstall, and portable execution.
- **FR-022**: Clean-machine validation MUST verify Windows keyboard navigation, visible focus, text scaling, high contrast or forced colors, screen-reader naming, and the S018 Windows reference performance contract.
- **FR-023**: Every manual or automated package result MUST use a versioned, content-free receipt that identifies the candidate digests, environment, checks performed, outcomes, and evidence authority without recording user document content, native paths, or secrets.
- **FR-024**: CI MUST build and validate unsigned Windows candidates on pull requests and MUST prevent publication from pull-request contexts.
- **FR-025**: Official signing and publication MUST remain restricted to an explicitly authorized release context and MUST not be activated by S019 alone.
- **FR-026**: Every acceptance criterion MUST map to an automated check or an explicit clean-machine manual receipt, and incomplete required evidence MUST not pass.

### Key Entities

- **Windows Package Candidate**: A versioned installer or portable archive produced from a specific locked source revision before official-release authorization.
- **Capability Inventory**: The governed list of stable file families, extensions, descriptions, and association eligibility used to validate package claims.
- **Package Inventory**: The expected names, roles, versions, licenses, and digests of files included in one candidate.
- **Signature Evidence**: Verification facts for a signed executable or installer, including artifact digest, signer identity, trust outcome, and timestamp outcome.
- **Supply-Chain Evidence Set**: Checksums, software bill of materials, provenance, notices, version facts, and package inventory bound to candidate digests.
- **Clean-Machine Receipt**: A content-free record of the supported Windows environment and lifecycle, behavior, accessibility, and performance checks executed against exact candidates.
- **Windows Package Gate**: The deterministic aggregate that distinguishes candidate validation from official-release readiness and fails on missing, inconsistent, or invalid evidence.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The installer and portable ZIP build from the locked workspace and pass 100% of automated name, version, architecture, inventory, association, notice, checksum, bill-of-materials, provenance, and digest-consistency checks.
- **SC-002**: Clean Windows 11 x86_64 testing completes 100% of the governed install/open/core-action/upgrade-or-repair/uninstall and portable scenarios without administrator access, document loss, or stale registrations.
- **SC-003**: Every registered extension belongs to the stable v0.1.0 text-family inventory, and zero planned or unsupported extensions appear in installer or dialog claims.
- **SC-004**: Supported file delivery succeeds through dialog, drag and drop, command line, and association in 100% of governed path and running-instance cases without duplicate opens or lost unsaved work.
- **SC-005**: Both compressed candidates remain at or below the 35 MiB target; either candidate exceeding 60 MiB fails the gate.
- **SC-006**: The official Windows gate rejects 100% of governed missing, invalid, mismatched, stale, expired, untrusted, and pre-finalization signature cases.
- **SC-007**: Every official candidate has matching SHA-256 checksums, a CycloneDX software bill of materials, provenance, license, notices, exact version evidence, and a clean-machine receipt bound to its final digest.
- **SC-008**: The Windows accessibility matrix passes all keyboard, focus, scaling, high-contrast, and screen-reader checks, and applicable S018 Windows performance results stay within hard limits.
- **SC-009**: Uninstall and portable cleanup preserve 100% of governed user-document fixtures and leave zero registered Glitchpad associations after removal.

## Assumptions

- S019 implements GitHub issue #62 only. macOS, Linux, Android, cross-platform conformance, and final release activation remain owned by issues #63 through #67.
- Issues #46 and #61 satisfy S019's source-host and brand dependencies. S018 supplies the package-size and reference-performance contracts consumed here.
- The canonical product version remains the unreleased foundation version until the final release documentation and activation slice; S019 validates packaging with an explicit nonzero candidate version without changing the official repository version.
- Pull requests do not possess release signing credentials and therefore produce unsigned candidates that are never described as official artifacts.
- Official Windows signatures require separately provisioned release credentials and an authorized release event. S019 implements fail-closed signing and verification seams without creating, importing, or exposing credentials.
- WebView2 Evergreen remains a declared Windows runtime prerequisite rather than a browser engine bundled into the portable archive.
- Preferences and recovery data follow Windows platform conventions and are preserved by default; user documents are never removed by package lifecycle operations.
