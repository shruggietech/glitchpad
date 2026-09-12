# Tasks: Publish a Working v0.1.3 Corrective Release

**Input**: Design documents from `specs/038-v013-release-rescue/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Release identity, package lifecycle, practical-use evidence, and publication boundaries require test-first contract coverage because they govern official package claims.

**Organization**: Tasks are grouped by user story and executed sequentially where active release authorities overlap.

## Phase 1: Setup and Baseline

**Purpose**: Establish immutable historical evidence and the exact active release surface before edits.

- [x] T001 Capture the v0.1.2 tag commit, release identity, publication timestamp, and fourteen-asset inventory in `specs/038-v013-release-rescue/verification.md`
- [x] T002 Confirm local and remote v0.1.3 tags and a v0.1.3 GitHub release are absent, then record the pull-request publication boundary in `specs/038-v013-release-rescue/verification.md`
- [x] T003 Inventory active 0.1.2 authorities versus frozen historical records and record the version-change map in `specs/038-v013-release-rescue/verification.md`

---

## Phase 2: Foundational Release Contracts

**Purpose**: Define failing guards for v0.1.3 lockstep and exact-package evidence before changing release authorities.

- [x] T004 Add failing v0.1.3 identity, immutable-history, and publication-boundary cases to `scripts/check-community-release.test.mjs` and `scripts/check-public-release.test.mjs`
- [x] T005 Add failing missing, mismatched, failed, and privacy-bearing practical-use receipt cases to `scripts/assemble-community-release.test.mjs`
- [x] T006 Run the focused red-phase release tests in the approved validation container and record expected failures in `specs/038-v013-release-rescue/verification.md`

**Checkpoint**: Tests reject the existing v0.1.2 active authorities and release assembly does not yet satisfy the v0.1.3 practical-use contract.

---

## Phase 3: User Story 1 - Install Glitchpad and Read Markdown (Priority: P1)

**Goal**: Produce v0.1.3 candidates whose exact Windows package lifecycles prove the primary Markdown workflow and recovery behavior.

**Independent Test**: Build both Windows package forms and require their lifecycle policies and hosted package jobs to prove clean launch, rendered Markdown through supported delivery paths, edit/save/preview, deterministic source-and-retry recovery, reserved shell geometry, termination, and cleanup.

- [x] T007 [US1] Advance active product, host, persistence, and Android version identities to 0.1.3 and Android version code 1003 in `Cargo.toml`, `Cargo.lock`, `package.json`, `pnpm-lock.yaml`, `apps/glitchpad/`, and `crates/glitchpad-host/`
- [x] T008 [US1] Advance Windows package names, package contracts, builder inputs, lifecycle targets, and policy expectations to v0.1.3 in `packaging/windows/`, `scripts/windows/`, `scripts/check-windows-package*`, and `.github/workflows/windows-package.yml`
- [x] T009 [US1] Require exact installer and portable receipts to retain S035 Markdown rendering, supported delivery, save/preview, recovery, governed scale, geometry, shutdown, and cleanup assertions in `scripts/windows/test-installer-lifecycle.ps1`, `scripts/windows/test-portable-lifecycle.ps1`, and `scripts/check-windows-package.mjs`
- [x] T010 [US1] Run focused Windows package policy and lifecycle parser checks in the approved validation container and record results in `specs/038-v013-release-rescue/verification.md`

**Checkpoint**: Both exact Windows candidate forms have a v0.1.3 identity and a release-blocking practical-use evidence contract.

---

## Phase 4: User Story 2 - Trust Every Published Package (Priority: P2)

**Goal**: Reconcile all four platform families and require complete package-bound evidence before release publication.

**Independent Test**: Assemble a synthetic complete release evidence set and prove missing, stale, wrong-source, wrong-digest, failed, duplicated, or privacy-bearing package evidence blocks promotion.

- [x] T011 [P] [US2] Advance macOS package names, contracts, lifecycle targets, and policy expectations to v0.1.3 in `packaging/macos/`, `scripts/macos/`, `scripts/check-macos-package*`, and `.github/workflows/macos-package.yml`
- [x] T012 [P] [US2] Advance Linux package names, contracts, lifecycle targets, and policy expectations to v0.1.3 in `packaging/linux/`, `scripts/linux/`, `scripts/check-linux-package*`, and `.github/workflows/linux-package.yml`
- [x] T013 [P] [US2] Advance Android package names, contracts, installed-package evidence, SBOM expectations, and workflow targets to v0.1.3 in `packaging/android/`, `scripts/android/`, `scripts/check-android-package*`, `scripts/generate-android-sbom.mjs`, and `.github/workflows/android-package.yml`
- [x] T014 [US2] Advance the aggregate package contract and require complete exact-source practical-use receipt classes during assembly in `packaging/release/package-contract.json`, `scripts/assemble-community-release.mjs`, and `scripts/promote-community-package.mjs`
- [x] T015 [US2] Make release-policy validation reject incomplete or inconsistent v0.1.3 practical-use evidence in `scripts/check-community-release.mjs`, `scripts/check-config.mjs`, and their test suites
- [x] T016 [US2] Run focused cross-platform package, assembly, promotion, configuration, and release-policy tests in the approved validation container and record results in `specs/038-v013-release-rescue/verification.md`

**Checkpoint**: The governed eight-package matrix cannot be represented as publishable without mutually consistent identity, integrity, trust, and practical-use evidence.

---

## Phase 5: User Story 3 - Publish a Truthful Immutable Corrective Release (Priority: P3)

**Goal**: Prepare synchronized v0.1.3 public authorities and an exact post-merge tag transaction without mutating v0.1.2.

**Independent Test**: Validate all active authorities as v0.1.3, all historical v0.1.2 documents as frozen, the tag-triggered workflow as exact and non-replacing, and the pre-merge absence of any v0.1.3 tag or release.

- [x] T017 [US3] Add v0.1.3 release notes, receipt, and owner operator runbook in `docs/releases/v0.1.3.md`, `docs/releases/v0.1.3-receipt.md`, and `docs/releases/v0.1.3-operator-runbook.md`
- [x] T018 [US3] Reconcile the 0.1.3 technical specification, changelog, README, support policy, security policy, package guidance, provenance authority, performance fixtures, and website content in `docs/glitchpad-technical-specification.md`, `CHANGELOG.md`, `README.md`, `SUPPORT.md`, `SECURITY.md`, `packaging/`, `fixtures/`, and `site/`
- [x] T019 [US3] Advance package and release workflow triggers, artifact handoffs, immutable creation guards, and release-authorized documentation deployment to exact v0.1.3 in `.github/workflows/` and `scripts/check-public-release.mjs`
- [x] T020 [US3] Extend public and community release validators so active v0.1.2 claims fail while frozen historical v0.1.2 records remain valid in `scripts/check-public-release.mjs`, `scripts/check-community-release.mjs`, and their tests
- [x] T021 [US3] Run focused public-surface, release-policy, documentation-generation, and publication-boundary checks in the approved validation container and record results in `specs/038-v013-release-rescue/verification.md`

**Checkpoint**: The repository is a reviewed v0.1.3 release candidate, but no v0.1.3 tag, GitHub release, or release-authorized deployment exists.

---

## Phase 6: Polish and Cross-Cutting Validation

**Purpose**: Complete repository evidence, integrity checks, and release handoff readiness.

- [x] T022 Verify ignore rules remain sufficient and no temporary package, evidence, secret, signing, or environment files are tracked in `.gitignore`, `.dockerignore`, `.prettierignore`, and applicable lint configuration
- [x] T023 Run formatting, linting, dependency, documentation, package-policy, public-surface, release, encoding, mojibake, and `git diff --check` gates and record results in `specs/038-v013-release-rescue/verification.md`
- [x] T024 Run the complete `cargo xtask check` gate through `scripts/invoke-docker-hidden.ps1` and record its real exit result in `specs/038-v013-release-rescue/verification.md`
- [x] T025 Re-run the v0.1.2 immutable baseline comparison plus v0.1.3 tag/release absence checks and record the final pre-publication state in `specs/038-v013-release-rescue/verification.md`

---

## Phase 7: Automated Review Convergence

**Purpose**: Close every first-round review gap without weakening the publication boundary.

- [x] T026 Reorder Windows tag-manifest promotion ahead of practical-use receipt generation and enforce the ordering in `.github/workflows/windows-package.yml`, `scripts/check-windows-package.mjs`, and `scripts/check-windows-package.test.mjs`
- [x] T027 Add a fixed, opt-in, content-free lifecycle probe that drives a real packaged Markdown failure through contained source recovery and successful preview retry in `crates/glitchpad-host/src/lifecycle_probe.rs`, `apps/glitchpad/src/`, and `scripts/windows/test-*-lifecycle.ps1`
- [x] T028 Emit and consume exact-manifest-bound geometry evidence for each governed 100, 125, 150, and 200 percent display scale in `scripts/check-shell-layout.mjs`, the Windows workflow, package contracts, and aggregate release validation
- [x] T029 Restrict Pages upload and deployment to the exact release-authorized reusable-workflow input and update public-release policy, release documentation, and the explicit S037 deviation record in `.github/workflows/docs.yml`, `scripts/check-public-release*`, `scripts/check-config.mjs`, `site/README.md`, `docs/releases/`, and `specs/038-v013-release-rescue/`
- [x] T030 Re-run focused review-remediation checks, the complete `cargo xtask check` gate, encoding and diff-integrity checks, and frozen-release checks, then record the local evidence in `specs/038-v013-release-rescue/verification.md`

---

## Phase 8: Second-Round Review and CI Convergence

**Purpose**: Address the final permitted review round and observed Windows runner failure without another review trigger.

- [x] T031 Split Windows candidate and official final-byte validation so tag-promoted manifests use `--official --artifact-root artifacts/windows`, and require that contract in `.github/workflows/windows-package.yml`, `scripts/check-windows-package.mjs`, and `scripts/check-windows-package.test.mjs`
- [x] T032 Replace the skippable default-branch freshness check with exact published-release/tag-commit authorization and provide a guarded manual site retry in `.github/workflows/docs.yml`, `scripts/check-public-release*`, `scripts/check-config.mjs`, `site/README.md`, and the v0.1.3 handoff documentation
- [x] T033 Install the pinned Puppeteer headless-shell browser before the Windows scale proof and add a policy regression that rejects omission in `.github/workflows/windows-package.yml`, `scripts/check-windows-package.mjs`, and `scripts/check-windows-package.test.mjs`
- [x] T034 Run focused workflow, release-policy, Windows-package, documentation, formatting, encoding, and diff-integrity checks after second-round convergence and record the local evidence in `specs/038-v013-release-rescue/verification.md`
- [x] T035 Replace strict nested member access for Windows scale receipts with explicit schema extraction and require the portable lifecycle contract in `scripts/windows/test-portable-lifecycle.ps1`, `scripts/check-windows-package.mjs`, and `scripts/check-windows-package.test.mjs`
- [x] T036 Eliminate runner-version-sensitive PowerShell JSON projection for every Windows receipt value through typed `System.Text.Json` property reads and add regressions that reject removing exact schema access
- [x] T037 Fall back from a failing advertised UI Automation Invoke pattern to the governed focused clickable-point path for Windows buttons and menu commands, and enforce the fallback in package policy
- [x] T038 Fall back from absent UI Automation clickable points to the center of validated visible element bounds and enforce the geometry path in package policy

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 establishes the immutable and absent-release baselines.
- Phase 2 depends on Phase 1 and must demonstrate red tests before implementation.
- User Story 1 depends on Phase 2 and establishes the primary practical-use contract.
- User Story 2 depends on User Story 1 because aggregate evidence consumes the Windows receipt contract; macOS, Linux, and Android identity work marked `[P]` may proceed independently.
- User Story 3 depends on the final package inventory and evidence model from User Story 2.
- Phase 6 depends on all three user stories.
- Phase 7 is append-only review convergence and depends on the first automated review of the published pull request.
- Phase 8 is append-only convergence for the single permitted second automated review and the first updated-commit CI result.

### User Story Dependencies

- **User Story 1**: Delivers the minimum corrective-release value independently through Windows exact-package evidence.
- **User Story 2**: Extends that evidence contract across the complete governed release inventory.
- **User Story 3**: Publishes synchronized release authorities and therefore depends on the inventory established by User Story 2.

### Parallel Opportunities

- T011, T012, and T013 affect independent platform contracts and workflows after shared identity rules are established.
- Focused platform policy suites may run concurrently inside one approved validation session when they do not contend for generated output.
- Documentation prose files may be drafted independently, but active version authorities must be reconciled serially before validation.

## Implementation Strategy

### MVP First

Complete the baseline, red tests, active product identity, and Windows exact-package contract first. If that primary flow cannot be proven from final package bytes, stop the release work rather than advancing public claims.

### Incremental Delivery

1. Establish immutable history and absent v0.1.3 authority.
2. Make the practical-use release tests fail against the existing state.
3. Establish exact Windows package usability.
4. Reconcile macOS, Linux, Android, and aggregate release evidence.
5. Advance public authorities and the post-merge release transaction.
6. Run complete validation and preserve the no-publication boundary.

## Notes

- Historical `docs/releases/v0.1.2*` and prior Spec Kit artifacts are read-only evidence.
- No task creates or pushes `v0.1.3`; publication begins only after the owner merges the reviewed pull request.
- Issue #66 receives focused evidence but remains open unless separately proven complete.
- Image issue #68 and all later format work remain outside S038.
