# Research: Markdown Recovery and Reserved Shell Chrome

## Decision 1: Separate confirmed regressions from the unproven renderer trigger

**Decision**: Fix the confirmed S030 fallback-grid stretching and revision-scoped permanent suppression, harden concrete WebView compatibility gaps, and label the universal packaged renderer trigger as unproven until final-byte evidence identifies it.

**Rationale**: The generic message proves a synchronous React projection or commit failure reached `DocumentErrorBoundary`; ordinary worker and parser failures already become a different in-document state. The repository can conclusively explain the giant action and missing retry, but the reporter's universal failure lacks version, WebView, asset, and content evidence.

**Alternatives considered**: Treating layout as the renderer cause would conflate symptoms. Swallowing projection exceptions would weaken containment. Claiming a single JavaScript compatibility API as universal would exceed the evidence.

## Decision 2: Harden the declared Chrome 69 runtime boundary narrowly

**Decision**: Replace `Object.hasOwn` with `Object.prototype.hasOwnProperty.call`, replace `queueMicrotask` cleanup with a Promise microtask helper, and use the worker's `self` global where appropriate. Add compatibility tests that fail when the production bundle preserves unsupported globals.

**Rationale**: Vite targets Chrome 69, the Windows package skips WebView2 installation, and the current polyfill layer does not cover `Object.hasOwn`, `queueMicrotask`, or `globalThis`. `Object.hasOwn` can synchronously fail during footnote projection and reach the reported boundary; the other APIs affect cleanup and worker startup.

**Alternatives considered**: Raising the browser target or requiring a newer WebView would silently narrow platform support. Broad polyfill packages add runtime weight and dependency surface. These changes are hardening, not a claim that one primitive explains every reported file.

## Decision 3: Make retry a document-owned attempt transition

**Decision**: Let `DocumentSurface` own revision-scoped suppression and a retry epoch. `View source` enters explicit recovery source mode. `Retry preview` clears suppression, increments the epoch, publishes rendered/scheduled state, and forces a fresh Markdown render attempt; repeated failure returns updated contained feedback without disabling source, close, open, or diagnostics.

**Rationale**: The current suppression key forces source until the revision changes, so the surfaced recovery path is terminal. An attempt epoch rejects stale results and remounts the projection path without changing document content or requiring application restart.

**Alternatives considered**: Automatically retrying indefinitely can loop on malformed content. Clearing suppression merely because the mode changes can immediately rethrow the same tree. Requiring an edit or restart is not usable recovery.

## Decision 4: Keep failure controls intrinsically sized

**Decision**: Constrain the failure layout to max-content rows aligned at the document start, with a compact action group and existing accessible control states.

**Rationale**: `.document-render-failure` is a grid inside a full-height grid cell. Unconstrained implicit tracks stretch the alert and action across the available height, directly matching the reported screenshot.

**Alternatives considered**: Fixed pixel heights break localization and zoom. Absolute positioning can collide with the shell and document content. A renderer-specific wrapper would duplicate the defect boundary.

## Decision 5: Reserve one shared in-flow shell row

**Decision**: Add `.shell-chrome` as the first application grid row, containing a 32px leading application toolbar and the conditional tab strip. Use a 44px row and trigger in coarse-pointer mode, retain an 18px glyph, and anchor the popup below the row within viewport bounds.

**Rationale**: The permanent trigger then has zero intersection with every document surface without renderer padding. With tabs, the existing 40px tab band absorbs the toolbar, so the fix does not create a third band. An always-available shell owner also supports the empty state.

**Alternatives considered**: A separate third row creates needless height. A left rail taxes document width. Renderer padding is distributed and fragile. A portal adds focus ownership complexity. Moving the control into `TabStrip` breaks zero- and one-document availability.

## Decision 6: Keep the toolbar stable while contextual panels are open

**Decision**: Preserve the shell row and connected menu trigger when panels or the inspector are active, disabling or hiding interaction without removing its layout owner. Focus restoration must target a connected element and the first enabled menu item.

**Rationale**: The current conditional unmount can leave the stored opener detached and changes shell structure. Stable ownership prevents focus loss and document movement while preserving existing mutual exclusion among disclosures.

**Alternatives considered**: Re-querying an unmounted trigger masks structural churn. Removing the entire row while panels open reintroduces document reflow. Keeping an open menu under another panel creates competing focus scopes.

## Decision 7: Combine behavioral, rendered-geometry, and packaged evidence

**Decision**: Use Vitest for state transitions and accessibility, a Puppeteer probe against the production build for actual CSS geometry, and the existing Windows lifecycle harness for final NSIS and portable bytes. Hosted macOS and Linux receive a named focused shared-shell test step.

**Rationale**: JSDOM cannot measure layout, static CSS matching cannot prove non-overlap, and only the packaged Windows runner can exercise WebView2 and UI Automation. One production-browser probe can measure both the recovery surface and menu geometry without a production failure backdoor.

**Alternatives considered**: A second native harness duplicates application-state and UIA infrastructure. Browser-only evidence misses packaged-runtime failures. Runtime query flags or fixture-name switches would add unsafe test authority to release bytes.

## Decision 8: Keep evidence content-free

**Decision**: Reuse closed renderer states and allowlisted receipt fields. Record environment versions, dimensions, scale, stable stages/codes, and boolean outcomes only; never persist raw exception messages, source, filenames, paths, URLs, or provider identifiers.

**Rationale**: Arbitrary error and console text can contain private document fragments. Existing diagnostics are designed around closed values and bounded numeric facts.

**Alternatives considered**: Truncating error messages does not remove private content. Raw WebView logs may aid a local manual investigation only after redaction and do not belong in default diagnostics or CI receipts.

## Decision 9: Extend the existing final-byte lifecycle gate

**Decision**: Add minimal, governed-complex, same-bytes/different-name, order, close/reopen, restoration, association-delivery, and geometry facts to the existing portable lifecycle receipt and installed wrapper. Verify exact candidate digests and WebView environment facts in the current Windows workflow.

**Rationale**: The harness already owns isolated state, exact artifact execution, command-line delivery, UI Automation, and receipt handling. Extending it preserves identity and reviewability.

**Alternatives considered**: A new S035 harness would duplicate isolation, association, process, and UIA logic. Attaching private reporter files is unacceptable. Deterministic contained-error geometry remains in the production-browser probe unless a safe packaged failure seam already exists.
