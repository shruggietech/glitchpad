# Data Model: Publish a Working v0.1.3 Corrective Release

## Release Source

| Field | Type | Rules |
| --- | --- | --- |
| version | semantic version | Exactly `0.1.3` |
| tag | release tag | Exactly `v0.1.3`; absent during pull-request review |
| commit | Git revision | Reviewed S038 merge commit only |
| specificationVersion | semantic version | Must equal product version |
| publicationState | enum | `prepared`, `reviewed`, `tagged`, `packages_verified`, `published`, or `failed` |

State transitions are monotonic: `prepared` to `reviewed` occurs after green CI and completed reviews; owner merge permits `tagged`; complete exact-source package evidence permits `packages_verified`; successful immutable release creation permits `published`. Any failed gate moves the transaction to `failed` without mutating a prior release.

## Application Package

| Field | Type | Rules |
| --- | --- | --- |
| artifactName | string | Governed v0.1.3 platform filename |
| platform | enum | `windows`, `macos`, `linux`, or `android` |
| architecture | string | Must match the package contract |
| packageKind | enum | Installer, portable archive, disk image, AppImage, Debian package, APK, or AAB |
| version | semantic version | Exactly `0.1.3` |
| sourceCommit | Git revision | Must equal the release source commit |
| sha256 | digest | Unique digest of final bytes |
| trustState | enum | Platform-governed signed, unsigned, ad-hoc, non-notarized, or attested state |
| evidenceRefs | list | Exactly the required evidence records for this package |

The governed inventory contains eight application packages: two Windows, one macOS, two Linux, and three Android artifacts. A package cannot enter the release evidence set until identity and lifecycle validation pass.

## Practical-Use Receipt

| Field | Type | Rules |
| --- | --- | --- |
| schemaVersion | integer | Governed receipt schema |
| artifactName | string | Must identify one application package |
| artifactSha256 | digest | Must match exact tested bytes |
| sourceCommit | Git revision | Must match release source |
| cleanState | boolean | Required for clean-install or clean-unpack evidence |
| deliveryPath | enum | Platform-supported Open, association, command line, warm delivery, or content-provider path |
| fixtureClass | enum | `minimal_markdown`, `representative_markdown`, `text`, or governed platform fixture |
| renderedMarkers | bounded list | Static synthetic markers only; no document body or private locator |
| recoveryResult | enum | `not_exercised`, `recovered`, or `failed` |
| shellGeometryResult | enum | `not_applicable`, `non_overlapping`, or `failed` |
| lifecycleResult | enum | `passed` or `failed` |

Receipts must be content-free, reproducible, and bound to final package bytes. Required receipt classes vary by platform contract, but absent or failing required records block publication.

## Release Evidence Set

| Field | Type | Rules |
| --- | --- | --- |
| releaseSource | Release Source | Exactly one |
| packages | set of Application Package | Complete governed eight-package inventory |
| checksums | mapping | One digest per published application package and evidence bundle |
| notices | artifact | Complete Apache-2.0-compatible distribution notices |
| sboms | mapping | Required software bill of materials for every package family |
| provenance | mapping | Binds workflow, source, and artifact digest |
| attestations | mapping | Required repository or platform attestations |
| lifecycleReceipts | set | Complete required practical-use and package lifecycle records |
| reconciliationResult | enum | `complete`, `incomplete`, or `inconsistent` |

Only a `complete` evidence set whose entries all bind to the same release source can authorize publication.

## Public Release Authority

| Field | Type | Rules |
| --- | --- | --- |
| productVersion | semantic version | `0.1.3` |
| specificationVersion | semantic version | `0.1.3` |
| releaseNotes | document | Describes S035 corrections and current limits |
| changelog | document | Contains dated 0.1.3 entry |
| supportAndSecurityVersion | semantic version | `0.1.3` |
| packageClaims | set | Matches the governed inventory and trust model |
| capabilityClaims | set | Stable text family only |
| releaseUrl | HTTPS URL | Canonical v0.1.3 GitHub release URL |
| deploymentRevision | Git revision | Must match release source after publication |

## Historical Release Baseline

| Field | Type | Rules |
| --- | --- | --- |
| tagCommit | Git revision | Captured v0.1.2 target |
| releaseId | immutable identity | Existing v0.1.2 release |
| publishedAt | timestamp | Must not change |
| assets | ordered inventory | Fourteen names, sizes, digests where obtainable, and update timestamps |

The baseline is read-only. Any difference during S038 is a release-blocking integrity failure.
