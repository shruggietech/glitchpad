# Feature Specification: Ship Android Packages

**Feature Branch**: `codex/022-android-packaging`

**Created**: 2026-09-06

**Status**: Draft

**Input**: User description: "S022: deliver Android release packaging for GitHub issue #65 under the autopilot protocol, with manual and physical-device validation deferred until after v0.1.0 publication."

## User Scenarios & Testing

### User Story 1 - Obtain installable Android release packages (Priority: P1)

An Android user or distribution operator can obtain a universal APK, an ARM64 APK, or an Android App Bundle carrying the same Glitchpad v0.1.0 candidate identity.

**Why this priority**: Android is the final platform family that lacks the artifacts required for the first official release.

**Independent Test**: Assemble all three deliverables from one source revision and inspect their package identity, version, supported runtime range, architecture contents, and final-byte digests.

**Acceptance Scenarios**:

1. **Given** the v0.1.0 candidate source, **When** Android packaging completes, **Then** one universal APK, one ARM64 APK, and one AAB are available under canonical release names.
2. **Given** the universal APK, **When** its native-library inventory is inspected, **Then** it contains ARM64 and x86_64 application libraries and no unsupported architecture claim.
3. **Given** the ARM64 APK, **When** its native-library inventory is inspected, **Then** it contains ARM64 application libraries and excludes x86_64 application libraries.
4. **Given** any of the three deliverables, **When** package metadata is inspected, **Then** the application identifier, version, minimum Android level, target Android level, and release build type agree with the governed package contract.

---

### User Story 2 - Receive truthful Android document intents (Priority: P1)

An Android user can offer implemented Markdown, Mermaid, plain-text, and approved source documents to Glitchpad without the application claiming image, PDF, office, archive, executable, or other planned formats.

**Why this priority**: Intent declarations are public product claims and determine which private documents Android may offer to the application.

**Independent Test**: Inspect the merged release manifest and compare every exported activity action, category, media type, scheme, and extension declaration with the governed stable capability inventory.

**Acceptance Scenarios**:

1. **Given** a stable text-family document, **When** Android resolves compatible view or single-item share handlers, **Then** Glitchpad is eligible under a content-provider URI grant.
2. **Given** a planned or unsupported document family, **When** Android package declarations are inspected, **Then** no matching Glitchpad intent claim exists.
3. **Given** an external document delivery, **When** the package manifest is inspected, **Then** it requires a content URI path and does not request broad storage access.
4. **Given** a release package, **When** its network and backup posture is inspected, **Then** cleartext traffic remains disabled and provider authority remains private to the application.

---

### User Story 3 - Verify Android artifact identity and provenance (Priority: P2)

A release operator can determine exactly which source revision produced each Android deliverable and can reject incomplete, oversized, mislabeled, modified, or insufficiently attributed candidates before they enter the final release slice.

**Why this priority**: Final publication must consume known bytes with explicit identity, licensing, dependency, and signing status rather than rediscovering package facts during the release ceremony.

**Independent Test**: Mutate or omit governed package facts, artifacts, checksums, notices, software-bill-of-materials entries, provenance fields, or signing evidence and confirm deterministic rejection; then confirm a complete pull-request candidate remains clearly non-official.

**Acceptance Scenarios**:

1. **Given** a pull-request build, **When** evidence is assembled, **Then** all three artifacts receive SHA-256 checksums, inventories, a software bill of materials, provenance, license notices, and an explicit non-official authority classification.
2. **Given** missing or inconsistent artifact evidence, **When** the package gate runs, **Then** the candidate is rejected without being described as official.
3. **Given** official Android signing inputs in an authorized release context, **When** package assembly runs, **Then** every official APK and AAB is signed and the signing certificate digest is bound to final-byte evidence.
4. **Given** no official signing inputs, **When** branch or pull-request packaging runs, **Then** only disposable candidate authority may be used and the resulting artifacts cannot satisfy official publication authority.

### Edge Cases

- One expected artifact is absent, duplicated, stale, or produced for the wrong version or source revision.
- The universal package silently drops x86_64 or gains an undeclared ABI, while the ARM64 package accidentally contains additional architectures.
- Package names or internal versions disagree across APK and AAB outputs.
- The final artifact exceeds the 40 MiB target or 65 MiB hard limit.
- Manifest merging broadens an intent filter, enables cleartext traffic, exports an unintended component, or requests broad storage permission.
- A candidate keystore or official signing input is missing, partial, malformed, logged, copied into the repository, or confused with official authority.
- A checksum, inventory, software bill of materials, or provenance record describes pre-signing bytes instead of the final delivered bytes.
- Artifact paths, manifests, or evidence contain workspace-specific absolute paths, credentials, raw document identifiers, or other private data.

## Requirements

### Functional Requirements

