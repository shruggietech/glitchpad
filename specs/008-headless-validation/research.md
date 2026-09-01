# Research: Headless Windows Validation

## Decision 1: Repair the nested launcher topology rather than restricting command execution

**Decision**: Preserve direct headless command execution and remove the two repository-owned per-item nested launch patterns.

**Rationale**: The Rust orchestrator applies `CREATE_NO_WINDOW` to its immediate command only. `scripts/check-links.ps1` starts `pnpm exec markdown-link-check` once per Markdown file, and `scripts/check-mermaid.ps1` starts `pnpm exec mmdc` once per diagram. A Windows creation flag does not automatically constrain later descendants created by those scripts. The Mermaid loop's roughly 27 launches also matches the reported once-per-second burst.

**Alternatives considered**:

- Block the command runner or terminal access: rejected because direct `git`, `gh`, builds, and tests are supported headless operations and are not the failure boundary.
- Add more outer `CREATE_NO_WINDOW` flags: rejected because the existing flag already covers only the immediate child and cannot guarantee independently launched nested descendants.
- Wrap every child in another hidden PowerShell launcher: rejected because it retains item-proportional process creation and adds another platform-specific layer.

## Decision 2: Use one programmatic link-check process

**Decision**: Import the installed `markdown-link-check` API and validate the deterministic Markdown set inside one Node process.

**Rationale**: The package API accepts Markdown content plus per-file `baseUrl`, `projectBaseUrl`, ignore patterns, retry settings, timeouts, and alive status codes. Calling it directly retains local relative-link behavior and the repository JSON policy without one package-manager and CLI process per file. Sequential file processing retains stable attribution while the library's own bounded link concurrency remains intact.

**Alternatives considered**:

- Pass all file paths to one CLI invocation: viable for current scale but vulnerable to Windows command-line limits as the repository grows and harder to test without subprocesses.
- Replace the link checker: rejected because the existing pinned dependency already provides the required programmatic API and license posture.

## Decision 3: Fail error-status link results

**Decision**: Treat both `dead` and `error` link results as validator failures.

**Rationale**: The existing CLI path fails dead links but can emit an error-status result without making the outer command fail. P6 and FR-008 require a real nonzero result when validation cannot establish success. The new diagnostic will retain the source file, link target, status, and error detail.

**Alternatives considered**:

- Reproduce the existing silent-error behavior: rejected as fundamentally unreliable validation and contrary to the project directive not to reproduce bad logic.

## Decision 4: Reuse one Puppeteer browser for all Mermaid blocks

**Decision**: Extract diagrams in deterministic repository order, launch Puppeteer once, and call the installed Mermaid `renderMermaid` function for every block.

**Rationale**: `@mermaid-js/mermaid-cli` exports `renderMermaid(browser, definition, format, options)`. It opens and closes a page per render while accepting a reusable browser or browser context. One browser eliminates per-diagram `pnpm` and browser launches and keeps source attribution under repository control.

**Alternatives considered**:

- Call `mmdc` once per diagram: rejected because this is the proven item-proportional launcher.
- Concatenate repository Markdown and call the CLI once: rejected because diagnostics would lose original file and block locations and generated-output management would become artificial.
- Implement a Mermaid parser or renderer: rejected as unnecessary duplication of the installed pinned tool.

## Decision 5: Share deterministic Markdown discovery

**Decision**: Create one small repository traversal helper parameterized by each validator's existing exclusion set.

**Rationale**: Both scripts currently recurse over Markdown but differ intentionally: link validation excludes `.agents` and `.specify`, while Mermaid validation includes them and excludes only generated/dependency trees. A shared helper can preserve those policies, sort paths deterministically, and handle spaces and non-ASCII names without shell parsing.

**Alternatives considered**:

- Duplicate traversal in both validators: rejected because behavior could drift and would require redundant regression coverage.
- Use shell globs: rejected because cross-platform expansion and quoting differ.

## Decision 6: Enforce topology statically and behavior dynamically

**Decision**: Add configuration assertions for direct Node entry points and prohibited launcher code, plus injected unit tests for behavior and resource counts.

**Rationale**: Unit tests can prove one launcher call and complete renderer coverage without relying on fragile operating-system process snapshots. Configuration assertions stop the specific architectural regression before it reaches a Windows desktop. The observed full Windows run remains the acceptance check for the user-interface symptom.

**Alternatives considered**:

- Count operating-system processes in tests: rejected because browser internals, platform timing, and runner permissions make snapshots nondeterministic.
- Rely only on manual observation: rejected because the topology regression would be too easy to reintroduce.

## Decision 7: Reuse current dependencies and CI browser configuration

**Decision**: Add no dependency and load `.github/puppeteer-ci.json` only for GitHub Actions on Linux.

**Rationale**: Node 24, `markdown-link-check`, Mermaid CLI, and Puppeteer are already pinned. The existing no-sandbox CI argument remains necessary in hosted Linux while the normal local launch configuration remains empty.

**Alternatives considered**:

- Add a new process manager or validation framework: rejected as disproportionate and unnecessary.
