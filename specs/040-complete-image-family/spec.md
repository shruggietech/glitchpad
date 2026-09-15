# Feature Specification: S040 Complete Image-Family Capability

**Feature Branch**: `codex/040-complete-image-family`

**Created**: 2026-09-15

**Status**: Specified, unreleased

**Input**: Complete the accepted next slice by bundling #70 (GIF/animated WebP), #71 (safe SVG), #72 (ICO entries/export), and #74 (complete image controls), using S039's bounded image pipeline. Automatically publish the official PR, satisfy every review comment, request at most one follow-up review round, and hand green CI to the owner without merging.

## User Scenarios & Testing

### User Story 1 - Inspect safe vector images (Priority: P1)

A user opens an SVG through the existing local source flow, views an inert preview, and inspects dimensions and supported facts without executing content or fetching resources.

**Why this priority**: SVG introduces an active-content boundary and is the image backlog's P0 implementation issue (#71).

**Independent Test**: Open original vector fixtures and malicious fixtures on each platform; verify correct local output or a bounded classified fallback, with zero network, script, navigation, or undeclared native activity.

**Acceptance Scenarios**:

1. **Given** a valid local SVG, **When** opened, **Then** it has a correctly sized inert preview, fit/zoom/pan controls, safe copyable facts, and no source editing/save.
2. **Given** scripts, events, foreign objects, external images/styles/fonts/references, or links, **When** opened, **Then** those constructs cannot execute or resolve and their omission or refusal is reported without exposing sensitive locators.
3. **Given** malformed, recursive, oversized, or excessively complex SVG, **When** previewed, **Then** a classified bounded failure or declared unsupported result appears and other sessions remain usable.
4. **Given** missing fonts or unsupported constructs, **When** rendered, **Then** the declared bundled-font/fallback policy is visible and no host-font or remote-resource lookup occurs.

### User Story 2 - Control animation explicitly (Priority: P1)

A user opens GIF or animated WebP paused, steps through correctly composed frames, and explicitly starts or pauses playback while seeing timing, loop, and frame facts.

**Why this priority**: This completes #70's end-to-end animation capability and replaces S039's animated-WebP poster limitation.

**Independent Test**: Compare independent golden pixels for timing/disposal/transparency fixtures; operate play/pause/step with keyboard and touch, then suspend the session and verify that work and regenerated surfaces are released.

**Acceptance Scenarios**:

1. **Given** a supported animation, **When** opened, **Then** it starts paused with current frame, frame count, original timing and loop facts available.
2. **Given** partial frames and disposal/blend instructions, **When** stepped or played, **Then** each displayed composited frame matches its golden expected pixels.
3. **Given** reduced-motion preferences or a background/hidden session, **When** the preference/session changes, **Then** playback stops, no new frame work is scheduled, and returning remains paused at the retained frame.
4. **Given** excessive frames, durations, dimensions, truncation, or cancellation, **When** inspected, **Then** checked limits produce a stable classification with no eager whole-animation allocation or late publication.

### User Story 3 - Inspect and export one icon entry (Priority: P1)

A user opens an ICO container, sees every directory entry and its dimensions, depth, encoding, byte size, alpha/decode facts, previews a chosen valid entry, and explicitly exports that decoded entry as PNG.

**Why this priority**: #72 requires transparent container inspection and introduces a narrowly authorized export operation distinct from source save.

**Independent Test**: Open mixed PNG/BMP, duplicate, overlapping, and malformed entries; preview valid entries independently and exercise cancelled, successful, stale, conflicting, and provider-failed exports without changing original bytes.

**Acceptance Scenarios**:

1. **Given** a mixed valid/malformed ICO, **When** opened, **Then** every bounded directory entry is listed, failures stay entry-local, duplicates are identified, and valid previews remain usable.
2. **Given** valid PNG- and BMP-backed entries, **When** selected, **Then** correct inert pixels appear on every platform and entry choice stays with the session.
3. **Given** a chosen decoded entry, **When** Export selected entry is explicitly invoked, **Then** Save As confirms a PNG destination and writes only that entry; cancellation writes nothing.
4. **Given** stale source/selection, destination conflicts, revocation, partial writes, or destination equal to the original, **When** export is attempted, **Then** it fails or requires the existing conflict decision, never overwrites the original automatically, and reports the actual outcome.

