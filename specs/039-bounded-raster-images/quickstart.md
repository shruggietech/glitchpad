# Quickstart: Validate S039

**Date**: 2026-09-15

## Prerequisites

Use the repository-pinned toolchain inside the image built from `scripts/docker/validation.Dockerfile`. On Windows invoke every repository command through the approved hidden Docker launcher; Git/GitHub use the approved hidden VCS launcher. No native Windows development-tool fallback is permitted.

## Focused validation

From the Linux repository root, run `cargo test -p glitchpad-core --locked`, `cargo test -p glitchpad-host --locked`, and `pnpm --filter @shruggietech/glitchpad test:run`. Image contract/corpus tests must cover all five codecs, orientation, pixel/byte boundaries, metadata redaction/failure, revision, cancellation, suspension, and disposal.

Run `cargo xtask check` for the complete repository gate. Watch it through actual exit status. The corpus and verification ledger record fixture provenance, expected results, and measured outcomes.

## End-to-end scenarios

1. Open each generated raster fixture using desktop chooser/drop and Android provider/chooser contracts. Confirm a read-only image session, expected preview/dimensions, compact controls, and unchanged source digest.
2. Exercise fit/actual-size/zoom/reset/pan/transparency by keyboard and touch at mobile widths; image content remains reachable.
3. Open the inspector for EXIF/XMP/IPTC/color fixtures. Confirm provenance, deterministic duplicates/statuses, redacted locations, and permitted copy output.
4. Refresh a changed source within the same session, supersede a request, revoke a provider, suspend/close tabs, and verify stale output rejection plus resource release.
5. Open malformed/oversized/decompression-bomb/metadata-bomb fixtures. Confirm classified bounded failure, no implicit network/execution/write, and independent usable neighboring tabs.

## Hosted completion

Push and publish the official PR with #68/#69/#73 traceability. Wait for all required CI/security/docs/platform packaging checks and external reviews; remediate every comment. Request at most one explicit second review. Keep #74/#75/#76/#66 open and hand the green reviewed PR to the owner for the final review/merge ritual.
