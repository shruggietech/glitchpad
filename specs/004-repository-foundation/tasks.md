# Tasks: Repository Foundation

**Input**: Design documents from `specs/004-repository-foundation/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

## Phase 1: Setup

**Purpose**: Establish repository-wide structure and immutable authorities.

- [x] T001 Create the planned directory skeleton and version authorities in `Cargo.toml`, `rust-toolchain.toml`, `.node-version`, `package.json`, and `pnpm-workspace.yaml`
- [x] T002 [P] Add cross-platform text, binary, ignore, and editor rules in `.gitattributes`, `.gitignore`, `.editorconfig`, `.prettierignore`, `.prettierrc.json`, and `.markdownlint.jsonc`
- [x] T003 [P] Add repository development metadata in `deny.toml`, `rustfmt.toml`, and `.github/labeler.yml`

## Phase 2: Foundational Workspace

**Purpose**: Create the buildable native, shared application, host, mobile, and verification foundation that blocks all public-surface stories.

- [x] T004 [P] Create the platform-independent native crate and unit tests in `crates/glitchpad-core/Cargo.toml` and `crates/glitchpad-core/src/lib.rs`
- [x] T005 [P] Create the shared application package and compiler/test/lint configuration in `apps/glitchpad/package.json`, `apps/glitchpad/tsconfig.json`, `apps/glitchpad/vite.config.ts`, `apps/glitchpad/vitest.config.ts`, and `apps/glitchpad/eslint.config.js`
- [x] T006 Create the deny-by-default Tauri desktop/mobile host in `crates/glitchpad-host/Cargo.toml`, `crates/glitchpad-host/build.rs`, `crates/glitchpad-host/src/`, `crates/glitchpad-host/capabilities/default.json`, and `crates/glitchpad-host/tauri.conf.json`
- [x] T007 Create the cross-platform command surface and command tests in `crates/xtask/Cargo.toml` and `crates/xtask/src/main.rs`
- [x] T008 Generate and commit reproducible dependency authorities in `Cargo.lock` and `pnpm-lock.yaml`
- [x] T009 Generate the Tauri Android host under `crates/glitchpad-host/gen/android/` and verify that local SDK paths, caches, signing data, and build output remain excluded

**Checkpoint**: Workspace manifests, host boundaries, and generated platform scaffolding are reproducible.

## Phase 3: User Story 1 - Public repository landing page (Priority: P1) 🎯 MVP

**Goal**: Present a complete and honest public repository surface.

**Independent Test**: Render and lint the README, validate badges/links/status against v0.0.0, and confirm no placeholders, historical references, or unsupported claims remain.

- [x] T010 [P] [US1] Add public-surface validation assertions to `scripts/check-public-surface.ps1`
- [x] T011 [US1] Write the centered badge header, project positioning, status, roadmap, platforms, architecture, quick start, development, security, contribution, license, and author sections in `README.md`
- [x] T012 [P] [US1] Add release-history and fragment policy in `CHANGELOG.md`, `changelog.d/README.md`, and `changelog.d/.gitkeep`
- [x] T013 [P] [US1] Add community documents in `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and `SUPPORT.md`

**Checkpoint**: The repository landing page and community documents are public-ready without application-release claims.

## Phase 4: User Story 2 - Bootstrap and verify the scaffold (Priority: P1)

**Goal**: Make the foundation runnable and verifiable from committed authorities.

**Independent Test**: Perform a frozen install, run `cargo xtask doctor` and `cargo xtask check`, then start the desktop foundation shell.

- [x] T014 [P] [US2] Add foundation-shell component tests in `apps/glitchpad/src/App.test.tsx` and `apps/glitchpad/src/test/setup.ts`
- [x] T015 [US2] Implement the accessible neutral foundation shell in `apps/glitchpad/index.html`, `apps/glitchpad/src/main.tsx`, `apps/glitchpad/src/App.tsx`, and `apps/glitchpad/src/styles.css`
- [x] T016 [P] [US2] Add version-consistency and strict UTF-8 validation in `scripts/check-version.ps1` and `scripts/check-encoding.ps1`
- [x] T017 [US2] Wire thin root package commands to frontend, documentation, Tauri, and `xtask` checks in `package.json`
- [x] T018 [US2] Document pinned contributor setup and aggregate verification in `CONTRIBUTING.md` and `specs/004-repository-foundation/quickstart.md`