### User Story 4 - Use complete compact image controls (Priority: P1)

A user operates raster, SVG, animation, and ICO sessions through capability-driven controls while the image keeps the majority of the document pane.

**Why this priority**: Completing #74 ties every included family into one coherent image increment instead of leaving disconnected decoder features.

**Independent Test**: Exercise every essential action with keyboard-only, touch-only, pointer, pinch, and assistive technology at desktop and mobile widths, including session switching, revision refresh, and disposal.

**Acceptance Scenarios**:

1. **Given** any image family, **When** fit, actual size, zoom, reset, pan, background, or information is used, **Then** only advertised actions appear, controls have accessible names, and the image cannot be panned permanently out of reach.
2. **Given** a mobile viewport, **When** controls collapse, **Then** all essential actions stay reachable with at least 44-pixel touch targets and without page overflow.
3. **Given** switched/hidden sessions, **When** resumed, **Then** viewport, chosen frame/entry and background are retained, playback remains paused, and regenerated previews obey current source revision.
4. **Given** replacement, external revision, permission loss, rapid selection, or close, **When** in-flight work completes, **Then** stale results/export authority cannot publish and owned timers, previews, and native work are disposed idempotently.

### Edge Cases

- Misleading extensions, truncated signatures, streamed Android sources with omitted size, the exact source ceiling, and revision changes during reads.
- SVG DTD/entities, CSS imports/URLs, nested references, foreign namespaces, enormous paths, embedded image data, missing fonts, and intrinsic-size overflow.
- GIF/WebP zero timing, disposal-to-background/previous, frame rectangles outside the canvas, loop overflow, frame bombs, and random seeks after suspension.
- ICO zero dimensions meaning 256 pixels, invalid reserved/type/count fields, directory truncation, overlapping/duplicate ranges, corrupt entry payloads, alpha/mask differences, and no valid entry.
- Export cancelling the chooser, writing to the original, stale entry/revision, destination replacement conflicts, non-seek Android providers, write/close failures, and original-source immutability.

## Requirements

### Functional Requirements

- **FR-001**: Content verification MUST select raster, GIF/animated WebP, SVG, or ICO through existing opaque source flows; extensions alone MUST NOT grant format or write authority.
- **FR-002**: Existing raster decoding, metadata/location redaction, source/revision checks, immutable source behavior, and official 0.1.3 authority MUST remain compatible.
- **FR-003**: SVG MUST produce inert local image output; source markup MUST never enter an active document surface.
- **FR-004**: SVG scripts/events/foreign objects, external styles/fonts/images/references/links, and network resolution MUST be disabled or refused, with bounded value-free diagnostics.
- **FR-005**: SVG MUST enforce encoded size, node/path complexity, depth, font, decoded/output, and time limits before unsafe expansion, and report malformed/unsupported/over-limit classifications.
- **FR-006**: SVG MUST expose intrinsic/display dimensions and supported facts with a declared deterministic bundled-font/fallback policy, without host or remote font discovery.
- **FR-007**: GIF/animated WebP MUST expose frame count/current position, original timing, and loop facts, and start paused.
- **FR-008**: Animation MUST compose timing/disposal/blending correctly and decode incrementally within checked frame count, duration, surface, peak, and per-request time limits; whole-animation surface buffering is prohibited.
- **FR-009**: Explicit play/pause/previous/next/position controls MUST support keyboard, pointer, touch, and assistive technology; reduced-motion changes MUST stop playback.
- **FR-010**: Hidden/background sessions MUST schedule no animation/frame work, release regenerable surfaces, and resume paused at the retained frame.
- **FR-011**: ICO MUST enumerate every bounded directory entry with dimensions, bit depth, encoding, byte size, alpha/decode status, and duplicate evidence.
- **FR-012**: Malformed ICO entries MUST fail independently; selected valid PNG/BMP entries MUST remain previewable without rejecting unrelated valid entries.
- **FR-013**: ICO entry count, range arithmetic, encoded/surface/peak/output budgets, and decode time MUST be bounded; selection MUST be validated against source revision.
- **FR-014**: ICO MUST advertise an explicit selected-entry PNG export capability distinct from source Save; export MUST require a chosen successfully decoded entry and Save As destination.
- **FR-015**: Export MUST revalidate source revision, selected entry, destination identity/conflicts, and write outcome, preserve original bytes, reject an original-source destination, and release temporary/native authority on every exit.
- **FR-016**: Raster/SVG/animation/ICO source editing and source Save MUST remain unavailable; generated entry export MUST never enable those commands implicitly.
- **FR-017**: Image controls MUST provide advertised fit, actual size, zoom 10%-1600%, reset, bounded pan, background and information, plus animation/frame or ICO/entry/export actions only for applicable capabilities.
- **FR-018**: Essential image actions MUST pass keyboard-only and touch-only operation, accessible names, reduced-motion behavior, and mobile layout checks with reachable 44-pixel targets and no page overflow.
- **FR-019**: Viewport, background, current frame/entry MUST belong to the session; refresh MUST atomically invalidate old preview/facts/entry export, retain session identity, and prevent stale publications.
- **FR-020**: Work MUST retain checked native admission until actual completion, cancel scheduling/publication within 250 ms, and release owned timers/blob previews/entry surfaces on suspension, replacement, close, failure, and disposal.
- **FR-021**: Original/generative golden and hostile fixtures MUST prove composition, SVG denial, ICO isolation/export, privacy, resource boundaries, accessibility, revision, and byte preservation across Windows/macOS/Linux/Android.
- **FR-022**: Dependencies/fonts/fixtures MUST have reviewed Apache-compatible provenance, pinned versions, required notices and no advisory suppression; full required validation MUST complete with real successful exit status.
- **FR-023**: This slice MUST satisfy every criterion of #70/#71/#72/#74 while keeping #75/#76/#66 and later format milestones incomplete; associations, intents, support claims and official version MUST remain unchanged.
- **FR-024**: Spec Kit analysis/convergence, official push/PR, every review reply/resolution, and green latest-head CI MUST precede owner handoff; at most one explicit follow-up review round is permitted and automatic merge is prohibited.

