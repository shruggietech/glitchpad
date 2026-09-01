# Research: Document Foundation and Content Shell

## Decision 1: Keep Rust authoritative and TypeScript presentational

**Decision**: Define document identity, source capabilities, renderer capabilities, errors, detection outcomes, text profiles, and session lifecycle in `glitchpad-core`. Represent the same serialized shapes in TypeScript for the shell and verify the Rust wire contract with JSON Schema tests. Source capabilities independently cover read, seek, stream, metadata, observe revision, revalidate, write, atomic replacement, reopen, and reveal location.

**Rationale**: These rules must behave identically across desktop and Android hosts and must remain independent of a WebView or native file API. A serialized boundary also prevents the React layer from inventing capabilities that a source or renderer did not advertise.

**Alternatives considered**: TypeScript-only domain types were rejected because privileged hosts and future non-WebView consumers need the same policy. A generated TypeScript client was deferred because the repository does not yet have a generation pipeline and S005 can establish stable schemas first.

## Decision 2: Derive versioned JSON Schema with Schemars 1.2.2

**Decision**: Add Schemars 1.2.2 with derive support alongside Serde, place an explicit contract version in exported envelopes, and test representative serialization plus generated schema shape.

**Rationale**: Schemars derives JSON Schema from Rust types and defaults to JSON Schema 2020-12, which provides machine-readable evidence that the native and interface boundary is deliberate. The explicit envelope version allows later incompatible contract revisions to fail visibly.

**Alternatives considered**: Hand-authored schemas were rejected because they can drift from Rust. A build-time TypeScript generator was deferred until multiple consumers make generation worth the additional toolchain.

## Decision 3: Bound detection to a 64 KiB probe

**Decision**: Detection receives a caller-supplied probe of at most 65,536 bytes plus safe source facts. It records when the source was truncated, caps evidence at 32 entries, performs no I/O, and returns a deterministic result that can be abandoned by the caller without side effects.

**Rationale**: A pure bounded detector cannot read an oversized file accidentally, is naturally cancellable at the host boundary, and can meet the 100 millisecond target without coupling the core to platform timers or threads.

**Alternatives considered**: Reading entire files was rejected as unsafe and unnecessary. A fixed extension map was rejected because untrusted content must not be classified by name alone. An asynchronous detector inside the core was rejected because cancellation and I/O ownership belong to host adapters.

## Decision 4: Use ordered, inspectable evidence

**Decision**: Evaluate strong content signatures first, then BOM and decoding validity, text structure, Mermaid directive structure, Markdown structure, and finally filename hints. Return the selected format, confidence, ordered evidence, and an explicit outcome of supported, ambiguous, unsupported, encrypted, malformed, oversized, inaccessible, binary, cancelled, or source-revised. Hosts may supply inaccessible, cancelled, and source-revised outcomes without invoking byte classification.

**Rationale**: Ordered evidence makes decisions explainable and testable. Filename hints remain useful while never overriding contradictory content.

**Alternatives considered**: A numeric score without evidence was rejected because it obscures why a decision occurred. MIME-only detection was rejected because MIME values can be absent, generic, or host-supplied guesses.

## Decision 5: Preserve source representation intent

**Decision**: The text profile distinguishes UTF-8 with or without BOM, UTF-16 little-endian or big-endian with BOM, mixed or consistent newline patterns, terminal-newline presence, and an explicit undecodable-byte policy. Invalid text candidates require a user decision when filename or media evidence still indicates text; otherwise they are unsupported binary input.

**Rationale**: Future save behavior needs a lossless representation contract. Recording uncertainty now prevents later editors from silently normalizing bytes.

**Alternatives considered**: Automatic lossy replacement was rejected because it corrupts source intent. Universal encoding guessing was rejected because probabilistic legacy-code-page detection is not required by this slice and would add ambiguous behavior.

## Decision 6: Make identity comparison three-valued

**Decision**: Identity comparison returns same, different, or uncertain. Only comparable strong identities can prove sameness or difference; weak or unavailable identities never trigger automatic deduplication.

