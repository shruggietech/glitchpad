# Research: Mermaid Viewing and Editing

**Date**: 2026-09-03

## R1. Model Mermaid as its own language in two document contexts

**Decision**: Treat Mermaid as a text-based diagram language, not as a Markdown subset. Support standalone `.mmd` and `.mermaid` files and fenced `mermaid` blocks inside Markdown through one renderer policy.

**Rationale**: Mermaid describes itself as using Markdown-inspired text definitions, and its official tooling accepts `.mmd` diagram files and transforms fenced Mermaid blocks in Markdown. Separating the contexts preserves correct ownership: standalone source is directly editable and saveable, while an embedded block is a region of its parent Markdown source.

**Alternatives considered**: Markdown-only support forces standalone diagrams into wrappers and prevents first-class associations. Treating Mermaid as Markdown would misclassify source and create incorrect rendering and save semantics. Separate renderer implementations would duplicate security and drift behavior.

**Primary evidence**: [Mermaid project introduction](https://github.com/mermaid-js/mermaid), [Mermaid CLI](https://github.com/mermaid-js/mermaid-cli), [Mermaid getting started](https://github.com/mermaid-js/mermaid/blob/develop/docs/intro/getting-started.md)

## R2. Use the bundled Mermaid API directly

**Decision**: Integrate Mermaid 11.17.2 through its public `parse` and `render` functions and pin DOMPurify 3.4.14 directly under its Apache-2.0 license option. Do not bundle Chromium, invoke a CLI, rely on a transitive sanitizer version, or use a remote rendering service.

**Rationale**: The API validates source without rendering and renders a definition string to SVG. Direct use fits the existing TypeScript/WebView renderer layer, works offline, avoids process and temporary-file overhead, and does not introduce Electron or Puppeteer. Exact patch selection belongs in the implementation lockfile and must pass dependency and security review.

**Alternatives considered**: Mermaid CLI brings a headless-browser toolchain unsuitable for an embedded mobile and desktop application. Server rendering violates offline and privacy requirements. Reimplementing Mermaid syntax is infeasible and incompatible.

**Primary evidence**: [Mermaid API usage and syntax validation](https://mermaid.js.org/config/usage), [Mermaid 11.17.2 release](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4011.17.2), [DOMPurify 3.4.14 release](https://github.com/cure53/DOMPurify/releases/tag/3.4.14)

## R3. Combine strict Mermaid configuration with an application-owned security boundary

**Decision**: Initialize Mermaid once with strict security, immutable security and styling configuration keys, no start-on-load behavior, bounded text and edge counts, no callbacks, and deterministic identifiers. Reject authored configuration directives at the render-policy boundary while preserving their source bytes. Apply both DOMPurify's SVG profile and a Glitchpad element, attribute, CSS, and local-fragment URL allowlist, then display the result only through an inert static-image sink.

**Rationale**: Mermaid documents that strict mode encodes HTML tags and disables click functionality. Its secure-key mechanism prevents diagram directives from overriding site-owned settings and includes `securityLevel`, `maxTextSize`, and `maxEdges` by default. Defense in depth remains required because every input is hostile and generated SVG is still parser output.

**Alternatives considered**: Loose and antiscript modes permit active labels or clicks and are prohibited. Mermaid's beta sandbox mode still executes library code in the caller and does not provide a cross-platform preemptible worker. Raw SVG injection, including the website's existing `dangerouslySetInnerHTML` integration, is prohibited. Trusting only built-in sanitization gives the application no stable allowlist contract.

**Primary evidence**: [Mermaid security levels](https://mermaid.js.org/config/schema-docs/config-properties-securitylevel.html), [Mermaid secure configuration](https://mermaid.js.org/config/schema-docs/config-properties-secure.html), [Mermaid security advisory GHSA-6x64-9x62-f2gx](https://github.com/mermaid-js/mermaid/security/advisories/GHSA-6x64-9x62-f2gx), [DOMPurify allowlist guidance](https://github.com/cure53/DOMPurify#control-our-allow-lists-and-block-lists)

## R4. Preserve user directives without allowing security overrides

**Decision**: Preserve all source text exactly and allow appearance/layout configuration that survives the security policy. Secure keys, external resource configuration, executable behavior, unsafe HTML, and renderer budgets remain application-owned and cannot be overridden by frontmatter or legacy directives.

**Rationale**: Diagram direction and safe styling are authored content. Mermaid's secure configuration exists specifically to keep designated site settings immutable while permitting lower-risk diagram configuration. The repository's top-to-bottom diagram convention governs project documentation and has no authority over opened user files.

**Alternatives considered**: Stripping every directive would alter legitimate diagrams. Allowing every directive would permit hostile configuration. Rewriting horizontal diagrams to top-to-bottom would corrupt user intent and violate exact source preservation.

**Primary evidence**: [Mermaid directives](https://mermaid.js.org/config/directives), [Mermaid secure configuration](https://mermaid.js.org/config/schema-docs/config-properties-secure.html)

## R5. Compose the existing text lifecycle

**Decision**: Standalone Mermaid sessions reuse the editable-text buffer, encoding/newline profile, source revision, dirty state, recovery, external-change detection, atomic save, search, and tab lifecycle. Mermaid state contains only parse/render diagnostics, preview revision, viewport, and accessibility projection.

**Rationale**: Mermaid files are text. Reusing one source lifecycle guarantees the same conflict and loss-prevention behavior while preventing the renderer from becoming a second source authority.

**Alternatives considered**: A Mermaid-specific save pipeline duplicates the highest-risk behavior. A visual graph editor would require source regeneration and format-preservation rules far outside this feature.

## R6. Debounce, supersede, and bound preview work

**Decision**: Start preview validation 300 milliseconds after the newest edit, allow only one in-flight request per owner and two queued owners app-wide, serialize access to Mermaid's module-global configuration, key every request by exact source revision and generation, and commit only a result matching the newest revision. Enforce 1 MiB standalone render input, 256 KiB per embedded block, 2,000 edges, 8 MiB sanitized output, and a 5 second cooperative deadline.

**Rationale**: The chosen delay stays inside the 250–500 ms acceptance window and avoids rendering each keystroke. Revision and generation keys solve out-of-order completion deterministically. Explicit limits prevent large diagrams and documents containing many blocks from monopolizing memory or interaction time while retaining source editing. Mermaid rendering requires a DOM and cannot be moved into the existing worker; a timer in the same WebView cannot preempt synchronous third-party code, so the plan records that limitation instead of treating a Promise race as a hard sandbox.

**Alternatives considered**: Rendering on every change wastes work and causes stale previews. Manual-only rendering slows ordinary edits. Unlimited parallel rendering violates mobile memory and active-tab priorities. Refusing the whole source after a rendering limit would unnecessarily block safe text access.

## R7. Keep the last valid preview, but label it stale

**Decision**: On parse or render failure, retain the last valid preview for the session, mark it as belonging to an older source revision, focus the diagnostic in source mode on request, and never save generated output.

**Rationale**: A diagram remains useful while the user corrects a temporary syntax error, but the UI must not imply that stale output represents current source. The editor buffer remains authoritative.

**Alternatives considered**: Clearing the preview on each syntax error creates distracting flicker and removes context. Showing stale output without an explicit state is misleading. Auto-repairing source changes authored content.

## R8. Preserve authored accessibility and guarantee a fallback

**Decision**: Preserve `accTitle` and `accDescr`, verify their resulting SVG title/description and ARIA relationships after sanitization, and add a localized filename/type or block-position label plus source route when annotations are absent.

**Rationale**: Mermaid supports accessible titles and descriptions for all diagram types and inserts corresponding SVG and ARIA elements. A fallback is still necessary because most existing files will not contain annotations and a visual-only result does not satisfy the product accessibility contract.

**Alternatives considered**: Requiring annotations before render would reject useful diagrams. Generating a prose summary of arbitrary graphs is unreliable. Exposing raw SVG structure alone gives inconsistent screen-reader output.

**Primary evidence**: [Mermaid accessibility options](https://mermaid.js.org/config/accessibility)

## R9. Defer export and online rendering

**Decision**: Ship view, source edit, save, search, zoom, pan, and inspect only. Defer SVG/PNG/PDF export, presentation mode, online rendering, and collaboration to separate feature specifications.

**Rationale**: Export introduces dimensions, scaling, font embedding, background, metadata, accessibility, deterministic output, and platform share contracts. None are required to solve local file viewing and source editing.

**Alternatives considered**: Saving generated SVG beside source creates synchronization and overwrite questions. Online rendering violates the local-first boundary. A broad diagram workspace conflicts with the minimal interface.
