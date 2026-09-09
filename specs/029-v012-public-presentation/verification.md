# Verification: v0.1.2 Public Presentation Corrections

## Automated evidence

Completed on 2026-09-09 in the repository validation image built from `scripts/docker/validation.Dockerfile` and invoked only through `scripts/invoke-docker-hidden.ps1`.

- Brand import and public-release mutation suites: 28 tests passed.
- Brand manifest, receipt, provenance, exact-copy, encoding, licensing, README PNG geometry, and offline integration validation: passed.
- Live brand freshness comparison against `brand.shruggie.tech`: passed for the recorded upstream derivatives.
- Rust formatting and strict Clippy across the workspace: passed.
- Rust workspace tests: 167 passed and 1 platform-only test ignored by contract.
- Cargo dependency advisories, bans, licenses, and sources: passed.
- Frontend lint and type checking: passed.
- Frontend unit suite: 43 files and 242 tests passed.
- Frontend production build: passed.
- Static site build and unit suite: 7 tests passed.
- Deployment verifier: passed against the locally exported site with an exact synthetic source revision.
- Browser contract matrix: 66 tests passed across all six public routes, light and dark themes, stored-theme overrides, theme switching, and 320, 768, and 1280 pixel widths.
- Android, Linux, macOS, and Windows package contract suites: passed.
- Configuration parsing, Prettier, and Markdown lint: passed.
- Link validation: 308 Markdown files passed.
- Mermaid validation: 46 diagrams parsed and rendered.
- Version authority: all sources agree on 0.1.1.
- Encoding and corruption check: 853 text files are UTF-8 without BOM or common mojibake markers.
- Public metadata and Mermaid direction policy: passed.

The first aggregate documentation run stopped at link validation because the downloaded upstream artifact remained under `.tmp/s029-brand`. That exact temporary directory and the diagnostic log were path-verified and removed. The failed-and-later link, Mermaid, version, encoding, and public-surface stages were then rerun successfully. No product assertion failed.

## Deferred production evidence

The pull request path builds and validates the Pages artifact without deployment. After an approved merge, the `docs` workflow deploys that exact main-branch artifact and verifies `deployment.json`, the expected source revision, v0.1.1 release authority, canonical homepage copy, documentation routes, and contextual logo assets. This evidence cannot truthfully exist before merge and is therefore enforced as part of the protected post-deployment job.
