# Feature Specification: BrandBuilder Release Integration

**Feature Branch**: `codex/042-brandbuilder-release-integration`

**Created**: 2026-09-24

**Status**: In Implementation

**Input**: Integrate the complete formally released Glitchpad brand 1.1.1 kit from BrandBuilder 2.0.3 into Glitchpad, with exact provenance, platform assets, enforcement, and documentation. Tracked by issues #202, #203, and #204 in one S042 work slice.

## User Scenarios & Testing

### User Story 1 - Trust one released kit (Priority: P1)

As a maintainer, I can identify and recover the exact released kit that governs Glitchpad without relying on a mutable website or a previous local kit.

**Why this priority**: Every downstream asset and contract depends on the same complete source package.

**Independent Test**: Import the named release into a clean checkout and confirm every governed file, release checksum, recovery archive, and integration receipt agrees with the release.

**Acceptance Scenarios**:

1. **Given** the formal release and its checksum manifest, **when** the kit is imported, **then** every delivered file matches the source manifest and the receipt names one exact package and revision.
2. **Given** an incomplete or altered archive, **when** import is attempted, **then** import fails without borrowing files from the existing kit.
3. **Given** a fresh checkout without network access, **when** a maintainer follows the recorded recovery instructions, **then** the exact bundled BrandBuilder version can be identified and checked.

---

### User Story 2 - Receive correct platform artwork (Priority: P2)

As a user installing or opening Glitchpad on supported platforms, I see the released brand artwork in the correct icon role without an altered product identity.

**Why this priority**: The release separates ordinary and maskable web artwork and revises Android launcher presentation.

**Independent Test**: Inspect site and application package inputs against the released kit, including the role declared for each web icon and the Android launcher resource set.

**Acceptance Scenarios**:

1. **Given** the public site manifest, **when** a browser selects an ordinary or maskable icon, **then** it receives the distinct released asset for that role.
2. **Given** Android and desktop package inputs, **when** they are assembled, **then** each governed copy matches its assigned released source bytes.
3. **Given** the updated kit, **when** the application shell opens, **then** its existing file-first layout and approved logo geometry remain intact.

---

### User Story 3 - Detect drift before delivery (Priority: P3)

As a maintainer, I get a clear failure when kit versions, package provenance, consumer copies, licensing, or documentation drift from the released contract.

**Why this priority**: A correct import must remain correct through later site and package changes.

**Independent Test**: Deliberately alter a fixture copy or receipt field and confirm the relevant check rejects it; follow the committed S042 record to reproduce the successful checks.

**Acceptance Scenarios**:

1. **Given** a missing, stale, or misclassified platform asset, **when** the delivery checks run, **then** they fail with the affected path or role.
2. **Given** a stale package or recovery version, **when** the brand checks run, **then** they fail before an artifact is described as verified.
3. **Given** the completed slice, **when** a new maintainer reads its record, **then** the source, changed surfaces, checks, and unverified scope are explicit.

### Edge Cases

- The release contains a complete archive but its README legal link assumes the source repository layout; the consumer records one deterministic correction and both source and integrated digests.
- A hosted brand page or sibling source branch moves after release publication; the pinned release remains the authority for this slice.
- A platform asset is byte-identical to the previous kit; the source mapping and check remain explicit even when no copied bytes change.
- A kit surface has no production consumer, such as the egui adapter; it remains in the complete delivery and its lack of an application call site is recorded.

## Requirements

### Functional Requirements

- **FR-001**: The repository MUST identify one formal Glitchpad 1.1.1 / BrandBuilder 2.0.3 package by release tag, package name, source revision, and archive checksum.
- **FR-002**: Import MUST verify the complete source inventory and fail when a governed source file is missing or altered.
- **FR-003**: The integrated kit MUST include all released contract, recovery, licensing, guidance, and platform files, including the release archive's three legal files outside the governed manifest, with any intentional local correction documented and checksummed.
- **FR-004**: The public site MUST serve separate ordinary and maskable icons according to the released role declarations.
- **FR-005**: Android and desktop package inputs MUST map to the released source assets and retain the approved logo construction.
- **FR-006**: Automated checks MUST detect stale versions, provenance, recovery bytes, governed files, platform copies, icon roles, and agent instructions.
- **FR-007**: The completed slice MUST record its issue mapping, decisions, migration impact, validation results, and limits without changing the historical record of earlier slices.
- **FR-008**: The existing AppFrame ownership and offline file workflows MUST remain functional.

### Key Entities

- **Released package**: One immutable archive with its package ID, release tag, source revision, checksum, and file manifest.
- **Integration receipt**: Project-owned record of the source package, the intended README correction, integrated manifest, recovery bytes, and retrieval date.
- **Platform mapping**: An explicit relationship from each governed asset role to a site or application destination.
- **Validation record**: Results and limits for checks that establish each issue's acceptance criteria.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 321 manifest-governed files and the three separately archived legal files are accounted for, with zero missing, unexpected, or unverified entries.
- **SC-002**: Every production platform copy covered by the brand mapping matches its assigned released source bytes.
- **SC-003**: The public manifest declares two ordinary and two distinct maskable icon entries, and all four files are present.
- **SC-004**: The documented brand and aggregate delivery gates complete with zero findings before the slice is called verified; any unavailable host check is identified by name and remains unclaimed.
- **SC-005**: All three S042 issues have explicit acceptance evidence and one linked implementation pull request.

## Assumptions

- The v2.0.3 formal release is the source for this slice. A newer release appearing during implementation requires an explicit scope reassessment, not an automatic version substitution.
- No new product release, deployment, identity redesign, navigation redesign, or egui application consumer is requested.
- The existing project-owned README legal-link correction remains necessary because the release archive retains a source-layout-relative link.
- Existing AppFrame adoption is assessed for compatibility and retained when its generated interface is unchanged.
