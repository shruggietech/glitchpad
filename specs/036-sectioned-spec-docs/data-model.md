# Data Model: Sectioned Technical Specification Documentation

## Canonical specification

| Field | Type | Rules |
| --- | --- | --- |
| `sourcePath` | repository-relative path | Fixed to `docs/glitchpad-technical-specification.md` |
| `title` | string | Exactly one level-one title outside code fences |
| `version` | semantic version | Must match the workspace version and document-control row |
| `documentControl` | ordered key/value rows | Must include status, specification version, release class, dates, repository, and license authorities required by the introduction |
| `tableOfContents` | ordered TOC entry list | Exactly one entry for every numbered level-two section |
| `sections` | ordered section list | Consecutive unique numbers beginning at 1; currently exactly 38 |

## Table-of-contents entry

| Field | Type | Rules |
| --- | --- | --- |
| `number` | positive integer | Consecutive and unique |
| `title` | string | Must equal the matching section heading title after Markdown label normalization |
| `anchor` | fragment string | Must equal the matching section's derived canonical heading anchor |
| `sourceIndex` | non-negative integer | Strictly increasing |

## Section record

| Field | Type | Rules |
| --- | --- | --- |
| `number` | positive integer | Matches exactly one table-of-contents entry |
| `title` | string | Canonical heading text without the number prefix |
| `heading` | string | Canonical numbered heading text |
| `anchor` | string | Unique canonical section-heading anchor |
| `slug` | string | Zero-padded number plus readable ASCII title slug; unique |
| `route` | absolute site path | `/docs/{slug}` |
| `description` | string | Deterministic plain-text summary suitable for route metadata |
| `body` | Markdown/MDX string | Complete owned source range with nested headings adapted one level |
| `headingAnchors` | string list | Unique anchors owned by this page |
| `previousRoute` | route or null | Introduction for section 1, otherwise preceding section |
| `nextRoute` | route or null | Following section, null for the final section |

## Documentation manifest

| Field | Type | Rules |
| --- | --- | --- |
| `schemaVersion` | integer | Fixed explicit generation-contract version |
| `source` | path string | Canonical repository authority |
| `productVersion` | semantic version | Matches package and specification authorities |
| `introductionRoute` | route | `/docs` |
| `compatibilityRoute` | route | `/docs/technical-specification` and excluded from ordered section navigation |
| `sections` | ordered section summaries | Exactly matches the generated page inventory and canonical order |

## Generated documentation set

| File class | Cardinality | Rules |
| --- | --- | --- |
| Introduction | 1 | Generated from repository authorities and clearly marked |
| Section pages | 38 | One per section record, clearly marked, no manual TOC |
| Compatibility page | 1 | Contains forward explanation and `/docs` destination, no canonical section body |
| Navigation metadata | 1 | Lists introduction and all section slugs in canonical order; excludes compatibility route |
| Manifest | 1 | Ordered contract used by audit and deployment verification |

## Generation state transitions

```text
authorities read -> structure parsed -> facts validated -> outputs rendered -> staging inventory validated -> live generated directories replaced
       |                  |                    |                 |                         |
       +------------------+--------------------+-----------------+-------------------------+-> actionable failure, previous live set retained
```

Abandoned staging directories are removed before the next run. Live outputs are never updated one page at a time.
