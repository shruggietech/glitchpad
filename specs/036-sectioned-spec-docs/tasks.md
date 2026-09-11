# Tasks: Sectioned Technical Specification Documentation

**Input**: Design documents from `/specs/036-sectioned-spec-docs/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/documentation-generation.md`

**Tests**: Issue #170 and the feature specification require automated content, export, browser, accessibility, and deployment validation. Test tasks precede their implementation tasks.

**Organization**: Tasks are grouped by user story so each slice of reader and maintainer value remains independently traceable.

## Phase 1: Setup and Governance

**Purpose**: Establish the complete S036 design and traceability boundary.

- [x] T001 Confirm issue #170 scope, Spec Kit artifacts, constitution gates, and unchanged 0.1.2 release authority in specs/036-sectioned-spec-docs/spec.md and specs/036-sectioned-spec-docs/plan.md
- [x] T002 [P] Record the parser, route, publication, compatibility, and evidence decisions in specs/036-sectioned-spec-docs/research.md and specs/036-sectioned-spec-docs/contracts/documentation-generation.md
- [x] T003 [P] Record generation entities, transitions, and validation commands in specs/036-sectioned-spec-docs/data-model.md and specs/036-sectioned-spec-docs/quickstart.md

---

## Phase 2: Foundational Generator Contract

**Purpose**: Establish tests and shared generation machinery required by every story.

**CRITICAL**: No story implementation begins until the canonical parser and complete-set writer contract is proven.

- [x] T004 Add failing parser and renderer contract tests for numbered TOC pairing, fence-aware headings, stable slugs, link ownership, MDX escaping, metadata descriptions, deterministic output, malformed structures, and stale cleanup in site/tests/content-contract.test.mjs
- [x] T005 Implement the Markdown-aware canonical parser, repository-fact validator, section renderer, ordered manifest builder, and staged complete-set publisher in site/scripts/prebuild.mjs
- [x] T006 Generate and inspect the baseline documentation and library outputs in site/content/docs and site/lib/generated

**Checkpoint**: The canonical source can produce a validated complete documentation model and replace stale output without partial publication.

---

## Phase 3: User Story 1 - Read Focused Authoritative Documentation (Priority: P1) MVP

**Goal**: Publish an authoritative introduction and exactly 38 complete focused section pages in canonical order.

**Independent Test**: Generate from the canonical source and prove that the introduction contains validated project facts while all 38 section bodies appear exactly once with nested structures preserved and no manual TOC.

### Tests for User Story 1

- [x] T007 [US1] Add failing exact-coverage, source-order, complete-body, nested-heading, table, code, Mermaid, introduction-authority, and manual-TOC absence tests in site/tests/content-contract.test.mjs

### Implementation for User Story 1

- [x] T008 [US1] Generate the authoritative introduction, 38 uniquely described section MDX pages, ordered meta.json, and documentation.json manifest from repository authorities in site/scripts/prebuild.mjs
- [x] T009 [US1] Validate the generated introduction plus representative early, middle, and final content using site/tests/content-contract.test.mjs

**Checkpoint**: User Story 1 is independently complete and the former monolith is no longer the public documentation body.

---

## Phase 4: User Story 2 - Navigate Without Dead Ends (Priority: P2)

**Goal**: Provide ordered sidebar and previous/next navigation, correct internal links, distinct metadata, responsive keyboard access, and legacy-route continuity.

**Independent Test**: Export the site, traverse representative routes and navigation controls, audit every generated route and fragment, and open the former monolithic URL directly.

### Tests for User Story 2

- [x] T010 [P] [US2] Add failing full-route, order, canonical/social metadata, internal-link, fragment, duplicate, and stale-route audit tests in site/tests/export-contract.test.mjs and site/scripts/audit-export.mjs
- [x] T011 [P] [US2] Add failing introduction, early/middle/final, legacy, sidebar, previous/next, responsive, keyboard, heading, table, and Mermaid browser tests in site/tests/public-routes.spec.mjs and site/tests/accessibility.spec.mjs

### Implementation for User Story 2

