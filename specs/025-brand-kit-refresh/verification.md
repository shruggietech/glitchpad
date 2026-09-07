# Verification: Brand Kit Refresh

## Upstream authority

- Source repository: `shruggietech/shruggie-brand`
- Pinned commit: `1681fcd444ff851d5bffc2cf67e23bbcedd753cd`
- Successful Build run: `34137139742`
- Published kit: Glitchpad `1.1.0`, canon `1.2.1`
- Published endpoint: `https://brand.shruggie.tech`
- Artifact comparison: all 181 files available from the published endpoint matched the pinned Build artifact byte-for-byte.
- Artifact caveat: the independently generated Pages PDF did not have a stable checksum, so the repository uses the manifest-bound PDF from the successful Build artifact.
- Hidden marker recovery: the Build artifact uploader omitted `icons/.iconkit-generated.json`; its deterministic contents were regenerated from the pinned upstream generator and verified against the supplied manifest.

## Integrated surfaces

- Replaced the governed `brand/` delivery and removed files absent from the approved artifact.
- Refreshed website logos, fonts, social preview, favicons, and manifest.
- Applied approved color and typography tokens to the application shell while preserving existing layout and behavior.
- Replaced application, Windows, macOS, Linux, Android, and Play Store icon inputs with exact approved derivatives.
- Extended `check:brand` to verify provenance, manifest completeness, exact integrated copies, and stale-placeholder removal.

## Focused validation

- `pnpm check:brand`: passed (18 tests plus repository integration validation).
- `pnpm check:frontend`: passed (lint, typecheck, 41 test files / 231 tests, production build).
- `pnpm check:site`: passed (production build, 7 unit tests, 29 Chromium tests).
- `pnpm check:android-package`: passed (14 tests plus source-package policy).
- `pnpm check:windows-package`: passed (9 tests plus package contract).
- `pnpm check:macos-package`: passed (18 tests plus package contract).
- `pnpm check:linux-package`: passed (21 tests plus package contract).

## Full validation

- `cargo xtask check`: passed end-to-end after resolving the imported artifact's repository-relative brand-license link against the pinned upstream source.
