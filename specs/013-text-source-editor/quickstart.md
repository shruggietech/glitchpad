# Quickstart: Text and Source Editor Validation

## Prerequisites

- Run `cargo xtask doctor` and correct every required-tool failure.
- Install locked dependencies with `pnpm install --frozen-lockfile` after the S013 lockfile is present.
- Use only repository fixtures recorded in `fixtures/provenance.toml`.

## Focused domain validation

```text
cargo test -p glitchpad-core editor
pnpm --filter @shruggietech/glitchpad test:run -- text-document language
```

Expected outcome: size-mode, language-evidence, transaction, mixed-newline, encoding, invalid-byte, Unicode, and stale-result suites pass.

## Renderer validation

```text
pnpm --filter @shruggietech/glitchpad test:run -- TextEditorSurface LargeTextSurface App
```

Expected outcome: editable and read-only command paths, focus, selection, undo/redo, find/replace, language fallback, suspension, disposal, recovery projection, and accessibility checks pass.

## Performance evidence

Run the S013 measurement harness against the recorded 1 MiB, 32 MiB, and large read-only fixtures in a release build. Retain fixture digest, host, operating system, WebView version, cold or warm state, sample count, median, p95, peak memory, and cancellation result in `verification.md`.

Expected outcome: 1 MiB first content p95 is at most 300 ms, input-to-paint p95 is at most 50 ms without repeated 100 ms stalls, cancellation p95 is at most 250 ms, and large mode never allocates the complete decoded source in interface memory.

## Full pre-publication gate

```text
pnpm check
```

Expected outcome: formatting, Clippy, Rust tests, dependency and license policy, interface lint, typecheck, tests, production build, documentation, links, Mermaid, version, encoding, public-surface, brand, and security checks all succeed.

## Platform evidence

Build the Android debug artifact locally through the repository's hidden-process path. Exercise editable and large read-only renderer contracts against desktop and Android host doubles, then allow the official pull request matrix to repeat platform builds and retained native source lifecycle tests.

## Manual accessibility and interaction check

- Verify keyboard and discoverable pointer or touch routes for edit, undo, redo, find, replace, go-to-line, wrapping, indentation, copy, language override, save, and Save As where available.
- Verify focus restoration after dialogs, 200% and 400% zoom, high contrast, long names, bidirectional text, combining characters, emoji, tabs, zero-width characters, and screen-reader labels.
- Verify read-only and refused modes never imply that editing or saving is available.
- Record operator, platform, build profile, and result in `verification.md`.
