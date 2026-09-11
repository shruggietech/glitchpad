# Contract: Markdown Recovery and Reserved Shell Chrome

## Markdown rendering

1. A supported Markdown document requests rendered mode automatically and publishes a projection only when session, revision, generation, and retry attempt still match.
2. A worker, parser, sanitizer, projection, embedded-resource, or React commit failure remains inside the active document region.
3. Failure copy is static and content-free. Source appears only after explicit user action.
4. `View source` enters a recovery source state with a visible `Retry preview` action.
5. `Retry preview` starts a fresh attempt without editing the document or restarting the application.
6. Repeated failure returns actionable contained feedback and leaves source, close, open, menu, and diagnostics reachable.
7. Failure message and action rows use intrinsic height near the start of the document region.

## Runtime compatibility

1. Production renderer code honors the declared Chrome 69 target unless the platform baseline is changed through a separate compatibility decision.
2. Projection, cleanup, and worker startup must not require unpolyfilled `Object.hasOwn`, `queueMicrotask`, or `globalThis`.
3. Compatibility hardening is verified in source and production bundles and is not presented as a universal root-cause diagnosis without reproducing evidence.

## Shared shell geometry

1. The application menu is owned by an in-flow shell row outside `.document-surface` in empty, single-document, and multi-document states.
2. Desktop toolbar and trigger are at least 32px; coarse-pointer toolbar and trigger are at least 44px; the visible glyph is approximately 18px.
3. The tab strip shares the shell row. Combined application chrome remains at or below 72px.
4. The persistent toolbar and closed trigger have zero intersection with document content, controls, selections, and scrollbar regions.
5. Opening and closing the popup changes neither document client geometry nor document scroll position.
6. The popup is below and disjoint from the trigger, remains inside the viewport, and scrolls internally if needed.
7. The trigger rectangle is stable within one device pixel and focus returns visibly to the same connected trigger after Escape, outside-pointer dismissal, or command activation.
8. Text, Markdown, Mermaid, empty, pending, ready, and failure surfaces require no renderer-specific shell padding.

## Evidence

1. Vitest proves state transitions, stale-result rejection, accessibility, containment, recovery, close/reopen, restoration, and same-bytes/different-name behavior.
2. A governed production-browser probe measures actual toolbar, trigger, glyph, popup, document, scrollbar, scroll-offset, and recovery-row geometry across representative viewports, scale factors, shell states, themes, motion, colors, and pointer modes.
3. The existing Windows lifecycle harness executes exact NSIS and portable candidate bytes and proves minimal plus governed Markdown rendering through supported delivery paths.
4. Hosted macOS and Linux CI run a named shared-shell and Markdown recovery smoke step.
5. Packaged OS scale claims require recorded OS-scale evidence; browser device scale or zoom is labeled accurately.
6. Receipts and diagnostics are content-free and allowlisted.
