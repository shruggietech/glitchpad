# Contract: Application State

## Load

- Each category loads independently from an application-private root.
- File metadata is checked before allocation and category byte limits are enforced.
- Missing state returns current defaults with `defaulted` status.
- Valid current state returns `loaded`; supported legacy state returns deterministically migrated current state.
- Corrupt state returns defaults and a stable safe warning, then self-heals on the next valid atomic write. Future state returns defaults with `unsupported`, preserves original bytes, and blocks ordinary writes to that category.

## Preference write

1. Validate and normalize every field independently.
2. Serialize the complete version-1 envelope once.
3. Atomically replace only the preference record.
4. Publish success only after commit; on failure retain the last committed record.

## Session write and restore

- Native delivery derives a stable path-free UUID only from strong source identity; Android additionally requires a persisted URI grant.
- The interface submits that explicit restoration UUID or a committed recovery-record UUID and never persists a process-local source ID.
- A maximum of 32 valid projections is committed; unqualified entries are omitted.
- On restart the shared shell matches loaded projections to sources independently re-delivered by the native owner, or to accepted recovery sessions, then restores the active session, inspector, and presentation mode without replacing document state.
- Recovery record identifiers may cross the boundary; recovery content and native source evidence may not.

## Reset

- Categories are `preferences`, `session`, and `diagnostics`.
- Reset is explicit, idempotent, and operates on exactly one application-owned category.
- Future-schema bytes are removed only when that exact category is explicitly reset.
- Preference or session reset never calls recovery cleanup and never touches user-created source files.
