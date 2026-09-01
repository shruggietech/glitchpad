# Contract: Documentation Validation Entry Points

## Supported commands

```text
pnpm docs:links
pnpm docs:mermaid
cargo xtask docs
cargo xtask check
```

The package scripts MUST invoke their Node validator entry points directly. `cargo xtask` remains the supported outer orchestrator and applies its Windows hidden-process flag to the direct child.

## Link validator

### Link input

- Repository root derived from the script location.
- `.markdown-link-check.json` repository policy.
- Every `.md` file below the root except paths containing `.agents`, `.specify`, `node_modules`, `target`, or `gen` directory segments.

### Link output

- Success: `Validated links in <file-count> Markdown files.`
- Failure: one or more diagnostics containing repository-relative source path, failing link target, status, and available error detail.
- Exit status: `0` only when every selected file has no dead or error-status link result; nonzero otherwise.

### Process contract

- One Node validator process for the run.
- No child package-manager, shell, or link-validator process.
- File count does not affect process count.

## Mermaid validator

### Mermaid input

- Repository root derived from the script location.
- Every fenced `mermaid` block below the root except paths containing `node_modules`, `target`, or `gen` directory segments.
- `.github/puppeteer-ci.json` launch options only when running on Linux under GitHub Actions.

### Mermaid output

- Success: `Parsed and rendered <diagram-count> Mermaid diagrams.`
- Failure: a diagnostic containing repository-relative source path, one-based block ordinal, opening-fence line, and renderer or launcher error.
- Exit status: `0` only when every selected diagram renders to a nonempty SVG result; nonzero otherwise.

### Process and resource contract

- One Node validator process for the run.
- Zero browsers when there are no diagrams; exactly one reusable browser when at least one diagram exists.
- No child package-manager, PowerShell, command-shell, or Mermaid CLI process.
- Diagram count does not affect validator-process or browser-instance count.
- The reusable browser is closed after success or failure.

## Configuration guard contract

Repository configuration validation MUST fail if:

- `docs:links` or `docs:mermaid` stops being a direct Node script.
- A validator imports process-spawning facilities.
- A validator references `pnpm`, PowerShell, `cmd.exe`, or another known nested command launcher.
- The prior PowerShell validator entry points remain active.

## Platform contract

- Windows invocation through the supported outer orchestrator produces no visible or focus-stealing project-owned console window.
- Windows and Linux select the same repository content and produce equivalent validation outcomes.
- Paths are passed through direct file APIs and may contain spaces or non-ASCII characters.
