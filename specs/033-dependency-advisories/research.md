# Research: Clear v0.1.2 Dependency Advisories

## Decision 1: Patch Next.js to 16.3.3

**Decision**: Change the exact site dependency from Next.js 16.3.0 to 16.3.3.

**Rationale**: Two critical advisories affect the current resolution, and 16.3.3 is the first fixed release for both. The site uses static export, which limits exposure, but deployment topology is not a substitute for removing a readily available compatible patch.

**Alternatives considered**: Retaining 16.3.0 with a risk note was rejected because a fixed patch is available. A wider minor or major upgrade was rejected because it expands review and regression risk without serving this slice.

## Decision 2: Override smol-toml to 1.7.1

**Decision**: Add a root pnpm override that resolves `smol-toml` to 1.7.1.

**Rationale**: `smol-toml` is a development-only transitive dependency of `markdownlint-cli2`. The current latest `markdownlint-cli2` still pins vulnerable version 1.7.0 exactly, while 1.7.1 is the first fixed patch and retains the same supported Node range and BSD-3-Clause license.

**Alternatives considered**: Upgrading `markdownlint-cli2` cannot remove the advisory today. Removing Markdown linting would weaken validation. Leaving the advisory open would conflict with the v0.1.2 security gate.

## Decision 3: Preserve release authorities

**Decision**: Do not alter the product version, Android version code, release-package manifest, release notes, tags, or published releases.

**Rationale**: S033 prepares the existing v0.1.2 release candidate. It does not create a new product increment or authorize publication.

## Decision 4: Require deterministic local proof before publication

**Decision**: Regenerate the lockfile with the pinned package manager, perform a frozen install and security audit, run focused release checks, then run the full repository gate before pushing.

**Rationale**: Dependency updates can affect more than the site. A complete local gate prevents CI from becoming the first validation environment.
