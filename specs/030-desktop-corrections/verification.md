# Verification: Desktop Rendering and Shell Corrections

**Date**: 2026-09-09

**Result**: PASS

## Chronological evidence

1. The initial `DocumentErrorBoundary` test failed because the boundary did not exist, establishing the expected red state before implementation.
2. The focused S030 frontend suite passed 54 tests across App, Markdown, menu, and document containment coverage. TypeScript, ESLint, and the production frontend build passed.
3. Focused Windows package and public-release policy tests passed 18 tests. PowerShell parsed both modified lifecycle scripts successfully, and documentation formatting passed.
4. The exact repository frontend command initially passed all 44 test files and 252 tests. After convergence added three timeout/theme cases, a default-concurrency rerun passed 222 tests but failed to start six unrelated fork workers before their timeout.
5. The native validation group passed lockfile integrity, `cargo fmt --check`, Clippy for all workspace targets and features with warnings denied, all Rust workspace tests, and `cargo deny check`.
6. `cargo xtask docs` passed brand and public-release authority, the production site build, 66 Playwright browser tests, validation and renderer fixtures, all four platform package contracts, configuration lint, Prettier, Markdown lint across 295 files, link validation across 318 Markdown files, 46 Mermaid renders, version consistency, public-surface policy, and strict UTF-8 without BOM or common mojibake markers.
7. Vitest concurrency was capped at two workers to stay below bind-mounted workspace I/O saturation. The exact repository frontend command then passed all 44 test files and all 255 tests without missing workers.
8. Final ESLint and Prettier checks passed, and the post-convergence encoding scan validated 867 text files as UTF-8 without BOM or common mojibake markers.
9. Final diff review identified a one-frame ready-result retention risk during a same-session revision change. Synchronous result identity gating was added, then 51 Markdown and App tests, TypeScript, ESLint, and the production build passed.
10. First-round Codex review findings strengthened packaged Windows evidence: delivery now monitors each actual raw sentinel continuously until safe heading settlement, and the two final-artifact fixtures exercise table, footnote, nested, and embedded-Mermaid rendering. Windows package policy, PowerShell syntax, and Prettier passed after the changes.

## Aggregate execution note

The first monolithic `cargo xtask check` invocation was terminated after its hidden launcher buffered all child output for 24 minutes, making progress indistinguishable from a stuck validator. The same authoritative stages were then run as bounded groups without changing their commands or acceptance criteria: lockfile integrity; Rust format, Clippy, tests, and dependency policy; exact frontend tests, typecheck, lint, and production build; and exact `cargo xtask docs`. Every constituent stage passed.

## Issue reconciliation

- #160: governed corpus, both orderings, identical-byte identities, revision supersession, document containment, source recovery, and final Windows artifact evidence are covered.
- #161: pending rendered mode contains only constant status text; source requires explicit recovery after failure; accessibility checks pass.
- #162: the fixed left trigger and independently positioned popup are covered by component, static policy, and packaged UI Automation geometry checks.
- #163: only the Platforms badge was removed; the platform table and all unrelated badges remain governed.

## Release state

The v0.1.2 behavior delta is recorded as unreleased. S030 does not publish or relabel the current v0.1.1 release.
