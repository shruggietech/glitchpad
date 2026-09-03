# Research: Local Markdown Viewing and Editing

## Decision 1: Use the unified Markdown pipeline directly

**Decision**: Parse with unified 11.0.5, remark-parse 11.0.0, remark-gfm 4.0.1, and remark-rehype 11.1.2, then sanitize structured output with rehype-sanitize 6.0.0. Use unist-util-visit 5.1.0 for narrowly scoped AST transformations and indexing. Versions are pinned and all six packages report MIT licensing through the package registry on 2026-09-02.

**Rationale**: The technical specification already selects a unified CommonMark/GFM pipeline. Direct ownership of the tree allows Glitchpad to make raw HTML inert, retain source positions, extract headings and visible search text, enforce a versioned final allowlist, and render without an HTML string or raw DOM insertion.

**Alternatives considered**: `react-markdown` is safe by default but hides part of the single-pipeline lifecycle and would encourage a second parse for outline/source mapping. A handwritten Markdown parser cannot provide credible CommonMark/GFM behavior. Injecting generated HTML, even sanitized HTML, creates an avoidable DOM trust boundary.

## Decision 2: Transform raw HTML into text before conversion

**Decision**: A remark-stage transform replaces every raw HTML node with a text node containing the authored bytes before Markdown is converted to a rendered tree.

**Rationale**: Dropping raw HTML makes source appear to vanish, while interpreting it violates the feature boundary. An explicit inert-text transform preserves what the reader authored without creating elements, event handlers, styles, frames, or scripts.

**Alternatives considered**: Enabling raw HTML with `rehype-raw` materially expands the attack surface and contradicts issue #53. Silently removing HTML is secure but fails the governing requirement that it appear as inert text.

## Decision 3: Sanitize structured output and render from an explicit element map

**Decision**: Apply an application-owned schema after all transforms, then convert only known safe HAST nodes to React elements through explicit property extraction. Never use `dangerouslySetInnerHTML` and never spread untrusted properties.

**Rationale**: Two explicit gates prevent parser or plugin drift from adding active properties. The sanitation version becomes part of the result contract and tests can assert the exact supported surface.

**Alternatives considered**: Browser parsing of an HTML string is unnecessary. A sanitizer-only design still risks unsafe component property spreading. A component-map-only design lacks a final transform boundary.

## Decision 4: Keep links inert until a separate confirmation

**Decision**: Classify authored destinations into external, email, local, blocked, or malformed. Render permitted external candidates as application controls without browser navigation. Activation opens a destination-disclosure confirmation; only confirmation invokes the injected narrow host gateway once. The host independently allows only normalized HTTP, HTTPS, and mail destinations and disables the opener plugin's automatic link interception.

**Rationale**: Markdown parsing cannot be allowed to navigate. Separating selection from confirmation supplies two deliberate user actions, preserves keyboard/touch parity, and keeps unsafe schemes outside the host boundary. The prior source-host authorization methods were desktop-only and not Tauri commands, so reusing them would have left Android without the promised behavior.

**Alternatives considered**: Ordinary anchors can navigate before application policy runs. `window.open` bypasses the native authorization model. Confirming every click through a browser-native prompt is hard to test, style, and make accessible.

## Decision 5: Deny remote resources and capability-gate local assets

**Decision**: Replace every remote image with an unavailable-resource description and issue no fetch. Classify relative images as local asset requests; render them only when an injected renderer-scoped resolver returns an approved opaque asset token. Without that resolver, show a bounded unavailable placeholder.

**Rationale**: This preserves offline and privacy guarantees while leaving a narrow route for existing or future source-root authorization. An opaque resolved token prevents the Markdown renderer from learning or traversing host paths.

**Alternatives considered**: Fetching remote images violates the constitution. Resolving relative paths in the renderer cannot reliably enforce desktop roots or Android document authorities. Omitting all image evidence makes documents misleading.

## Decision 6: Use a worker client with deterministic direct execution for tests

**Decision**: Production parsing runs in a module worker. The client assigns request IDs, session IDs, and source revisions, allows one active request per owner, terminates superseded work, and ignores mismatched results. A direct executor implementing the same contract is injected in unit tests and environments without worker support.

**Rationale**: Large Markdown parsing is CPU-intensive and must not block the UI. Contract injection makes cancellation and stale-result behavior deterministic without weakening the production path.

**Alternatives considered**: Main-thread parsing violates the worker policy at eligible sizes. A global worker complicates owner isolation and concurrency. Persisting render trees adds unnecessary storage and migration concerns.

## Decision 7: Reuse text state as the sole source authority

**Decision**: `TextDocumentState` remains authoritative for normalized display text, raw-text projection, encoding, newline sequence, byte size, dirty state, recovery, and saving. Markdown session state stores only mode and render/navigation projections.

**Rationale**: S013 already handles the difficult byte-preserving lifecycle. Reusing it prevents Markdown from accidentally serializing an AST or normalizing source that the user did not edit.

**Alternatives considered**: Saving from the parsed tree would rewrite formatting and comments. A parallel Markdown source buffer would drift from recovery and conflict state.

## Decision 8: Treat Mermaid fences as escaped code in S014

**Decision**: Fenced `mermaid` blocks render as ordinary escaped code until issue #54 supplies the isolated renderer and issue #56 integrates revision-bound child diagrams.

**Rationale**: The Mermaid sanitizer, resource limits, sandbox, and concurrency contract are a distinct P0 security boundary. Bundling an incomplete version into Markdown would undermine both slices.

**Alternatives considered**: Hiding Mermaid source loses content. Rendering it through an ad hoc library call duplicates and weakens the planned isolated adapter.

## Decision 9: Use semantic-tree indexes for outline and search

**Decision**: Build heading and visible-text indexes from the sanitized result, retaining parser source positions. Stable heading IDs use a normalized label plus deterministic collision suffixes. Search operates on visible semantic text and maps matches back to rendered node IDs and exact source offsets when available.

**Rationale**: Indexing the same accepted tree keeps rendered navigation synchronized and avoids DOM scraping. Source positions support meaningful mode handoff without rewriting the document.

**Alternatives considered**: Searching source exposes markup rather than what the reader sees. Searching the DOM loses source positions and can include hidden accessibility text. Label-only heading IDs collide.

## Decision 10: Define explicit size modes and print presentation

**Decision**: At or below 16 MiB, rendered and source modes are available. Above 16 MiB through 32 MiB, source editing remains but preview is limited. Existing S013 behavior handles 32-256 MiB and greater-than-256 MiB sources. Print uses the sanitized rendered surface plus print CSS and never prints shell chrome.

**Rationale**: These are the normative release thresholds. Reusing the existing large-text path keeps degradation consistent across platforms.

**Alternatives considered**: Attempting preview above 16 MiB violates the declared memory budget. Refusing at 16 MiB discards already-supported source editing. Building a separate print serializer would create a second rendering pipeline.
