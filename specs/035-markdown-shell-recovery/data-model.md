# Data Model: Markdown Recovery and Reserved Shell Chrome

## Markdown presentation attempt

| Field | Type | Rules |
| --- | --- | --- |
| `sessionId` | string | Existing local session identity; never emitted in diagnostics or receipts |
| `revision` | non-negative integer | Existing source revision; results publish only to the same active revision |
| `attempt` | non-negative integer | Increments only when the user explicitly retries rendered preview |
| `requestedMode` | `rendered` or `source` | Existing user-visible presentation intent |
| `state` | `idle`, `scheduled`, `pending`, `ready`, `failed`, or `recovery-source` | Exactly one visible state per active document |
| `failureStage` | closed stable enum or absent | Content-free classification only |

### Transitions

```text
idle -> scheduled -> pending -> ready
scheduled -> failed
pending -> failed
ready -> failed
failed -> recovery-source
recovery-source -> scheduled (explicit Retry preview, attempt + 1)
failed -> scheduled (explicit Retry preview, attempt + 1)
any state -> idle (different session, revision, or format)
```

Stale results whose session, revision, generation, or attempt differs from the active request are ignored. Retry is user initiated and bounded by one active attempt; it never loops automatically.

## Recovery presentation

| Field | Type | Rules |
| --- | --- | --- |
| `message` | governed static copy | Contains no source or exception text |
| `sourceAvailable` | boolean | True for Markdown failures with a readable source buffer |
| `retryAvailable` | boolean | True after a contained Markdown failure and in recovery source mode |
| `actions` | ordered action set | Retry preview, View source, and existing shell actions remain keyboard reachable |
| `layout` | intrinsic rows | Message and action rows align to the document start and never stretch |

## Shell chrome

| Field | Type | Rules |
| --- | --- | --- |
| `rowHeight` | CSS length | 32px with zero/one document, 40px with tab strip, 44px for coarse pointer |
| `toolbarWidth` | CSS length | 32px desktop, 44px coarse pointer |
| `triggerTarget` | rectangle | At least 32x32px desktop and 44x44px coarse pointer |
| `glyphBox` | rectangle | 18x18px visual footprint |
| `popup` | disclosure | Absolute to shell owner, below the row, viewport bounded, independently scrollable |
| `documentClient` | rectangle | Begins after shell row; never intersects persistent toolbar or trigger |

## Geometry evidence

| Field | Type | Rules |
| --- | --- | --- |
| `viewport` | width and height | Governed minimum, ordinary, and large dimensions |
| `deviceScaleFactor` | number | Browser evidence only; not represented as Windows OS scaling |
| `pointerMode` | `fine` or `coarse` | Selects 32px or 44px minimum target |
| `toolbarRect` | bounded numeric rectangle | Must not intersect document client |
| `triggerRect` | bounded numeric rectangle | Stable within one device pixel across disclosure |
| `glyphRect` | bounded numeric rectangle | 18x18px within tolerance |
| `popupRect` | bounded numeric rectangle | Inside viewport and disjoint from trigger |
| `documentRect` | bounded numeric rectangle | Unchanged across disclosure |
| `scrollOffset` | bounded numeric pair | Unchanged across disclosure |
| `recoveryRows` | bounded numeric rectangles | Intrinsic height and aligned near document start |

## Packaged lifecycle receipt

The receipt uses a closed schema of boolean outcomes, bounded counts, environment versions, window dimensions, display scale, and artifact digests. `content_free` must be true. It must not contain source, filenames, file paths, URLs, exception messages, provider identifiers, or UI text copied from documents.
