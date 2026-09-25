# Data Model: BrandBuilder Release Integration

## Released package

`enforcement/bundle.json` identifies `glitchpad-brand-1.1.1-bb2.0.3`, its filename, brand and compiler versions, source revision, release tag, and checksum authorities. The release `SHA256SUMS` binds the archive bytes. `manifest.json` binds 321 governed files by path, byte length, and SHA-256. Three legal files are authenticated by the archive checksum but absent from the file manifest, so their individual digests belong in the integration receipt.

## Integrated kit

The `brand/` directory contains the complete released file set plus `INTEGRATION.json` and `INTEGRATION.md`. A single legal-link correction changes `README.md`; the integrated `manifest.json` records that file's new bytes. All other governed files and all three legal files must match the source archive. Stale files are forbidden.

## Integration receipt

`INTEGRATION.json` records package ID, release tag and URL, archive SHA-256, source revision, source and integrated manifest SHA-256, governed file count, three legal-file digests, retrieval date, the legal-link correction, and optional hosted derivative comparisons. It also records the exact bundled BrandBuilder recovery SHA-256. Receipt values must agree with both the bundle and integrated files.

## Platform mapping

Each mapping has a canonical path under `brand/` and a destination in the site, browser app, desktop icon inputs, or Android resources. The source and destination must be byte-identical. The web manifest has two `any` and two distinct `maskable` entries; every referenced public file must exist.

## Import states

`Unverified archive` -> `Release checksum verified` -> `Complete manifest verified` -> `Integrated kit and receipt written` -> `Consumer copies checked` -> `Validation evidence recorded`. Failure before the complete-manifest state must leave the existing governed kit intact.
