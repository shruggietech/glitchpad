# Brand Integration Contract

## Canon authority

- `brand/manifest.json` identifies the approved canon version and records every governed file's byte length and SHA-256 checksum.
- The imported repository tree must match canon 1.0.0 before any integration surface is described as approved.
- `brand/README.md`, `brand/brand.json`, `brand/VERIFY.md`, and the canonical SVG masters govern usage. Integration code may reference them but may not silently redefine their rules.
- `brand/concepts/` and `brand/qc/` are design and verification evidence. They are not selectable production assets.
- Original Glitchpad artwork is Apache-2.0 project material. Bundled fonts retain their OFL license files and notices.

## README banner

- The banner appears before the existing Glitchpad heading inside the centered introduction.
- One `<picture>` provides a dark-surface source and a light-surface fallback from canonical horizontal SVG lockups.
- The rendered width must respect the canonical composition and clear space without cropping or independently scaling the mark and wordmark.
- Alternative text identifies Glitchpad once; the existing H1 remains available as document structure and text fallback.
- README badges, status language, support links, and capability claims remain accurate after the visual change.

## Governed integrations

- Website CSS consumes canonical tokens or generated bindings rather than copying raw color, radius, spacing, or typography values into page code.
- Website fonts are loaded from the bundled local files and request only shipped weights.
- Favicons, social previews, and application/store assets come from named canonical outputs.
- A failing canon verification blocks the README, website, application, packaging, or store integration from being treated as approved.

## Verification

- Verify manifest file coverage, length, and checksum equality.
- Verify UTF-8 without BOM and absence of mojibake for governed text.
- Re-derive contrast and token pairing claims.
- Verify SVG paths, view boxes, and absence of live text.
- Verify favicon entry sizes and bundled font weights/licenses.
- Reject prohibited raw values and temporary or exploratory asset references from governed integration surfaces.
