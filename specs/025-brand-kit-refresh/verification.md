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
- Reader-link correction: `brand/README.md` points directly to `LICENSE-BRAND.md` at the pinned upstream commit because the artifact's `../../LICENSE-BRAND.md` target escapes this repository when the kit is embedded. The corrected bytes are recorded in the local manifest.

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

- `cargo xtask check`: passed end-to-end before review remediation; focused validation is repeated for review changes below.

## Review remediation

- Added the `data-theme='system'` root to light-scheme token overrides and covered the contract in `check:brand`.
- Replaced the embedded README's escaping license link with the immutable pinned upstream target, updated its manifest entry, and covered reader reachability in `check:brand`.
- `pnpm check:brand`: passed (20 tests plus repository integration validation).
- `pnpm check:frontend`: passed (lint, typecheck, 41 test files / 231 tests, production build).
- `pnpm check:validation`: passed (18 tests).
- `pnpm docs:links`: passed (269 Markdown files).
- `pnpm docs:format`: passed after applying the formatter's task-checkbox normalization.
