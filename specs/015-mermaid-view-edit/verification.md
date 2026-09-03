# Verification: Mermaid Viewing and Editing

**Slice**: S015  
**Issues**: #54, #55, #56, #57  
**Date**: 2026-09-03  
**Status**: Locally complete, pull-request CI pending

## Delivered capability

S015 adds one shared Mermaid renderer boundary for standalone `.mmd` and `.mermaid` documents and fenced Mermaid blocks in Markdown. Source remains authoritative and uses the existing editing, recovery, save, encoding, newline, and conflict lifecycle. Rendered output is sanitized twice, rewritten into request-local identifiers, and displayed only as an inert Blob-backed image.

The implementation includes revision-keyed latest-result commits, 300 millisecond preview debounce, a two-request scheduler, cancelled-queue removal, hard source/edge/output/block/concurrency limits, bounded diagnostics, last-valid stale preview behavior, rendered-text search, accessibility metadata, keyboard/pointer/touch navigation, zoom and pan bounds, host MIME delivery, Android provider coverage, dependency notices, governed fixtures, and a production-browser runtime isolation gate.

## Deliberate architectural decision

A hard five-second preemption guarantee is impossible while Mermaid performs synchronous DOM work in the application WebView. S015 therefore uses enforceable preflight limits, rejects any result observed after the five-second deadline, invalidates obsolete generations, and documents the timeout as cooperative. Claiming hard interruption without moving rendering into a separately terminable DOM-capable process would be false.

The Mermaid implementation is also dynamically imported. This keeps the parser and diagram-specific modules out of the application startup bundle until a Mermaid preview is requested.

## Issue traceability

| Issue | Delivered evidence |
| --- | --- |
| #54 | Standalone routing, verified detection, exact desktop and Android source delivery, fit-to-view, source fallback, and first-class document state |
| #55 | Shared source editor, revision-safe debounced preview, stale-preview labeling, commands, source round-trip, recovery, and conflict-safe state projection |
| #56 | Exact fenced-block extraction, stable block identities, bounded aggregate work, inert Markdown placeholders, independent failures, and parent source routing |
| #57 | DOMPurify plus application SVG allowlist, strict Mermaid configuration, Blob image presentation, CSP tightening, accessibility metadata, search, navigation, and browser instrumentation |

## Local verification results

| Gate | Result |
| --- | --- |
| Focused Mermaid, editor, recovery, viewport, and Markdown tests | Passed |
| Frontend lint and TypeScript | Passed |
| Frontend unit and integration suite | 26 files, 149 tests passed |
| Frontend production build | Passed |
| Mermaid runtime browser gate | Passed with zero external requests, dialogs, navigation, native invocation, or page errors |
| Rust workspace formatting and checks | Passed |
| Rust workspace tests | Passed |
| Core detection tests | 55 unit, schema, and doc tests passed |
| Desktop source conformance | 8 tests passed |
| Rust dependency policy | Advisories, bans, licenses, and sources passed |
| Android `aarch64-linux-android` target check | Passed |
| Windows desktop debug build | Passed |
| Documentation and site aggregate | 29 browser tests, 7 site unit tests, 39 Mermaid diagrams, links, formatting, lint, and configuration passed |
| Encoding and corruption check | 544 text files verified as UTF-8 without BOM or common mojibake |
| Full `pnpm check` | Passed |

## Convergence assessment

The specification, plan, research decisions, contract, task list, implementation, and local evidence agree. All four bundled issues have direct implementation and test coverage. No unimplemented task, placeholder, conflicting requirement, or unjustified stable-platform claim remains. Platform package and third-party review receipts remain pull-request gates and must be green before merge.
