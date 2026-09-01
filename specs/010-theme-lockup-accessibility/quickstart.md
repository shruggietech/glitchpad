# Quickstart: Theme-Aware Lockup Accessibility

## Prerequisites

- Start from `codex/010-theme-lockup-accessibility` with a clean worktree.
- Use the pinned Node.js, pnpm, Rust, and browser toolchains from repository authorities.
- Restore purged dependencies with `pnpm install --frozen-lockfile` before validation.

## Focused brand contract

```powershell
pnpm check:brand
```

Expected result: canonical brand verification passes, the README structural contract selects white for dark and black for fallback, and both active website SVG copies equal canon byte-for-byte.

## Production site and browser matrix

```powershell
pnpm check:site
```

Expected result: the static site builds, unit contracts pass, and Playwright confirms exact theme mappings, one stable `Glitchpad` home-link name, one visible lockup image, theme switching without reload, and no tested responsive overflow on `/` and `/docs`.

## Full repository gate

```powershell
pnpm check
```

Expected result: Rust, frontend, brand, site, documentation, links, Mermaid, configuration, encoding, dependency, security, and version gates all complete successfully with real exit status zero.

## Manual review

1. Render the repository README in GitHub light and dark themes and confirm one legible banner in each.
2. Browse the production-equivalent static export on landing and documentation layouts at narrow and desktop widths.
3. Change the site theme in both directions and confirm the lockup changes without reload while the home link remains named `Glitchpad`.
4. Inspect the diff and confirm no file under `brand/` changed.

## Hosted evidence

Push the completed branch, open one pull request that closes Issues #104 and #106, wait for all required CI, docs, and CodeQL checks, and process every third-party review comment individually before declaring convergence.
