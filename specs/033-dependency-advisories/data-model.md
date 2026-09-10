# Data Model: Clear v0.1.2 Dependency Advisories

## Dependency Declaration

- **Identity**: Package name and owning manifest.
- **Fields**: requested version, dependency class, package-manager authority.
- **Validation**: Next.js resolves from the site manifest at an exact safe patch; the smol-toml override is declared once at the repository root.

## Resolved Package

- **Identity**: Package name and lockfile version.
- **Fields**: version, integrity hash, dependency edges, development/runtime scope.
- **Validation**: No lockfile entry resolves Next.js below 16.3.3 or smol-toml below 1.7.1.

## Advisory Coverage Record

- **Identity**: GitHub Security Advisory identifier.
- **Fields**: affected package, severity, vulnerable resolution, first fixed version, resulting safe resolution.
- **Validation**: GHSA-2xp9-vwfh-vxw4 and GHSA-p293-qw3h-jr36 resolve through Next.js 16.3.3; GHSA-7w5x-hrqm-74c2 resolves through smol-toml 1.7.1.

## Release Invariant Set

- **Identity**: v0.1.2 release candidate.
- **Fields**: product version, Android version code, release-package count, tag state, public release state.
- **Validation**: Values remain 0.1.2, 1002, eight packages, no v0.1.2 tag, and no v0.1.2 published release.
