# Feature Specification: S039 Bounded Raster Viewing and Metadata

**Feature Branch**: `codex/039-bounded-raster-images`

**Created**: 2026-09-15

**Status**: Specified

**Input**: Implement the accepted bundled proposal using Spec Kit and autopilot through a published, reviewed, green pull request. Include #68, #69, and #73. Contribute raster controls to #74 without closing it; preserve #75 and #76 activation gates.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Open and inspect a raster image (Priority: P1)

A user opens PNG, JPEG, static WebP, BMP, or TIFF through existing desktop or Android source flows and sees a readable image occupying the document viewport. They can fit, inspect actual size, zoom, pan, and inspect dimensions without changing the source.

**Why this priority**: This is the first useful image capability and the foundation for animation, SVG, ICO, and embedded office images.

**Independent Test**: Open the generated/redistributable valid corpus through each source adapter, exercise viewport controls, and compare expected preview dimensions, orientation, pixels, and original source digests.

**Acceptance Scenarios**:

1. **Given** each supported raster container, **When** it is opened through the chooser or delivered source, **Then** verified content selects a read-only image session and expected preview without text decoding.
2. **Given** orientation and color-profile facts, **When** the image is previewed, **Then** the documented display policy is applied and original facts remain inspectable.
3. **Given** a large or transparent image, **When** fit, actual-size, zoom, reset, pan, or background controls are used by keyboard, pointer, or touch, **Then** content remains reachable and controls remain compact at mobile widths.
4. **Given** a mislabeled, unsupported, truncated, or malformed source, **When** it opens, **Then** bounded content evidence/diagnostics explain the result without execution, source modification, or disruption of other tabs.
5. **Given** animated or multi-page content, **When** only this raster subset is implemented, **Then** poster/page limitations are explicit rather than implying complete navigation or playback.

### User Story 2 - Inspect metadata without exposing sensitive facts (Priority: P1)

A user opens the existing information drawer to inspect container, color, orientation, camera, exposure, software, timestamps, and supported EXIF/XMP/IPTC facts. Availability and provenance are explicit; location facts are redacted by default.

**Why this priority**: Inspection shares the native raster boundary, while metadata failure must remain independent of image readability.

**Independent Test**: Inspect deterministic metadata fixtures, exercise permitted copy actions, and prove sensitive facts cannot reach visible, raw, logged, or copied output accidentally.

**Acceptance Scenarios**:

1. **Given** supported metadata, **When** the drawer opens, **Then** stable typed normalized and bounded original facts identify provenance, availability, sensitivity, and copy policy.
2. **Given** GPS or other location metadata, **When** the image opens or metadata is copied, **Then** default display/copy redacts values, including raw values and contradictory duplicates.
3. **Given** malformed, duplicate, contradictory, unknown, or oversized blocks, **When** metadata is extracted, **Then** independent bounded statuses are reported and safe image viewing remains usable.
4. **Given** an externally revised image, **When** refreshed, **Then** preview and metadata update within the same session and stale results cannot replace current facts.
5. **Given** keyboard, touch, or screen-reader interaction, **When** the drawer is opened, read, copied, or dismissed, **Then** existing inspector accessibility and focus behavior remain intact.

### User Story 3 - Bound hostile inputs and background resources (Priority: P1)

A user can encounter an oversized, malicious, revoked, or slow source without letting unused tabs retain image work/resources indefinitely.

**Why this priority**: Native image parsing adds an untrusted binary boundary that must be constrained before activation.

**Independent Test**: Exercise pixel/byte thresholds, hostile fixtures, revocation, replacement, suspension, close, and repeated lifecycles while measuring scheduling cancellation and retained resources.

**Acceptance Scenarios**:

1. **Given** at most 100 megapixels and the decoded-byte budget, **When** opened, **Then** full preview is eligible; otherwise only an independently bounded thumbnail is used when available and degradation is announced.
2. **Given** over 200 megapixels, arithmetic overflow, or a decoded hard limit, **When** preview is requested, **Then** prohibited surface allocation is refused.
3. **Given** pending work, **When** its owner is superseded, suspended, closed, or revoked, **Then** new work stops promptly, stale results cannot commit, and previews/leases/object URLs are released.
4. **Given** hostile image or metadata content, **When** processed, **Then** no implicit network request, script, navigation, undeclared native invocation, or source write occurs.
5. **Given** each image-family capability state, **When** evaluated, **Then** raster, animation, SVG, ICO, and unavailable actions are explicit; selected-entry export is separate from source save.

### Edge Cases

