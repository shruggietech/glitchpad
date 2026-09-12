# Feature Specification: Publish a Working v0.1.3 Corrective Release

**Feature Branch**: `codex/s038-v013-release-rescue`

**Created**: 2026-09-11

**Status**: Ready for Planning

**Input**: User description: "Prepare S038 as a verified v0.1.3 corrective release that makes the post-v0.1.2 Markdown recovery and reserved-shell fixes available in official packages, proves the exact packaged application is practically usable, preserves v0.1.2 immutability, publishes a reviewed pull request under autopilot, and stops for the owner merge ritual after CI and two review rounds are satisfied."

## User Scenarios & Testing

### User Story 1 - Install Glitchpad and read a Markdown file (Priority: P1)

A person can download an official v0.1.3 package, install or unpack it on a supported platform, launch Glitchpad with clean application state, open ordinary Markdown files through supported operating-system entry paths, and see rendered content instead of a universal failure surface.

**Why this priority**: The previous official release is not practically usable for the primary Markdown workflow, so no roadmap expansion should take priority over delivering a working application.

**Independent Test**: Exercise the exact final package bytes in a clean environment, open a minimal Markdown document and a representative document through each supported delivery path, and verify rendered content, navigation, editing, saving, and continued application availability.

**Acceptance Scenarios**:

1. **Given** a clean supported environment and an official v0.1.3 package, **When** the package is installed or unpacked and launched, **Then** Glitchpad starts without requiring an account, network connection, or pre-existing application data.
2. **Given** a newly launched application, **When** a minimal supported Markdown file is opened through the in-application Open command, **Then** its rendered heading and body become visible without a document-level failure.
3. **Given** representative Markdown files, **When** they are delivered by file association, command line, and an already-running application where the platform supports those routes, **Then** each delivered document becomes the active rendered document and retains its own state.
4. **Given** a rendered Markdown document, **When** the user searches, enters source editing, saves a safe change, and returns to preview, **Then** the saved content is visible and the application remains usable.
5. **Given** a deterministic preview failure, **When** the user views source and retries preview, **Then** the failure stays confined to that document and a fresh preview attempt can succeed without restarting Glitchpad.

---

### User Story 2 - Trust every published package (Priority: P2)

A release maintainer can prove that every v0.1.3 application package was built from the reviewed release source, carries the expected version and trust metadata, passes its platform lifecycle checks, and is accompanied by complete integrity and provenance evidence.

**Why this priority**: A working source tree does not repair the user experience until the exact downloadable bytes have passed release-like installation and file-opening checks.

**Independent Test**: Build the complete governed package inventory from one reviewed revision, run the applicable clean-package lifecycle on each platform family, and reconcile each artifact with checksums, notices, software bills of materials, provenance, signatures or explicit unsigned status, and privacy-safe smoke receipts.

**Acceptance Scenarios**:

1. **Given** the reviewed v0.1.3 source, **When** package workflows complete, **Then** the full Windows, macOS, Linux, and Android package inventory is present with no v0.1.2 filename or embedded product identity.
2. **Given** an exact candidate artifact, **When** its platform lifecycle runs, **Then** installation or unpacking, launch, primary file delivery, visible content, shutdown, and cleanup succeed with bounded diagnostics.
3. **Given** a package and its evidence, **When** a maintainer reconciles the release inventory, **Then** the source revision, version, digest, trust state, notices, provenance, and smoke receipt agree exactly.
4. **Given** a failed lifecycle or missing evidence item, **When** release readiness is evaluated, **Then** publication remains blocked and the failed artifact cannot be represented as official.

---

### User Story 3 - Publish a truthful immutable corrective release (Priority: P3)

A user can identify v0.1.3 as the current supported corrective release, understand which practical defects it fixes and which limitations remain, download the correct package, and verify its integrity without any mutation of the historical v0.1.2 release.

**Why this priority**: Release claims must describe the bytes users can actually download, and the existing immutable release cannot be silently replaced with newer code.

**Independent Test**: Compare every public version and capability authority with the v0.1.3 release record, execute the owner-controlled post-merge tag procedure, and verify that the new release and production site refer to the same reviewed revision while v0.1.2 remains byte-for-byte unchanged.

**Acceptance Scenarios**:

