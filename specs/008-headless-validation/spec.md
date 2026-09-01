# Feature Specification: Headless Windows Validation

**Feature Branch**: `codex/008-headless-validation`

**Created**: 2026-08-31

**Status**: Ready for review

**Input**: User description: "Eliminate the repeated native Windows terminal flashes caused by project validation without restricting ordinary headless command execution, direct Git or GitHub operations, builds, tests, or AI coding. Run S008 end-to-end under the Spec-Kit autopilot protocol."

**Issue Traceability**: GitHub Issue #101

## Clarifications

### Session 2026-08-31

- Q: Is all terminal or command-runner access prohibited? A: No. Headless command execution, including direct `git` and `gh`, remains permitted. The defect boundary is a project-owned launch pattern that creates visible or focus-stealing Windows console windows.
- Q: Which behavior most likely causes the reported burst? A: Repository validation launches a new package-manager process for each Markdown file and Mermaid block. The immediate parent is hidden, but its nested descendants do not inherit that guarantee.
- Q: Does S008 need to change application runtime behavior? A: No. S008 is limited to repository validation, its regression coverage, and contributor documentation.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Validate without desktop interruption (Priority: P1)

A contributor or coding agent can run the repository's full validation workflow on Windows without native console windows appearing, flashing, or stealing desktop focus.

**Why this priority**: Repeated foreground windows interrupt the user's workstation and make otherwise valid automation unacceptable.

**Independent Test**: Run the complete repository validation workflow from the supported Windows automation host while observing the desktop and verify that zero project-owned console windows become visible or take focus.

**Acceptance Scenarios**:

1. **Given** a Windows workstation and a clean checkout, **When** the full repository validation workflow runs, **Then** no project-owned console window becomes visible or steals focus.
2. **Given** documentation containing many Markdown files and Mermaid diagrams, **When** documentation validation runs, **Then** its child-process topology remains bounded rather than creating one console process per file or diagram.
3. **Given** a contributor runs direct Git, GitHub, build, or test commands through a verified headless host, **When** S008 is complete, **Then** those capabilities remain available and are not blocked as a workaround.

---

### User Story 2 - Receive equivalent, precise validation failures (Priority: P1)

A contributor receives reliable link and Mermaid validation results that identify the exact source of every failure even though validation now uses a bounded process topology.

**Why this priority**: Eliminating visible windows cannot weaken validation coverage or make failures harder to diagnose.

**Independent Test**: Run the validators against representative valid content and deliberately invalid link and Mermaid fixtures, then verify full coverage, source-specific diagnostics, and accurate exit status.

**Acceptance Scenarios**:

1. **Given** valid repository Markdown and Mermaid content, **When** documentation validation runs, **Then** every selected file and diagram is checked and the workflow succeeds.
2. **Given** a broken link, **When** link validation runs, **Then** it exits unsuccessfully and identifies the source file and failing target.
3. **Given** an invalid Mermaid block, **When** Mermaid validation runs, **Then** it exits unsuccessfully and identifies the source file and diagram location.
4. **Given** one or more validation failures, **When** the workflow completes, **Then** temporary artifacts are cleaned up and the outer repository check receives a nonzero result.

---

### User Story 3 - Maintain the headless guarantee (Priority: P2)

A maintainer can change documentation validation with an explicit, testable contract that prevents reintroducing item-proportional process spawning or unhidden Windows console descendants.

**Why this priority**: The failure is easy to recreate accidentally if process topology is not documented and enforced.

**Independent Test**: Inspect and run automated regression checks that enforce the supported validator entry points, bounded process topology, cleanup behavior, and platform parity.

**Acceptance Scenarios**:

1. **Given** a proposed validation change, **When** automated configuration and regression checks run, **Then** they reject nested package-manager or shell launch patterns that scale with document count.
2. **Given** validation on Windows and hosted Linux runners, **When** the same repository content is checked, **Then** both environments apply the same selection rules and failure semantics.
3. **Given** contributor guidance, **When** a maintainer investigates a future console-window regression, **Then** the documented failure boundary distinguishes visible launchers from ordinary headless command execution.

### Edge Cases

