# Research: S039 Bounded Raster Viewing and Metadata

**Date**: 2026-09-15

## Reviewed dependency decisions

**Decision**: Use `image` 0.25.10 with explicit png/jpeg/webp/bmp/tiff features and defaults disabled. Its MIT/Apache-2.0 terms and Rust 1.88 minimum are compatible with the repository. [Manifest](https://github.com/image-rs/image/blob/v0.25.10/Cargo.toml).

**Rationale**: One pure-Rust native pipeline avoids WebView codec differences and new C toolchains. Do not enable the all-codec default, animation playback, or unrelated format families. The exact transitive graph is reviewed with cargo-deny.

**Alternatives considered**: Unverified direct WebView decoding cannot enforce native hostile-input admission; a separate libwebp/native color library expands platform packaging without sufficient value.

**Decision**: Use `kamadak-exif` 0.6.1 (BSD-2-Clause) and `quick-xml` 0.42.0 (MIT). Explicitly add reviewed BSD-2-Clause to the license allowlist and generated notices. [EXIF license](https://github.com/kamadak/exif-rs/blob/master/LICENSE), [XML manifest](https://github.com/tafia/quick-xml/blob/v0.42.0/Cargo.toml).

**Rationale**: Bounded EXIF blocks and an event-driven declared XMP subset support independent metadata failure without unrestricted XML or image-container APIs. Published EXIF facts use the application-owned GPS-aware TIFF graph walker; `kamadak-exif` is retained only for independently bounded private thumbnail extraction because library field-context labels cannot preserve sensitivity across shared IFD offsets.

## Allocation and cancellation findings

**Decision**: Separately bound encoded source, native decoded pixels, conversion/orientation copies, output PNG bytes, and admitted concurrency. Apply reader limits before decoder construction, then check dimensions/color/total bytes before allocating output. [Image limits](https://docs.rs/image/0.25.10/image/struct.Limits.html), [reader implementation](https://github.com/image-rs/image/blob/v0.25.10/src/io/image_reader_type.rs).

**Rationale**: `max_alloc` is best-effort. JPEG constructor copies encoded input; TIFF has an internal decoded buffer; WebP does not fully honor decoder allocation hints. Checked admission and one retained worker permit constrain application-owned allocations without claiming a hard operating-system memory sandbox. [JPEG](https://github.com/image-rs/image/blob/v0.25.10/src/codecs/jpeg/decoder.rs), [TIFF](https://github.com/image-rs/image/blob/v0.25.10/src/codecs/tiff.rs), [WebP](https://github.com/image-rs/image/blob/v0.25.10/src/codecs/webp/decoder.rs).

**Decision**: Cancellation stops new staged work and publication within 250 ms. In-flight synchronous decoder calls finish cooperatively; their admission permits stay reserved until completion. Never free capacity by merely aborting a blocking task handle.

**Decision**: Over-limit previews use only independently bounded embedded thumbnails. Never decode a prohibited full surface before downsampling. Over 200 MP refuses even thumbnail presentation, matching the declared refusal boundary.

## Orientation and color

**Decision**: Preserve original dimensions/orientation/color facts; apply all eight supported orientation transforms. Output policy is normalized 8-bit RGBA/sRGB-assumed presentation with explicit status for absent, invalid, unsupported, or unapplied ICC profiles. Arbitrary ICC conversion is not claimed. Native decoder-supported color conversions remain explicit. [DynamicImage](https://docs.rs/image/0.25.10/image/enum.DynamicImage.html).

**Rationale**: Accurate declared fallback is preferable to silently claiming office/photo-suite color management. Profile parsing is bounded and reports provenance without executing or exposing binary profiles. A future measured color-management change can add reviewed pure-Rust transforms.

## Metadata subset and privacy

**Decision**: Scan bounded JPEG/PNG/WebP/TIFF metadata containers independently from pixel output. EXIF uses bounded raw TIFF blocks; XMP uses namespace-aware scalar/attribute/RDF collection events with no DTD/custom entities; IPTC uses checked IIM record lengths and declared encodings. Unknown payloads expose classification/counts only. [XMP specifications](https://developer.adobe.com/xmp/docs/xmp-specifications/), [IPTC IIM 4.2](https://www.iptc.org/std/IIM/4.2/specification/IIMV4.2.pdf).

**Decision**: Do not call PNG metadata helpers that decompress before application-side length checks. Compressed text requires bounded decompression or a classified unsupported result. [PNG metadata implementation](https://github.com/image-rs/image/blob/v0.25.10/src/codecs/png.rs).

**Decision**: Redact GPS, destination GPS, IPTC location fields, and recognized XMP location namespaces before serialization. Unknown fields default to non-copyable, value-free summaries. No sensitive original value, tooltip, log payload, or aggregate clipboard output is retained on the wire.

## Release and scope decisions

**Decision**: Implement only raster previews and metadata while modeling later families. Chooser/source internals may accept raster bytes; association declarations, Android public intent filters, public matrices, official version, and historical releases do not activate them until #76.

**Decision**: Follow the accepted bundled #68/#69/#73 slice and keep #74/#75/#76/#66 open. Preserve the existing community trust policy and prohibit unnecessary paid signing requirements.

No unresolved research or clarification remains. Spec Kit's required research-agent step was performed; decisions were consolidated before implementation.
