# Tasks: Brand Kit Refresh

**Input**: Design documents from `specs/025-brand-kit-refresh/`

## Phase 1: Source and Authority

- [x] T001 [US2] Record and verify the pinned upstream delivery in `brand/INTEGRATION.md` and `specs/025-brand-kit-refresh/verification.md`
- [x] T002 [US2] Replace the complete governed delivery under `brand/` with the verified Glitchpad 1.1.0 artifact

## Phase 2: Product Integrations

- [x] T003 [US1] Refresh README and public-site brand copies under `README.md` and `site/public/`
- [x] T004 [US1] Replace Windows, macOS, and Linux packaging icons under `crates/glitchpad-host/icons/`
- [x] T005 [US1] Replace Android launcher inputs and generated resources under `crates/glitchpad-host/icons/android/` and `crates/glitchpad-host/gen/android/app/src/main/res/`

## Phase 3: Enforcement and Accessibility

- [x] T006 [US2] Update brand delivery and integration validation in `scripts/check-brand.mjs` and `scripts/check-brand.test.mjs`
- [x] T007 [US3] Verify theme, accessibility, package, and stale-placeholder behavior across existing test suites

## Phase 4: Completion

- [x] T008 Run focused validation and record results in `specs/025-brand-kit-refresh/verification.md`
- [x] T009 Run `cargo xtask check`, reconcile the implementation against this specification, and prepare the reviewed change for delivery

## Dependencies & Execution Order

T001 and T002 establish authority. T003 through T005 consume that delivery. T006 enforces the final mappings. T007 through T009 validate the integrated result.

## Independent Test Criteria

- **US1**: Every visible and packaged identity is an exact approved asset.
- **US2**: Manifest, provenance, and copy mappings fail closed on drift.
- **US3**: Existing theme and accessibility checks remain green.

## Implementation Strategy

Replace the canonical kit once, map only supplied derivatives, strengthen validation before changing claims, and complete the full pre-push gate before publication.
