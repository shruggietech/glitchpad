# Verification Contract

## Issue traceability

| GitHub Issue | Required evidence |
| --- | --- |
| #45 Core contracts | Rust tests for identity comparison, independent capability serialization, error redaction, session lifecycle, duplicate activation, and JSON Schema generation. |
| #48 Detection | Rust table tests for signatures, extension disagreement, Markdown, Mermaid, text, source hints, UTF-8 and UTF-16 BOM handling, newline profiles, invalid bytes, truncation, evidence limits, and deterministic results. |
| #49 Shell and tabs | Reducer tests for open, activation, close successor, reorder, cycling, dirty/background preservation, and deterministic overflow; interface tests for tab semantics, keyboard and pointer interaction, focus, empty state, compact layout constants, and live announcements. |
| #51 Commands and accessibility | Unit tests for capability-derived command sets and stale targets; interface tests for accessible names, keyboard activation, absence of unsupported commands, focus visibility hooks, coarse-pointer target rules, and axe-core results; quickstart checks for 200 percent zoom and screen-reader announcements. |

## Automated gates

The implementation must pass all of the following from the repository root:

```powershell
cargo fmt --all --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --all-targets --all-features
pnpm exec prettier --check .
pnpm exec markdownlint-cli2 "**/*.md" "#node_modules"
pnpm --filter @shruggietech/glitchpad check
cargo xtask check
```

The aggregate gate is the final authority when an individual command and repository automation disagree.

## Manual checks

The quickstart records checks that require a real browser or assistive technology: 200 percent zoom, coarse-pointer layout, tab and command focus visibility, and concise screen-reader announcements. A failed manual check blocks a verified claim even when automated checks pass.

## Encoding check

All added text files must decode as UTF-8, contain no byte-order mark, and contain no replacement character indicating mojibake.
