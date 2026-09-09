# Research: v0.1.2 Public Presentation Corrections

## Authoritative brand delivery

**Decision**: Pin and rebuild the Glitchpad kit from `ShruggieTech/shruggie-brand` commit `737cc1e88f3ddf50950a50897f68cdd131bf0167`, the current `main` revision observed on 2026-09-09, and independently compare public download derivatives where available.

**Rationale**: `brand.shruggie.tech/glitchpad/` reports Glitchpad brand 1.1.0, the exact descriptor `A fast, cross-platform viewer and editor for local files.`, and the brand idea `View your files.`. The public site exposes generated derivatives but not the complete kit manifest; the source repository plus its pinned generator is therefore the complete reproducible authority. The older v1.2.1 GitHub release contains a Glitchpad 1.0.0 archive and is not current enough for this import.

**Alternatives considered**: Keep the local same-version kit (rejected because hashes differ); copy individual live assets (rejected because it cannot prove completeness); use the older release ZIP (rejected because it is version 1.0.0).

## README rendering

**Decision**: Use contextual PNG lockups for the GitHub README and validate dimensions, nontransparent pixel bounds, and selected paths.

**Rationale**: GitHub clips the current transformed SVG mask while the upstream raster export renders the complete composition. Filename and byte-equality checks alone did not detect visible failure.

**Alternatives considered**: Continue using the SVG (rejected by production evidence); hand-edit a simplified SVG (rejected because governed assets must not be modified).

## Website identity and copy

**Decision**: Retain responsive contextual lockups, but validate their actual rendered geometry and pixels. Replace promotional copy and long controls with the exact brand idea, descriptor, ownership endorsement, `Download`, and `Docs`. Keep security and policy links in the footer rather than primary navigation.

**Rationale**: This follows the brand authority and preserves policy discoverability without presenting support/security as primary product tasks.

## Specification dates

**Decision**: Preserve `Issued` as the original 2026-08-30 publication date and add `Updated` for the current revision date.

**Rationale**: The two dates convey distinct facts and avoid rewriting history while eliminating ambiguity.

## Deployment transaction

**Decision**: Build on pull requests and `main`, upload/deploy only from `main` or an explicit authorized dispatch, attach version/source provenance to the artifact, and verify production after deployment.

**Rationale**: The previous manual-only deployment path allowed green build CI and stale production to coexist. Separating validation permissions from the deploy job keeps pull requests non-mutating.

**Alternatives considered**: Retain manual deployment (rejected because it caused the defect); deploy pull requests (rejected because it mutates production before review); verify only the artifact (rejected because it cannot detect stale Pages state).