1. **Given** the S038 pull request is under review, **When** its changes are inspected, **Then** no v0.1.3 tag, GitHub release, or production release deployment exists before owner merge approval.
2. **Given** the reviewed S038 merge revision, **When** the owner creates the exact authorized v0.1.3 tag, **Then** one release transaction builds or gathers the governed packages, verifies all gates, and publishes the official release without replacing v0.1.2.
3. **Given** a published v0.1.3 release, **When** a user reads the repository, website, support policy, security policy, changelog, release notes, and technical specification, **Then** each authority names v0.1.3 and describes the same stable capability boundary.
4. **Given** the v0.1.2 tag, release record, and assets captured before S038, **When** v0.1.3 publication completes, **Then** every v0.1.2 identity, timestamp, digest, and asset remains unchanged.

### Edge Cases

- A candidate built from any revision other than the reviewed release source must be rejected even when its filename and embedded version appear correct.
- A package that launches but cannot render the minimal Markdown fixture must fail the release gate.
- A package that passes a source-tree or browser-only test but has not passed its exact packaged lifecycle must not qualify as working release evidence.
- Existing application data must not be allowed to mask a clean-install failure, and clean-state evidence must remain distinguishable from restored-state evidence.
- Platform routes that do not exist on a target operating system must be documented rather than simulated and claimed as native evidence.
- Trust warnings caused by unsigned Windows packages or a non-notarized macOS package must remain explicit without being confused with application-function failures.
- A failed package or publication workflow must not replace, edit, append to, or delete the v0.1.2 release.
- A retry of the v0.1.3 transaction must detect an existing release or mismatched tag and stop rather than overwrite official assets.
- Release evidence must not contain opened document content, private filenames, native paths, link destinations, or embedded metadata.

## Requirements

### Functional Requirements

- **FR-001**: S038 MUST define v0.1.3 as a patch release containing the post-v0.1.2 Markdown preview recovery, reserved shell chrome, documentation publication, and release-automation corrections without adding a new format family.
- **FR-002**: The official product version and the technical specification version MUST both become 0.1.3 in the release candidate.
- **FR-003**: Every active manifest, package identity, workflow trigger, artifact name, public version claim, support authority, and release authority MUST agree on v0.1.3.
- **FR-004**: Historical v0.1.2 notes, receipts, runbooks, tag, release record, and release assets MUST remain immutable.
- **FR-005**: The v0.1.3 release source MUST include the merged S035, S036, and S037 corrections and MUST be traceable to issues #171 and #172 plus their reviewed implementation evidence.
- **FR-006**: S038 MUST retain the existing stable capability boundary of local Markdown, Mermaid, plain text, and recognized source files and MUST NOT activate image, PDF, DOCX, or ODT claims or associations.
- **FR-007**: The complete governed package inventory MUST be produced for Windows, macOS, Linux, and Android with the existing platform trust model documented accurately.
- **FR-008**: Exact packaged Windows evidence MUST cover a clean installer lifecycle and a clean portable lifecycle.
- **FR-009**: Exact packaged Windows evidence MUST prove rendered output for a minimal Markdown fixture and representative governed Markdown fixtures through the in-application Open command, file association, command-line delivery, and delivery to an already-running process.
- **FR-010**: Packaged evidence MUST prove source editing, a safe save, return to rendered preview, and document-scoped source-and-retry recovery without restarting the application.
- **FR-011**: Packaged evidence MUST prove the persistent application menu occupies reserved shell space and does not cover the document or recovery controls at the governed Windows display scales.
- **FR-012**: Shared desktop evidence MUST cover launch, visible Markdown content, reserved shell geometry, and clean termination on macOS and Linux packages.
- **FR-013**: Android evidence MUST retain supported content-provider discovery, cold delivery, warm delivery, visible supported content, permission-scoped access, and cleanup across the governed API levels.
- **FR-014**: Every package MUST be bound to the reviewed source revision, embedded product version, filename version, digest, trust state, and applicable lifecycle receipt.
- **FR-015**: The release inventory MUST include checksums, license notices, software bills of materials, provenance, attestations, signatures or explicit unsigned status, and privacy-safe platform evidence.
- **FR-016**: Release validation MUST fail if any required package, lifecycle result, evidence field, public authority, or version identity is missing, stale, inconsistent, or reports failure.
- **FR-017**: Evidence and diagnostics MUST exclude document contents, private filenames and paths, link destinations, and embedded metadata by default.
- **FR-018**: The release workflow MUST respond only to the exact v0.1.3 release tag and MUST refuse to replace an existing tag or release.
- **FR-019**: The pull-request phase MUST NOT create or push the v0.1.3 tag, publish the v0.1.3 GitHub release, or perform the release-authorized production deployment.
- **FR-020**: The owner-controlled post-merge runbook MUST identify the reviewed S038 merge commit as the sole valid v0.1.3 tag target.
- **FR-021**: Publication MUST remain blocked until all required package workflows, security checks, lifecycle checks, release reconciliation checks, and public documentation checks succeed for the same source revision.
- **FR-022**: After publication, the production site and release metadata MUST identify the same v0.1.3 source revision and official release URL.
- **FR-023**: S038 MUST record requirement-to-evidence traceability for the practical-use failures reported in #171 and #172 while leaving the broader stable-core matrix in #66 open unless all of its independent acceptance criteria are satisfied.
- **FR-024**: Work on the v0.2.0 image roadmap MUST remain deferred until the v0.1.3 release is published and its primary installed-user workflow is verified.

