# Verification: Content-First Desktop Hotfix

Verified on 2026-09-08 from branch `codex/027-content-first-hotfix` before publication.

## Results

- Focused lint and type checks: passed.
- Focused application menu, conditional tab, desktop delivery, and Windows package-policy tests: 25 passed across the targeted Vitest and Node test runs.
- Complete frontend suite: 43 test files and 240 tests passed after the first-round review corrections.
- Production frontend build: passed; a generated-bundle scan found none of the former synthetic fixture content.
- Mermaid runtime boundary: passed using its explicit performance-only fixture build, with zero external requests, navigation dialogs, or native invocations.
- Documentation format, lint, link, and Mermaid checks: passed across 264 linted Markdown files, 287 linked Markdown files, and 44 rendered Mermaid diagrams.
- Complete repository gate: `cargo xtask check` passed after the runtime harness correction, covering Rust, frontend, documentation, security, configuration, performance, and package-policy checks.
- First-round Codex review: all four findings were corrected with focused regression coverage for single-document close focus, Mermaid and Markdown command availability, and multi-document warning placement.
- Hosted performance regression: the removed Mermaid toolbar left a stale automation selector; the collector now drives the compact application menu, waits for its dismissal, focuses CodeMirror explicitly, and passes all six hosted metrics locally.
- Diff integrity: `git diff --check` passed; UTF-8 BOM and mojibake scans returned no matches.
- Windows packaged UI Automation: the pull-request runner passed the platform-native Windows 11 x86_64 candidate, including the strengthened TXT/Markdown, empty-start, conditional-tab, and close-control lifecycle.

## Issue reconciliation

Issues #141 through #147 are implemented by this slice. Their release disposition remains tied to pull-request review and the platform-native CI result; no issue is treated as validated merely by publishing the pull request.
