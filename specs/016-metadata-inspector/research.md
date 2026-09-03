# Research: Contextual Metadata Inspector

## Centralized policy and shell ownership

**Decision**: Define the static catalog and typed fact/snapshot model in the shared TypeScript domain. Native and renderer producers submit bounded observations; `App` owns one nonmodal inspector beside the document surface.

**Rationale**: Policy stays identical across platforms and renderers, producer labels cannot mislead the interface, and future formats extend one contract. Shell ownership gives the command bar and contextual controls one action.

**Alternatives considered**: Native-preformatted rows leak localization and policy into adapters. Renderer-specific panels duplicate copy, layout, and accessibility logic. A modal dialog blocks document context.

## Revision-safe contributions

**Decision**: Each contribution names the session, expected session revision, producer, and applicable external or renderer revision. The reducer accepts matching contributions atomically and discards stale work.

**Rationale**: Host, detection, profile, and renderer work finish independently; last-completion-wins would publish old facts after edits and tab changes.

## Path-free platform observations

**Decision**: Native metadata returns source ID, exact external revision, optional reliable timestamps, source kind, and effective write state. It never returns a displayable path, URI authority, document ID, identity token, change token, or native error.

**Rationale**: The interface needs truth and currency, not locators. Android omissions and filesystem timestamp failures remain per-fact states.

## Cooperative source integrity

**Decision**: Host-owned SHA-256 state uses start, at-most-1-MiB advance, and cancel operations. Completion revalidates the external revision before returning a lowercase digest. Known sources above 256 MiB are refused; unknown lengths require EOF within the cap; empty sources use a revision-check finalize path.

**Rationale**: This avoids whole-document WebView copies, bounds cancellation, supports provider streams that omit size, and closes the post-read revision race.

**Alternatives considered**: WebCrypto requires a whole buffer. One native hash call cannot provide reliable cooperative cancellation with existing state boundaries. Rejecting all unknown lengths would exclude truthful Android providers.

## Explicit disclosure and copy

**Decision**: Catalog copy policy is `direct`, `explicit_confirmation`, or `denied`. Copy uses the exact formatted visible value and unit. Sensitive disclosure is per fact, is never included in bulk copy, and resets on close or session change.

**Rationale**: Clipboard output is a data-release boundary; producer-controlled copy flags or a persistent global disclosure preference weaken it.

## Responsive accessible presentation

**Decision**: Desktop and tablet use a right sheet capped at 360 pixels; phones use a compact bottom sheet. The structure uses headings and description lists, Escape dismissal, opener focus restoration, 44-pixel coarse targets, and one restrained live region.

**Rationale**: CSS follows viewport reality without user-agent detection. Nonmodal semantics preserve the file as primary content.
