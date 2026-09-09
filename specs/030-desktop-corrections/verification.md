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
11. The second Codex round identified a durable-recovery gap and a pre-effect mode transition. Both were reproduced and fixed at the state boundary. The two focused component files passed 27 tests; TypeScript, ESLint, the production build, and all 11 Windows package-policy tests passed.
12. Final Windows artifact execution exposed that HTML comments are intentionally rendered as inert visible source by the Markdown security pipeline, making the original sentinel itself a false positive. Both sentinels were changed to unused Markdown reference definitions, which remain in raw source but are omitted from the rendered projection. The package policy now requires those exact source-only definitions.
13. The corrected sentinel passed in both Windows candidate jobs. Their next failure showed that the rendered footnote is exposed as nested UI Automation text rather than one exact-name element. Its assertion now uses the same bounded descendant text discovery as the raw-source guard while exact-name checks remain in place for headings, tabs, and the embedded diagram.
14. Both Windows candidates then advanced to an ambiguous UI Automation activation and failed because a name-only lookup returned a node without InvokePattern. Menu and close activation now require the matching node to have the Button control type, retrieve InvokePattern through its supported-pattern API, and emit the control name if invocation is unavailable.
15. Typed lookup identified `Menu` as the control lacking InvokePattern on both hosted WebView runners. Button activation now prefers InvokePattern, falls back to the standard LegacyIAccessible default action exposed by WebView, and fails with the accessible control name if neither pattern is supported.
16. Hosted PowerShell 7 did not project a static LegacyIAccessiblePattern .NET type. The fallback now resolves the registered UI Automation pattern by standard ID 10018 and invokes the returned pattern object dynamically, avoiding runtime type binding while preserving the capability check.
17. Both hosted WebView runners exposed the typed `Menu` button without InvokePattern or LegacyIAccessiblePattern. The final activation path now focuses the verified Button control and sends Enter, matching platform keyboard semantics without depending on a Chromium-specific UI Automation action provider.
18. Keyboard activation successfully opened the hosted menu. Closing it by activating the trigger again raced the menu's initial-focus effect, so the geometry check now dismisses the disclosed menu through its supported Escape contract before verifying that the trigger returns to its original bounds. Direct document-close buttons continue to exercise the same focused-button activation path independently.

## Aggregate execution note

The first monolithic `cargo xtask check` invocation was terminated after its hidden launcher buffered all child output for 24 minutes, making progress indistinguishable from a stuck validator. The same authoritative stages were then run as bounded groups without changing their commands or acceptance criteria: lockfile integrity; Rust format, Clippy, tests, and dependency policy; exact frontend tests, typecheck, lint, and production build; and exact `cargo xtask docs`. Every constituent stage passed.

## Issue reconciliation

- #160: governed corpus, both orderings, identical-byte identities, revision supersession, document containment, source recovery, and final Windows artifact evidence are covered.
- #161: pending rendered mode contains only constant status text; source requires explicit recovery after failure; accessibility checks pass.
- #162: the fixed left trigger and independently positioned popup are covered by component, static policy, and packaged UI Automation geometry checks.
- #163: only the Platforms badge was removed; the platform table and all unrelated badges remain governed.

## Release state

The v0.1.2 behavior delta is recorded as unreleased. S030 does not publish or relabel the current v0.1.1 release.
