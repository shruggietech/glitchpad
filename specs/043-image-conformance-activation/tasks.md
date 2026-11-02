# Tasks: S043 Image Conformance and Activation

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [qualification.md](contracts/qualification.md).

**Tests**: Required. Add focused regressions before activation and evidence-policy implementation; never suppress failing security, source-integrity or resource checks.

## Phase 1: Setup

- [x] T001 Inspect active issues, current branch/version and hidden launchers; bind S043 in `spec.md` (FR-001, FR-011).
- [x] T002 Execute specify/clarify/checklist and mandated research in `research.md`; record owner-amended evidence policy in `plan.md` (FR-005, FR-012).
- [x] T003 Resolve installed templates and run Spec Kit setup/prerequisites through hidden Docker; persist `.specify/feature.json` for S043 (FR-010).

## Phase 2: Foundation

- [x] T004 Perform read-only cross-artifact analyze and resolve blocking findings before code changes; record in `analysis.md` (FR-001 through FR-012).
- [x] T005 Build the repository validation image with development fuzz tooling in `scripts/docker/validation.Dockerfile`; prepare reusable native Linux checkout/cache (FR-002, FR-010).

## Phase 3: US1 - Qualification

**Goal**: One truthful core/image conformance result with new fuzz/resource evidence.

**Independent test**: All 23 core rows and included issue criteria have classified current outcomes; hostile inputs remain bounded and non-executable.

- [x] T006 [US1] Add bounded core/image fuzz harnesses and regression corpus under `fuzz/`, covering detection/metadata/family/entry/export output limits (FR-002, FR-007; US1/AC2).
- [x] T007 [US1] Add measured native image latency/process-memory and suspended-surface qualification through `crates/glitchpad-core/tests/`, `fixtures/` and existing frontend tests (FR-003, FR-004; US1/AC2, AC3).
- [x] T008 [US1] Integrate fuzz/resource/native evidence and retained artifacts into `.github/workflows/ci.yml` with no desktop focus exposure (FR-002 through FR-004; US1/AC1).
- [x] T009 [US1] Create the 23-row core/issue acceptance map and current qualification results in `verification.md` (FR-001, FR-005, FR-012; SC-001).

## Phase 4: US2 - Stable Image Entry Points

**Goal**: Exact image families through native chooser/associations/intents.

**Independent test**: All ten image extensions and declared MIME aliases agree across native entry points; unsupported formats stay excluded.

- [x] T010 [US2] Add failing activation/role/native delivery regressions in existing desktop and package tests (FR-006, FR-007; US2/AC1, AC2).
- [x] T011 [US2] Activate the full image matrix in `packaging/desktop/capabilities.json`, Tauri overlays, Linux MIME/desktop declarations, Windows association hooks and macOS contract (FR-006; SC-003).
- [x] T012 [US2] Update native chooser/admission and Android intent/resolver declarations in `crates/glitchpad-host/` and `packaging/android/` (FR-006, FR-007; US2/AC1 through AC3).

## Phase 5: US3 - v0.2.0 Candidate

**Goal**: Complete consistent release candidate and honest evidence policy.

**Independent test**: v0.2.0 candidate identities agree while published v0.1.4 links/provenance remain accurate.

- [x] T013 [US3] Add failing evidence-policy and version/public-release regression cases in `scripts/` and `site/tests/` (FR-005, FR-008, FR-009).
- [x] T014 [US3] Synchronize product/package/workflow candidate versions and amend active physical/manual gates in `docs/`, package contracts and validators (FR-005, FR-008, FR-009; US3/AC1).
- [x] T015 [US3] Complete release documentation pass, canonical site generation, notices and changelog in `docs/releases/`, `site/` and `changelog.d/` (FR-008, FR-009; US3/AC1).
- [x] T016 [US3] Run focused and aggregate checks, record true results and repair failures in `verification.md` (FR-010; SC-002 through SC-004).

## Phase 6: Delivery and Review

- [x] T017 Perform convergence against all requirements, scenarios and decisions; append remaining work only to `tasks.md` (FR-010, FR-012).
- [ ] T018 Commit, automatically push and publish one official S043 PR; record its URL and head in `verification.md` (FR-011).
- [ ] T019 Resolve every first-round CI/review result and record the external review ledger in `verification.md` (FR-010, FR-011).
- [ ] T020 Request at most one explicit follow-up review, address/resolve every finding, and verify terminal current-head platform/package/security checks in `verification.md` (FR-010, FR-011).
- [ ] T021 Record issue-level completion and remaining release-only obligations; deliver the unmerged PR for owner merge ritual in `verification.md` (FR-012; SC-005).

## Dependencies and Execution Order

Setup and blocking analysis precede implementation. Qualification establishes candidate evidence before stable-release claims. Native activation and release-version updates share validators and must be integrated sequentially. Local verification precedes push, hosted evidence and external review. Final review receipt must itself complete applicable head checks.

## Parallel Opportunities

Research was delegated under the installed plan skill. Native corpus tests, frontend tests and documentation checks can run independently after their shared inputs stabilize. The existing hosted three-desktop and API24/API36 jobs execute in parallel. Shared package/version/claim files are edited sequentially.

## Implementation Strategy

Retain the existing image engines and core source lifecycle. Add missing qualification, then complete coherent activation and release candidate preparation. Validate each story before aggregate verification and publication. No merge, tag or official release is authorized by these tasks.

## Phase 7: Convergence

- [x] T022 Exclude exact vendored upstream prose from project link checks while retaining local provenance validation in `scripts/check-links.mjs` and its regression (FR-010, partial).
- [x] T023 Replace obsolete deferred physical/TalkBack wording in `packaging/android/README.md` with the owner-amended unavailable/not-required policy (FR-005, partial).

T022/T023 are convergence prerequisites to T018 publication; the appended placement preserves the installed convergence command's task-history contract.
