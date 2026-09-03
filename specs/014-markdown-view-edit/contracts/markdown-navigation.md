# Markdown Navigation Contract

## Rendered Search

Search indexes visible semantic text from the accepted sanitized tree. It excludes markup delimiters, raw property values, blocked destination internals, hidden labels, and application controls. Matching is Unicode-aware and case-insensitive by default, retains at most 1,000 results, advances forward or backward, and wraps deterministically. Changing the query or accepting a new render revision rebuilds the result list and resets the active index.

Each result identifies a rendered node and an optional exact source range. Activating it scrolls the rendered node into view and applies a non-persistent visual highlight. Switching to source mode moves the editor to the exact range when present.

## Outline

The outline contains at most 10,000 accepted headings in document order. Each entry records level, normalized visible label, target node, and exact source range. IDs are generated from the normalized label, fall back to `section`, and receive deterministic numeric suffixes for duplicates. Selecting an entry focuses and scrolls the semantic heading without changing browser history or source.

## Link Classification

| Authored target | Classification | Result |
| --- | --- | --- |
| Absolute `https:` or `http:` without credentials | `external` | Disclose normalized target, then require confirmation and independent host revalidation. |
| Absolute `mailto:` without credentials or control characters | `email` | Disclose normalized target, then require confirmation and independent host revalidation. |
| Relative path or fragment | `local` | Use a scoped local resolver when available; otherwise report unavailable. |
| Protocol-relative, credential-bearing, `file:`, `javascript:`, `data:`, custom scheme, encoded control, or bidirectional-control target | `blocked` | Remain inert and expose a stable reason. |
| Unparseable or over 2,048 characters | `malformed` | Remain inert and expose a stable reason. |

Rendered links never receive authored destinations as browser `href` values. Initial activation only opens an application-owned confirmation dialog showing the normalized destination. Confirmation calls the injected gateway once; cancel closes the dialog without a host request. A gateway error leaves the document open and announces a bounded failure.

## Local Resources

Remote images are always blocked without a request. Relative images are submitted only to an injected resolver already scoped to the source identity and root. The resolver returns an opaque asset token or a stable denial. The Markdown renderer never joins filesystem paths, interprets Android URIs, or falls back to a remote URL.

## Print

Print mode reuses the accepted sanitized tree. It hides tabs, command controls, dialogs, search controls, outline controls, diagnostics, and status rows. Link disclosure text remains visible. Source mode is not printed automatically; a print request from source mode uses the newest accepted rendered result or reports that preview is unavailable.
