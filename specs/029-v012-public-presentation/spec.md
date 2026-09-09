# Feature Specification: v0.1.2 Public Presentation Corrections

**Feature Branch**: `codex/029-v012-public-presentation`

**Created**: 2026-09-09

**Status**: Draft

**Input**: Deliver S029 as the coherent corrective slice for issues #151 through #156, publish an official pull request, resolve no more than two Codex review rounds, and return only when reviews are settled and CI is green.

**Tracking Epic**: [#157](https://github.com/shruggietech/glitchpad/issues/157)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Recognize the current product and owner (Priority: P1)

As a visitor, I can immediately recognize Glitchpad, read its approved purpose, identify ShruggieTech as its owner, and reach the current release without encountering broken or illegible branding.

**Why this priority**: The current public surfaces misrepresent the released product and visibly break the product identity.

**Independent Test**: Open the repository README and every public-site route in light and dark themes at 320, 768, and 1280 pixel widths and verify the complete approved lockup, canonical wording, ownership endorsement, and concise task-oriented navigation.

**Acceptance Scenarios**:

1. **Given** GitHub light or dark mode, **When** the README loads, **Then** the complete Glitchpad lockup is visible without clipping or overflow.
2. **Given** any public site route and supported theme, **When** the header loads, **Then** the contextual Glitchpad lockup is legible and has one accessible name.
3. **Given** the landing page, **When** a visitor scans its primary content and actions, **Then** it says "View your files.", uses the canonical descriptor, identifies ShruggieTech, and offers concise `Download` and `Docs` actions.

---

### User Story 2 - Trust public release information (Priority: P2)

As a visitor or maintainer, I can see accurate product version, availability, specification status, and dates across the repository and deployed documentation.

**Why this priority**: Contradictory version and date claims make the official release authority unreliable.

**Independent Test**: Compare repository authorities, generated documentation, and the production site and verify that they agree on the current v0.1.1 release until v0.1.2 is published, with unambiguous specification dates and no claim that installable packages are unavailable.

**Acceptance Scenarios**:

1. **Given** the current official v0.1.1 release, **When** public content is built, **Then** every active release claim and download action describes or targets v0.1.1 accurately.
2. **Given** the technical specification, **When** its control table and revision history are compared, **Then** `Issued` and `Updated` have defined, internally consistent meanings.
3. **Given** a stale release claim or contradictory specification date, **When** repository validation runs, **Then** validation fails before deployment.

---

### User Story 3 - Deploy the reviewed site reliably (Priority: P3)

As a release operator, I can deploy the reviewed public site from the intended source revision and verify production freshness without mistaking a successful build for a successful deployment.

**Why this priority**: The existing workflow builds on `main` but requires a separate manual dispatch to deploy, which allowed production to remain stale after v0.1.1.

**Independent Test**: Exercise pull-request, main-branch, and manual workflow paths and verify that only the authorized deployment path mutates Pages, that the deployed site exposes source/version provenance, and that production verification detects stale content and broken critical links.

**Acceptance Scenarios**:

1. **Given** a pull request, **When** site CI runs, **Then** it builds and tests without deploying.
2. **Given** a reviewed merge to `main`, **When** the docs workflow succeeds, **Then** the validated artifact deploys to the protected Pages environment.
3. **Given** a deployment, **When** the production verification runs, **Then** it confirms the expected version, source revision, canonical copy, lockup assets, and release link before delivery is reported successful.

### Edge Cases

- GitHub strips or clips an SVG feature that browsers render locally.
- Stored theme and system theme disagree during hydration.
- The upstream brand kit changes without changing its semantic version.
- The upstream registry is unavailable during routine offline validation.
- A valid build artifact is never deployed, or production still serves an older source revision.
- v0.1.2 is not yet published while the corrective site is prepared against the current v0.1.1 release.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The repository MUST import the latest complete Glitchpad brand delivery from the authoritative ShruggieTech source without hand-editing generated assets.
- **FR-002**: The brand integration receipt MUST record the upstream source revision, retrieval date, whole-kit digest, and governed per-file hashes.
- **FR-003**: Validation MUST detect same-version upstream brand drift when an explicit online freshness check is requested, while normal repository validation remains reproducible offline.
- **FR-004**: The README MUST use a GitHub-compatible lockup representation whose visible output is complete in light and dark modes.
- **FR-005**: Every public site route MUST use the correct contextual Glitchpad lockup with a single accessible product name.
- **FR-006**: Public lockups MUST remain legible and unclipped at 320, 768, and 1280 pixel reference widths in light, dark, stored-theme, and system-theme scenarios.
- **FR-007**: The landing-page headline MUST be exactly `View your files.` and its descriptor MUST be exactly `A fast, cross-platform viewer and editor for local files.`
- **FR-008**: The landing page MUST display the exact ownership endorsement `A ShruggieTech project.` outside logo clear space.
- **FR-009**: Primary actions MUST be named `Download` and `Docs`; Download MUST target the authoritative current release destination.
- **FR-010**: Support and Security MUST NOT occupy primary navigation; security reporting and policy documents MUST remain discoverable in an appropriate secondary location.
- **FR-011**: Active public copy MUST identify v0.1.1 as installable until v0.1.2 is published and MUST contain no contradictory pre-release availability claim.
- **FR-012**: The specification control table MUST define and distinguish original issue date from current update or effective date, and repository and generated copies MUST agree.
- **FR-013**: Validation MUST reject stale public versions, contradictory release availability, incorrect canonical slogans, missing ShruggieTech attribution, and inconsistent specification dates.
- **FR-014**: Pull-request validation MUST build and test without deploying.
- **FR-015**: A successful reviewed merge to `main` MUST deploy the validated Pages artifact without requiring an untracked manual follow-up dispatch.
- **FR-016**: The deployed site MUST expose machine-readable product version and source revision provenance.
- **FR-017**: Post-deployment verification MUST reject stale production version, source revision, canonical copy, critical release links, or missing lockup assets.
- **FR-018**: S029 MUST NOT publish the v0.1.2 tag or GitHub release; #157 remains open until the separate owner-approved release ritual completes.
- **FR-019**: All added source and documentation files MUST be UTF-8 without BOM and free of mojibake.

### Key Entities

- **Brand delivery**: The generated Glitchpad kit, its upstream revision, governed file inventory, hashes, and integration receipt.
- **Public identity contract**: Canonical logo treatments, brand idea, descriptor, ownership endorsement, and primary action labels.
- **Release authority**: The current product version and authoritative GitHub release destination represented in public content.
- **Specification control record**: Original issue date, current updated/effective date, version, release class, and revision history.
- **Deployment provenance**: The product version and exact source revision serving production.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The complete README and public-site lockups render visibly in both supported themes at all three reference widths with zero clipping or overflow failures.
- **SC-002**: Every inspected public route contains exactly one accessible Glitchpad navigation identity and all landing-page canonical strings match the brand authority exactly.
- **SC-003**: One validation run rejects tested mutations for stale version, false installability, wrong slogan, missing ownership endorsement, stale specification dates, and mismatched brand hashes.
- **SC-004**: The imported brand receipt accounts for 100% of governed files and identifies one upstream revision, retrieval date, and whole-kit digest.
- **SC-005**: Pull-request runs perform zero Pages deployments, while one successful `main` workflow deploys exactly the artifact that passed validation.
- **SC-006**: Production verification confirms the expected version and source revision plus all critical public routes, lockups, and release links before deployment reports success.
- **SC-007**: All local repository gates and pull-request CI checks pass before S029 is presented for merge.

## Assumptions

- v0.1.1 remains the current official release while S029 is reviewed.
- GitHub Releases remains the download authority and paid signing or store enrollment remains outside this slice.
- The authoritative brand source is the current `ShruggieTech/shruggie-brand` main revision that produces brand.shruggie.tech.
- Live production verification may occur only after merge; repository-side tests use the exported artifact and deterministic fixtures before the pull request is published.
- Issues #151 through #156 are delivered by S029; #157 coordinates the later v0.1.2 publication and is not closed by this implementation pull request.

## Out of Scope

- Publishing the v0.1.2 tag or GitHub release.
- v0.2 image-viewing capabilities.
- Application-interface redesign unrelated to public brand and release presentation.
- Paid code signing, Apple notarization, or store publication.
