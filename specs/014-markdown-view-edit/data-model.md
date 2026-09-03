# Data Model: Local Markdown Viewing and Editing

## MarkdownDocumentState

Represents the durable-in-session Markdown projection. It never replaces `TextDocumentState` as source authority.

| Field | Meaning | Invariant |
| --- | --- | --- |
| `mode` | `rendered` or `source` | Eligible documents default to rendered; limited documents use source. |
| `eligibility` | `full`, `source_only`, `large_read_only`, or `refused` | Derived from encoded source bytes at 16, 32, and 256 MiB boundaries. |
| `renderRevision` | Revision represented by the accepted result | Never exceeds the current session revision. |
| `renderStatus` | `idle`, `scheduled`, `rendering`, `ready`, `empty`, `limited`, `cancelled`, `stale`, or `failed` | A result commits only for the active request and exact source revision. |
| `location` | Optional rendered node, heading, or exact source range | Reset or translated when the referenced revision changes. |

## MarkdownRenderRequest

| Field | Meaning | Validation |
| --- | --- | --- |
| `requestId` | Unique request identity | Non-empty and unique for one client lifetime. |
| `sessionId` | Owning document session | Must match the client owner. |
| `sourceRevision` | Exact text revision | Non-negative integer. |
| `sourceText` | Normalized decoded Markdown | Encoded size must be at most 16 MiB. |
| `sanitizerVersion` | Expected output policy version | Must equal the renderer's supported version. |

## MarkdownRenderResult

| Field | Meaning | Validation |
| --- | --- | --- |
| `requestId`, `sessionId`, `sourceRevision` | Request correlation | Must match the current request before commit. |
| `status` | Stable parse outcome | `ready`, `empty`, `limited`, `cancelled`, or `failed`. |
| `tree` | Sanitized semantic root | Present only for ready/empty and contains allowlisted nodes/properties. |
| `outline` | Ordered heading entries | Identifiers are unique within the result. |
| `searchText` | Ordered visible-text entries | Each entry points to one rendered node and optional source range. |
| `diagnostics` | Bounded safe messages | No source dump, path, URI, stack trace, or host identifier. |
| `measurements` | Source bytes, parse duration, node counts | Non-negative and bounded. |
| `sanitizerVersion` | Policy used for the tree | Must equal the request version. |

## SafeRenderedNode

| Field | Meaning | Validation |
| --- | --- | --- |
| `id` | Deterministic result-local node identity | Unique within one render result. |
| `type` | `root`, `element`, or `text` | Other syntax-tree node kinds are rejected. |
| `tagName` | Safe semantic element name | Present only for elements and found in the versioned allowlist. |
| `properties` | Explicit safe properties | Only allowed keys and normalized scalar/list values. |
| `value` | Text content | Present only for text nodes. |
| `children` | Ordered safe nodes | Bounded by result node and depth limits. |
| `sourceRange` | Optional start/end offsets and lines | Monotonic, in bounds, and tied to the source revision. |

## HeadingEntry

| Field | Meaning | Validation |
| --- | --- | --- |
| `id` | Stable fragment-style identity | Normalized label plus deterministic collision suffix. |
| `level` | Heading depth | Integer 1 through 6. |
| `label` | Visible heading text | Whitespace-normalized and bounded. |
| `nodeId` | Rendered target | References a heading node in the same result. |
| `sourceRange` | Authored range | Exact when parser evidence supplies it. |

## LinkCandidate

| Field | Meaning | Validation |
| --- | --- | --- |
| `kind` | `external`, `email`, `local`, `blocked`, or `malformed` | Deterministically derived from the authored destination. |
| `authoredTarget` | Original destination | Never used directly for navigation. |
| `normalizedTarget` | Canonical disclosure/authorization target | Present only when normalization succeeds. |
| `displayTarget` | Bounded text shown before confirmation | Credentials are never accepted or displayed. |
| `reasonCode` | Stable blocked/unavailable reason | Contains no source content or platform locator. |

## RenderedSearchState

| Field | Meaning | Validation |
| --- | --- | --- |
| `query` | User-entered search text | Empty query has no results. |
| `matches` | Ordered match references | Capped and tied to one render revision. |
| `activeIndex` | Current match | Null for no matches; otherwise in range. |
| `wrapped` | Whether the last move wrapped | Reset on query or revision change. |

## State Transitions

| Current | Event | Next | Required effect |
| --- | --- | --- | --- |
| `idle` | Eligible rendered open | `scheduled` | Start 100 ms debounce. |
| `scheduled` | Newer edit | `scheduled` | Cancel prior timer and retain only newest revision. |
| `scheduled` | Debounce elapsed | `rendering` | Dispatch one bounded worker request. |
| `rendering` | Newer edit, hide, close, or dispose | `cancelled` | Terminate active request and reject later result. |
| `rendering` | Matching success | `ready` or `empty` | Accept tree and rebuild indexes. |
| `rendering` | Mismatched result | unchanged | Ignore without visible mutation. |
| any | Source crosses 16 MiB | `limited` | Cancel preview and retain source mode. |
| `ready` | Switch to source | `ready` | Retain accepted result as regenerable cache and move to mapped source range when available. |

## Limits

| Quantity                        | Limit                                      |
| ------------------------------- | ------------------------------------------ |
| Renderable encoded source       | 16 MiB                                     |
| Source editing                  | 32 MiB through the existing text contract  |
| Large-text view                 | 256 MiB through the existing text contract |
| Preview debounce                | 100 ms                                     |
| Cancellation response           | 250 ms                                     |
| Visible search matches retained | 1,000                                      |
| Outline entries retained        | 10,000                                     |
| Diagnostics retained            | 32                                         |
| Rendered node depth             | 256                                        |
| Safe disclosure target          | 2,048 characters                           |