- No Markdown files or no Mermaid blocks are selected.
- A Markdown file path contains spaces or non-ASCII characters.
- A Markdown file contains several Mermaid blocks, including repeated or empty blocks.
- Link validation encounters a malformed URL, an unavailable external service, or a local target outside the selected documentation set.
- Mermaid validation cannot start its browser, a diagram times out, or browser shutdown fails after a validation error.
- Temporary workspace creation or cleanup fails.
- Validation is invoked from an existing terminal, a non-console automation host, or hosted Linux CI.
- A future change attempts to restore per-item `pnpm`, PowerShell, command-shell, or browser launches.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Project-owned Windows validation MUST create zero visible, flashing, or focus-stealing console windows when invoked through the supported headless automation path.
- **FR-002**: S008 MUST preserve direct headless `git`, `gh`, build, test, and repository command execution and MUST NOT impose a blanket terminal-access restriction.
- **FR-003**: Documentation link validation MUST use a bounded validator process topology whose process count does not increase with the number of selected Markdown files.
- **FR-004**: Mermaid validation MUST use a bounded validator process topology and a single reusable browser instance whose process-launch count does not increase with the number of diagrams.
- **FR-005**: Link validation MUST inspect the same repository Markdown scope and exclusions as the existing workflow unless a documented correctness defect requires a proportional correction.
- **FR-006**: Mermaid validation MUST inspect every fenced Mermaid block in the selected repository Markdown scope and preserve deterministic source order.
- **FR-007**: Every link or Mermaid failure MUST identify its source file and failing target or diagram location with enough context for a contributor to reproduce it.
- **FR-008**: Validators MUST return success only when every selected item passes and MUST propagate a nonzero result through the complete repository validation workflow when any item fails.
- **FR-009**: Validators MUST handle paths containing spaces and non-ASCII characters without shell interpolation or argument-loss defects.
- **FR-010**: Temporary files and browser resources MUST be isolated per run and cleaned up after success, validation failure, or launcher failure.
- **FR-011**: Windows and hosted Linux validation MUST apply equivalent content-selection, validation, diagnostic, and exit-status behavior.
- **FR-012**: Automated regression coverage MUST verify successful and failing validator behavior, deterministic source attribution, cleanup, and the bounded-process contract.
- **FR-013**: Repository configuration validation MUST reject known item-proportional nested package-manager, PowerShell, command-shell, or browser launch patterns in documentation validators.
- **FR-014**: Contributor documentation MUST define the visible-window failure boundary, approved headless execution paths, validator architecture, and recovery guidance.
- **FR-015**: S008 MUST retain pinned, license-compatible dependencies and MUST pass the repository's formatting, lint, test, documentation, dependency, license, secret, encoding, and security gates.
- **FR-016**: S008 MUST NOT change Glitchpad application runtime behavior, production hosting, DNS, release state, or Android source lifecycle work.

### Key Entities

- **Validation run**: One invocation of a repository validator with a selected content set, bounded process resources, diagnostics, and final exit status.
- **Validation item**: One Markdown file, link target, or Mermaid block associated with an exact repository source location.
- **Diagnostic**: A deterministic source-specific success or failure record emitted during validation.
- **Validation resource**: A process, reusable browser instance, or temporary workspace whose lifetime is bounded by one validation run.
- **Headless execution contract**: The repository rule that project-owned Windows console descendants remain hidden while ordinary verified command execution stays available.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A complete Windows repository validation run produces zero visible, flashing, or focus-stealing project-owned console windows during observed acceptance testing.
- **SC-002**: Link validation uses no more than one validator process for any selected Markdown-file count, and Mermaid validation uses no more than one validator process and one browser instance for any diagram count.
- **SC-003**: One hundred percent of selected Markdown files and Mermaid blocks are validated in deterministic order with no coverage loss from the previous workflow.
- **SC-004**: Deliberately invalid link and Mermaid fixtures are rejected in automated tests with diagnostics naming the exact source file and failing target or diagram location.
- **SC-005**: Successful, validation-failure, browser-launch-failure, and cleanup paths all produce the expected outer exit status, with no leaked temporary workspace or reusable browser resource.
- **SC-006**: Windows and hosted Linux validation complete with equivalent selection counts and pass/fail outcomes for the same repository revision.
- **SC-007**: Automated configuration checks detect 100 percent of the explicitly prohibited nested-launch regression fixtures.
- **SC-008**: Full repository formatting, lint, tests, documentation, dependency-license, secret, encoding, and CodeQL gates complete successfully before S008 is described as ready to merge.

## Assumptions

- The reported burst is caused by repository-owned nested validation launchers, particularly the per-file link checks and per-diagram Mermaid checks, rather than direct Git or GitHub operations.
- A project-owned validator may use one long-lived headless process and one reusable browser instance while still satisfying the no-visible-window contract.
- Existing Markdown selection and exclusion rules are the behavioral baseline; S008 corrects process topology without intentionally broadening or narrowing documentation scope.
- A human-observed Windows acceptance run complements automated topology checks because focus theft itself cannot be proven solely by exit status.
- The current JavaScript toolchain can host programmatic link and Mermaid validation without adding an application runtime dependency.
- S008 is repository tooling work and does not change product behavior or authorize external hosting configuration.
