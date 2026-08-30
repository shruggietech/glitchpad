# Feature Specification: Repository Foundation

**Feature Branch**: `[004-repository-foundation]`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "Generate the standard project scaffolding, prepare a public-ready README and repository metadata, add the usual GitHub workflows and Git attributes, then initialize the first local Git repository state."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Understand the project from its repository landing page (Priority: P1)

A visitor reaches the future public repository and can understand what Glitchpad is, what it will support, its current maturity, target platforms, license, architecture, documentation authority, and how to follow or contribute without encountering stale claims or placeholder sections.

**Why this priority**: The README becomes the project's public front door as soon as the repository is created under the organization.

**Independent Test**: Render the README in a GitHub-compatible Markdown viewer and verify that every badge, link, status statement, capability claim, development command, and license reference is accurate for v0.0.0.

**Acceptance Scenarios**:

1. **Given** a first-time visitor, **When** they read the README, **Then** they can identify the product purpose, supported direction, current foundation-only status, target platforms, and Apache-2.0 license without reading another file.
2. **Given** that no application release exists, **When** the README is rendered, **Then** it does not claim downloadable binaries, implemented viewers, or production readiness.
3. **Given** the repository is made public at its planned organization path, **When** badges and internal links load, **Then** they resolve to the intended CI, version, license, documentation, and contribution surfaces without placeholder text.

---

### User Story 2 - Bootstrap and verify the scaffold (Priority: P1)

A contributor clones the repository, installs the pinned toolchains, installs locked dependencies, and runs one documented command that verifies the Rust workspace, TypeScript application, documentation, and foundational tests.

**Why this priority**: A scaffold is useful only when it is reproducible and independently verifiable on a clean contributor machine.

**Independent Test**: Follow the contributor quick start on a clean supported host and confirm that dependency installation, formatting, linting, type checking, unit tests, and production builds complete from committed configuration and lockfiles.

**Acceptance Scenarios**:

1. **Given** the required shared toolchains, **When** a contributor installs dependencies with the documented frozen-lock command, **Then** the committed dependency graph resolves without modifying lockfiles.
2. **Given** an installed workspace, **When** the contributor runs the aggregate check command, **Then** native formatting/lint/tests, shared-application formatting/lint/typecheck/tests/build, and documentation checks all run and report their actual exit status.
3. **Given** the initial application scaffold, **When** it starts in a development host, **Then** it displays a compact foundation screen without claiming unimplemented document capabilities.

---

### User Story 3 - Receive trustworthy repository automation (Priority: P1)

A maintainer opens a pull request and receives an aggregate CI result covering documentation, native code, shared application code, dependencies, and platform-scaffold integrity, with standard issue, pull-request, ownership, security, and dependency-update metadata already present.

**Why this priority**: Public development needs consistent review inputs and branch-protection targets from the first pull request.

**Independent Test**: Validate every workflow and repository metadata file, then execute the same local commands each workflow invokes and confirm that an aggregate status job cannot pass when a required job fails.

**Acceptance Scenarios**:

1. **Given** a pull request, **When** CI runs, **Then** documentation and shared-code jobs report into one always-present aggregate gate suitable for branch protection.
2. **Given** a documentation-only change, **When** expensive code jobs are skipped by a future path optimization, **Then** the aggregate result distinguishes an intentional skip from failure and still reports.
3. **Given** a dependency or workflow change, **When** automation evaluates it, **Then** lockfile, license, vulnerability, and workflow-integrity checks have explicit ownership and failure behavior.

---

### User Story 4 - Begin with a clean local Git history (Priority: P2)

A maintainer has a local Git repository on `main` whose initial commit contains the verified public foundation, normalizes text consistently across platforms, excludes generated and machine-local files, and has no premature remote configured.

**Why this priority**: The initial public push should be reviewable, portable, and free from local artifacts or accidental secrets.

**Independent Test**: Initialize Git after generation, inspect ignored and tracked files, verify attributes and line endings, run secret-sensitive filename checks, create the initial commit, and confirm the repository is clean on `main` with no remote.

**Acceptance Scenarios**:

1. **Given** the completed scaffold, **When** Git is initialized, **Then** the default branch is `main` and no remote repository is created or configured.
2. **Given** the staged initial tree, **When** ignore and attribute rules are inspected, **Then** dependencies, build outputs, credentials, local IDE state, Spec Kit's active pointer, and platform artifacts are excluded while durable specifications and source are included.
3. **Given** all required checks pass, **When** the initial commit is created, **Then** the working tree is clean and the commit contains only UTF-8, public-ready project files and explicitly classified binary assets.

### Edge Cases

