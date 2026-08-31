# S007 verification

## Local evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Spec Kit requirements checklist | pass | 18 of 18 items complete in `checklists/requirements.md` |
| Cross-artifact analysis | pass | 18 functional requirements and 33 tasks with full requirement coverage, no unresolved ambiguity, duplication, or constitution conflict |
| `pnpm check:brand` | pass | 3 contract tests plus manifest, checksum, encoding, license, README, governed-reference, and selected-public-copy verification |
| `pnpm check:site` | pass | Static export plus 5 unit/export tests and 9 Chromium route, theme, keyboard, reduced-motion, responsive, and not-found tests |
| `cargo xtask docs` | pass | Configuration, Prettier, Markdown, 99-file link, 27-diagram Mermaid, version, 344-file UTF-8, and public-surface checks passed |
| `cargo xtask check` | pass | Rust formatting, Clippy, 61 Rust tests, dependency policy, 11 frontend tests, application builds, brand checks, website checks, and complete documentation gates passed |
| `git diff --check` | pass | No whitespace errors |
| S007 prose audit | pass | No replacement characters, prohibited em dashes, TODO markers, or FIXME markers in authored S007 files |

## Hosted evidence

Hosted CI, CodeQL, the delivered Python verifier, and the static-site artifact workflow are recorded after the pull request is published. Production deployment is intentionally excluded from S007 and requires an explicit owner-authorized workflow dispatch.

## Implementation deviations

- The site uses `next/font/local` with the bundled WOFF2 files instead of the delivered `brand/nextjs/fonts.ts`, because the delivered helper fetches Google fonts while the same canon prohibits remote font loading and already includes redistribution-approved files.
- Repository integration guidance lives in `brand/INTEGRATION.md` instead of the governed `brand/README.md`, because editing a manifest-governed file would invalidate canon 1.0.0.
- Metadata points directly to the checksum-verified favicon and social-preview files instead of synthesizing separate Next.js image routes, preventing a second noncanonical identity from entering the export.
