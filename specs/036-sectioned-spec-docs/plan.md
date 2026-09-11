# Implementation Plan: Sectioned Technical Specification Documentation

**Branch**: `codex/s036-sectioned-spec-docs` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

## Summary

Replace the generated monolithic technical-specification page with a deterministic documentation set containing a repository-derived introduction, 38 ordered section pages, an unlisted legacy forwarder, and an ordered generation manifest. A Markdown-aware build step will validate table-of-contents and heading structure, preserve each section body, rewrite fragment links to their owning routes, stage the complete set before replacement, and feed expanded unit, export, browser, accessibility, and production-deployment checks.

## Technical Context

**Language/Version**: JavaScript ES2024 and TypeScript 5.9 on Node.js 24

**Primary Dependencies**: Next.js 16.3, Fumadocs Core/UI 16.14, Fumadocs MDX 15.2, React 19.2, Playwright 1.62, Node.js test runner

**Storage**: Canonical repository Markdown, generated MDX/JSON files, and static HTML export; no runtime persistence

**Testing**: Node.js unit and contract tests, Next.js static export, export-route/link audit, Playwright browser and accessibility tests, production deployment verifier, complete `cargo xtask check`

**Target Platform**: Static documentation hosted at `https://glitchpad.com`, with generation and validation on the pinned Linux CI/tooling environment

**Project Type**: Statically exported documentation website within a cross-platform desktop application repository

**Performance Goals**: Deterministic generation of 38 sections in one prebuild invocation, complete static route audit in one pass, and no new client-side data fetch or runtime documentation dependency

**Constraints**: Canonical specification remains unchanged; UTF-8 without BOM; project-authored Mermaid remains top-to-bottom; static export has no server redirects; generated files must be replaced as a complete set; release version remains 0.1.2; no new dependency; all local non-Git execution uses the hidden validation container

**Scale/Scope**: One canonical 38-section document, one generated introduction, 38 section routes, one compatibility route, one ordered manifest, and focused extensions to existing site checks

## Constitution Check

_GATE: Passed before research and passed again after design._

| Principle | Application | Result |
| --- | --- | --- |
| P1 | Documentation presentation does not alter application viewport ownership | Pass |
| P2 | Documentation generation uses local repository authorities and adds no network or upload path | Pass |
| P3 | Generation and export remain cross-platform Node.js behavior validated in the pinned Linux environment | Pass |
| P4 | Malformed or adversarial Markdown structure fails before publishing a mixed set, and MDX-special characters remain escaped outside code fences | Pass |
| P5 | The canonical specification remains the sole normative source, and S036 changes presentation without advancing the 0.1.2 release | Pass |
| P6 | Every issue #170 acceptance criterion maps to unit, export, browser, accessibility, CI, or explicit post-merge production evidence | Pass |
| P7 | The existing prebuild, page route, metadata helper, audit, and test systems are extended proportionally without adding a content framework | Pass |
| P8 | No dependency, license, or distributable asset is added | Pass |

## Project Structure

```text
specs/036-sectioned-spec-docs/
├── checklists/
│   └── requirements.md
├── contracts/
│   └── documentation-generation.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
├── tasks.md
└── verification.md
site/
├── app/docs/
│   ├── [[...slug]]/page.tsx
│   └── layout.tsx
├── content/docs/
│   ├── index.mdx
│   ├── meta.json
│   ├── 01-document-control-and-authority.mdx
│   ├── ...
│   ├── 38-appendices.mdx
│   └── technical-specification.mdx
├── lib/generated/
│   ├── documentation.json
│   └── project.ts
├── scripts/
│   ├── audit-export.mjs
│   ├── postbuild.mjs
│   └── prebuild.mjs
└── tests/
    ├── accessibility.spec.mjs
    ├── content-contract.test.mjs
    ├── export-contract.test.mjs
    └── public-routes.spec.mjs
scripts/
└── verify-site-deployment.mjs
docs/
└── glitchpad-technical-specification.md
.github/workflows/
└── docs.yml
```

**Structure Decision**: Extend the existing site prebuild and validation pipeline in place. Treat `site/content/docs` and `site/lib/generated` as complete generated products, publish them from staging directories, keep the existing catch-all page and shared metadata helper, and make the manifest the common ordered contract for tests, export audit, and deployment verification.

## Complexity Tracking

No constitution violations require justification.