- [x] T012 [US2] Rewrite known canonical fragments to owning generated routes and publish the unlisted static-compatible legacy forwarding page in site/scripts/prebuild.mjs and site/content/docs
- [x] T013 [US2] Extend the static export audit to enforce the manifest route set, order, unique metadata, and resolvable internal route/fragment destinations in site/scripts/audit-export.mjs
- [x] T014 [US2] Extend production verification for representative section routes, navigation, diagrams, metadata, compatibility, and links in scripts/verify-site-deployment.mjs
- [x] T015 [US2] Run the focused static build, export audit, browser, and accessibility checks and resolve all navigation or rendering failures

**Checkpoint**: User Stories 1 and 2 are independently usable across direct, sequential, sidebar, fragment, keyboard, narrow-viewport, and legacy entry paths.

---

## Phase 5: User Story 3 - Trust Generated Documentation Facts (Priority: P2)

**Goal**: Make regeneration deterministic, fail malformed authority structures safely, remove obsolete pages, and expose complete evidence traceability.

**Independent Test**: Generate twice, mutate controlled fixtures, seed stale output, and prove byte-identical success or actionable failure with the prior complete set retained.

### Tests for User Story 3

- [x] T016 [US3] Add failing fixture cases for missing, duplicate, skipped, reordered, mismatched, and colliding structures plus unchanged-output and interrupted-generation behavior in site/tests/content-contract.test.mjs

### Implementation for User Story 3

- [x] T017 [US3] Harden structure diagnostics, staging cleanup, complete inventory validation, deterministic serialization, and authority cross-checks in site/scripts/prebuild.mjs
- [x] T018 [US3] Verify pull-request documentation CI exercises the complete site contract without introducing a second workflow or dependency in .github/workflows/docs.yml and package.json
- [x] T019 [US3] Run focused malformed-fixture, deterministic-generation, stale-cleanup, and failure-retention tests and resolve all defects

**Checkpoint**: All three user stories are independently complete and generation failures cannot silently publish drift or mixed content.

---

## Phase 6: Verification and Handoff

**Purpose**: Close S036 with complete local, hosted, review, and issue-level evidence.

- [x] T020 [P] Update requirement-to-evidence results for FR-001 through FR-024, SC-001 through SC-014, and issue #170 in specs/036-sectioned-spec-docs/verification.md
- [x] T021 Run formatting, documentation links, Markdown/Mermaid, UTF-8/mojibake, generated-diff, and whitespace checks through the approved hidden launchers
- [x] T022 Run the complete cargo xtask check repository gate through the pinned hidden validation container
- [ ] T023 Push codex/s036-sectioned-spec-docs, open the official pull request closing issue #170, and confirm all continuous integration checks are green
- [ ] T024 Resolve every first-round Codex and security review item, trigger at most one explicit second review with @codex review, and resolve every second-round item
- [x] T025 Record the merge-dependent glitchpad.com deployment verification as pending for the final review and merge ritual in specs/036-sectioned-spec-docs/verification.md

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 has no dependencies.
- Phase 2 depends on Phase 1 and blocks all user stories.
- Phase 3 depends on Phase 2 and establishes the generated page set.
- Phase 4 depends on Phase 3 routes and metadata.
- Phase 5 depends on the complete generator and navigation contracts from Phases 3 and 4.
- Phase 6 depends on all local story work and validation.

### User Story Dependencies

- User Story 1 depends only on the foundational generator and delivers the reader-facing MVP.
- User Story 2 depends on User Story 1's ordered routes but has its own export and browser acceptance evidence.
- User Story 3 depends on the completed output contract so failure and regeneration behavior can be tested against the real set.

### Within Each User Story

- Add and observe failing tests before implementing the corresponding behavior.
- Parse and validate authorities before rendering files.
- Render and inventory staging output before replacing live output.
- Complete focused checks before moving to the next story.
- Complete the full repository gate before push and hosted review.

### Parallel Opportunities

- T002 and T003 cover independent planning artifacts.
- T010 and T011 cover independent static-audit and browser-test files after section routes exist.
- T020 can be drafted from accumulated evidence while T021 runs, but final results require T021 through T024.

## Implementation Strategy

1. Establish the parser and complete-set publisher with failing contract tests.
2. Deliver the introduction and 38-page authoritative reader experience.
3. Add navigation, compatibility, metadata, and every-route audit coverage.
4. Prove deterministic regeneration and safe failure behavior.
5. Run focused and aggregate local gates, then complete both allowed hosted review rounds.
6. Hand off only after CI and reviews are satisfied, with production deployment verification explicitly reserved for the merge-triggered workflow.
