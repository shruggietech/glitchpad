# S016 Verification

## Requirement evidence

| Scope | Evidence |
| --- | --- |
| FR-001 to FR-003, US1 | Shell and renderer entry points, grouped nonmodal inspector, tab retargeting, Escape dismissal, and opener focus are covered by `App.test.tsx` and `MetadataInspector.test.tsx`. |
| FR-004 to FR-009, SC-002 | The bounded catalog, typed values, six availability states, provenance, sensitivity, copy policy, revision bindings, source/text/detection/renderer projection, and format-conflict key are covered by Rust schema tests, `metadata.test.ts`, renderer tests, and the catalog fixture validator. |
| FR-010 to FR-012, US3, SC-003, SC-004, SC-008 | Desktop and Android hosts implement 1 MiB cooperative SHA-256 steps with a 256 MiB ceiling, EOF and final-revision checks, cancellation, terminal cleanup, and 100-cycle stale/cancel coverage. The open inspector refreshes native facts every 750 ms, keeps document write authority unchanged, cancels work on close or session change, and rejects response revisions that do not match the request. |
| FR-013 to FR-015, US2, US4, SC-006, SC-007 | Component tests cover direct copy, explicit per-fact confirmation, denied and bulk-copy exclusion, clipboard failure, keyboard dismissal, focus, async announcements, phone expansion, and automated axe checks. CSS limits desktop/tablet sheets to 40 percent of viewport width, uses a phone bottom sheet capped at 40 percent until explicit expansion, preserves tablet side-sheet placement, and provides 44-pixel coarse-pointer targets. |
| FR-016 to FR-018, SC-005 | Native snapshots are path-free, Android provider locators remain private, query failures leave document viewing intact, hostile fixtures remain inert text, and the aggregate runtime policy records zero external requests, navigation, or native invocation from renderer content. |
| FR-019 | Catalog entries expose stable localization keys; dates, integer counts, decimal timings, byte units, and plurals use locale-aware `Intl` formatting without translating file names or metadata values. |
| FR-020 | No EXIF, IPTC, XMP, image, PDF, or office parser was added. |

## Local gate receipt

`pnpm check` completed successfully on 2026-09-03. The gate included strict Rust formatting and Clippy, the complete locked Rust workspace suite, dependency policy, 31 frontend test files with 178 passing tests, production builds, runtime isolation, metadata fixture and provenance validation, configuration validation, documentation formatting/lint/link checks, 40 Mermaid renders, version consistency, and UTF-8/no-BOM/mojibake checks across 569 text files.

Focused host evidence included 55 core unit tests, 3 schema tests, 33 host unit tests, 9 Android contract tests, 14 desktop source conformance tests, 6 recovery conformance tests, and 4 xtask tests. The changed-source metadata test proves the inspector may observe current external facts without silently accepting that revision for document writes.

## Platform boundary

Android host and provider behavior is covered locally by the Rust Android contract suite and controlled generated-provider source. Device-level API 24 and API 36 instrumented execution requires the existing headless CI jobs and is intentionally not claimed as local evidence.