### Key Entities

- **Release source**: The single reviewed S038 merge revision authorized to receive the v0.1.3 tag after owner approval.
- **Application package**: One platform-specific downloadable artifact with version, platform, architecture, trust state, digest, and source-revision identity.
- **Practical-use receipt**: A privacy-safe result for an exact package that records clean state, delivery path, visible rendered markers, recovery behavior, shell geometry, termination, and pass or fail status.
- **Release evidence set**: The complete collection of packages, checksums, notices, software bills of materials, provenance, attestations, trust evidence, and lifecycle receipts required for publication.
- **Public release authority**: The synchronized set of product manifests, technical specification, changelog, release notes, support and security policies, website metadata, release workflow, exact tag, and GitHub release record.
- **Historical release baseline**: The captured immutable identity and asset inventory of v0.1.2 used to detect accidental mutation.

## Success Criteria

### Measurable Outcomes

- **SC-001**: One hundred percent of the governed v0.1.3 package inventory is produced from one reviewed source revision with matching embedded and filename versions.
- **SC-002**: The minimal Markdown fixture and every representative governed Markdown fixture reach visible rendered preview in both exact Windows package forms with zero universal document failures.
- **SC-003**: One hundred percent of supported Windows delivery paths activate the intended document in clean and already-running application states.
- **SC-004**: The packaged recovery scenario completes from contained failure to source and back to rendered preview in one retry without an application restart.
- **SC-005**: The application menu has zero intersection with document and recovery-control regions at 100, 125, 150, and 200 percent governed Windows display scaling.
- **SC-006**: Every required macOS, Linux, and Android package lifecycle reports success for launch, primary delivery, visible content, termination, and cleanup appropriate to that platform.
- **SC-007**: Every published application package has one matching digest, notice set, software bill of materials, provenance record, trust declaration, and lifecycle evidence record, with zero orphaned or duplicated inventory entries.
- **SC-008**: All release, security, dependency, documentation, encoding, platform, and packaging gates complete successfully for the same candidate revision before publication is authorized.
- **SC-009**: Public product, specification, package, documentation, workflow, and release identities contain zero active v0.1.2 claims after v0.1.3 publication, excluding clearly historical records.
- **SC-010**: The v0.1.2 tag, release metadata, and fourteen-asset inventory show zero changes throughout S038 and v0.1.3 publication.
- **SC-011**: Release evidence contains zero raw document-content excerpts, private filenames or paths, link destinations, or embedded metadata values.
- **SC-012**: A user can identify, download, verify, install or unpack, launch, and open a Markdown file with the official v0.1.3 release using only the published release and support instructions.

## Assumptions

- v0.1.3 is the next available patch identity and no tag or GitHub release with that name exists before S038.
- S035 contains the intended fixes for #171 and #172, while S036 and S037 are compatible documentation and release-operation corrections that should ship from the same current mainline source.
- Existing package formats and the community trust model remain unchanged: Windows remains unsigned, macOS remains ad-hoc signed and non-notarized, Linux retains repository attestations, and Android retains the stable project-owned update key.
- The release pull request prepares and validates v0.1.3 but does not publish it; the owner merge ritual authorizes the exact post-merge tag transaction.
- Real-user confidence requires exact-package evidence and cannot be established solely by source, browser, component, or static policy tests.
- The broader #66 conformance program and the v0.2.0 image family remain outside S038 except for focused evidence directly required to release the corrected stable core.