**Checkpoint**: Shared contributor bootstrap and verification complete from a clean lockfile state.

## Phase 5: User Story 3 - Repository automation (Priority: P1)

**Goal**: Provide review, security, dependency, and release-readiness automation from the first pull request.

**Independent Test**: Parse all workflow and metadata files, execute their local command equivalents, and verify that `ci-ok` includes every required job result.

- [x] T019 [P] [US3] Add pull-request/manual/nightly documentation, shared, dependency-review, and aggregate jobs in `.github/workflows/ci.yml`
- [x] T020 [P] [US3] Add scheduled and pull-request CodeQL analysis with minimal permissions in `.github/workflows/codeql.yml`
- [x] T021 [P] [US3] Add tag-driven version/documentation/license/platform readiness gates in `.github/workflows/release.yml`
- [x] T022 [P] [US3] Add ownership, pull-request, issue, config, and dependency-update metadata in `.github/CODEOWNERS`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/`, `.github/dependabot.yml`, and `.github/labeler.yml`
- [x] T023 [US3] Add workflow/public-metadata checks to `scripts/check-public-surface.ps1` and the `cargo xtask docs` gate

**Checkpoint**: One `ci-ok` status is ready for future branch protection and release publication remains fail-closed.

## Phase 6: User Story 4 - Clean local Git baseline (Priority: P2)

**Goal**: Prepare the exact first local snapshot and then initialize one clean commit on `main` without a remote.

**Independent Test**: Inspect ignored/tracked candidates and attributes, run prohibited-file checks, initialize Git, create the commit with the existing identity, and verify branch/status/remotes/history.

- [x] T024 [P] [US4] Add staged-tree, prohibited-file, secret-name, active-pointer, and remote-absence checks in `scripts/check-git-baseline.ps1`
- [x] T025 [US4] Validate the intended initial snapshot against `.gitignore`, `.gitattributes`, `scripts/check-git-baseline.ps1`, and the repository contract before local Git initialization

**Checkpoint**: The verified tree is ready for the final local `git init -b main` and initial commit operation.

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: Close formatting, documentation, security, and consistency obligations before Git initialization.

- [x] T026 [P] Run Prettier, markdownlint, link, Mermaid-render/direction, YAML/JSON/TOML, UTF-8/BOM/mojibake, and public-surface validation across `README.md`, `.github/`, `docs/`, and `specs/`
- [x] T027 Run `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --all-features -- -D warnings`, and `cargo test --workspace --locked`
- [x] T028 Run frontend ESLint, TypeScript type checking, Vitest, and production Vite build through `apps/glitchpad/package.json`
- [x] T029 Run the complete `cargo xtask check` foreground gate and verify frozen installs leave `Cargo.lock` and `pnpm-lock.yaml` unchanged
- [x] T030 Complete public-readiness, initial-snapshot, and Spec Kit analysis evidence against `specs/004-repository-foundation/contracts/repository.md` and `specs/004-repository-foundation/contracts/verification.md`

## Phase 8: Git Finalization

**Purpose**: Create the requested local history only after every generated file and required gate is final.

- [x] T031 [US4] Initialize Git with `main`, stage the verified public tree, create the initial commit with the existing identity, and verify clean status plus remote absence against `scripts/check-git-baseline.ps1`

## Dependencies and Execution Order

- Phase 1 precedes Phase 2.
- Phase 2 blocks all user stories.
- US1 and US2 may proceed in parallel after Phase 2; US3 depends on the final commands established by US2.
- US4 snapshot validation depends on US1, US2, and US3.
- Phase 7 precedes Phase 8 Git initialization and the initial commit.

## Parallel Opportunities

- T002 and T003 affect independent configuration files.
- T004 and T005 may proceed in parallel before T006-T009 integrate them.
- T010, T012, and T013 are independent public-surface files before T011's final link review.
- T014 and T016 are independent test/check surfaces before T015-T018 finish integration.
- T019-T022 are separate workflow/metadata files before T023 aggregates their checks.

## Implementation Strategy

1. Establish machine-readable authorities and buildable workspace boundaries.
2. Complete the README/community surface and runnable foundation shell as co-equal P1 increments.
3. Wire hosted automation to the same local commands.
4. Verify every contract before initializing Git.
5. Run Spec Kit convergence, initialize local Git on `main`, create the initial commit, and confirm clean/no-remote state.
