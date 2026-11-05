# S047 validation guide

Use the repository's approved hidden launchers. All local non-Git commands execute inside the running validation Linux container built from scripts/docker/validation.Dockerfile; never launch local Windows test/browser/build tooling.

1. Run affected Vitest and Rust tests before/after each behavior change. Use the existing frontend package scripts and cargo test package selectors; retain real exit results.
2. Run composed React/AppFrame geometry against actual components, including diagram Fit→zoom/pan and every visible task control across required frames/text/IME profiles. Synthetic HTML alone is insufficient.
3. Run cargo xtask check, existing validation policy suite and pinned brand verify/glyph/manifest checks. Scan tracked changes for BOM/mojibake; preserve generated assets byte-for-byte.
4. Compile affected Android plugin/instrumentation in the cached hidden SDK container. Actual GUI/native input belongs to isolated hosted CI.
5. Push codex/047-android-task-completion and open the unmerged PR. Monitor final-head Linux/Windows/macOS/Android/package applicable jobs. Android four-role/API matrix must retain every attempt and per-journey receipts.
6. Independently capture/read installed package, saved text, ICO PNG and Diagnostics destination/receiver bytes. Validate ten rows and119-control ledger using contracts/task-and-evidence.md, with exact final source/package identities.
7. Resolve findings within at most two external review rounds, rerun affected gates on each final change, complete Spec-Kit convergence and handoff. Keep auto-merge off. No release publication.

Expected result: all27acceptance criteria and required variants have passing retained evidence; explicit waivers/original-incident absence remain. A running job, source test, probe-only package, callback success or unrelated green check cannot satisfy a missing candidate task.
