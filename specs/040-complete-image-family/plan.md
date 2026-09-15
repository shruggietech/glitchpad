# Implementation Plan: S040 Complete Image-Family Capability

**Branch**: `codex/040-complete-image-family` | **Date**: 2026-09-15 | **Spec**: [spec.md](spec.md)

**Input**: Bundled issues #70/#71/#72/#74 and S039's merged native/source/image contracts.

## Summary

Complete the common image family through inert native SVG rendering, bounded incremental GIF/animated WebP composition, independently selected ICO entries with explicit native PNG export, and capability-driven compact controls. Preserve official version/support/associations/intents at 0.1.3; full conformance/activation remain #75/#76.

## Technical Context

**Language/Version**: Repository-pinned Rust 1.96, TypeScript/React, Kotlin/Java for the narrow Android document/export bridge; Linux-container local execution only.

**Primary Dependencies**: Existing image 0.25.10 plus its explicit ico feature; direct gif 0.14.2 and image-webp 0.2.4 for owned incremental decoder state; resvg/usvg 0.48.1 with defaults disabled and text only; roxmltree 0.21.1 with defaults disabled/std for DTD-disabled node-limited admission; existing quick-xml 0.42.0. APIs/compatible licenses/MSRV are confirmed by mandated dependency research before adoption; lock and notices are verified during implementation.

**Storage**: One regenerable native animation context application-wide, keyed by opaque source/revision; no persistent decoder/pixel cache. Session presentation retains viewport/selected frame/entry only, never bytes, facts, buffers, or autoplay authority.

**Testing**: Failure-first native contracts/golden/hostile/export tests; frontend gateway/control/session/cleanup/axe tests; original fixture provenance/digests; layout gate; existing hosted desktop and API 24/36 entry points; complete cargo xtask check and real latest-head CI.

**Target Platform**: Windows/macOS/Linux desktop and Android API 24/36 evidence, including older Chrome WebView compatibility.

**Project Type**: Existing Tauri application with shared pure-Rust image core and narrow native sources.

**Performance Goals**: Foreground request-driven composition with no prefetch/background timers, one retained native worker, two composited canvases, bounded cancellation publication within 250 ms, checked 5-second application-stage deadlines without claiming forced interruption of synchronous codec/rasterizer internals.

**Constraints**: Existing 128 MiB encoded, 8 MiB PNG, 100/200 MP, desktop 400 MB surface/1 GiB peak, Android 128 MiB surface/384 MiB peak. Animation <=1024 frames, original frame durations <=60 seconds and checked aggregate <=30 minutes, two composited canvases plus explicitly admitted codec scratch; presentation zero/short timing normalized to at least 20 ms while original timing remains visible. ICO <=256 entries and <=256x256 actual entry dimensions. SVG <=4 MiB UTF-8, 50,000 nodes, depth128, <=250,000 path tokens, <=65,536 text characters and bounded attributes; unsupported resource-expanding constructs fail before usvg.

**Scale/Scope**: Complete #70/#71/#72/#74, preserve every S039 raster/privacy regression, implement explicit entry export on desktop/Android, and produce acceptance evidence. No public format activation, generalized cache, image editing, SVG DOM insertion, or additional native rendering platform.

## Constitution Check

| Principle | Initial and post-design gate |
| --- | --- |
| P1 viewport | Pass: extend one compact capability-driven row and shared information drawer |
| P2 local files | Pass: opaque local sources; SVG resolution denied; no uploads/telemetry |
| P3 parity | Pass: shared decoder/selection/export contract with narrow native destination adapters |
| P4 untrusted input | Pass: content probes, preflight limits, inert PNG, source-bound export, classified failure |
| P5 release authority | Pass: unreleased Spec Kit delta, official 0.1.3 remains authoritative |
| P6 verification | Pass: every scenario/criterion maps to tasks and passing evidence is required |
| P7 proportionality | Pass: extend existing image/source/session modules; record export deviation before changes |
| P8 licensing | Pass: reviewed locked compatible dependencies and approved packaged Geist font/notices |

No exception is required. Spec Kit setup/resolution/prerequisite scripts execute through the hidden Docker boundary. No extension hooks or separate autopilot protocol file are installed; the owner's push/review/green-CI/unmerged-handoff instructions govern autopilot.

## Project Structure

- `specs/040-complete-image-family/`: specification, checklist, plan, dependency/integration research, data model, contracts, quickstart, tasks, and verification/review receipt.
- `crates/glitchpad-core/src/images.rs` and new `image_animation.rs`, `image_svg.rs`, `image_ico.rs`: common schema, native family detection/admission, pure bounded decoders/preflight and original fixtures/tests.
- `crates/glitchpad-host/src/images.rs`, desktop source/delivery modules, Android source/bridge modules: retained incremental context, request/selection/revision validation, suspension eviction, and source-bound native export.
- `apps/glitchpad/src/domain/image-contract.ts`, `image-gateway.ts`, `tabs.ts`, persistence/restoration modules and `components/ImageSurface.tsx`: bounded family projection, selection/playback/retention, stale rejection, owned timer/blob cleanup, shared controls/metadata/export outcomes.
- `fixtures/images/`, `scripts/check-image-layout.mjs`, hosted CI/provider tests and four platform notice bundles: original golden/hostile/byte/export/platform evidence and license obligations.

## Dated Architecture Decisions

1. 2026-09-15: Replace S039's deferred family capabilities with the existing modeled common variants; descriptor codec expands to container identity deliberately, preserving raster enum parsing and metadata contracts.
2. 2026-09-15: Use owned Send-compatible GIF/WebP decoder contexts rather than collecting frames or repeatedly restarting every forward frame. Keep exactly one retained context across foreground requests; backward seeks reset/replay incrementally under cancellation/deadline/count admission.
3. 2026-09-15: Disable resvg default system-font/memmap/raster-image features. Reject DTD, active/external/resource-bearing constructs and unbounded nested-image/use/filter/pattern/mask expansion during XML preflight; construct a DTD-disabled node-limited roxmltree document and feed usvg from_xmltree, install deny callbacks for both image resolver paths, and load only approved packaged Geist bytes. Missing glyphs/unsupported constructs have explicit fallback status.
4. 2026-09-15: Enumerate ICO directory manually and validate actual PNG/DIB dimensions and byte ranges before selected decode. Reuse bounded PNG decoding and single-entry ICO BMP-mask decoding; never rely on the library's preferred-entry choice or directory dimensions alone.
5. 2026-09-15: Existing desktop Save As accepts frontend bytes/path without original binding, and Android Save As does not exclude original provider identity. Do not reuse these unchanged for generated entry export. Introduce native regeneration and entry/revision-bound destination authorization, original-alias exclusion, truthful conflict/write/cancel results, and unconditional authority cleanup. No source-save capability changes.

## Execution and Documentation Impact

Specification/quality gates precede dependency research/design and task generation. Tests precede native family implementation; common contracts precede host/frontend integration. Complete all four user stories before full local gate, analyze/converge, official publication, review remediation, and latest-head hosted validation. Prepare one final receipt commit, wait its own CI, and hand over without merging or requesting a third review round.

Record this as an unreleased v0.2.0 delta in feature artifacts and a changelog fragment. Historical technical specification/public support claims and package associations/intents remain unchanged. #75/#76/#66 and PDF/office milestones remain open.
