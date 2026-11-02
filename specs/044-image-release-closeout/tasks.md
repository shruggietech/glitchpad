# Tasks: S044 Image Release Convergence and Closeout

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [qualification contract](contracts/qualification.md).

**Tests**: Required for sampler/diagnostic behavior; preserve source/security/resource assertions. Write focused failures before implementation.

## Phase 1: Setup

- [x] T001 Bind branch/directory/selector S044 and assess live issues in `spec.md` (FR-001/FR-010).
- [x] T002 Execute installed specify/clarify/checklist/plan, resolve templates and research in `research.md` (FR-003/FR-009/FR-010).

## Phase 2: Foundation

- [x] T003 Run read-only cross-artifact analyze and record coverage in `analysis.md` before implementation (FR-001 through FR-010).
- [x] T004 Prepare reusable hidden Linux validation environment from `scripts/docker/validation.Dockerfile` and synchronize source (FR-010).

## Phase 3: US1 - Dependency convergence

**Goal**: One consistent selected dependency graph.

**Independent test**: Lock consistency, original SVG/source regressions, advisory/license gates and affected native contracts pass.

- [x] T005 [US1] Integrate #240 Cargo changes in `Cargo.toml`/`Cargo.lock`, reconcile `fuzz/Cargo.lock` (FR-001/FR-002).
- [x] T006 [US1] Select application patch fixes from #226 in workspace `package.json` files and `pnpm-lock.yaml`; record full dispositions in `verification.md` (FR-001).
- [x] T007 [US1] Run SVG/hostile/fuzz-lock/advisory/license checks and update notices/SBOM inputs as required in `packaging/*/THIRD_PARTY_NOTICES.txt` (FR-002/FR-007).

## Phase 4: US2 - Native startup evidence

**Goal**: Retained, comparable measurements and bounded readiness diagnostics.

**Independent test**: Failure injections retain all attempts, cleanup processes and exclude private values; both Mac architecture campaigns complete with unchanged budgets.

- [x] T008 [US2] Write failing sampler/paired-order/failure-retention tests in `scripts/macos/startup-sampler.test.mjs` (FR-003/FR-004/FR-005).
- [x] T009 [US2] Implement reusable sampler and lifecycle integration in `scripts/macos/startup-sampler.mjs`/`test-package-lifecycle.mjs` (FR-004/FR-005).
- [x] T010 [US2] Implement exact published-baseline comparison and always-upload evidence in `scripts/macos/compare-startup.mjs`/`.github/workflows/macos-package.yml` (FR-003/FR-008).
- [x] T011 [P] [US2] Add tested content-free portable startup diagnostics in `scripts/windows/test-portable-lifecycle.ps1` and diagnostic helper/tests (FR-006).
- [x] T012 [P] [US2] Add tested bounded callback diagnostics in `BrandBuilderAppFrameInstrumentedTest.kt` and Android policy tests (FR-006).
- [ ] T013 [US2] Qualify both Mac architectures, Windows and Android observations; record #239/#66 dispositions in `verification.md` (FR-003/FR-008).

## Phase 5: US3 - Exact candidate handoff

**Goal**: Final-head official PR and package readback, with owner publication boundary explicit.

**Independent test**: Eight final package bytes match manifests and receipts; all applicable checks/review threads complete.

- [x] T014 [US3] Update `docs/releases/v0.2.0-operator-runbook.md`, release candidate receipt and `changelog.d/` with S044 decisions and pending publication states (FR-007/FR-009).
- [x] T015 [US3] Run aggregate and affected package/documentation/security checks; retain actual exits in `verification.md` (FR-002/FR-007/FR-010).
- [ ] T016 [US3] Commit, push and publish official PR; monitor CI and at most two review rounds, resolving every comment/thread in `verification.md` (FR-010).
- [ ] T017 [US3] Read back all eight final-head packages and bind checks, source, digests, provenance and issue dispositions in `.tmp/s044-candidate-handoff.json` and its PR conversation receipt (FR-007/FR-008/FR-009).

## Phase 6: Convergence

- [ ] T018 Complete installed convergence and final cross-artifact analysis; report final owner review/merge readiness from `verification.md` (FR-001 through FR-010).

## Dependencies and Execution Order

T001-T004 precede implementation. US1 and US2 can be verified independently; US3 qualifies their combined final source. Sampler tests precede helper, lifecycle and workflow changes. T011/T012 touch separate platform files and may run in parallel after foundation. Both Mac campaigns and all final CI checks are required before T017/T018 handoff. Publication-only criteria are outside task completion and remain open in #76/#10.

## Parallel Examples

- US1: evaluate Cargo and npm disposition inventories independently; integrate locked graph changes sequentially.
- US2: T011 Windows and T012 Android diagnostic work can proceed independently; Mac helper/lifecycle changes share files and remain sequential.
- US3: independent hosted architecture/package jobs run concurrently; source mutation and final readback remain sequential.

## Implementation Strategy

Deliver and verify US1 graph convergence first, then sampler fixes and native diagnostics, then qualify the combined candidate. No intermediate phase substitutes for final native/package evidence. Keep the official PR open for owner merge and do not publish a release during this slice.
