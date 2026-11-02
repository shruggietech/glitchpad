# Feature Specification: S043 Image Conformance and Activation

**Feature Branch**: `codex/043-image-conformance-activation`

**Created**: 2026-11-02

**Status**: Specified

**Input**: Execute the approved S043 bundle for GitHub #66, #75 and #76 under autopilot, automatically push and open one official PR, resolve reviews with at most two rounds, and return for owner merge approval.

## Clarifications

### Session 2026-11-02

- Q: Are physical-device and manual screen-reader checks mandatory? → A: The owner explicitly removes these unavailable requirements. Automated accessibility and hosted platform checks remain required; reports must not claim physical-device or manual screen-reader validation.
- Q: Does PR authorization include merge or release publication? → A: No. Prepare v0.2.0 and its activation inputs, push and open the official PR automatically, then stop with green CI and satisfied reviews. #76 and #10 retain publication obligations until the owner completes the release ritual.
- Q: Should unrelated dependency PRs join this bundle? → A: No. Repair a dependency only when the S043 advisory or qualification gate demonstrates that it blocks this candidate.

## User Scenarios & Testing

### User Story 1 - Assess one truthful conformance result (Priority: P1)

An owner can inspect one traceable result for text-core and image behavior across every target platform, distinguishing current automated evidence from historical receipts and unperformed checks.

**Why this priority**: Stable activation must follow demonstrated behavior and expose regressions.

**Independent Test**: Every TS-FR-001 through TS-FR-023 obligation has evidence or an explicit actionable defect; missing or failed results cannot become passing results.

**Acceptance Scenarios**:

1. **Given** a candidate, **When** qualification runs, **Then** all 23 core obligations and all #66/#75 acceptance criteria map to named checks, platform results and retained artifacts.
2. **Given** malformed, truncated or resource-exhausting images, **When** processing runs, **Then** outcomes stay bounded with no source mutation, implicit network, script or native invocation.
3. **Given** automated accessibility and hosted desktop/Android results, **When** the report is assembled, **Then** it describes their actual scope without claiming physical or manual acceptance.

### User Story 2 - Open stable image families consistently (Priority: P1)

A user can choose or open each qualified raster, animation, vector and icon family through the existing native file flows and compact contextual interface.

**Why this priority**: Existing in-app image implementation needs consistent advertised host entry points.

**Independent Test**: The exact extension/MIME matrix agrees across chooser, desktop registrations and Android delivery, while PDF and office formats remain planned.

**Acceptance Scenarios**:

1. **Given** PNG, JPEG, WebP, BMP, TIFF, GIF, SVG or ICO input, **When** delivered by a supported host flow, **Then** content detection and existing source authority select the correct bounded viewer.
2. **Given** an unsupported or disguised source, **When** opened, **Then** the source contract reports its actual classification without granting format execution authority.
3. **Given** animation, metadata or ICO export, **When** used, **Then** reduced motion, privacy, source integrity, cancellation and independent destination rules are retained.

### User Story 3 - Review a complete v0.2.0 candidate (Priority: P2)

The owner receives one reviewed candidate with synchronized documentation, version identities and package inputs, ready for the final merge and release ritual.

**Why this priority**: Activation is meaningful only when user claims and installable package behavior agree.

**Independent Test**: Product, specification, package contracts and proposed release metadata agree on v0.2.0; the published v0.1.4 deployment remains separately identified until release publication.

**Acceptance Scenarios**:

1. **Given** a prepared candidate, **When** release consistency checks run, **Then** capabilities, versions, notices, documentation and package identities agree.
2. **Given** CI or review findings, **When** remediation completes, **Then** the final PR head has successful applicable checks and satisfied review threads, with no third review request and no automatic merge/tag/release.

### Edge Cases

- Truncated containers, extreme dimensions, animation/frame bombs, SVG remote/active content, malformed metadata, invalid ICO entries and generated-export payloads.
- Source revision, cancellation, low-memory refusal, suspended tabs, failed writes, revoked Android grants and corrupt recovery records.
- Missing evidence, stale receipts, dependency advisories, platform-specific classifier drift and release/candidate version confusion.

## Requirements

### Functional Requirements

- **FR-001**: Qualification MUST map TS-FR-001 through TS-FR-023 and every included issue criterion to current evidence or an explicit actionable defect.
- **FR-002**: Qualification MUST exercise bounded image detection, raster/family decoding, metadata, frame/entry parsing and export payload boundaries with fuzz regression coverage and retained reproducible inputs.
- **FR-003**: Qualification MUST measure image decode latency, peak process memory, suspended-surface behavior and final-package size, with explicit budgets and platform provenance.
- **FR-004**: Automated accessibility MUST cover static, animated, vector and icon critical controls, keyboard/touch, reduced motion and metadata; hosted Windows/macOS/Linux and Android API 24/36 MUST exercise native source and viewer contracts.
- **FR-005**: Physical-device and manual screen-reader checks MUST NOT be required gates; their absence MUST remain explicit and MUST NOT be represented as validation.
- **FR-006**: Stable candidate entry points MUST cover png, jpg, jpeg, webp, bmp, tif, tiff, gif, svg and ico using content detection and existing native source authority.
- **FR-007**: Image metadata privacy, script/network denial, original-source protection, source-neutral presentation, cancellation and bounded disposal MUST remain intact.
- **FR-008**: The candidate MUST reconcile v0.2.0 product/specification/package identities, capability declarations, associations/intents, changelog, README, site/help, notices, SBOM and release documentation.
- **FR-009**: Published-release deployment checks MUST distinguish the current official release from the unpublished candidate. No PDF/DOCX/ODT stable claim may be introduced.
- **FR-010**: Full quality, documentation, encoding, license/advisory, platform and package gates MUST run and retain their true outcomes before handoff.
- **FR-011**: Delivery MUST automatically push one official PR, address every review comment, request no more than one explicit follow-up round, and stop before owner merge/tag/publication.
- **FR-012**: #66/#75 closure MUST reflect their actual acceptance evidence; #76/#10 publication obligations MUST remain open until release. Any remaining criterion MUST be reported individually.

### Key Entities

- **Qualification row**: Obligation, issue, check, platform, source revision, evidence location, outcome and limitation.
- **Activation matrix**: Family, extensions, MIME types, chooser/association/intent state and supported operations.
- **Candidate receipt**: Version identities, completed slices, package digests/sizes, supply-chain state and publication boundary.
- **Review ledger**: Initial review, at most one requested follow-up, comment resolution and final head checks.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 23 core obligations and all included issue criteria have traceable outcomes, with zero missing rows or false passing results.
- **SC-002**: Every supported image family completes its golden/hostile/accessibility campaign on all four platform families, with no unbounded allocation or execution/network escape.
- **SC-003**: All ten activated extensions and their declared MIME aliases agree across supported host entry points; PDF and office formats remain inactive.
- **SC-004**: Every candidate identity agrees on 0.2.0, every required applicable check succeeds, and every received review comment has a recorded disposition.
- **SC-005**: The owner receives one unmerged official PR with retained qualification results, explicit limitations and at most two review rounds.

## Assumptions

- Existing S039/S040 decoders, controls, source/export contracts and corpus remain the implementation foundation. This slice extends qualification and delivery rather than replacing engines.
- The current official release is v0.1.4. v0.2.0 is a candidate until the owner authorizes its later publication.
- Owner-directed removal of unavailable physical/manual testing applies to current active requirements; historical release receipts remain historical.
- Windows commands use hidden repository launchers; local development checks run inside the repository Linux validation image. Native UI checks use isolated hosted runners.
