# Implementation Plan: v0.1.2 Public Presentation Corrections

**Branch**: `codex/029-v012-public-presentation` | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

## Summary

Refresh the governed Glitchpad brand delivery from the current ShruggieTech authority, repair the README and public-site identity, reconcile current v0.1.1 claims and specification dates, and make the Pages workflow deploy and verify the exact reviewed artifact after `main` merges.

## Technical Context

**Languages/versions**: Node.js 24.11.0, TypeScript 5.9.3, React 19.2.8, Next.js 16.3.0, Python 3.13 for upstream brand generation, YAML for GitHub Actions

**Primary dependencies**: Fumadocs 16.14.3, Playwright 1.62.1, Node test runner, GitHub Pages Actions

**Storage**: Git-tracked brand assets, JSON manifests/receipts, static HTML export, GitHub Pages artifact

**Testing**: Node unit tests, Playwright browser/visual assertions, deterministic brand and export audits, repository-wide `cargo xtask check`

**Target platform**: GitHub README renderer, modern desktop/mobile browsers, GitHub-hosted Ubuntu CI and Pages deployment

**Performance goals**: No new runtime network dependency; no horizontal overflow at 320, 768, or 1280 pixels; static export remains fully local

**Constraints**: Public copy remains v0.1.1 until the separate v0.1.2 publication ritual; pull requests never deploy; generated upstream brand assets are never hand-edited; normal validation remains offline and deterministic

**Scale/scope**: Six P0 issues (#151-#156), one README, six public routes, one brand kit, one docs workflow

## Constitution Check

- **P1, file owns viewport**: Public prose and navigation are reduced to literal high-value tasks; no application-shell expansion is introduced.
- **P2, local files remain local**: The static public site gains no file upload, telemetry, account, or runtime service dependency.
- **P3, cross-platform behavior**: Brand integrations retain all platform icon suites and public content remains responsive.
- **P4, untrusted input fails safely**: No document-processing boundary changes; downloaded brand data is digest-verified before import.
- **P5, specifications and releases move together**: Repository and generated technical-specification metadata are reconciled while v0.1.1 remains current.
- **P6, verification precedes claims**: Browser-visible output, static export, deployment provenance, and production freshness receive explicit gates before merge/deployment claims.
- **P7, proportionality**: Work is bounded to the six public-presentation defects and deployment reliability required to keep them fixed.
- **P8, licensing**: The authoritative kit's licensing and provenance remain bundled and manifest-bound.

No constitution exception is required.

## Project Structure

```text
README.md
brand/
├── INTEGRATION.md
├── manifest.json
└── ... governed upstream delivery
docs/
└── glitchpad-technical-specification.md
scripts/
├── check-brand.mjs
├── check-brand.test.mjs
├── check-public-release.mjs
├── check-public-release.test.mjs
└── sync-brand-kit.mjs
site/
├── app/(home)/page.tsx
├── components/footer.tsx
├── lib/layout.shared.tsx
├── scripts/prebuild.mjs
├── scripts/postbuild.mjs
└── tests/
    ├── content-contract.test.mjs
    ├── public-routes.spec.mjs
    └── theme-lockup.spec.mjs
.github/workflows/docs.yml
specs/029-v012-public-presentation/
```

## Design Decisions

1. The current upstream authority is pinned by source revision and rebuilt with the upstream generator. A project-owned sync command stages output, verifies the upstream manifest, records receipt metadata, and replaces governed files atomically.
2. README presentation uses the upstream PNG lockups because GitHub's SVG rendering is the observed failure boundary. The website may use upstream SVGs only when browser pixel/geometry assertions prove visible rendering.
3. Canonical public copy is generated from repository authorities where practical. A focused public-release checker rejects stale or contradictory literal claims across source and generated content.
4. `Issued` means the original publication date; `Updated` means the date of the current specification revision. Revision history remains chronological.
5. The docs workflow uploads a Pages artifact only on `main` or an explicit deployment dispatch, deploys automatically after a successful `main` build, and runs a bounded production verifier against the expected version and source revision. Pull requests cannot deploy.
6. Deployment provenance is emitted into the static export as machine-readable JSON derived from the build revision and product version.

## Phase 0: Research

See [research.md](research.md) for authoritative brand, GitHub rendering, copy, and deployment decisions.

## Phase 1: Design and Contracts

- [data-model.md](data-model.md) defines the brand receipt, public identity, specification control, and deployment provenance records.
- [contracts/public-presentation.md](contracts/public-presentation.md) defines observable public and workflow behavior.
- [quickstart.md](quickstart.md) defines the local pre-PR verification path.

## Complexity Tracking

No unjustified complexity or constitution violation is introduced.
