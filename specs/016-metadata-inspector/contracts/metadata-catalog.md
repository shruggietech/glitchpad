# Metadata Catalog Contract

## Producer boundary

Producers submit typed observations for registered keys. Unknown/duplicate keys, malformed values, and over-limit contributions are rejected atomically. Producers never submit display labels, groups, sensitivity, or copy policy.

## Groups and availability

Facts are ordered as Source (`host.*`), Content (`text.*`), Embedded (reserved for later format slices), Derived (`derived.*`), and Renderer (Markdown and `diagram.*`). Every applicable fact has exactly one state: available, not provided, unsupported, redacted, pending, or errored.

## Currency

Host/integrity facts carry external revision, content facts carry session revision, and renderer facts carry accepted renderer revision. A contribution with mismatched currency is discarded without partial merge.

## Copy policy

- `direct`: an available fact may copy the exact visible value and unit.
- `explicit_confirmation`: a per-fact disclosure is required and bulk copy must exclude it.
- `denied`: no copy action or hidden raw value exists.
- Non-available facts never copy. Clipboard failure changes only the status announcement.

## Safety bounds

Values and codes are bounded. No path, URI, provider authority, identity token, change token, source excerpt, native error, or stack trace is displayable. Metadata failure cannot change renderer eligibility or close a document.

S016 covers applicable stable-core `host.*`, `text.*`, `diagram.*`, Markdown renderer, and `derived.*` keys. Image, EXIF, IPTC, XMP, ICO, PDF, and office values remain unsupported until their owning slices.
