# Verification: Markdown Recovery and Reserved Shell Chrome

## Local evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Red-phase focused frontend tests | Expected failure | Four new recovery and shell assertions failed before implementation. |
| Focused Markdown and shell suite | Pass | 10 test files, 93 tests passed. |
| Complete frontend gate | Pass | ESLint, TypeScript, 46 test files with 265 tests, and the Vite production build passed in the isolated rerun. |
| Production shell geometry | Pass | 48 pairwise compiled-CSS cases passed across three viewport sizes, 100/125/150/200 percent page scales, four device scale factors, light and dark themes, reduced and ordinary motion, forced colors, tabbed and untabbed states, fine and coarse pointers, and Escape focus restoration. |
| Windows package policy | Pass | 12 policy tests and package configuration validation passed. |
| Windows lifecycle script parsing | Pass | Portable and installer lifecycle scripts parsed successfully with PowerShell. |
| Documentation checks | Pass | The clean aggregate documentation run passed. An earlier run completed 65 of 66 browser cases before the technical-specification lockup case timed out at 30 seconds; that case passed alone in 2.2 seconds. |
| Complete repository gate | Pass | `cargo xtask check` exited successfully across Rust formatting, Clippy, 63 core tests, 48 host tests, all remaining native suites, dependency policy, frontend lint/type checking, 265 frontend tests, production builds, site/docs, package policies, geometry, and encoding. An earlier aggregate returned a transient late frontend exit after printing passing tests and build output; an identical isolated frontend gate and the final clean aggregate both exited successfully. |
| Repository diff integrity | Pass | `git diff --check` returned clean before final publication. |
| Encoding integrity | Pass | 923 tracked text files passed UTF-8 without BOM and common mojibake-marker validation. |

Existing React `act(...)` notices and the Vite chunk-size notice remain unchanged non-failing warnings and are outside S035.

## Requirement traceability

| Scope | Acceptance evidence |
| --- | --- |
| #171 rendered-preview compatibility | Chrome 69 source-policy assertions, focused Markdown pipeline tests, all 265 frontend tests, and the production build pass locally; exact candidate bytes remain pending hosted Windows validation. |
| #171 containment and compact recovery | `DocumentErrorBoundary`, `DocumentSurface`, and `MarkdownSurface` tests cover contained failure, source recovery, fresh retry, repeated failure, and stale attempts; compiled CSS geometry proves intrinsic rows and compact actions. |
| #171 document isolation and lifecycle | Existing and S035 tests cover sequential documents, close/reopen, restoration, and document-scoped revision/attempt keys; the expanded portable lifecycle covers minimal and governed fixtures in both orders. |
| #171 privacy-safe diagnostics | Static failure copy, existing diagnostics allowlists, content-free schema-4 lifecycle receipts, and the repository encoding/policy gates contain no document content or native locator values. |
| #172 reserved shell ownership | `App` owns one in-flow shell row for empty, single-document, multi-document, panel, and inspector states; no renderer-specific padding was introduced. |
| #172 compact and accessible trigger | CSS and rendered geometry enforce a 32px desktop toolbar/target, 40px tabbed row, 44px coarse target, 18px glyph, theme/forced-color rules, and connected focus behavior. |
| #172 stable disclosure geometry | The 48-case production probe measures trigger, toolbar, popup, document, scroll offset, recovery action, viewport containment, page scale, preferences, and Escape focus; Windows UI Automation repeats geometry and focus checks on exact packaged candidates. |
| #172 shared desktop evidence | Named Windows, macOS, and Linux focused smoke steps are present in CI; hosted results remain pending. |
| #66 focused contribution | S035 adds compatibility, containment, geometry, package, and privacy regression evidence only; it does not claim the broader stable-core matrix is complete. |

## Hosted evidence

Pending the official pull request. T020 and T021 remain open until CI, final-byte Windows package evidence, review responses, UTF-8 and mojibake checks, and issue reconciliation are complete.
