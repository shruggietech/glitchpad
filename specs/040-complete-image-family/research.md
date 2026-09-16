# Research: S040 Complete Image-Family Capability

**Date**: 2026-09-15

## Native Family Reuse

**Decision**: Extend S039's native/common schema and opaque source adapters; keep raster metadata extraction unchanged. Dependency and integration research agents were dispatched as required by Spec Kit plan Phase 0, independently of specification authoring.

**Rationale**: Existing contracts already model animation, SVG, ICO, 1024 frames/two composited canvases, 256 entries, 50,000 SVG nodes/depth128 and one worker. New incompatible family schemas or browser-controlled source writes would undermine these boundaries.

**Alternatives considered**: WebView format decoding (platform-dependent and active SVG risk), frame collection (unbounded memory), independent per-tab native caches (multiplicative retained memory), and separate C WebP tooling (unnecessary packaging surface).

## SVG

**Decision**: resvg/usvg 0.48.1, defaults disabled, text feature only; bounded UTF-8/XML preflight followed by roxmltree 0.21.1 with DTD disabled/node count bounded and usvg from_xmltree, image resolver callbacks that always deny, packaged Geist Regular font bytes with existing OFL provenance/notices and no system font discovery. Geist Regular's approved source digest is `43065e72260288e84672cd1f27e1a8f8889b636a74f5f9252649365c41e8eca8`.

**Rationale**: Default resvg features include system fonts/memmap/raster images. usvg also allows nested SVG images and DTD parsing, and may decode data URLs before resolver callbacks, so callbacks alone are insufficient. Reject resource-bearing images, DTD/entities, active/external references and expansion constructs before Tree construction; raster output alone enters the WebView.

**Alternatives considered**: Raw SVG DOM insertion (prohibited), default resource/font resolvers (native file lookup), and no-text rendering (avoidable text fidelity loss with approved packaged font already available).

