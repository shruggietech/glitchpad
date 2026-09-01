# Quickstart: Verify Headless Windows Validation

## 1. Run focused automated regressions

```powershell
node --test scripts/check-validation.test.mjs
node scripts/check-config.mjs
```

Expected: traversal, link diagnostics, Mermaid extraction, one-browser reuse, cleanup, and prohibited-launcher contracts pass.

## 2. Run each direct validator

```powershell
pnpm docs:links
pnpm docs:mermaid
```

Expected: all selected Markdown files and Mermaid diagrams validate, each command uses one Node validator process, and Mermaid uses one reusable browser.

## 3. Run the complete documentation and repository gates

```powershell
cargo xtask docs
cargo xtask check
```

Watch both commands through completion and evaluate their real exit status. On Windows, observe the desktop for the entire run. Expected: zero project-owned native console windows become visible, flash, or steal focus.

## 4. Verify failure attribution

The automated tests create isolated temporary fixtures with deliberately failing link and Mermaid results. Expected diagnostics name the fixture's repository-relative source, failing link or block ordinal and line, and the outer result is nonzero. No production repository file needs to be corrupted for this check.

## 5. Verify hosted parity

Push the branch, wait for every required GitHub Actions workflow, and confirm the documentation and full validation jobs complete successfully on hosted Linux. Compare the reported source and diagram counts with the local run.

## Acceptance record

- Automated topology contract: required.
- Focused validator tests: required.
- Full local repository validation: required.
- Human-observed Windows no-flash run: required.
- Hosted required checks: required.