- A missing platform SDK produces a precise doctor result while shared checks remain runnable.
- A future repository badge returns an unavailable state before the public repository exists; the badge URL itself still targets the final organization path and requires no README edit after publication.
- The absence of approved brand artwork does not cause a placeholder logo or temporary icon to be presented as final branding.
- Generated Android or Tauri files are committed only when reproducible and required by the platform scaffold; caches, signing data, local SDK paths, and build output remain ignored.
- Git user identity is not invented or modified by the scaffold; an existing configured identity is used for the initial commit, otherwise commit creation stops with a clear instruction.
- Workflow files never publish v0.0.0 application binaries or bypass the documentation, version, license, and platform gates.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The repository MUST contain the planned native workspace, shared application, permissioned host boundary, Android host scaffold, cross-platform task runner, documentation, fixture, script, and Spec Kit directory structure without implementing document-viewer features outside this slice.
- **FR-002**: Rust, Node.js, package-manager, JavaScript dependency, Tauri, and product versions MUST be pinned through machine-readable authorities and committed lockfiles.
- **FR-003**: The initial application MUST compile and display a minimal, accessible, content-first foundation surface that accurately identifies the product version and current non-release status.
- **FR-004**: One aggregate local command MUST run required formatting, linting, type checking, tests, builds, documentation validation, and version-consistency checks while preserving each failing exit status.
- **FR-005**: The contributor doctor command MUST report required and optional tools, exact observed versions, platform-specific prerequisites, and actionable failures without installing operating-system packages or changing global configuration.
- **FR-006**: `README.md` MUST be ready for public rendering and contain standard project badges, concise positioning, honest status, planned capabilities, target platforms, architecture, quick start, development commands, documentation links, security, contribution, license, and authorship/organization fields.
- **FR-007**: Public prose MUST not mention prior projects, prior websites, migration history, temporary branding, or unsupported application behavior.
- **FR-008**: Markdown prose MUST remain one physical line per paragraph, and formatting configuration MUST disable prose wrapping and Markdown line-length enforcement.
- **FR-009**: `.gitattributes` MUST normalize repository text to LF, preserve required Windows script endings, mark generated and vendored files where applicable, and explicitly classify common application, document, font, archive, installer, and mobile binary formats.
- **FR-010**: `.gitignore` and tool ignore configuration MUST exclude dependencies, build output, generated caches, local environments, signing material, secrets, IDE state, diagnostics, local Spec Kit pointers, and platform-specific transient files without hiding durable source or specifications.
- **FR-011**: GitHub pull-request CI MUST contain documentation and shared-code gates plus one always-reporting aggregate status intended for branch protection.
- **FR-012**: GitHub release automation MUST be tag-driven, verify version and documentation consistency before build fan-out, and refuse publication when required release evidence or platform artifacts are absent.
- **FR-013**: Repository metadata MUST include pull-request and issue templates, ownership, security reporting guidance, contribution guidance, a code of conduct, dependency-update configuration, funding opt-out or omission, and standard community-health links.
- **FR-014**: Workflow dependencies and permissions MUST be minimal, explicit, and pinned to reviewed major or immutable references consistent with organization conventions.
- **FR-015**: The repository MUST remain Apache-2.0, include LICENSE and NOTICE, declare package licenses, and provide dependency-policy configuration compatible with the technical specification.
- **FR-016**: The local Git repository MUST be initialized only after scaffold validation, use `main` as its initial branch, contain one initial commit using the maintainer's existing Git identity, have a clean working tree, and have no remote configured.
- **FR-017**: No secret, credential, signing key, private document, local absolute path, dependency directory, build output, or temporary validation artifact MAY enter the initial commit.
- **FR-018**: The public repository path MUST be treated as `ShruggieTech/glitchpad` in badges and metadata while repository creation, remote configuration, push, branch protection, and organization settings remain outside this feature.
- **FR-019**: Every scaffold file MUST use UTF-8 without BOM and pass mojibake detection before the initial commit.
- **FR-020**: This feature MUST produce and complete an implementation task list, cross-artifact analysis, and post-implementation convergence check through the installed Spec Kit workflow.

### Key Entities

- **Workspace manifest set**: The versioned Rust, JavaScript, Android, Tauri, documentation, and lockfile authorities that define reproducible builds.
- **Repository public surface**: README, community-health documents, badges, metadata, and links visible before a contributor opens source files.
- **Verification gate**: A local or hosted check with a stable name, command, exit-status contract, and required evidence.
- **Initial Git snapshot**: The first committed tree on `main`, including tracked files, ignored classes, attribute rules, commit identity, and remote absence.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The README contains zero placeholder markers, broken internal links, stale capability claims, hard-wrapped prose paragraphs, or references to superseded project history.
- **SC-002**: A frozen dependency installation produces zero lockfile changes, and the aggregate local check completes every required gate with exit code 0 on the foundation workstation.
- **SC-003**: The native workspace, shared-application production bundle, desktop development binary, and generated Android project reach their documented scaffold verification point without implementing a viewer feature.
- **SC-004**: CI configuration exposes exactly one documented aggregate branch-protection check and every required job is included in its result evaluation.
- **SC-005**: All committed text files decode as strict UTF-8 without BOM, all project-authored Mermaid diagrams render top-to-bottom, and formatting, Markdown, link, workflow, JSON, TOML, and YAML validation report zero errors.
- **SC-006**: The initial Git commit is on `main`, `git status --short` is empty afterward, `git remote` returns no configured remote, and secret/artifact inspection reports zero prohibited files.
- **SC-007**: Every functional requirement maps to at least one implementation task before implementation begins, with zero critical cross-artifact analysis findings.
- **SC-008**: A public-repository readiness review marks README, license, security, contribution, code-of-conduct, templates, ownership, dependency updates, CI, release workflow, attributes, ignores, and version authorities present and internally consistent.

## Assumptions

- The future GitHub repository path is `https://github.com/ShruggieTech/glitchpad`, but this feature does not create it or contact GitHub with write authority.
- The existing v0.0.0 technical specification and Apache-2.0 license remain authoritative.
- Approved final brand artwork is a separate required deliverable. This foundation uses typography and neutral CSS only and does not invent a temporary public logo.
- The initial commit uses the maintainer's existing local Git identity and does not change global or repository identity configuration.
- CI begins with the shared foundation gates and structurally valid platform jobs; signing and store credentials are not required for ordinary pull requests.
