# Tasks: v0.1.0 Community Release

**Input**: Design documents from `/specs/023-community-release/`

## Phase 1: Release foundation

- [x] T001 Create `packaging/release/package-contract.json` with the exact v0.1.0 inventory and trust vocabulary
- [x] T002 [P] Add cross-platform release-policy tests in `scripts/check-community-release.test.mjs`
- [x] T003 Implement the release-policy validator in `scripts/check-community-release.mjs` and register it in `package.json`

## Phase 2: User Story 1 - Assemble a truthful community release (P1)

**Goal**: Produce a version-aligned four-platform artifact set without paid Windows or Apple credentials.

**Independent Test**: Run all platform package contract suites plus the aggregate community-release validator.

- [x] T004 [US1] Update Windows package contract, validator, tests, and README for `unsigned_community`
- [x] T005 [US1] Update macOS package contract, validator, tests, and README for `adhoc_non_notarized_community`
- [x] T006 [P] [US1] Preserve and cross-check Linux repository-attested authority in `packaging/linux/`
- [x] T007 [P] [US1] Preserve Android stable-key official authority and document secret provisioning in `packaging/android/`
- [x] T008 [US1] Synchronize all product, application, native-host, specification, and fallback versions at 0.1.0

## Phase 3: User Story 2 - Understand trust and installation limits (P2)

**Goal**: Publish one consistent capability, privacy, support, and trust explanation.

**Independent Test**: Run documentation, version, and stale-claim validation and review the release note as a downloader.

- [x] T009 [US2] Reconcile `docs/glitchpad-technical-specification.md` and the release-gate contract with the community policy
- [x] T010 [US2] Assemble `CHANGELOG.md` from completed fragments and consume those fragments
- [x] T011 [US2] Create `docs/releases/v0.1.0.md` and `docs/releases/v0.1.0-receipt.md`
- [x] T012 [US2] Update README and public version surfaces for v0.1.0

## Phase 4: User Story 3 - Guarded post-merge publication (P3)

**Goal**: Publish only from the exact merged tag after every platform and aggregate gate succeeds.

**Independent Test**: Validate workflow structure and exercise readiness through non-publishing manual dispatch.

- [x] T013 [US3] Add official community modes and release outputs to the four platform package workflows
- [x] T014 [US3] Replace paid authority gates with a fail-closed aggregate publication transaction in `.github/workflows/release.yml`
- [x] T015 [US3] Extend `scripts/check-release-readiness.ps1` to validate repository, tag, inventory, release note, receipt, and Android authority prerequisites
- [x] T016 [US3] Add an operator runbook for stable Android key provisioning and the post-merge tag ritual

## Phase 5: Verification and closure

- [x] T017 Run focused aggregate and platform contract suites in the hidden validation container
- [x] T018 Run `cargo xtask check` in the hidden validation container and correct every failure
- [x] T019 Verify UTF-8 without BOM and scan changed text for mojibake
- [x] T020 Complete Spec Kit convergence and analysis, update this task list, and record the final local verification receipt
