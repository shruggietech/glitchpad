# Verification: Desktop Source Lifecycle

## Scope and traceability

S006 implements GitHub Issue #46 for Windows, macOS, and Linux. Android document-provider acquisition remains assigned to the next Android source-adapter slice and no Android source behavior is claimed here.

| Issue acceptance criterion | S006 implementation | Automated evidence |
| --- | --- | --- |
| Desktop adapter conformance passes on Windows, macOS, and Linux | One `DesktopSourceHost` and one shared `desktop_source_conformance` suite | The `platform` matrix runs the suite and desktop build on all three operating systems |
| Duplicate stable identities focus an existing session while uncertain identities remain separate | Native `file-id` evidence plus the core strong-only identity comparison policy | Four-channel host deduplication test and 100-delivery strong/weak session tests |
| Stale external revisions cannot be overwritten silently | Exact external-revision and session-revision checks precede temporary-file creation and replacement | 1,000-attempt stale-save conformance test plus stale-session, oversized-save, successful-receipt, and close-invalidation unit tests |
| Revocation, deletion, rename, and watcher overflow produce stable visible states | Parent-aware `notify` watcher mapping, path-free events, and authoritative revalidation | Watch mapping unit tests, path-free serialized event assertion, native mutation conformance test, and session conflict tests |

## Durability evidence

Unix adapters report `atomic_file_and_directory` after the sibling temporary file is flushed and synchronized, atomically committed, and the parent directory is synchronized. Windows reports `atomic_file` after the sibling temporary file is flushed, synchronized, and atomically committed because the standard library does not expose an equivalent parent-directory synchronization primitive there.

No supported desktop adapter silently selects a non-atomic fallback. A failed atomic commit returns `partial_write_prevented` without a durable receipt. The revision-bound acknowledgement policy for a future `recoverable_non_atomic` adapter is separately unit-tested, so such an adapter cannot begin a weaker write without an acknowledgement matching the source, revision, and disclosed guarantee.

## Automated validation

[GitHub Actions run 33324951889](https://github.com/shruggietech/glitchpad/actions/runs/33324951889) passed Windows, macOS, and Linux conformance and desktop builds, the Android non-regression build, workspace formatting, Clippy with warnings denied, Rust tests, frontend checks, documentation and public-surface checks, dependency review, and license/advisory/secret checks on implementation commit `f8067c1`. The temporary S006 bootstrap job generated no further source correction and was removed after that evidence was established. Pull Request #98 remains subject to the normal required CI and CodeQL checks on the review-ready commit.

## Environment limits and manual checks

No local non-Git process was launched because this Windows desktop session has no verified integrated headless terminal and project policy prohibits external console execution. Platform behavior is therefore recorded only from GitHub-hosted CI, not claimed as locally observed.

The quickstart's interactive dialog, drop, association, visible conflict, and filesystem-specific weak-guarantee checks require application-layer UI integration that is outside S006. S006 validates their native host contracts and trusted delivery values without opening an external application, foregrounding a console, or exposing a renderer path-acquisition command.

## Encoding and documentation integrity

All S006 source and documentation files are UTF-8 without BOM. The repository documentation gate checks formatting, Markdown, links, Mermaid structure, encoding corruption, and public-surface consistency; new Mermaid remains top-to-bottom and prose remains unwrapped according to project convention.
