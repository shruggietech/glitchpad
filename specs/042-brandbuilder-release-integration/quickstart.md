# Quickstart: Validate the BrandBuilder Release Integration

1. Obtain the formal `v2.0.3` Glitchpad archive and `SHA256SUMS` from `shruggietech/shruggie-brand` and confirm the archive SHA-256 is `4cedc498d58fe6a8e7573b4c18ca97b95e27bf96c4e0eeb88712dff6545543f3`.
2. Inspect `brand/INTEGRATION.json`, `brand/enforcement/bundle.json`, `brand/enforcement/consumer-contract.json`, and `brand/manifest.json` for one package identity and the documented README correction.
3. In the repository's approved Linux validation image, run `pnpm check:brand`, `pnpm check:site`, the relevant Android and desktop package checks, and `cargo xtask check`. Watch each command to its final exit status. The upstream kit's verifier and glyph validator must report zero failures after exact recovery-bundle extraction.
4. Check CI documentation, shared, performance, desktop-host, and Android jobs for the PR. Treat unavailable local or actual-host checks as unverified until CI or a documented host run provides their result.
5. Compare the three S042 issues with `spec.md`, `tasks.md`, and `verification.md`; close an issue only after its acceptance criteria are supported by observed evidence.

The kit has no runtime network dependency. `pnpm check:brand:freshness` is an optional comparison with public hosted derivatives; the formal release archive and checksum remain the source authority.
