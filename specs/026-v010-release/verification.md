# Verification: v0.1.0 Release Publication

## Spec Kit convergence

The completed implementation was compared with the specification, plan, research decisions, data model, readiness contract, quickstart, and task graph. All 14 functional requirements and six success criteria have implementation or validation coverage. No clarification marker, constitution violation, critical inconsistency, or incomplete task remains.

## Pre-push evidence

| Gate | Result |
| --- | --- |
| Focused community-release policy and assembly suite | Passed, 14 tests |
| Missing-secret coverage | Passed for all five required secret names |
| Rust formatting, Clippy, workspace tests, and dependency policy | Passed |
| Frontend lint, typecheck, tests, and production build | Passed, 41 files and 231 tests |
| Existing site, brand, metadata, persistence, performance, and four-platform package-policy stages | Passed before the documentation formatting stop |
| Markdown and structured-file formatting | Passed after correcting `data-model.md` |
| Markdown lint and links | Passed, 254 linted files and links in 277 Markdown files |
| Mermaid rendering | Passed, 43 diagrams |
| Version agreement | Passed at 0.1.0 |
| UTF-8, BOM, and mojibake validation | Passed, 807 text files |
| Public documentation and repository metadata | Passed |

The first complete repository run stopped when Prettier identified one S026 Markdown file. That file was formatted, and the release/documentation tail from the stopping point was rerun successfully. A subsequent redundant full rerun was terminated after exceeding the bounded local execution window; no failed assertion was used as evidence, and the already completed component results above cover every required gate.

## Publication-attempt remediation

The first owner-authorized tag attempt exposed one stale S023 evidence path in the tag-only readiness check after S025 replaced the governed brand kit. Release run `34168087207` failed before artifact publication, the four package workflows were cancelled, no GitHub release was created, and the local and remote `v0.1.0` tags were deleted. The readiness check now requires `brand/manifest.json` and `brand/INTEGRATION.md`, and community-release regression coverage rejects the removed `brand/references/01-canon.json` path. The focused policy suite passed 16 tests, current brand validation passed 20 tests, and the exact `v0.1.0` tag-context readiness command passed before this remediation was pushed.

The second owner-authorized tag attempt passed release preparation but exposed a Linux ownership boundary in run `34170361890`: the governed container produced `artifacts/linux` as root, so the runner could not rewrite the manifest during tag-only promotion. Windows and macOS packaging passed, Android was cancelled after the orchestrator stopped, no GitHub release was created, and both `v0.1.0` tags were deleted. The Linux workflow now restores runner ownership immediately after container assembly, and release-policy coverage requires that handoff to occur before promotion. The focused release suite passed 16 tests, Linux packaging passed 21 tests plus static contract validation, exact tag-context readiness passed, workflow syntax validation passed, and formatting and Markdown lint passed before push.

The ownership correction alone would prevent the observed failure but would leave the underlying coverage gap intact. Non-tag Linux CI now runs the exact release-promotion command against the actual container-produced artifact directory, proves the mutation succeeded, and restores non-official candidate evidence before upload. Static release-policy coverage requires this probe to run after ownership restoration and before candidate upload, and requires the probe and tag path to use the same command.

Second-round review identified that the initial static assertion could accept the candidate-upload step's identical non-tag guard if the promotion probe guard were removed. The validator now scopes the guard requirement to the probe block, with a regression fixture that preserves the upload guard while removing only the probe guard.

## Publication boundary

No `v0.1.0` tag or GitHub release currently exists. Stable Android authority is configured, manual readiness passed on current `main` in run `34166727857`, and the owner authorized publication. After this remediation is reviewed and merged, the operator may repeat the exact tag ritual in `docs/releases/v0.1.0-operator-runbook.md`.
