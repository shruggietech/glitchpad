# Feature Specification: Brand Kit Refresh

**Feature Branch**: `codex/025-brand-kit-refresh`

**Created**: 2026-09-07

**Status**: Ready

**Input**: User description: "Obtain the improved Glitchpad brand kit from brand.shruggie.tech and apply it to the project in work slice S025 using Spec Kit autopilot."

## User Scenarios & Testing

### User Story 1 - See one current identity everywhere (Priority: P1)

People viewing Glitchpad in the repository, public site, installed application, or operating-system launcher see the same approved square Glitchpad identity and contextual light/dark treatment.

**Why this priority**: The first release must not mix the retired open-page identity with the newly approved square system.

**Independent Test**: Compare each governed product surface with the approved masters and confirm every copied asset is an exact approved derivative.

**Acceptance Scenarios**:

1. **Given** a dark or light repository or website surface, **When** the Glitchpad lockup is shown, **Then** the appropriate approved contextual lockup is used without recomposition.
2. **Given** a packaged desktop or Android application, **When** its launcher or application icon is displayed, **Then** it uses the approved square platform asset rather than a foundation placeholder.

### User Story 2 - Preserve a verifiable brand delivery (Priority: P2)

Maintainers can identify the exact upstream brand source, validate the imported kit, and reproduce every project-owned copy from governed assets.

**Why this priority**: Brand provenance and licensing are release gates, and silent local edits would make the delivery untrustworthy.

**Independent Test**: Run the brand integration gate against the imported manifest, receipt, and all copied product assets.

**Acceptance Scenarios**:

1. **Given** the imported kit, **When** validation runs, **Then** the declared version, canon, file sizes, checksums, licenses, and encoding all pass.
2. **Given** a copied website or platform asset, **When** it is compared with its canonical source, **Then** the bytes match exactly.

### User Story 3 - Retain accessible product behavior (Priority: P3)

People can use the refreshed public and application surfaces without losing readable contrast, visible focus, or non-color status cues.

**Why this priority**: The visual refresh cannot weaken existing accessibility or content-first behavior.

**Independent Test**: Run existing theme, accessibility, site, package, and integration checks with the refreshed assets and tokens.

**Acceptance Scenarios**:

1. **Given** either supported theme, **When** a user navigates the site or application, **Then** focus and text remain readable and the document remains visually primary.

### Edge Cases

- Small icons below the approved threshold use the reduced master selected by the upstream platform suite.
- Light and dark surfaces use the supplied contextual variants rather than recoloring an asset locally.
- A missing, extra, or modified governed file fails validation instead of being silently accepted.
- Generated upstream files that are no longer part of the approved delivery are removed rather than retained as stale authority.

## Requirements

### Functional Requirements

- **FR-001**: The repository MUST import the complete verified Glitchpad brand kit version 1.1.0 governed by canon 1.2.1 from upstream commit `1681fcd444ff851d5bffc2cf67e23bbcedd753cd`.
- **FR-002**: The repository MUST record the source commit, successful upstream build run, acquisition method, and integration mapping without modifying manifest-governed files.
- **FR-003**: Repository and public-site logos, favicons, fonts, social imagery, and theme bindings MUST use approved kit assets or tokens.
- **FR-004**: Windows, macOS, Linux, and Android packaging inputs MUST replace foundation resources with approved platform-specific kit assets.
- **FR-005**: Every project-owned copied asset MUST be byte-identical to its canonical kit source and covered by automated validation.
- **FR-006**: The brand gate MUST validate the current kit version and canon, manifest integrity, required licenses, UTF-8 integrity, provenance, and production integrations.
- **FR-007**: Existing accessibility, local-first, content-first, packaging, and release-trust contracts MUST remain unchanged.
- **FR-008**: S025 MUST NOT publish v0.1.0 or broaden supported product capabilities; release assembly remains a subsequent slice.

### Key Entities

- **Verified Brand Delivery**: The immutable upstream kit, identified by brand version, canon version, commit, build run, and manifest.
- **Integration Mapping**: A project destination and the single canonical asset from which it is copied.
- **Brand Receipt**: The project-owned provenance and verification record for the imported delivery.

## Success Criteria

### Measurable Outcomes

- **SC-001**: One hundred percent of manifest entries pass byte-length and SHA-256 verification.
- **SC-002**: One hundred percent of repository, site, desktop, and Android brand copies match their declared canonical sources.
- **SC-003**: No foundation placeholder icon remains referenced by a distributable package configuration.
- **SC-004**: All focused brand, site, Android, and desktop packaging checks pass before pull-request publication.
- **SC-005**: The complete repository validation gate passes with zero brand-related regressions.

## Assumptions

- `https://brand.shruggie.tech` is the public distribution surface for the `shruggietech/shruggie-brand` repository.
- The successful upstream Build and Pages runs for commit `1681fcd` establish the approved delivery.
- The upstream CI artifact is the manifest-bound complete kit; the public site exposes its production asset subset.
- Binary assets may be copied mechanically, but may not be edited or regenerated inside Glitchpad.
