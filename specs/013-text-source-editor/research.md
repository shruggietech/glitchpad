# Research: Text and Source Editor

## Decision 1: Use a minimal explicit CodeMirror 6 configuration

**Decision**: Mount CodeMirror 6 directly and compose only the required state, view, history, search, line-number, selection, wrapping, indentation, bracket, and highlighting extensions. Do not use an opaque all-features preset.

**Rationale**: CodeMirror virtualizes the rendered DOM, models edits as transactions, supports read-only state separately from DOM editability, and exposes update listeners and compartments for controlled integration. Explicit extensions keep completion, linting, folding, workspace, and execution-adjacent features outside S013.

**Alternatives considered**: A textarea cannot meet line-number, multi-selection, large-document viewport, or language requirements. An all-features preset would silently add capabilities outside scope. A custom editor would duplicate mature input, selection, accessibility, and undo behavior.

## Decision 2: Load a bounded language registry on demand

**Decision**: Use a project-owned allowlist that maps the existing canonical language IDs to lazily loaded CodeMirror language descriptions. The selected module is imported only after the core language decision is current; revision tokens discard stale loads.

**Rationale**: CodeMirror language descriptions explicitly support asynchronous loading. A bounded allowlist preserves deterministic behavior, avoids registration-order authority, and prevents a generalized plugin surface.

**Alternatives considered**: Eager imports increase startup and bundle cost. Filename-only selection ignores shebang and modeline evidence. Arbitrary package loading would violate local security and product scope.

## Decision 3: Preserve mixed newlines with a raw round-trip shadow

**Decision**: Store the authoritative decoded source with original newline tokens alongside CodeMirror's normalized document. Map each editor change from normalized offsets into raw offsets, apply inserted line breaks using the session insertion default, and serialize the resulting raw shadow using the selected encoding and BOM policy.

**Rationale**: CodeMirror intentionally normalizes line separators in its text model. A raw shadow preserves untouched CRLF, LF, and CR tokens exactly while still allowing standard editor transactions. Revision-bound serialization makes stale or lossy payloads rejectable before host mutation.

**Alternatives considered**: Normalizing on open violates round-trip safety. Reconstructing all line endings from aggregate profile counts is ambiguous. Storing only original bytes cannot correctly incorporate arbitrary Unicode edits without a decoded mapping.

## Decision 4: Keep large-text mode source-backed and read-only

**Decision**: Use the existing opaque range and stream commands through a renderer-scoped gateway to build a bounded incremental byte/line index and request only the visible or searched windows. The React surface renders a bounded window rather than constructing a complete JavaScript string or CodeMirror document.

**Rationale**: CodeMirror virtualizes DOM nodes but still retains its complete document model. A 256 MiB decoded document can exceed memory budgets, especially on Android. The existing host already supports bounded ranged and streamed reads without exposing paths or URIs.

**Alternatives considered**: A complete CodeMirror read-only document violates the decoded-memory constraint. A native temporary copy duplicates sensitive data and is unnecessary for seek-capable sources. Editing large files would require a separate piece-table and durable patch architecture outside S013.

## Decision 5: Extend core detection and S012 lifecycle

**Decision**: Add stable text mode limits and language evidence to `glitchpad-core`, then project them into TypeScript renderer state. Every document-changing transaction increments the existing session revision and invalidates stale save authority; recovery observes the same current content.

**Rationale**: Format detection and revision safety already have platform-independent authority. A frontend-only detector or independent dirty flag would create contradictory state machines.

**Alternatives considered**: Embedding all policy inside the component would be hard to test and diverge across renderers. Replacing existing session contracts would create unnecessary churn and risk S012 guarantees.

## Decision 6: Validate performance without timing-only CI assertions

**Decision**: Add deterministic structural budget tests for bounded reads, allocations, tasks, stale results, and cancellation, plus a local release-profile measurement harness whose recorded output includes fixture digest, host, WebView, sample count, median, p95, and peak memory. CI enforces deterministic hard invariants and runs the harness as evidence without brittle shared-runner timing failures.

**Rationale**: The technical specification requires reproducible measurement context and prohibits claims from incomplete runs. Shared CI runner wall time alone is not stable enough for a 50 ms interaction assertion.

**Alternatives considered**: Browser-mocked timers cannot prove paint latency. Hard CI wall-clock assertions would be flaky and could mask actual regressions through retries.

## Decision 7: Treat dependency provenance as a release input

**Decision**: Pin the CodeMirror dependencies in the workspace lockfile, record their MIT licenses through existing automated dependency checks, and avoid third-party language packages outside the official dependency family in S013.

**Rationale**: MIT is compatible with Apache-2.0 distribution, while a bounded official package family reduces provenance and maintenance risk.

**Alternatives considered**: Unreviewed community modes add license and supply-chain uncertainty. Copying grammar sources into the repository would create attribution and update obligations without user value.

## Decision 8: Fix large-view resource bounds in the contract

**Decision**: Native reads are capped at 256 KiB, rendered windows at 512 KiB, copy assembly at 1 MiB, sparse line anchors at 65,536 entries recorded every 1,024 lines, and retained matches at 10,000. Search may continue counting after the retained-position cap while reporting truncation.

**Rationale**: Concrete limits make unknown-size, adversarial-line, copy, index, and search behavior testable and keep the largest session-scoped structures materially below the source size on desktop and Android.

**Alternatives considered**: Unbounded arrays or copy payloads violate memory policy. Very small chunks create excessive native calls. A line offset for every line grows linearly and is unnecessary for bounded navigation.
