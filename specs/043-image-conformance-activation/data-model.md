# Data Model: S043

## Qualification row

Each row has a stable obligation ID, issue numbers, check names, target platform, source revision, outcome (`pass`, `fail`, `pending`, `unavailable`), evidence reference and limitation. Historical evidence cannot be substituted for current-candidate results. Owner-removed checks use `unavailable`, never `pass`.

## Image activation

Eight image families map to ten extensions and explicit MIME aliases. Each declaration permits viewing/inspection and existing selected ICO export, not source image editing. Detection verifies content independently of extensions. PDF and office families remain excluded.

## Candidate lifecycle

Specification → implementation → local verification → pushed PR → current-head CI/reviews → owner merge decision → separately authorized tag/publication → published readback. #76/#10 remain incomplete until their publication-dependent criteria are satisfied.

## Resource receipt

A receipt binds original-fixture hashes, iterations, source revision, platform/toolchain, latency distribution, process peak-memory unit, suspended-surface evidence and package size to explicit limits. A failed or missing measurement blocks the claimed result.
