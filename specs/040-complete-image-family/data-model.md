# Data Model: S040 Complete Image-Family Capability

**Date**: 2026-09-15

## Common Image State

Container identity extends descriptor codec to png/jpeg/webp/bmp/tiff/gif/svg/ico while RasterCodec stays the native raster parser identity. A bounded render result carries common family state, selected frame/entry, metadata, checked resources and a verified inert PNG. Editing/source save remain false for every family; export is true only for ICO with a valid selected decoded entry.

## Animation

The descriptor contains bounded original frame durations, frame count, loop facts, canvas and selected frame. Native private context owns source/revision, decoder, composition/scratch and current cursor under the existing worker permit. Only one context exists application-wide. Foreground next requests advance incrementally; backwards seek resets/replays. Suspend/revision/close evicts private state. Frontend presentation stores selection and paused state, owns one timer/blob and schedules only after commit; restoration never grants autoplay.

## SVG

The descriptor contains dimensions, inert raster output state, disabled script/external resource flags, font policy and bounded omission/refusal diagnostics. Source bytes and parsed tree are temporary admitted worker data, never persistent session/presentation state.

## ICO

Entry index is its directory position, never an arbitrary byte offset supplied by the frontend. Every entry contains checked width/height, declared depth, encoding, encoded length, alpha/decode classification and optional duplicate index. Valid entries can be selected independently; corrupt entries remain listed. Selection is bound to source external revision.

## Export

An explicit native intent contains source ID, expected revision, selected index and request UUID. Native regeneration produces verified PNG bytes; destination authorization is separate and original identity/aliases are denied before writing. Receipt is path-free, reports cancelled/exported/conflict/failed and actual durability, and cannot mutate original session source identity or save capabilities.

## Presentation Persistence

Persist only bounded viewport/zoom/pan/background and frame/entry indices. Do not persist preview URLs, pixels, metadata, private decoders, source bytes, pending export authority or playing state. Refresh retains session identity but invalidates descriptors, facts, selected export authority and pending work together.
