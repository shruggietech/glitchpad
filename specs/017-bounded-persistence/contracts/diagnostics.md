# Contract: Redacted Diagnostics

## Event ingestion

- Event IDs, levels, platforms, and components come from closed enumerations.
- Duration and byte count are optional bounded non-negative integers.
- Error codes are stable ASCII identifiers with a strict length bound.
- No API accepts arbitrary user-facing messages, paths, URIs, metadata values, excerpts, context maps, native handles, recovery payloads, or stack traces.

## Retention

1. Validate every event independently and discard invalid input with a safe status.
2. Remove events older than seven days.
3. Order surviving events by timestamp and stable input order.
4. Remove oldest events until no more than 2,000 remain and serialized event bytes do not exceed 2 MiB.
5. Atomically commit the complete bounded collection.

## Preview and export

- Preview returns environment facts from an allowlist plus the exact retained event projections.
- Export accepts the preview token or exact immutable preview payload and a native user-selected destination.
- Export never rehydrates discarded raw values and writes only the payload shown in preview.
- A user cancellation or write failure preserves retained diagnostics and returns a stable content-free status.
