# Contract: Foundation Verification

**Date**: 2026-08-30

## Local commands

| Command | Contract |
| --- | --- |
| `cargo xtask doctor` | Read-only toolchain and platform prerequisite report |
| `cargo xtask docs` | Formatting, Markdown, links, Mermaid direction/render, encoding, and version checks |
| `cargo xtask check` | Native, frontend, documentation, and consistency gates with failure propagation |
| `pnpm install --frozen-lockfile` | Reproduce JavaScript graph without lock changes |
| `cargo test --workspace --locked` | Reproduce native tests without dependency drift |

## Hosted gates

| Gate | Trigger | Required behavior |
| --- | --- | --- |
| `docs` | Pull request, manual, nightly | Run documentation contract |
| `shared` | Pull request, manual, nightly | Run native and frontend contract |
| `dependency-review` | Pull request | Reject prohibited dependency changes when GitHub supports the event |
| `ci-ok` | Always after required CI jobs | Fail on failed/cancelled dependency, pass explicit skips |
| CodeQL | Pull request, schedule, manual | Analyze supported source languages with read-only contents and security-event write only |
| Release readiness | `vX.Y.Z` tag | Verify version/docs/license/platform evidence before any publication |

## Initial-commit receipt

The completion report records branch, commit hash, commit subject, tracked-file count, ignored active pointer, clean status, remote count, UTF-8 result, aggregate check result, and any platform check that could not run because a release-only prerequisite was absent.
