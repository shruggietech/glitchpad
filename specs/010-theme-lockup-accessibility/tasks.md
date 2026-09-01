# Tasks: Theme-Aware Lockup Accessibility

**Input**: Design documents from `specs/010-theme-lockup-accessibility/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/theme-lockup.md, quickstart.md

**Tests**: Required by FR-003, FR-009, FR-010, FR-011, SC-005, and Constitution P6. Behavioral and structural regression tests are observed failing before their protected implementations.

**Organization**: Tasks are grouped by user story so README identity, public-site navigation, and durable regression protection retain issue-level traceability within one coherent slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes a separate file without an incomplete dependency
- **[Story]**: Maps the task to a feature-specification user story
- Every implementation task names its exact repository path

## Phase 1: Setup and Design Baseline

**Purpose**: Establish the clean toolchain and approved mapping authority before editing consumers.

- [x] T001 Restore pinned workspace dependencies from `pnpm-lock.yaml` with `pnpm install --frozen-lockfile` and verify the worktree remains unchanged
- [x] T002 Verify the canonical white and black SVG manifest entries and record the unchanged canon boundary in `specs/010-theme-lockup-accessibility/research.md`
- [x] T003 Run Spec-Kit cross-artifact analysis across `specs/010-theme-lockup-accessibility/spec.md`, `plan.md`, and `tasks.md`, then remediate any critical or high findings before implementation

**Checkpoint**: S010 has a clean dependency baseline, explicit canon authority, and analysis-approved execution plan.

---

## Phase 2: User Story 1 - Recognize Glitchpad in every GitHub theme (Priority: P1) 🎯 MVP

**Goal**: Make the README select white artwork on dark surfaces and black artwork on light surfaces with one preserved project identity.

**Independent Test**: Run the focused brand test against valid, reversed, missing, and detached banner fixtures, then inspect the repository README contract.

### Tests for User Story 1

- [x] T004 [US1] Add an initially failing repository banner expectation and pure fixture coverage for the exact direct `<picture>` relationships in `scripts/check-brand.test.mjs`

### Implementation for User Story 1

- [x] T005 [US1] Implement an exported scoped README banner validator with actionable association diagnostics in `scripts/check-brand.mjs`
- [x] T006 [US1] Map the dark media source to canonical white while preserving the black fallback, alternative text, heading, width, and composition in `README.md`
- [x] T007 [US1] Run `pnpm check:brand` and confirm the focused README contract passes with no canonical `brand/` changes

**Checkpoint**: GitHub light and dark README presentations have exact, structurally enforced surface mappings.

---

## Phase 3: User Story 2 - Navigate the public site with a stable brand identity (Priority: P1)

**Goal**: Make landing and documentation headers legible and consistently named across initial themes, explicit switching, and responsive layouts.

**Independent Test**: Exercise `/` and `/docs` under initial light and dark preferences, switch themes in both directions, and verify exact visible assets, one named home link, one visible lockup image, and no horizontal overflow.

### Tests for User Story 2

- [x] T008 [US2] Add an initially failing route, preference, switching, and viewport matrix in `site/tests/theme-lockup.spec.mjs`
- [x] T009 [P] [US2] Remove the obsolete global image-count assertion while preserving keyboard and overflow coverage in `site/tests/accessibility.spec.mjs`

### Implementation for User Story 2

- [x] T010 [P] [US2] Add the byte-identical canonical white lockup and remove the unused misleading light copy in `site/public/logos/`
- [x] T011 [US2] Map white-on-dark and black-on-light decorative variants around one persistent visually hidden `Glitchpad` name in `site/lib/layout.shared.tsx`
- [x] T012 [US2] Rename visibility selectors by target surface and preserve existing lockup geometry in `site/app/global.css`
- [x] T013 [US2] Run the focused production build and browser suite with `pnpm check:site`

**Checkpoint**: Both public layout families retain a legible lockup and stable accessible home-link name through theme and viewport transitions.

---

## Phase 4: User Story 3 - Reject future theme-mapping regressions (Priority: P2)

**Goal**: Make structural, byte-copy, visibility, and naming regressions fail deterministically before merge.

**Independent Test**: Run focused unit fixtures that reverse and detach README mappings and mutate or remove an integration copy, plus browser assertions that expose wrong or duplicate visible assets and unnamed links.

### Tests for User Story 3

- [x] T014 [US3] Add explicit reversed, missing, duplicated, and detached README fixture assertions with diagnostic expectations in `scripts/check-brand.test.mjs`
- [x] T015 [US3] Add temporary-fixture coverage for matching, drifted, and missing public asset copies in `scripts/check-brand.test.mjs`

### Implementation for User Story 3

- [x] T016 [US3] Export a focused public-copy comparison helper and replace the light-copy tuple with the active white-copy tuple in `scripts/check-brand.mjs`
- [x] T017 [US3] Re-run `pnpm check:brand` and `pnpm check:site` to prove structural, copy, browser, and accessibility contracts together

**Checkpoint**: Every regression class named by Issues #104 and #106 has deterministic automated evidence.

---

## Phase 5: Polish, Convergence, and Review

**Purpose**: Record issue-level user impact, prove repository-wide compatibility, and complete the authorized hosted review lifecycle.

- [x] T018 [P] Record the GitHub README theme correction for Issue #104 in `changelog.d/104.fixed.md`
- [x] T019 [P] Record the public-site header and accessible-name correction for Issue #106 in `changelog.d/106.fixed.md`
- [x] T020 Format all changed Markdown, JavaScript, TypeScript, CSS, and JSON; verify UTF-8 without BOM and no mojibake
- [x] T021 Run `pnpm check` to completion and evaluate the real exit status
- [x] T022 Run Spec-Kit convergence against `specs/010-theme-lockup-accessibility/` and complete any appended remediation tasks before proceeding
- [x] T023 Commit the coherent S010 slice, push `codex/010-theme-lockup-accessibility`, and open one pull request that closes Issues #104 and #106
- [ ] T024 Wait for every required hosted check and third-party review, address warranted findings, respond under each review comment individually, resolve every concluded thread, and revalidate until CI and reviews are fully satisfied

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup and Design Baseline (Phase 1)**: Starts immediately and blocks implementation until cross-artifact analysis passes.
- **User Story 1 (Phase 2)**: Depends on Phase 1 and supplies the README structural validator used by later regression fixtures.
- **User Story 2 (Phase 3)**: Depends on Phase 1; its active public copies must exist before the final browser matrix passes.
- **User Story 3 (Phase 4)**: Depends on the completed README and site consumers so negative fixtures target the final contract.
- **Polish, Convergence, and Review (Phase 5)**: Depends on all user stories.

### User Story Dependencies

- **US1**: Independent after setup and provides a complete README correction.
- **US2**: Independent after setup and provides a complete website correction.
- **US3**: Builds on US1 and US2 to prove their final mappings and failure modes together.

### Within Each User Story

- Add and observe each behavioral or structural test failing before implementing its protected behavior.
- Update canonical-copy allowlists only after the intended active asset set is explicit.
- Complete focused validation before advancing to repository-wide checks.

### Parallel Opportunities

- T009 and T010 touch separate website surfaces and may proceed in parallel after T008 establishes the failing contract.
- T018 and T019 are independently traceable changelog fragments.
- Hosted CI, docs, CodeQL, and third-party review run in parallel after T023.

## Implementation Strategy

### MVP First

1. Establish the clean analyzed baseline.
2. Add the failing README association contract.
3. Correct the README mapping and focused validator.
4. Run `pnpm check:brand` before touching the website story.

### Incremental Delivery

1. US1 repairs the GitHub surface and closes its independent acceptance path.
2. US2 repairs the live-site header and stable navigation name.
3. US3 strengthens negative evidence across both surfaces.
4. Full local and hosted convergence establishes merge readiness.

## Notes

- S010 bundles Issues #104 and #106 because they share one root association error and one coherent validation boundary.
- No task adds a dependency, modifies canonical brand files, changes application runtime behavior, or mutates hosting and DNS.
- The usual pre-push autopilot halt is explicitly waived by the product owner for this slice.
