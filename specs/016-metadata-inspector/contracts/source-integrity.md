# Source Integrity Contract

## Query metadata

Input is `source_id`. Output is one path-free source snapshot containing the observed external revision and optional reliable facts. Failure uses stable not-found, permission, unavailable, or safe internal codes without locator context.

## Start, advance, and cancel SHA-256

- Start accepts source ID, expected external revision, and unique request ID. It rejects mismatched revisions and known sizes above 256 MiB, then initializes private state. Empty sources may finalize only after revalidation.
- Advance consumes at most 1 MiB. At authoritative EOF it revalidates before finalizing. Ready contains a lowercase 64-character digest and matching revision; pending, stale, limited, cancelled, and failed states contain no digest.
- Unknown length is allowed only when EOF occurs within the hard ceiling. Exhaustion without EOF is limited, never a prefix digest.
- Cancel is idempotent and retires hasher and stream. Source close also cancels all source-owned operations.

The frontend publishes a digest only when request ID, source ID, session revision, and external revision still match. Native final revalidation and frontend merge validation are both required.
