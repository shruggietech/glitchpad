# Contract: Desktop Delivery

**Contract version**: 1

## Boundary

Only native process startup, single-instance, operating-system association, Tauri window-drop, and Rust dialog handlers may construct a delivery containing a native path. Interface code can request a dialog and drain safe results, but it never supplies or receives a path.

## Operations

| Operation | Trusted input | Safe output | Required failures |
| --- | --- | --- | --- |
| `enqueue_startup` | Initial process arguments and working directory | Queue receipt | invalid argument, missing source, unsupported source, denied, unavailable |
| `enqueue_secondary` | Secondary process arguments and working directory | Queue receipt | invalid argument, missing source, unsupported source, denied, unavailable |
| `enqueue_drop` | Native window-drop paths | Queue receipt | missing source, symlink, unsupported source, denied, unavailable |
| `choose_sources` | User activation through a host command | Safe delivery results | cancelled, dialog unavailable, missing source, unsupported source, denied |
| `drain_deliveries` | Maximum result count | Ordered safe delivery results | invalid maximum, unavailable queue |
| `save_as` | Source ID or recovery content, expected revision, bounded bytes, safe suggested name | Safe source summary and durable receipt | cancelled, conflict, budget exceeded, denied, unavailable, partial write prevented |

## Invariants

- The executable argument, Tauri switches, empty arguments, directories, symlinks, URLs, and nonexistent paths never become document sessions.
- Relative arguments resolve only against the working directory supplied by the trusted process channel.
- Quoted paths are parsed by the operating system or plugin and are never reparsed as a command string.
- Acquisition uses `DesktopSourceHost::acquire` for every channel.
- Strong native identity opens at most one session and focuses its existing tab; weak identity never causes unsafe deduplication.
- Queue ordering is stable, capacity is bounded, draining has a caller-supplied maximum, and overflow produces a path-free diagnostic.
- Secondary-instance delivery completes before the main window is focused.
- Errors contain no path, filename, working directory, document bytes, command line, or secret.

## Interface projection

The interface receives only source ID, safe descriptor, external revision, delivery kind, sequence, status, and stable error fields. It performs bounded reads through the existing opaque source commands, detects content independently of extension, and opens or focuses the matching session.
