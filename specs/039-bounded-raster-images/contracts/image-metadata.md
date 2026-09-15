# Contract: S039 Image Metadata

**Date**: 2026-09-15

## Parsing bounds

Enforce 1 MiB per metadata block, 4 MiB aggregate, 256 observations, 1,024-character values, 32 XML levels, and 4,096 container segments/entries. Every offset/length/count uses checked arithmetic. Unknown binary blocks expose presence/type/length only. Metadata processing is independent from pixel preview and contributes stable malformed/unsupported/oversized/conflicting statuses.

## Supported subset

- EXIF: bounded raw TIFF/EXIF blocks, original orientation, camera make/model, software, capture/digitization dates, exposure/aperture/focal length/ISO, pixel dimensions, and value-free GPS presence. MakerNotes/unknown binary payloads are not arbitrary display values.
- XMP: namespace-aware known scalar attributes/elements and bounded RDF Bag/Seq/Alt collections for reviewed title/creator/description/keywords/software/date/orientation/dimension facts. Reject DTDs/custom entities; no external URI resolution, network, sidecar, or executable content.
- IPTC IIM: checked short/extended record lengths, reviewed title/caption/byline/keywords/software/date and location classification. Honor declared UTF-8; otherwise preserve encoding uncertainty without lossy claims.
- Color/container: native dimensions/codec/alpha/bit-depth/orientation, bounded profile presence/declared status, source size, and preview limitations.
- Compressed metadata is processed only with bounded decompression; otherwise it is explicitly unsupported. Do not use decoder helpers that allocate/decompress first and check later.

## Facts and privacy

Known facts use registered catalog policy and typed normalized/bounded original values with family/tag/block provenance. Duplicates/contradictions remain explicit. Unknown observations never become directly copyable arbitrary text.

GPS/destination GPS, IPTC city/sublocation/province/country, and recognized XMP location fields are sensitive and redacted before wire serialization. Redacted DTOs contain no raw coordinate/string, tooltip, clipboard payload, or logged source value. Unknown metadata is protected and summarized without content. Inspector aggregation cannot bypass these rules.

EXIF/TIFF classification precedes value publication: GPS sensitivity follows supported IFD links and shared IFDs, and ordinary facts whose checked payload extents overlap GPS structures or values are withheld. Invalid sensitive extents fail closed; adjacent non-overlapping public values remain eligible. Pixel decoding remains independent of metadata failure.

## Revision and accessibility

Facts are bound to the request/session/external revision. Refresh invalidates stale facts and updates within the same session. The existing dismissible drawer, focus restoration, group ordering, availability labels, and keyboard/touch/screen-reader semantics are reused. Independent metadata failures never suppress an otherwise safe preview.
