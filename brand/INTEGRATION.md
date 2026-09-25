# Repository integration

Glitchpad uses the formal [shruggie-brand v2.0.3 release](https://github.com/shruggietech/shruggie-brand/releases/tag/v2.0.3) package `glitchpad-brand-1.1.1-bb2.0.3` from source revision `115bd423f0656b6006b0719d1838da8286afb5e4`. The archive `glitchpad-brand-1.1.1-bb2.0.3.zip` has SHA-256 `4cedc498d58fe6a8e7573b4c18ca97b95e27bf96c4e0eeb88712dff6545543f3` in the release `SHA256SUMS`. It was retrieved on 2026-09-24.

The untouched source manifest SHA-256 is `e32b6211e698a4ca47c8c547a5d64975e22bb623c62e8b31fcc494a7df086910` and governs 321 files. The release archive also contains `LICENSE`, `LICENSE-BRAND.md`, and `NOTICE` outside that manifest; their individual digests are recorded in `INTEGRATION.json`. All archive entries were checked before import.

The sole governed-byte correction changes the released `README.md` legal link from `../../LICENSE-BRAND.md` to the bundled local `LICENSE-BRAND.md` so it resolves inside this repository. The integrated manifest SHA-256 is `a6688b0d8a81aaa2e7d6a168fd5f09e8c60d24c089aa2a0ce7ee6eeb7302c217` after that correction. Other generated files are exact copies of the release. `INTEGRATION.json` and this file are the only project-owned files in `brand/`.

The project copies fonts, logos, web icons, and Android and desktop package assets from `brand/` through `scripts/sync-brand-kit.mjs`. `scripts/check-brand.mjs` compares their exact bytes and validates the release receipt, bundled recovery archive, legal files, web icon roles, agent contract, encoding, and manifest. The optional `pnpm check:brand:freshness` compares sampled public-site derivatives; the formal release remains the source authority.

Use the exact bundled `brand/enforcement/distributions/shruggie-brandbuilder-2.0.3.skill` for offline recovery after confirming SHA-256 `f8ae954806e9797cbde8270a0660dc16dd6c4018df03f8003ca95e633efc073f`. Run the kit verifier and glyph validator under the approved validation environment. See `specs/042-brandbuilder-release-integration/verification.md` for S042 migration and validation evidence.
