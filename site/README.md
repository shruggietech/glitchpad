# Glitchpad public site

The `site/` workspace is the Next.js and Fumadocs source for the Glitchpad landing page and public documentation at `https://glitchpad.com`. It exports a self-contained static artifact to `site/out/`. Repository files under `docs/` remain authoritative; `scripts/prebuild.mjs` adapts them for the public `/docs` route.

Run `pnpm --filter @shruggietech/glitchpad-site dev` for local authoring and `pnpm check:site` for the production build, contract tests, and browser checks. Brand assets in `public/` are selected copies from the approved `brand/` canon and must not be edited independently.

## Publication control

Pull requests and pushes to `main` build and validate the static artifact without deploying it. A production publication requires a maintainer to run the `docs` workflow manually with its deployment input enabled, approve the protected `github-pages` environment if configured, and confirm that the repository's Pages source is GitHub Actions.

Before the first publication, the domain owner must configure `glitchpad.com` DNS for GitHub Pages, verify the custom domain in the GitHub organization, enable HTTPS after certificate issuance, and confirm the repository Pages settings. S007 does not perform these owner-controlled actions.

To roll back, redeploy the last known-good workflow run or revert the website change on `main` and dispatch a new deployment. If the published artifact or domain configuration is unsafe, disable Pages or remove the DNS records while the repository fix is prepared.
