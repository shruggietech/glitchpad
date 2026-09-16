# Contract: S040 Image Families and Controls

**Date**: 2026-09-15

## Native Requests

Render commands accept registered opaque source ID, expected external revision, UUID request ID and optional bounded selected frame/entry. Result echoes ownership/revision and selection, carries common family state and metadata, and supplies only native-generated RGBA8 inert PNG <=8 MiB. Existing raster output, location withholding and Android exact-ceiling EOF behavior remain unchanged.

Family detection uses a bounded content probe including SVG's XML declaration/whitespace/root handling; unsupported or non-SVG XML remains text. Sources remain local read-only authority with bounded chunks, unconditional stream closure and pre/post revision checks.

## Animation

Enforce 1024 frames, checked per-frame original timing <=60 seconds, aggregate <=30 minutes, existing encoded/decoded/peak policy, two composited canvases and admitted codec scratch. Frame inventory parsing must not allocate full frame surfaces. Actual frame construction is incremental and cancellation/deadline checked between stages/frames. Frame presentation uses max(original,20 ms), with a declared default for absent timing. Original timing and loop counts remain inspectable.

Playback starts paused, never prefetches or collects every surface, and stops on reduced-motion changes, suspension, source revision or close. Native retained decoder/source/surfaces are evicted on suspension; synchronous internal work retains admission until completion and cannot publish or re-store a cancelled context. Resume restores selection with explicit play required.

## SVG

Enforce 4 MiB UTF-8, 50,000 XML nodes, depth128, 250,000 path tokens and 65,536 text characters before parser expansion. Reject DTD, active/foreign/script/event/link content, images/data references, external CSS/fonts/resources, use/filter/pattern/mask expansion and nonfragment paint URLs before rasterizer construction. Both image resolver callbacks deny all resolution, host font discovery is disabled, and only approved packaged Geist bytes are loaded. The intermediate XML document explicitly disables DTD and limits nodes before usvg conversion. Unsupported constructs return value-free classified fallback, never active source or raw locators.

## ICO

Enforce type1/reserved0, directory <=256 entries, checked header/range math, actual PNG/DIB dimensions <=256 exactly matching normalized directory dimensions, and existing encoded/surface/peak/output limits. Invalid entry data stays entry-local; directory truncation/count refusal is container-wide. Identify exact duplicate ranges/payload evidence while preserving each directory row. Never eagerly decode every entry.

## Interface

Extend the existing compact row with capability-driven play/pause/frame and entry/export controls; preserve fit/actual/zoom/reset/bounded pan/background/information. Keep >=44-pixel reachable touch targets, no mobile page overflow and >=70% image-pane coverage. Timer/request/blob ownership is foreground-only; rapid selection uses unique request plus echoed selected index to reject late results. Persist bounded presentation only and resume paused.
