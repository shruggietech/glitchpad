# Research: Brand Kit Refresh

## Decision: Pin the current published authority

- **Decision**: Use upstream commit `1681fcd444ff851d5bffc2cf67e23bbcedd753cd`, Build run `34137139742`, and its `verified-brand-kits` artifact as the complete manifest-bound delivery.
- **Rationale**: The commit is the source of the successful Pages deployment currently served by `brand.shruggie.tech`; 181 published production assets were independently fetched from the site and matched the build artifact byte-for-byte.
- **Alternatives considered**: Scraping rendered pages lacks non-public kit files. Rebuilding locally would produce a new PDF byte stream and would not preserve the upstream manifest receipt.

## Decision: Replace the delivery as a unit

- **Decision**: Replace `brand/` with the complete Glitchpad directory from the verified artifact, add a clearly project-owned integration receipt, and correct the README's artifact-layout-relative license link to an immutable URL at the pinned upstream commit.
- **Rationale**: Partial overlay would retain obsolete generators, evidence, and filenames from canon 1.0.0.
- **Alternatives considered**: Editing individual SVGs or tokens is prohibited by the kit and would break checksum authority.

## Decision: Consume platform suites without local image generation

- **Decision**: Map supplied Windows, macOS, web/Linux, and Android assets to the existing Tauri and generated Android destinations using byte copies and validate those mappings.
- **Rationale**: The upstream icon manifests already encode safe-area, reduced-master, adaptive-icon, and platform rules.
- **Alternatives considered**: Resizing or recoloring locally would create ungoverned derivatives.

## Decision: Preserve behavior boundaries

- **Decision**: Limit S025 to brand authority, presentation assets, package icons, validation, and provenance.
- **Rationale**: Product capability and release publication changes belong to the release slice and are not required to adopt the approved identity.
- **Alternatives considered**: Combining v0.1.0 publication would make review and rollback materially riskier.