- Signature/extension disagreement, empty/incomplete headers, unknown source length, stream-only Android providers, and mid-read revision/revocation.
- Zero/overflowing dimensions, boundary pixel counts, TIFF entry/offset complexity, huge color profiles, and decompression bombs.
- All eight orientations, alpha, unsupported profiles/color models, multi-page TIFF, APNG, and animated WebP poster-only states.
- Entity-bearing/deep XMP, malformed IPTC lengths, invalid text, duplicate families, contradictory facts, unknown binary payloads, and unexpected location tags.
- Independent metadata failure, absent/corrupt thumbnails, stale completion, inaccessible source, rapid tab changes, and repeated disposal.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Define one versioned image-family contract for raster, animation, SVG, ICO, dimensions, orientation, color, frames, entries, metadata, thumbnails, limits, cancellation, suspension, and idempotent disposal (#68).
- **FR-002**: Independently describe preview, inspection, viewport, animation/frame, entry selection, selected-entry export, and source-save capabilities; unavailable actions remain unavailable (#68).
- **FR-003**: Schema-define malformed, truncated, oversized, unsupported-codec, metadata, allocation, revision, revocation, cancellation, and degraded-preview outcomes (#68).
- **FR-004**: Processing receives only bounded source authority; rendering/metadata content receives no generic filesystem, network, shell, or native invocation authority (#68).
- **FR-005**: Preserve compatibility with text source/session/recovery/save/metadata contracts; image sessions are read-only and preserve original bytes (#68, #69).
- **FR-006**: Verify image content and support PNG, JPEG, static WebP, BMP, and TIFF through existing desktop/Android chooser and delivery flows without text decoding (#69).
- **FR-007**: Decode outside the interface thread with reviewed codecs; validate dimensions and checked decoded-byte calculations before prohibited surface allocation (#69).
- **FR-008**: Full preview requires at most 100 megapixels and the decoded-byte budget; over 200 megapixels refuses preview; degraded previews use independently bounded embedded thumbnails, never full-decode-then-resize (#69).
- **FR-009**: State orientation/color display policy explicitly and preserve original facts; invalid/unsupported profiles produce classified warnings rather than hiding safe content (#69).
- **FR-010**: Provide compact fit, actual-size, bounded zoom, reset, reachable pan, and transparency-background actions with keyboard, pointer, touch, and accessible labels (#69; partial #74).
- **FR-011**: Report animated WebP/APNG and multi-page TIFF limitations; do not advertise animation playback, SVG rendering, ICO inspection, or export implementations (#69).
- **FR-012**: Expose supported EXIF/XMP/IPTC, dimensions, orientation, color, camera, exposure, software, timestamps, and container facts through the existing inspector (#73).
- **FR-013**: Facts carry typed normalized/bounded original values, provenance, availability, sensitivity, and copy policy; distinguish derived from embedded facts (#73).
- **FR-014**: GPS and other location facts are sensitive/redacted by default; raw values, unknown fields, duplicates, and copy aggregation cannot bypass redaction (#73).
- **FR-015**: Malformed/duplicate/contradictory/oversized/unknown metadata yields deterministic independent statuses without blocking otherwise safe preview (#73).
- **FR-016**: Metadata remains inert typed facts/text; forbid external resolution, entity expansion, scripts, and implicit network access (#73).
- **FR-017**: External revision refresh updates preview and metadata within the same session and discards stale extraction (#73).
- **FR-018**: Stop scheduling new work within 250 ms of cancellation, bound admitted work, suppress stale completion, and release regenerable surfaces/URLs on suspension or close (#68, #69).
- **FR-019**: Map every included issue criterion to contract/corpus/hostile/resource/accessibility/copy/revision evidence, including explicit four-platform results and completed manual checks where required (#68, #69, #73).
- **FR-020**: Review dependency/fixture licenses, provenance, notices, vulnerabilities, and explicit codec features; do not suppress advisories or expand codecs without review (#69, #73).
- **FR-021**: Preserve current official version, associations, Android intents, public supported-format declarations, and historical artifacts; record S039 as an unreleased delta for v0.2.0 (#75, #76 stay open).
- **FR-022**: Publish the pushed official PR, complete checks and every review remediation, request at most one explicit second review, and stop before owner final review/merge.

### Key Entities _(include if feature involves data)_

- **Image source**: Existing opaque identity, authority, external revision, content evidence, and bounded access.
- **Image descriptor**: Verified container/variant, dimensions/decoded size, orientation/color, optional frame/page/entry facts, and capabilities.
- **Image preview**: Revision-bound full/thumbnail/unavailable/refused result with owned resource lifetime and limits.
- **Image metadata fact**: Catalog identity, typed display/original value, family provenance, availability, sensitivity, copy policy, and extraction status.
- **Image request**: Owner, request identity, revision/generation, cancellation, immutable limits, and completion state.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every supported format's valid corpus opens with expected dimensions, orientation, and preview across four-platform adapter evidence.
- **SC-002**: Boundary/hostile fixtures produce zero crash, silent write, implicit network, script, or prohibited surface allocation.
- **SC-003**: Essential viewport/inspector actions pass keyboard and touch tests; pan recovery and mobile layouts pass assertions.
- **SC-004**: Metadata facts/statuses are deterministic, every default sensitive-copy probe is redacted, and malformed metadata preserves valid preview.
- **SC-005**: Cancellation stops new scheduling within 250 ms; stale results never commit; completed disposal returns owned resources to zero.
- **SC-006**: Every #68/#69/#73 criterion has passing automated evidence or an explicit completed manual check; #74/#75/#76/#66 remain accurately open.
- **SC-007**: The PR's latest required CI/security/docs/platform packaging checks pass and all review threads are resolved before owner handoff.

## Assumptions

- #67 and #58 are closed; existing native source, session, and inspector foundations are reused.
- S039 is unreleased without advancing official 0.1.3 or publishing v0.2.0 support.
- Original generated fixtures are preferred; external materials require compatible recorded redistribution terms.
- Metadata is a bounded documented subset; unknown content reports unavailable/unsupported rather than unrestricted extraction.
- #70/#71/#72, complete #74, milestone-wide #75, stable #76, and non-blocking #66 remain incomplete separate work.
- Community trust states remain in force without paid signing or notarization prerequisites.
