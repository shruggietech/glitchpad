# Glitchpad public site

The `site/` workspace is the Next.js and Fumadocs source for the Glitchpad landing page and public documentation at `https://glitchpad.com`. It exports a self-contained static artifact to `site/out/`. Repository files under `docs/` remain authoritative; `scripts/prebuild.mjs` adapts them for the public `/docs` route.

Run `pnpm --filter @shruggietech/glitchpad-site dev` for local authoring and `pnpm check:site` for the production build, contract tests, and browser checks. Brand assets in `public/` are selected copies from the approved `brand/` canon and must not be edited independently.

## Publication control

Pull requests and pushes to `main` build and validate the static artifact without deploying it. A production publication requires a maintainer to run the `docs` workflow manually with its deployment input enabled, approve the protected `github-pages` environment if configured, and confirm that the repository's Pages source is GitHub Actions.

Production is published from the `shruggietech/glitchpad` GitHub Actions Pages site. The `github-pages` environment accepts deployments only from `main`; `glitchpad.com` is verified for the `shruggietech` organization, attached as the repository custom domain, and protected by the persistent `_github-pages-challenge-shruggietech.glitchpad.com` TXT record. HTTPS is enforced with certificate coverage for the apex and `www`, and `www` redirects to the canonical `https://glitchpad.com` host.

Cloudflare remains authoritative DNS. The apex uses all four supported GitHub Pages A records and all four supported AAAA records as DNS-only entries; `www` is a DNS-only CNAME to `shruggietech.github.io`. Do not enable the Cloudflare proxy or remove the organization challenge without a separately validated change because either action changes the provider-validation and ownership contract.

For an artifact rollback, redeploy the last known-good `main` workflow run or revert the website change on `main` and dispatch a new deployment. For domain recovery, follow `docs/operations/glitchpad-domain-cutover.md`: prefer restoring the validated organization deployment while retaining organization verification; an exact return to the personal-account Pages attachment is a guarded last resort that must remove organization verification before recreating the legacy attachment and restoring the captured DNS values.
