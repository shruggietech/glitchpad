# Quickstart: Brand and Public Web Foundation

## Prerequisites

- Use the Node.js and pnpm versions pinned by the root workspace.
- Use the repository Rust toolchain for aggregate validation.
- Use a Python environment satisfying `brand/build/README.md` only when regenerating or re-running the canon verifier.
- Do not configure production Pages or DNS credentials for pull-request validation.

## Brand and README validation

1. Run the canon verifier documented in `brand/build/README.md` and require zero problems.
2. Render `README.md` with light and dark color preferences and confirm that the intended canonical horizontal lockup is selected.
3. Inspect the banner fallback and H1 with images disabled or through an accessibility tree.
4. Confirm no governed integration references `brand/concepts/` or `brand/qc/` as a production asset.

## Site validation

1. Install the pinned workspace dependencies from the repository root.
2. Run the site production build, which first adapts authoritative repository documentation and then emits the static export.
3. Assert that `site/out/.nojekyll` exists and `site/out/CNAME` contains exactly `glitchpad.com`.
4. Run unit checks for claim sourcing, documentation adaptation, route inventory, and metadata.
5. Run production-browser checks for landing, documentation, legal/support/security, and not-found routes in light and dark modes at 320, 768, 1280, and 1920 CSS-pixel widths.
6. Require zero serious or critical automated accessibility violations, zero broken required links, and zero horizontal page overflow.

## Repository validation

1. Run the aggregate repository check so formatting, lint, tests, documentation, link, encoding, dependency-license, secret, brand, site, and public-surface checks execute together.
2. Validate the production-equivalent site in hosted CI on Windows where shared checks run and in the Linux documentation job where browser checks run.
3. Require CodeQL analysis for JavaScript/TypeScript and the existing Rust workspace.

## Deployment readiness without publication

1. Confirm pull-request jobs have read-only repository permission and no Pages or identity-token write permission.
2. Confirm the deployment job requires explicit workflow dispatch, a successful artifact build, and the protected `github-pages` environment.
3. Stop after artifact validation unless the product owner separately authorizes Pages configuration, DNS changes, and the first production deployment.

## Expected outcome

The repository contains one verified brand authority, the README displays an approved theme-aware banner, the public landing and `/docs` routes build into a complete static artifact, all hosted gates pass, and no production publication occurs during S007.
