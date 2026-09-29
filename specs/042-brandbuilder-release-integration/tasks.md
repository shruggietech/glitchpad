# Tasks: BrandBuilder Release Integration

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [brand-delivery.md](contracts/brand-delivery.md)

**Tests**: Required by issues #202-#204 and the S042 verification gate. Write focused regression checks before implementation and record any local execution constraint.

## Phase 1: Setup

- [x] T001 Confirm v2.0.3 release archive checksum and stage its complete contents outside `brand/`; record source evidence in `specs/042-brandbuilder-release-integration/verification.md`
- [x] T002 Inspect existing integration, CI, and package maps and record exact changed and unchanged surfaces in `specs/042-brandbuilder-release-integration/verification.md`

## Phase 2: Foundational Contract

- [x] T003 Run the Spec Kit analyze gate across `spec.md`, `plan.md`, and `tasks.md`; resolve critical or high findings before code changes and record the result in `specs/042-brandbuilder-release-integration/verification.md`
- [x] T004 Add failing release identity, missing-file, unsafe-path, and receipt regression cases in `scripts/check-brand.test.mjs` and a focused sync-script test
- [x] T005 Update `scripts/sync-brand-kit.mjs` to verify the formal complete release and write an exact release receipt without prior-kit recovery

## Phase 3: User Story 1 - Trust one released kit (P1, issue #202)

**Goal**: One complete release-backed governed kit and recoverable provenance.

**Independent Test**: Import from the staged archive and compare every governed file, receipt, and recovery digest with the release.

- [x] T006 [US1] Import the complete kit into `brand/`, apply the one documented README link correction, and refresh root `AGENTS.md`
- [x] T007 [US1] Validate `brand/INTEGRATION.json`, `brand/INTEGRATION.md`, `brand/manifest.json`, and bundled BrandBuilder 2.0.3 recovery against the formal release

## Phase 4: User Story 2 - Correct platform artwork (P2, issue #203)

**Goal**: Every existing consumer uses the released role-specific source assets.

**Independent Test**: Compare site and package inputs byte-for-byte with mapped kit files and inspect all four public web icon roles.

- [x] T008 [US2] Add failing ordinary/maskable web role and asset-presence cases in `site/tests/content-contract.test.mjs` and `scripts/check-brand.test.mjs`
- [x] T009 [US2] Update `scripts/sync-brand-kit.mjs` and `scripts/check-brand.mjs` mappings for the released web manifest and maskable icons
- [x] T010 [US2] Repin `site/public/`, `apps/glitchpad/public/`, and `crates/glitchpad-host/icons/` plus generated Android resources from the released kit
- [x] T011 [US2] Confirm Windows, macOS, Linux, Android, and existing AppFrame consumer boundaries in `specs/042-brandbuilder-release-integration/verification.md`

## Phase 5: User Story 3 - Detect drift (P3, issue #204)

**Goal**: Checks and guidance preserve the release identity and consumer mapping.

**Independent Test**: Focused regressions reject stale version, recovery, legal-link, manifest, and platform-role fixtures; committed guidance reproduces results.

- [x] T012 [US3] Extend `scripts/check-brand.mjs` and `scripts/check-brand.test.mjs` for complete release receipt, contract, recovery, inventory, license, and platform-role validation
- [x] T013 [US3] Update `brand/INTEGRATION.md`, a `changelog.d` fragment, and S042 `specs/042-brandbuilder-release-integration/verification.md` with issue mapping, dated decisions, migration effects, and checks

## Phase 6: Validation and PR

- [x] T014 Run focused brand, site, Android, desktop, encoding, and aggregate validation through the approved Linux environment where available; record real exit results in `specs/042-brandbuilder-release-integration/verification.md` (Node/Rust and full BrandBuilder verification await CI because the local approved toolchain is incomplete)
- [x] T015 Commit S042, push `codex/042-brandbuilder-release-integration`, and open one PR closing #202, #203, and #204
- [ ] T016 Resolve CI and first Codex review findings, request at most one additional Codex review round after all first-round threads close, then resolve second-round findings and return for merge approval after CI is green

## Dependencies

T001 and T002 precede analysis. T003 blocks implementation. T004 must be authored before T005. T006 and T007 depend on T005. T008 precedes T009 and T010; platform work depends on the imported kit. T012 and T013 follow the complete import and consumer mapping. T014 gates T015. T016 follows PR publication. Each issue remains individually traceable within the shared S042 PR.

## Implementation Strategy

First establish the complete release boundary and receipt (#202), then map direct platform consumers (#203), then finish drift enforcement and documentation (#204). The first two outcomes can be inspected independently, while the final CI and review gate covers their combined delivery.
