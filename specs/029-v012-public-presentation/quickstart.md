# Quickstart: v0.1.2 Public Presentation Corrections

## Prerequisites

- Docker Desktop running with the repository validation image built from `scripts/docker/validation.Dockerfile`.
- No direct Windows Node, pnpm, browser, Python, or build-tool execution.

## Focused validation

Run through `scripts/invoke-docker-hidden.ps1`:

```text
pnpm check:brand
pnpm check:public-release
pnpm check:site
```

Expected result: the imported brand manifest and receipt validate, public copy/version/date mutations are rejected by unit tests, and the exported site passes all browser checks in supported themes and widths.

## Full pre-PR validation

```text
cargo xtask check
```

Expected result: every repository gate exits successfully before commit, push, or pull-request publication.

## Post-deployment validation

The `docs` workflow verifies `https://glitchpad.com/deployment.json`, the homepage, documentation landing page, technical specification, current release link, and lockup assets against the merged source revision. This production-only check runs after the protected Pages deployment and is not substituted for pre-PR testing.
