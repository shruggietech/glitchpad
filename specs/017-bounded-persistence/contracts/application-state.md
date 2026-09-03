# Contract: Application State

## Load

- Each category loads independently from an application-private root.
- File metadata is checked before allocation and category byte limits are enforced.
- Missing state returns current defaults with `defaulted` status.
- Valid current state returns `loaded`; supported legacy state returns deterministically migrated current state.
- Corrupt state returns defaults and a stable safe warning. Future state returns defaults with `unsupported`, preserves original bytes, and blocks ordinary writes to that category.

## Preference write

1. Validate and normalize every field independently.
2. Serialize the complete version-1 envelope once.
3. Atomically replace only the preference record.
4. Publish success only after commit; on failure retain the last committed record.

## Session write and restore

- The interface submits safe presentation projections and live opaque source handles.
- The native host resolves handles to durable restoration evidence only where the platform confirms authority.
- A maximum of 32 valid projections is committed; unqualified entries are omitted.
- On restart the native host revalidates every restoration reference independently and returns new runtime source handles or stable safe failures.
- Recovery record identifiers may cross the boundary; recovery content and native source evidence may not.

## Reset

- Categories are `preferences`, `session`, and `diagnostics`.
- Reset is explicit, idempotent, and operates on exactly one application-owned category.
- Future-schema bytes are removed only when that exact category is explicitly reset.
- Preference or session reset never calls recovery cleanup and never touches user-created source files.
