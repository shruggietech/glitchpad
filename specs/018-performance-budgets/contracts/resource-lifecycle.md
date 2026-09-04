# Renderer Resource Lifecycle Contract

## Ownership

Every worker, timer, object URL, observer, subscription, pending callback, native stream lease, and regenerable rendered surface belongs to exactly one renderer/session owner. Ownership is ephemeral, contains no document content or native authority, and is removed when the owner is disposed.

## Active

An active owner may acquire declared resources within renderer limits. Every acquisition has exactly one idempotent release. Replacing or superseding work releases its prior resources before the replacement can publish.

## Suspended

Suspension cancels pending work, rejects later stale publication, and releases every regenerable owned resource. The session may retain authoritative source state, revision, dirty state, selection intent, compact navigation state, and recovery coverage. Resume reacquires resources on demand and MUST NOT reuse a stale callback or result from the prior generation.

## Disposed

Disposal performs suspension cleanup, releases remaining native leases and callbacks, marks the owner terminal, and removes it from the ledger. Repeated disposal is harmless. A disposed owner cannot acquire a resource or publish a result.

## Ledger invariants

- Counts are non-negative safe integers with a closed set of resource kinds.
- Release of an absent resource is harmless and cannot make a count negative.
- Suspended snapshots have zero workers, object URLs, observers, subscriptions, timers, callbacks, leases, and regenerable surfaces.
- Disposed owners have no snapshot and reject acquisition.
- One hundred lifecycle cycles return to the same zero-resource baseline.
- The ledger retains no source bytes, labels, filenames, paths, URIs, provider identifiers, callback values, or resource objects.

## Cancellation

Cancellation invalidates the owner generation synchronously, releases schedulable resources, and acknowledges through the public operation within 250 milliseconds. Results completing concurrently are accepted only when owner, generation, source revision, and sanitizer/parser version still match. An abort cannot be reported as an internal error.

## Measurement

The ledger provides deterministic resource-count and estimated-byte evidence. It does not claim to measure an entire WebView or native process. Platform collectors supply idle working set or proportional set size, and the evidence contract keeps those observations distinct.
