# Research: Desktop Source Lifecycle

## Decision 1: Keep source authority in the Rust host

**Decision**: Add the portable revision, event, persistence, and link-authorization value contracts to `glitchpad-core`, while native paths, file handles, watcher instances, and write machinery live only in `glitchpad-host`.

**Rationale**: This follows the document-host boundary, lets the core own deterministic comparisons and stable serialized states, and prevents TypeScript or renderers from gaining broad native authority.

**Alternatives considered**: A TypeScript filesystem adapter was rejected because WebView code must not receive reusable paths or unrestricted native operations. Putting all value contracts in the host was rejected because session and interface layers need one portable contract across desktop platforms and later Android work.

## Decision 2: Use process-local random source IDs

**Decision**: Generate UUID-v4 source IDs in the host and keep their path mapping in an in-memory registry that is dropped on close or process exit.

**Rationale**: Random process-local tokens are unguessable, serialize cleanly, and do not leak path semantics. A source ID authorizes only the bounded operations implemented by the registry.

**Alternatives considered**: Sequential integers were rejected because they are guessable. Path-derived hashes were rejected because they can leak equality information and remain reusable beyond the intended session.

## Decision 3: Derive identity per platform and keep path fallback weak

**Decision**: Use the safe `file-id` abstraction to derive device/inode identity on Unix and volume/file identity on Windows. If the platform or filesystem cannot provide it, emit a weak normalized-path identity. The identity token is scoped to its authority and platform comparison domain.

**Rationale**: Device/inode and Windows file IDs survive ordinary renames and correctly distinguish replacement at the same path. A normalized path is useful evidence but cannot safely prove sameness on case, alias, link, mount, or replacement boundaries.

**Alternatives considered**: Canonical path as strong identity was rejected because it does not identify the underlying object. Content hashing was rejected because it is expensive, changes with edits, and merges distinct files with equal bytes.

## Decision 4: Treat watcher output as ordered invalidation hints

**Decision**: Use the platform-recommended `notify` watcher on the non-recursive parent directory, filter events to the tracked source, assign host sequence numbers, and map rescan flags/backend errors to an overflow or unavailable event that invalidates certainty. Save always revalidates independently.

**Rationale**: Parent watching improves rename and deletion observation, while the library selects native Windows, macOS, and Linux backends. Its own documentation warns that filesystems and queues can miss or coalesce events, so watcher output cannot be revision authority ([notify watcher documentation](https://docs.rs/notify/latest/notify/trait.Watcher.html), [notify event rescan guidance](https://docs.rs/notify/latest/notify/struct.Event.html)).

**Alternatives considered**: Watching only the file was rejected because rename/removal behavior varies by backend. Polling as the only implementation was rejected because it weakens responsiveness, although explicit revalidation remains the fallback for unsupported native watching.

## Decision 5: Use a reviewed cross-platform atomic-write primitive

**Decision**: Use `atomic-write-file` for a same-directory temporary file and cross-platform replacement, explicitly synchronize file data before commit, preserve supported permissions, and perform or report parent-directory durability according to the target. The host reports the actual guarantee in the save receipt.

**Rationale**: Atomic replacement requires platform-specific syscalls, and the workspace forbids unsafe code. The crate provides a safe abstraction for sibling temporary writes and atomic overwrite on Unix and Windows, while documenting metadata limitations that must be reflected as capabilities or weaker guarantees ([atomic-write-file documentation](https://docs.rs/atomic-write-file/latest/atomic_write_file/)).

**Alternatives considered**: `std::fs::rename` alone was rejected because overwrite semantics differ on Windows. Handwritten platform FFI was rejected because the workspace forbids unsafe code and the change would duplicate sensitive low-level logic. `tempfile::persist` was rejected because its documentation does not guarantee atomicity on every platform.

## Decision 6: Model revisions as comparable facts, not hashes

**Decision**: Build an `ExternalRevision` from identity, byte length, and the strongest modified/change timestamp available, with an explicit evidence strength. Exact equality is required to save; unavailable facts reduce the source capability rather than being fabricated.

**Rationale**: Revision checks must be cheap enough before every bounded operation and save. Combining stable identity and metadata detects ordinary replacement and mutation while retaining explicit uncertainty.

**Alternatives considered**: Full-file hashes were rejected because they require unbounded reads and scale poorly. Modified time alone was rejected because timestamp granularity and preservation can miss replacement or rapid writes.

## Decision 7: Separate link authorization from operating-system launch

**Decision**: S006 validates and authorizes only `https`, `http`, and `mailto` targets after explicit current user activation, producing a one-use authorization. The policy tests never launch an external application; later interface integration may consume the authorization through a narrow native opener.

**Rationale**: Separating policy from side effects keeps automated tests deterministic and prevents a renderer from converting document content into a general shell or URL launcher.

**Alternatives considered**: Directly accepting a URL in a Tauri command was rejected because invocation alone does not prove current user intent. Allowing platform-specific custom schemes was rejected because no product requirement defines their trust or user experience.

## Dependency and license review

The planned direct additions are `atomic-write-file`, `file-id`, `notify`, `url`, and `uuid`, all pinned through `Cargo.lock` and subject to `cargo deny check`. No dependency may be merged unless its declared terms pass the repository Apache-2.0 compatibility policy and its transitive graph remains accepted.
