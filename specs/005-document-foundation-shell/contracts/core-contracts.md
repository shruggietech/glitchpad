# Core Contract

## Versioning

All native-to-interface payloads use the following logical envelope. Field names use snake case on the wire.

```json
{
  "contract_version": 1,
  "payload": {}
}
```

Consumers must reject an unsupported `contract_version` before interpreting `payload`.

## Identity comparison

`compare_identity(left, right)` returns:

| Condition | Result |
| --- | --- |
| Both identities are strong, have compatible authority and scope, and tokens are equal | `same` |
| Both identities are strong, have compatible authority and scope, and tokens differ | `different` |
| Either identity is weak or unavailable, or the authorities/scopes are not comparable | `uncertain` |

Only `same` authorizes session deduplication.

## Capability contract

Source and renderer capabilities are independent flags. Implementations must not infer write from read, save from edit, navigation from view, atomic replacement from write, or any other unstated capability.

## Session operations

| Operation | Input | Success | Failure |
| --- | --- | --- | --- |
| Open | Source, detection result, renderer | Existing session activation for a same identity, otherwise a new ready or failed session | Invalid contract, invariant failure |
| Activate | Session ID | Active ID and revision snapshot | Not found, closed session |
| Close | Session ID | Removed session and deterministic successor focus | Not found, future dirty-confirmation conflict |
| Reorder | Session ID and destination index | Stable identities in new order | Not found, invalid index |
| Next/previous | Current active ID | Cyclically selected active session | Empty registry |

## Error safety

Errors may contain source display names, stable categories, byte counts, capability names, retryability, recoverability, and recovery guidance. Errors must not contain source bytes, decoded document text, secrets from URIs, or unrestricted native error dumps.

## Compatibility rule

Adding an optional field or enum case with an explicit unknown fallback is backward-compatible within contract version 1. Removing or renaming fields, changing comparison semantics, or changing required capability behavior requires a new contract version and a separate Spec Kit decision.