**Rationale**: Desktop canonical paths, file IDs, Android document URIs, and ephemeral sources have different authority. A three-valued result prevents a cosmetic string match from merging unrelated documents and prevents weak differences from creating false certainty.

**Alternatives considered**: Comparing display paths was rejected because casing, aliases, URI grants, and provider semantics vary. Treating all uncertain identities as different was rejected because it would hide the reason deduplication was not possible.

## Decision 7: Use a deterministic reducer for tabs

**Decision**: Model open, activate, close, reorder, next, previous, and overflow operations as pure reducer transitions. Display at most five inline tabs by default, always retain the active tab inline, and place remaining tabs in a deterministic overflow menu.

**Rationale**: Pure transitions are inexpensive to test across keyboard, pointer, and touch entry points. Keeping the active tab visible preserves orientation while a fixed initial capacity avoids a layout-measurement dependency in the foundation slice.

**Alternatives considered**: A drag-and-drop dependency was rejected as unnecessary for a small strip and difficult to make equally accessible. Unlimited horizontal scrolling was rejected because it hides document count and complicates active-tab discoverability.

## Decision 8: Derive commands from active capabilities

**Decision**: Command descriptors are generated from the active session's source and renderer capability sets. A command contains a stable ID, label, optional shortcut, enabled state, and target session revision; execution rejects stale or unsupported targets.

**Rationale**: This keeps the interface honest, prevents dormant controls, and provides a testable atomicity rule when the active tab changes during an interaction.

**Alternatives considered**: A permanent global toolbar was rejected because it wastes viewport and exposes irrelevant actions. Hiding unsupported commands only at execution time was rejected because users should not be offered impossible operations.

## Decision 9: Use native semantics plus direct axe-core checks

**Decision**: Use native buttons, a semantic tablist with tabs and tabpanels, visible focus, automatic keyboard tab activation, polite live announcements, and direct `axe.run` checks in Vitest. Verify 200 percent zoom and screen-reader behavior with explicit quickstart checks until browser-level assistive technology automation is introduced.

**Rationale**: Native semantics reduce custom ARIA state and provide reliable keyboard behavior. axe-core 4.13.0 supplies local automated WCAG rules and TypeScript declarations without runtime dependencies.

**Alternatives considered**: Custom clickable containers were rejected because they require recreating built-in semantics. A browser automation stack was deferred because S005 can verify behavior with the existing test harness and documented manual checks without introducing a second large test runtime.

## Decision 10: Keep touch geometry responsive

**Decision**: Compact desktop controls use a 72-pixel maximum shell chrome budget. On coarse pointers or narrow viewports, essential controls gain a minimum 44 by 44 CSS-pixel activation area while labels and document content remain readable.

**Rationale**: The same interface must remain compact on desktop and operable on Android. Responsive hit areas satisfy both goals without permanently inflating every desktop tab.

**Alternatives considered**: A separate Android interface was rejected because shared interaction behavior is foundational. Permanently large controls were rejected because they would violate the content-first viewport requirement on desktop.

## Decision 11: Keep S005 fixture-backed

**Decision**: The shell starts with representative in-memory document sessions and exposes pure APIs that future native adapters can populate. No file picker, native path access, persistence, save operation, renderer engine, or metadata extraction is added.

**Rationale**: This slice proves the contracts and interaction architecture before privileged I/O and complex formats depend on them.

**Alternatives considered**: Adding one desktop file adapter was rejected because it would create false cross-platform completeness and expand S005 beyond the four bundled issues.

## Dependency and license findings

| Dependency | Use | License posture | Decision |
| --- | --- | --- | --- |
| Schemars 1.2.2 | Rust development and runtime contract schema derivation | MIT | Accept and lock through Cargo.lock. |
| axe-core 4.13.0 | Development-only accessibility testing | MPL-2.0 | Accept as a test tool, retain notices required by its license, and verify repository license policy. |

## Documentation impact

S005 changes unreleased architecture and interaction behavior, so its Spec Kit artifacts are the source of record until the mandatory release documentation pass reconciles the shipped behavior into `docs/glitchpad-technical-specification.md`. Product version 0.0.0 does not change in this slice.