### Key Entities

- **Image session**: Existing opaque source/revision owner, image family and advertised capabilities, viewport, chosen frame/entry, metadata and classified lifecycle state.
- **Animation descriptor/frame**: Canvas, bounded frame inventory, original timing/loop facts, composited selected pixels and transient bounded decode state.
- **Vector descriptor**: Intrinsic dimensions, supported facts, omitted/refused construct statuses, deterministic font policy and inert bounded preview.
- **Icon directory/entry**: Stable directory index, checked byte range, dimensions/depth/encoding/alpha, duplicate and independent decode state.
- **Selected-entry export**: Explicit entry/revision-bound intent, regenerated verified PNG bytes, chosen destination authority and actual conflict-safe result, never original-source write authority.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every included issue criterion and all 16 acceptance scenarios have passing automated or explicitly documented platform evidence, with zero implicitly closed incomplete issues.
- **SC-002**: SVG hostile fixtures cause zero script execution, navigation, undeclared native invocation, host-resource lookup, or network request on all four platform families.
- **SC-003**: All golden animation frames and valid PNG/BMP icon entries match independent expected pixels; every bounded icon directory entry remains represented despite neighboring payload failures.
- **SC-004**: Every essential action passes keyboard/touch/accessibility tests at four viewport sizes; the document pane retains at least 70% usable image coverage and the page never overflows.
- **SC-005**: After suspension/close/replacement, no new animation work is scheduled, playback stays paused on resume, and all owned regenerable previews/timers return to zero; cancelled/stale results never publish.
- **SC-006**: Every export scenario preserves original bytes; cancelled/stale/revoked/conflicting/failed exports report truthful outcomes and never perform automatic original replacement.
- **SC-007**: All required local/hosted/security/documentation/platform gates pass on the final PR head, every actionable review is replied to and resolved, and review-round limits are respected before owner handoff.

## Assumptions

- S039's merged image/source/metadata contracts are the foundation; this is an unreleased v0.2.0 delta, not public image activation.
- Animations start paused even without reduced-motion preferences. Zero/very short timing has a documented bounded presentation policy while original timing remains inspectable.
- SVG may omit unsupported active or external constructs or refuse the file; it never resolves them. Unsupported embedded image/font content receives a declared fallback.
- ICO export is a new explicit generated-PNG action. Existing source-save restrictions continue to protect original image containers.
- Full milestone fuzz/performance/conformance and release reconciliation remain #75/#76 work, while this slice supplies the acceptance evidence for its included capabilities.
