# Contract: S039 Image Renderer

**Date**: 2026-09-15

## Family and capabilities

Contract version 1 covers raster, animation, SVG, and ICO. S039 implements PNG/JPEG/static WebP/BMP/TIFF. APNG/animated WebP and multi-page TIFF expose poster/first-page-only limitations. SVG/ICO/animation navigation/export remain unavailable. Raster sessions expose view, metadata, fit, actual-size, zoom/reset/pan, and transparency background, with no edit/source save.

## Native boundary

Native commands accept opaque registered source identity, expected external revision, and a bounded request identity. Limits are host-owned. Source reads enforce a 128 MiB encoded budget, bounded chunks, cancellation checks, and pre/post-read revision validation. Decode uses a blocking native worker; one admitted worker remains reserved until its real completion. Busy requests receive a classified retryable state without creating another decode.

Results echo the request and source revision, contain verified descriptors and value-free classified diagnostics, and deliver inert PNG bytes at most 8 MiB. The interface creates only an owned blob URL, validates result fields, and revokes the URL on replacement/suspension/close. No image markup or native paths enter the interface.

## Admission limits

- Full decode eligibility is <=100,000,000 pixels and checked native/output reservations.
- 100,000,001 through 200,000,000 pixels permit only an independently bounded embedded thumbnail when available; >200,000,000 refuses preview.
- Desktop decoded surface cap is 400,000,000 bytes and application-owned peak reservation cap is 1 GiB. Android surface cap is 128 MiB and peak reservation cap is 384 MiB. JPEG input copies, TIFF intermediate pixels, RGBA normalization, orientation copies, and delivery copies are included conservatively.
- Native decoder allocation limits are supplementary best-effort hints, not a total process-memory guarantee. Unsupported color/bit-depth cases fail or degrade before prohibited output allocation.
- Thumbnail decode obeys the same codec validation and a 1 MiB encoded/4 megapixel bound. No full-decode-then-thumbnail fallback is allowed.
- Invalid dimensions, overflow, source/output budget exhaustion, unsupported codec, malformed/truncated input, revocation, revision changes, cancellation, and allocation errors have stable schema categories.

## Presentation policy

Apply supported EXIF orientations and preserve original dimensions/facts. Normalize display pixels to 8-bit RGBA. Use explicit sRGB-assumed output; classify absent/unapplied/invalid/unsupported ICC profiles and decoder color conversions honestly. Do not claim arbitrary ICC color management. No image pixels or containers are written.

The viewport starts fitted. Keyboard/pointer/touch actions support bounded zoom, actual size, reset, and pan with recoverable bounds. Transparency backgrounds are application-owned. Controls remain in one compact horizontally scrollable row at mobile widths, have explicit labels, and preserve the image pane's viewport majority.

## Cancellation and revision

Cancellation disables new scheduling and publication within 250 ms. Synchronous decoder internals are cooperative and cannot be forcibly interrupted; admission stays held until they finish. Every result must match current request/owner/source revision. Source refresh invalidates preview/facts together without replacing session identity. Background image tabs hold no decoded preview/object URL; completed disposal returns owned resources to zero.

## Activation

Only internal source/chooser routing is extended. Official version/public support matrix/desktop associations/Android intent filters remain unchanged until #75/#76. Full-family controls #74 remain incomplete.
