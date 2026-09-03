# Large-Text Source Contract

## Purpose

Provide a bounded, source-backed read-only view for text sources larger than 32 MiB and no larger than 256 MiB without constructing a complete decoded interface document.

## Range Request

Input:

- Opaque source ID.
- Expected external revision.
- Byte offset.
- Requested byte length no larger than 256 KiB.
- Operation budget and operation ID.

Output:

- Bytes beginning at the accepted offset.
- Actual byte count and end-of-source flag.
- Current external revision evidence.
- Stable changed, unavailable, revoked, cancelled, or limit result.

The host must revalidate before or as part of each read. A revision mismatch cannot return bytes as current content.

## Incremental Decode

The renderer carries incomplete multibyte units and CRLF boundaries between adjacent chunks. Only complete decoded units are published. Unsupported or newly invalid encoding stops the operation without fabricating replacement text as round-trip-safe content.

## Sparse Line Index

The renderer may retain byte offsets every 1,024 lines, up to 65,536 anchors. The index is revision-bound and regenerable. It must not contain document excerpts or grow linearly without the configured bound.

## Search

Search reads forward in bounded chunks, retains only boundary carry and at most 10,000 match positions, reports progress and result truncation, and yields around the interface event loop. A new query, tab backgrounding, source change, or disposal cancels the current operation. Results publish only for the exact operation and external revision.

## Copy and Navigation

Copy requests assemble no more than 1 MiB and only for the current revision. The rendered visible window contains no more than 512 KiB. Go-to-line uses the sparse index and bounded scanning. Invalid or unavailable targets do not move the current view.

## Capability Denial

Large-text mode never advertises edit, replace, indentation, undo, redo, syntax highlighting, recovery, save, or Save As. Direct attempts receive a stable read-only result and cause no source mutation.