**Sources**: [resvg manifest](https://github.com/linebender/resvg/blob/v0.48.1/crates/resvg/Cargo.toml), [usvg options](https://github.com/linebender/resvg/blob/v0.48.1/crates/usvg/src/parser/options.rs), [usvg parser](https://github.com/linebender/resvg/blob/v0.48.1/crates/usvg/src/parser/mod.rs), [image resolver](https://github.com/linebender/resvg/blob/v0.48.1/crates/usvg/src/parser/image.rs).

## Animation

**Decision**: Direct pinned gif 0.14.2 (std/raii_no_panic only) and image-webp 0.2.4 (defaults disabled) with owned Send decoder state behind native Mutex/moved to the retained single worker. GIF composes a bounded patch into its canvas and keeps one previous canvas when disposal requires it; WebP already composites internally with persistent canvas, caller output and transient patch. Account for codec scratch conservatively without claiming its memory-limit hint caps every allocation. Restart WebP decoder at loops/backward seeks because reset_animation retains old canvas. Native foreground requests only, reset/replay under cancellation/deadline for backwards seeks, bounded original timing/loop inventory and normalized presentation delay.

**Rationale**: Retained forward decoding avoids quadratic replay during normal playback. Existing single worker admission and private one-context ownership prevent background prefetch and per-tab memory growth. Rust's generic frame iterator may not be Send, so use the narrow owned decoder APIs instead.

**Alternatives considered**: collect_frames, browser autoplay, native timer loops, and repeated full replay for every forward frame.

**Sources**: [gif documentation](https://docs.rs/gif/0.14.2/gif/), [image-webp decoder](https://docs.rs/image-webp/0.2.4/image_webp/struct.WebPDecoder.html).

## ICO and Export

**Decision**: Manually enumerate/validate the bounded directory, decode only selected payload, enforce actual dimensions <=256 with exact directory match, use existing bounded PNG and image's single-entry ICO BMP-mask path. Native export regenerates selected PNG and authorizes a separate destination with original-source exclusion.

**Rationale**: IcoDecoder picks a preferred entry and does not supply reliable allocation enforcement; PNG dimensions may exceed directory hints. Existing Save As paths lack the source/entry binding and original-destination denial required for this operation. Preserve mixed-entry isolation and source read-only state.

**Alternatives considered**: Library preferred-entry inspection (hides entries), frontend-supplied export bytes (unchecked authority), and reusing source Save unchanged (original replacement risk).

**Sources**: [image ICO decoder](https://github.com/image-rs/image/blob/v0.25.10/src/codecs/ico/decoder.rs), source integration inspection of native desktop/Android save adapters and AndroidSourcePlugin.

## 2026-09-15: Dependency Gate Refinement

The complete locked audit found RUSTSEC-2026-0206 (`rustybuzz`) and RUSTSEC-2026-0192 (`ttf-parser`) in the initially researched 0.47 text stack. Mandatory research follow-up verified maintained resvg/usvg 0.48.1, whose text stack uses fontdb0.24, harfrust0.12 and skrifa0.44. The exact released pin retains the bounded XML/font/resolver APIs and removes both flagged packages. No advisory suppression or text-support downgrade is introduced. Default features remain disabled, including SVGZ, host fonts, memmap and raster-image decoding. See the [tagged changelog](https://raw.githubusercontent.com/linebender/resvg/v0.48.1/CHANGELOG.md), [tagged manifest](https://raw.githubusercontent.com/linebender/resvg/v0.48.1/crates/usvg/Cargo.toml) and [release](https://github.com/linebender/resvg/releases/tag/v0.48.1).

## 2026-09-15: Entry-local ICO range refusal

Adversarial reassessment found that returning a container failure for one bad entry range contradicts FR-012 and #72. Before correction, the decision is to keep only header/directory truncation and global resource ceilings container-wide; each invalid payload range, claimed size or payload shape becomes a row-local classification. Unknown/unavailable payload encoding is explicit, and browser facts admit the bounded raw u16 depth/u32 byte length without authorizing decode or export. Valid neighboring entries remain usable.

## 2026-09-15: Animation encoded-buffer admission

Peak reassessment found that vector growth and conversion to `Arc<[u8]>` could temporarily add an uncounted encoded copy. Before correction, the decision is to reserve at most the source length for sanitized bytes, keep the vector allocation behind an immutable `Arc<Vec<u8>>` cursor wrapper without copying its payload, and conservatively admit three encoded buffers (including Android source-cache/read coexistence) plus existing fixed, surface and delivery overhead. Reject insufficient encoded headroom before allocating the sanitized vector, then apply full surface admission with that extra encoded buffer reserved.

## 2026-09-15: Non-truncating Android export descriptor

The [Android ContentResolver contract](https://developer.android.com/reference/android/content/ContentResolver) permits provider-specific truncation for `w` and identifies `rw` as a seekable descriptor. Before correction, the generated export decision is to open with `rw`, reject any actual nonzero/unknown descriptor size, and recheck cancellation/source registration immediately before writing. Providers without a verifiable empty seekable destination fail safely. This does not change general source Save As. A controlled provider with deliberately misreported zero size supplies real conflict-preservation evidence.

## 2026-09-15: Nested WebP dimensions before allocation

Pinned image-webp 0.2.4 source inspection shows `read_frame` calls lossy VP8 decode before comparing dimensions; VP8 header parsing allocates Y/U/V planes from embedded dimensions. The ALPH/VP8 branch similarly decodes before filling the ANMF-sized output. Before correction, the decision is to inspect the bounded ANMF subchunk sequence and require each VP8/VP8L bitstream header to match its already admitted frame rectangle before constructing any decoder. ALPH must precede one VP8 image; unknown/repeated/truncated subchunks fail preflight. This closes P4/FR-008 admission rather than relying on a metadata memory hint or a comparison after allocation.
