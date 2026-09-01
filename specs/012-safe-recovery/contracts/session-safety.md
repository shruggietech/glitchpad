# Contract: Session Safety

## Invariants

- Dirty state is monotonic from an edit until one matching durable receipt or explicit discard resolves it.
- Focus changes never alter integrity, source state, pending save, pending transition, or recovery coverage.
- Every source event is rejected unless its source ID matches the live session authority.
- A current save receipt matches operation ID, source ID, submitted session revision, previous external revision, payload byte count, and reviewed durability.
- Close, reload, and exit cannot remove a dirty session while its transition is unresolved.
- A source event never removes a dirty buffer. Deleted, revoked, or unavailable authority moves it to conflicted or recovery-only state.

## Close resolution

| Session condition | Allowed decisions | Result |
| --- | --- | --- |
| Clean | Close | Dispose immediately |
| Dirty and ordinary save safe | Save, Save As, Discard, Cancel | Close only after matching receipt or discard |
| Dirty and ordinary save unsafe | Save As, Discard, Cancel | No in-place mutation |
| Conflicted | Compare, Save As, confirmed overwrite, discard/reload, Cancel | Confirmation remains revision-bound |
| Recovery-only | Save As, Discard, Cancel | No claim of original authority |

## Stable failures

Stale session, stale source, stale authorization, capability denial, partial or indeterminate persistence, recovery unavailable, quota exhausted, corrupt recovery, and unsupported recovery schema are safe values. None may contain document text, full paths, raw Android URIs, provider IDs, recovery hashes, or credentials.
