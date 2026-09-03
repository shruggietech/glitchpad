# Glitchpad Agent Instructions

## Markdown formatting

- Write each prose paragraph on one physical line. Never hard-wrap Markdown prose to a fixed column width.
- Preserve line breaks only when Markdown semantics or deliberate visual structure require them, including headings, lists, blockquotes, tables, fenced code, Mermaid diagrams, and intentional hard breaks.
- Treat line-length linting for Markdown prose as disabled. Do not reflow existing paragraphs merely to satisfy a column limit.
- These rules override generated tool or skill guidance that recommends wrapping Markdown rationale, prose, or documentation for readability.

## Mermaid diagrams

- Lay out Mermaid diagrams from top to bottom. For flowcharts, use `flowchart TB`; for nested subgraphs with an explicit direction, use `direction TB`.
- Do not use left-to-right, right-to-left, or bottom-to-top flow directions (`LR`, `RL`, or `BT`) unless the user explicitly requests one for a specific diagram.
- Keep the primary reading order vertically stacked. When a diagram would become too wide, split it into multiple focused diagrams or vertically arranged subgraphs instead of changing it to a horizontal layout.
- Treat top-to-bottom layout as a required project convention for every new or modified Mermaid diagram, not as an optional formatting preference.

## Work slice composition

- Bundle as many compatible GitHub Issues into one implementation slice as can be completed, validated, and reviewed coherently.
- Do not default to one GitHub Issue per implementation slice. Split work only when dependencies, risk, reviewability, platform boundaries, conflicting validation needs, or independent delivery value make separate slices materially clearer or safer.
- Preserve issue-level traceability inside a bundled slice by naming every included issue, satisfying each issue's acceptance criteria, and reporting any issue that remains incomplete instead of closing it implicitly.
- Prefer slices that deliver a meaningful end-to-end capability or release increment over artificially narrow issue-by-issue churn.

## Headless command execution on Windows

- Foreground, flashing, or focus-stealing console windows are prohibited. Do not interpret this as a blanket ban on command execution that remains headless.
- Direct `git` and `gh` operations are allowed for status inspection, review, commit, fetch, push, pull-request publication, and related repository work. On Windows, automated agents MUST invoke them through `scripts/invoke-vcs-hidden.ps1`; it applies `CREATE_NO_WINDOW`, redirected non-interactive I/O, and disables credential and CLI prompts.
- Do not launch a fresh PowerShell process for each file read, check, or polling iteration. Prefer direct file tools, batch compatible checks, reuse one verified process host, or invoke the underlying tool directly.
- If a launch pattern produces visible windows, stop that specific executable and pattern immediately. Record what caused the behavior and continue unrelated direct Git or verified headless operations.
- Non-Git console tools that have not been verified headless MUST use an integrated terminal, repository-aware API, or a launcher with a `CREATE_NO_WINDOW` guarantee, redirected output, and non-interactive arguments.
- Project-owned Windows process launchers MUST apply the `CREATE_NO_WINDOW` creation flag to console child processes. A successful build or test does not justify visible desktop console windows.

## Mandatory hidden virtualized execution

- All non-Git repository commands on Windows MUST run inside a Linux container through `scripts/invoke-docker-hidden.ps1`. This includes Node.js, pnpm, Rust, test, build, lint, formatting, browser, and performance commands.
- The Docker launcher is the primary approved Windows-to-Linux process boundary. It MUST keep `UseShellExecute` disabled, set `CreateNoWindow`, request a hidden window style, redirect standard output and standard error, and invoke Docker non-interactively.
- `scripts/invoke-wsl-hidden.ps1` is an approved fallback only when Docker is unavailable and the WSL distribution has the complete required toolchain and working networking. Never mix Windows development binaries into a WSL command through `/mnt/c`.
- Direct Windows execution of PowerShell, `cmd.exe`, Node.js, pnpm, Cargo, browsers, test runners, build tools, or project scripts is prohibited, even when a command previously appeared harmless.
- Do not fall back to Windows tooling when the Linux environment lacks a dependency. Add the dependency to the container invocation or image, or stop and report the missing dependency.
- Build the repository validation environment from `scripts/docker/validation.Dockerfile`; do not repeatedly install its toolchain or system packages in disposable command containers.
- Reuse one running launcher session for long operations and polling. Never implement a polling loop that repeatedly starts `docker.exe` or `wsl.exe`.
- Git and GitHub CLI may run directly only through a verified headless Codex runner path. Otherwise, run them through an approved hidden launcher with credentials supplied through the existing credential mechanism, never copied into an image or repository.
- The validated visibility probes are `scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', 'alpine:3.22', 'sleep', '180')` and `scripts/invoke-wsl-hidden.ps1 -Command 'sleep 180'`. Any visible window, taskbar activation, flash, or focus change is a hard failure. Stop the launcher immediately and do not continue repository commands.
