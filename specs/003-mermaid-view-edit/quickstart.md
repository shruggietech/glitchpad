# Quickstart Validation: Mermaid Viewing and Editing

**Date**: 2026-08-30

This guide defines the end-to-end evidence expected from the implementation. Commands that depend on the repository-foundation slice become runnable when its manifests and `xtask` surface exist. Exact commands remain repository-owned and must not be replaced with untracked local scripts.

## Prerequisites

- Install the pinned contributor environment documented by the technical specification and machine-readable toolchain files.
- Install locked JavaScript and Rust dependencies through the repository bootstrap command.
- Confirm that fixture provenance is valid and that no fixture contains production or private user data.
- Build a release-profile application for the target platform under test.

## Validate repository documents

```powershell
npx prettier --check "**/*.{md,json,yml,yaml}"
npx markdownlint-cli2 "**/*.md"
```

Expected result: formatting and Markdown linting complete with exit code 0, prose remains unwrapped, and every project-authored Mermaid flow uses top-to-bottom layout.

## Run the shared Mermaid contract

```powershell
pnpm test --filter mermaid-renderer
pnpm test --filter mermaid-security
pnpm test --filter mermaid-accessibility
pnpm test --filter mermaid-integration
```

Expected result: standalone and embedded conformance, limits, latest-revision behavior, sanitation, zero-network assertions, accessibility projections, and error classification pass with exit code 0.

## Validate valid standalone files

1. Open representative `.mmd` and `.mermaid` fixtures through the file dialog, drag-and-drop or platform open-with path, and Android document provider.
2. Confirm rendered mode appears first for valid source and fit-to-view keeps the complete diagram reachable.
3. Exercise source mode, find/replace, go to line, edit, undo/redo, preview refresh, metadata, save, close, and reopen.
4. Confirm comments, whitespace, directives, layout direction, encoding, BOM intent, and newlines change only where the edit changed them.

Expected result: the same source and semantic diagram behavior appears on Windows, macOS, Linux, and Android, subject only to documented platform interaction differences.

## Validate embedded Markdown blocks

1. Open a Markdown fixture containing at least twenty Mermaid blocks with valid, malformed, and over-limit examples.
2. Confirm valid blocks render inline at source position and malformed blocks show independent bounded fallbacks.
3. Edit one block in Markdown source mode and verify that only results for the newest parent revision commit.
4. Search for a rendered label and confirm the Markdown search path reaches it.

Expected result: non-diagram Markdown and every unaffected block remain readable when one block fails.

## Validate latest-revision preview behavior

1. Open a normal standalone diagram and make at least one hundred rapid source revisions using the automated fixture driver.
2. Capture requested, cancelled, completed, discarded, and committed revision identifiers.
3. Introduce a syntax error after a valid render, then correct it.

Expected result: zero stale results commit as current, one current request exists per owner, the invalid revision preserves and labels the last valid preview as stale, and correction produces a current preview.

## Validate hostile source

```powershell
pnpm test --filter mermaid-hostile-corpus
cargo xtask verify-network-denial --renderer mermaid
```

Expected result: fixtures containing scripts, event handlers, HTML, callbacks, automatic links, remote CSS/fonts/images, unsafe data URLs, secure-key overrides, oversized graphs, output expansion, and timeout behavior produce zero execution, navigation, native bridge calls, or network requests.

## Validate accessibility

1. Run automated accessibility tests for rendered/source modes, errors, stale preview, metadata, zoom, pan, and search.
2. Perform keyboard-only checks on desktop and touch-only checks on Android.
3. Inspect diagrams with and without authored `accTitle` and `accDescr` using the release screen-reader matrix.
4. Check 200 percent interface zoom, high contrast, dark/light themes, long localized fallback labels, right-to-left labels, and reduced motion.

Expected result: every essential action remains reachable, authored labels and descriptions are exposed, unannotated diagrams receive a useful fallback and source route, and SVG content does not trap focus.

## Validate limits and degradation

Test the exact boundary immediately below, at, and above every value in [the renderer contract](contracts/mermaid-renderer.md): standalone and block source bytes, aggregate Markdown Mermaid bytes, block count, edge count, output bytes, wall time, document concurrency, and app-wide concurrency.

Expected result: in-limit work succeeds, over-limit rendering returns the named limit result, and source view/edit/search/copy/save remains available through the shared text thresholds.

## Validate package activation

```powershell
cargo xtask release-check --capability mermaid
```

Expected result: dialog filters, `.mmd` and `.mermaid` associations, Android intents, support declarations, help, release notes, notices, SBOM, provenance, and four-platform package evidence agree. Any missing platform, security, accessibility, source-integrity, performance, license, or documentation receipt blocks the stable claim.