- **FR-001**: The packaging workflow MUST produce exactly one universal APK, one ARM64 APK, and one AAB for the v0.1.0 candidate.
- **FR-002**: Official artifact names MUST follow `glitchpad-{version}-android-{arch}.{ext}` with unambiguous `universal` and `arm64` architecture labels.
- **FR-003**: The universal APK MUST contain ARM64 and x86_64 application libraries, while the ARM64 APK MUST contain only ARM64 application libraries.
- **FR-004**: Every deliverable MUST declare application identifier `com.shruggietech.glitchpad`, minimum API 24, target API 36, the governed version name, and a positive version code.
- **FR-005**: Release builds MUST disable debugging and cleartext traffic and MUST retain the existing application-private backup, file-provider, and content-security posture.
- **FR-006**: Exported Android activities MUST claim only the implemented text, Markdown, Mermaid, and approved source-document families through content-provider URI deliveries and single-item share actions.
- **FR-007**: Android packaging MUST NOT claim image, PDF, office, archive, executable, multi-item share, broad filesystem, or planned document capabilities.
- **FR-008**: The package MUST use the approved Glitchpad name and Android launcher assets and MUST carry the Apache-2.0 license and required third-party notices alongside distributed artifacts.
- **FR-009**: Each final artifact MUST have a SHA-256 checksum, normalized package inventory, CycloneDX software bill of materials, and provenance record bound to its final bytes and source revision.
- **FR-010**: The universal APK MUST remain at or below 65 MiB, with results above 40 MiB reported as a target miss rather than silently accepted.
- **FR-011**: Branch and pull-request builds MUST be labeled non-official and MUST NOT satisfy official Android signing authority.
- **FR-012**: Official builds MUST fail closed unless all required signing inputs are supplied through the authorized secret boundary and every final APK and AAB verifies against the recorded certificate digest.
- **FR-013**: Signing secrets and private keys MUST never be committed, bundled, printed, uploaded as evidence, or retained in repository artifacts.
- **FR-014**: Android package assembly and evidence checks MUST be repeatable through repository commands and an isolated Linux build environment with pinned required tooling.
- **FR-015**: Package-related changes MUST participate in repository labels, validation-file routing, changelog traceability, and the final release workflow handoff.
- **FR-016**: Manual, physical-device, TalkBack, touch, rotation, background/restore, low-memory, and real-world provider validation MUST be explicitly recorded as post-release work and MUST NOT block S022 closure or v0.1.0 publication.

### Key Entities

- **Android package contract**: The governed identity, version, API range, ABI composition, intent surface, artifact names, size policy, notices, and authority rules shared by all Android deliverables.
- **Android artifact**: One final APK or AAB with a canonical role, byte length, SHA-256 digest, internal package facts, and signing classification.
- **Package inventory**: A normalized record of application metadata, native ABIs, exported components, permissions, intent claims, embedded notices, and signing information extracted from a final artifact.
- **Android evidence manifest**: The content-free binding between the three final artifacts, their inventories, source revision, toolchain identity, checksums, software bill of materials, provenance, and authority classification.
- **Signing authority**: Either disposable candidate authority used only to exercise the packaging path or repository-provisioned official authority eligible for v0.1.0 publication.

## Success Criteria

### Measurable Outcomes

- **SC-001**: One packaging run produces all three required Android deliverables with canonical, versioned names and no missing or duplicate role.
- **SC-002**: Package inspection reports ARM64 plus x86_64 for the universal APK, ARM64 only for the split APK, application identifier `com.shruggietech.glitchpad`, minimum API 24, target API 36, and identical version identity for 100% of deliverables.
- **SC-003**: Every declared intent media type and extension belongs to the governed stable text-family inventory, and zero image, PDF, office, archive, executable, multi-item share, or broad-storage claims are present.
- **SC-004**: The universal APK is no larger than 65 MiB, with a machine-readable target classification at the 40 MiB threshold.
- **SC-005**: All three final artifacts have matching SHA-256 entries, normalized inventories, CycloneDX coverage, provenance, license, notices, source-revision identity, and explicit signing-authority classification.
- **SC-006**: The package gate rejects 100% of governed missing, duplicated, stale, modified, mislabeled, oversized, wrong-ABI, wrong-version, broadened-intent, incomplete-notice, and invalid-authority fixtures.
- **SC-007**: Automated repository and Android package checks complete successfully before the S022 pull request is published, without requiring manual or physical-device validation.

## Assumptions

- S022 implements GitHub issue #65 only. Final documentation reconciliation, cross-platform release assembly, tagging, and publication remain S023 under issue #67.
- Existing issue #47 and S011 provide the Android source and lifecycle implementation; this slice packages that implementation and does not redesign provider behavior.
- Version `0.1.0` is the Android candidate identity for this slice and does not itself publish the official release.
- The universal package includes the required ARM64 and x86_64 architectures. Legacy ARMv7 and x86 delivery are outside the v0.1.0 package contract.
- Pull-request candidates may use disposable signing authority solely to prove that final APK and AAB signing works. Disposable authority never becomes official release authority.
- Official Android signing credentials, if not yet provisioned, remain an S023 release-operator input; S022 must implement and fail closed at that boundary.
- The current GitHub issue text governs S022: manual and physical-device validation begins after v0.1.0 publication and is not a closure gate.
- The mandatory v0.1.0 documentation pass in S023 will reconcile the canonical technical specification where it still describes deferred validation as a pre-publication gate.
