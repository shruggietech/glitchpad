# Verification: Local Markdown Viewing and Editing

## Acceptance Evidence

| Criterion | Evidence | Result |
| --- | --- | --- |
| SC-001 | Deterministic 1 MiB fixture `1b06b5873a3bdf2cb89638252b47f5865b0df558fdba741435bfa5cc6ce700c9`, three Windows development-build samples: 358.17 ms, 423.17 ms, and 487.97 ms; p95 487.97 ms | Pass |
| SC-002 | `markdown-renderer.test.ts` submits 100 revisions inside the debounce interval, proves one execution and revision 100 as the only accepted result, and verifies idempotent disposal | Pass |
| SC-003 | URL, pipeline, component, and host tests cover raw HTML, executable and ambiguous schemes, credentials, controls, remote images, and zero pre-confirmation gateway calls | Pass |
| SC-004 | Repeated pipeline projections cover CommonMark, GFM tables/tasks/strikethrough, footnotes, source mappings, and collision-free heading IDs | Pass |
| SC-005 | Markdown source mode composes the existing S013 byte-preserving editor; the aggregate round-trip and recovery suites remain green | Pass |
| SC-006 | Conformance tests cover exact 16 MiB, 32 MiB, and 256 MiB boundaries plus the first byte above each boundary | Pass |
| SC-007 | Post-render axe checks report no critical or serious findings; keyboard controls, focus return, semantic navigation, and coarse-pointer 44-pixel rules are automated | Pass |
| SC-008 | `pnpm check`, Android-target Rust compilation, formatting, dependency, fixture provenance, documentation, browser, encoding, and policy checks complete before publication | Pass |

## Platform and Security Evidence

- Windows host unit tests pass with the independently validating external-link command and automatic opener interception disabled.
- `cargo check -p glitchpad-host --target aarch64-linux-android` passes, including the shared opener boundary.
- The production build emits Markdown parsing as a module-worker asset and renders only the application-owned safe tree.
- Remote resources have no resolver path, permitted links require a disclosed confirmation, and the host repeats scheme, credential, ambiguity, length, and control-character validation.
- Mermaid fences remain inert code for issue #54 and no split view, HTML authoring, online retrieval, or generalized plugin authority was added.

## Manual Boundaries

The operating-system print dialog and native external application launch cannot be automated in the repository's headless gate. Their application-owned preconditions, print-only CSS, normalized disclosure, confirmation, host validation, and failure behavior are covered automatically. Final platform interaction remains part of maintainer review.

## Aggregate Gate

The final pre-publication `pnpm check` passed on 2026-09-02 with 111 frontend tests, 29 browser tests, all Rust unit/conformance/doc tests, production builds, dependency policy, source provenance, Markdown formatting/linting, 175-file link validation, 36 Mermaid render validations, version authority, and 515-file UTF-8/no-BOM/mojibake validation green. `git diff --check` also passed.
