# Editor Renderer Contract

## Registration

The text renderer registers a stable renderer ID, text and source families, platform parity, limits, lazy loader, and capabilities. Registration order never determines detection priority.

Editable mode advertises view, edit, navigate, search, copy, save when source authority permits it, Save As when the host permits it, and metadata inspection when available. Large-text mode advertises only view, navigate, search, and copy. Refused mode advertises no document operation.

## Open

Input:

- Bounded source descriptor and opaque source ID when native authority exists.
- Detection result and text profile.
- Expected external revision.
- Cancellation and progress sinks.
- Renderer-scoped bounded read capability.
- Theme and accessibility preferences.

Output is one of:

- `editable`: current normalized content, exact raw round-trip state, language decision, revision, capabilities, and compact status.
- `large_read_only`: source-backed view state, bounded initial window, capabilities, and compact status.
- `refused`: stable size or input result with actionable non-sensitive guidance.

Opening must publish safe first content before optional language loading. It must not publish editable authority until the actual read proves the editable size boundary.

## Transaction

Every request carries the target session and expected current revision. A document-changing request also carries ordered changes and the resulting selection.

An accepted document change applies to the raw round-trip shadow and normalized editor state atomically, advances exactly one editable revision, invalidates stale save and asynchronous language or search results, marks the session dirty, schedules recovery for the exact new content, and publishes the resulting content, selection, profile, and status.

A stale, read-only, invalid, or over-budget request changes nothing and returns a stable content-free result.

## Serialize

Input:

- Target session and exact current revision.
- Current raw round-trip state and text profile.
- Optional explicit lossy authorization bound to the same revision and decision.

Output:

- Exact bytes, byte count, digest, encoding, BOM, newline facts, and revision for the existing S012 save operation.

Serialization must reject unresolved or stale lossy decisions before any host write. It must not normalize untouched newline tokens or silently add or remove a terminal newline.

## Lifecycle

Backgrounding may suspend syntax trees, decorations, search indexes, view instances, and other regenerable state. Reactivation reconstructs them from authoritative text and profile state. Disposal cancels all current work and idempotently releases editor views, observers, timers, listeners, and large-view buffers.

## Security Boundary

The renderer receives no filesystem path, raw Android URI, network client, shell executor, unrestricted Tauri invocation, language server, compiler, debugger, repository, package, terminal, or AI authority. Opened text is data only.
