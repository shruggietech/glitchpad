# Tasks: Local Markdown Viewing and Editing

**Input**: Design documents from `specs/014-markdown-view-edit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Automated contract, unit, component, accessibility, performance, and regression tests are mandatory because FR-021 and SC-001 through SC-008 require repeatable evidence. Tests precede their implementation tasks.

**Organization**: Tasks are grouped by user story so each increment is independently testable while sharing one bounded renderer foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches separate files and has no incomplete dependency.
- **[Story]**: Maps the task to a user story from spec.md.

## Phase 1: Setup

**Purpose**: Establish pinned dependencies, feature fixtures, and shared types.

- [x] T001 Add pinned unified, remark, rehype sanitation, traversal, and native opener dependencies with compatible license metadata in `apps/glitchpad/package.json`, `pnpm-lock.yaml`, workspace Cargo manifests, and `Cargo.lock`
- [x] T002 [P] Define Markdown renderer, node, outline, search, link, limit, and diagnostic types in `apps/glitchpad/src/domain/markdown-contract.ts`
- [x] T003 [P] Add Markdown session projection types to `apps/glitchpad/src/domain/contracts.ts`
- [x] T004 [P] Add licensed representative, hostile, boundary-descriptor, duplicate-heading, footnote, and raw-HTML sources plus provenance in `fixtures/markdown/` and `fixtures/provenance.toml`

---

## Phase 2: Foundational Renderer Boundary

**Purpose**: Build the safe parsing, URL, worker, and lifecycle contracts that block every story.

**Critical checkpoint**: No UI story begins until the pure pipeline and renderer lifecycle pass their tests.

- [x] T005 [P] Write URL classification and normalization tests for allowed, local, credential-bearing, encoded-control, bidirectional-control, unsafe-scheme, malformed, and over-limit targets in `apps/glitchpad/src/domain/markdown-url.test.ts`
- [x] T006 [P] Write pipeline tests for CommonMark, GFM, footnotes, inert raw HTML, remote-image denial, final allowlist sanitation, deterministic heading IDs, source positions, visible search text, depth/count limits, and redacted failures in `apps/glitchpad/src/domain/markdown-pipeline.test.ts`
- [x] T007 [P] Write renderer-client tests for request correlation, debounce scheduling, 100 superseded revisions, cancellation, timeout, suspension, stale results, worker failure, and idempotent disposal in `apps/glitchpad/src/domain/markdown-renderer.test.ts`
- [x] T008 Implement pure target classification and bounded disclosure in `apps/glitchpad/src/domain/markdown-url.ts`
- [x] T009 Implement the single unified parse, inert-HTML transform, post-transform sanitation schema, safe-tree projection, outline, and visible-text indexes in `apps/glitchpad/src/domain/markdown-pipeline.ts`
- [x] T010 Implement the typed module-worker request loop without native, network, window, or source-handle authority in `apps/glitchpad/src/domain/markdown-worker.ts`
- [x] T011 Implement the owner-scoped renderer client, direct test executor, 100 ms debounce, exact-revision commit gate, cancellation, failure redaction, suspension, and disposal in `apps/glitchpad/src/domain/markdown-renderer.ts`
- [x] T012 Run the focused domain suites and correct every failure in `apps/glitchpad/src/domain/markdown-*.test.ts`

---

## Phase 3: User Story 1 - Read Markdown Safely (Priority: P1)

**Goal**: Render supported Markdown locally as safe, readable semantic content.

**Independent Test**: Open representative and hostile Markdown fixtures; verify syntax semantics and raw HTML text while no script, network, navigation, or native behavior is possible.

- [x] T013 [P] [US1] Write component tests for readable supported syntax, empty/malformed states, raw HTML text, blocked images, safe element/property projection, and renderer diagnostics in `apps/glitchpad/src/components/MarkdownSurface.test.tsx`
- [x] T014 [P] [US1] Write an accessibility regression for semantic headings, lists, tables, task states, code, footnotes, and blocked resources in `apps/glitchpad/src/components/MarkdownSurface.test.tsx`
- [x] T015 [US1] Implement explicit safe-tree-to-React projection without raw HTML injection or untrusted property spreading in `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T016 [US1] Implement rendered, loading, empty, limited, and failed document states with compact status in `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T017 [US1] Route eligible Markdown sessions to the Markdown surface while preserving S013 large-text and refusal paths in `apps/glitchpad/src/components/DocumentSurface.tsx`
- [x] T018 [US1] Add responsive readable Markdown typography, tables, code, task lists, footnotes, and inert-resource styling in `apps/glitchpad/src/styles.css`
- [x] T019 [US1] Run the independent safe-reading and accessibility tests and correct every failure in `apps/glitchpad/src/components/MarkdownSurface.test.tsx`

---

## Phase 4: User Story 2 - Edit the Source Without Rewrites (Priority: P1)

**Goal**: Toggle between the safe preview and the existing exact text editor with revision-safe refresh.

**Independent Test**: Edit a writable mixed-newline Markdown source, render only the newest revision, and prove the save projection changes only authored edits; verify 16-32 MiB source-only behavior.

- [x] T020 [P] [US2] Write session reducer tests for Markdown mode persistence, exact revision checks, active/background transitions, and size eligibility in `apps/glitchpad/src/domain/tabs.test.ts`
- [x] T021 [P] [US2] Write component tests for rendered default, read-only source, writable source, mode toggle, shared editor commands, dirty state, preview debounce, stale-result rejection, source-only limit, and recovery-only editing in `apps/glitchpad/src/components/MarkdownSurface.test.tsx`
- [x] T022 [US2] Add revision-bound Markdown mode and location actions to `apps/glitchpad/src/domain/tabs.ts`
- [x] T023 [US2] Compose `TextEditorSurface` as Markdown source mode and retain one editor command handle in `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T024 [US2] Implement preview scheduling from the newest text document, size transitions, mode persistence callbacks, and unmount cancellation in `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T025 [US2] Wire Markdown mode updates and existing text/language updates through `apps/glitchpad/src/App.tsx` and `apps/glitchpad/src/components/DocumentSurface.tsx`
- [x] T026 [US2] Map the renderer-driven Edit command and compact Preview/Edit action without adding split view in `apps/glitchpad/src/domain/commands.ts` and `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T027 [US2] Prove lossless Markdown edits with existing raw-text projection and recovery regressions in `apps/glitchpad/src/domain/text-document.test.ts` and `apps/glitchpad/src/domain/recovery.test.ts`
- [x] T028 [US2] Run the independent source/edit/revision/limit tests and correct every failure in `apps/glitchpad/src/components/MarkdownSurface.test.tsx` and `apps/glitchpad/src/domain/tabs.test.ts`

---

## Phase 5: User Story 3 - Search and Navigate Rendered Content (Priority: P2)

**Goal**: Search visible text, navigate a heading outline, translate exact source locations, and print readable content.

**Independent Test**: Search duplicate and Unicode content forward/back with wrap, navigate duplicate headings, switch to mapped source, and inspect print presentation without shell chrome.

- [x] T029 [P] [US3] Write rendered-search tests for visible-only indexing, Unicode case folding, next/previous wrap, result cap, query reset, revision reset, and source mapping in `apps/glitchpad/src/domain/markdown-pipeline.test.ts`
- [x] T030 [P] [US3] Write component tests for search controls, command invocation, active-match focus, outline disclosure, duplicate heading navigation, source handoff, and print invocation in `apps/glitchpad/src/components/MarkdownSurface.test.tsx`
- [x] T031 [US3] Implement rendered-search state and navigation over accepted semantic indexes in `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T032 [US3] Implement accessible outline disclosure and exact rendered/source heading navigation in `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T033 [US3] Route search, next, previous, close-search, copy, go-to-line, and Edit commands by active Markdown mode in `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T034 [US3] Add print control and print-only sanitized document presentation in `apps/glitchpad/src/components/MarkdownSurface.tsx` and `apps/glitchpad/src/styles.css`
- [x] T035 [US3] Run independent rendered search, outline, source handoff, command, and print tests and correct every failure in `apps/glitchpad/src/components/MarkdownSurface.test.tsx`

---

## Phase 6: User Story 4 - Operate Links and Resources Deliberately (Priority: P2)

**Goal**: Disclose, confirm, and narrowly authorize safe destinations while all unsafe or unavailable targets remain inert.

**Independent Test**: Activate permitted and forbidden links by keyboard and pointer; cancel and confirm permitted targets; verify one gateway call and zero browser-driven navigation or requests.

- [x] T036 [P] [US4] Write link interaction tests for disclosure, cancel, confirm, focus return, one-use gateway calls, gateway failure, local unavailability, remote images, and every blocked target family in `apps/glitchpad/src/components/MarkdownSurface.test.tsx`
- [x] T037 [P] [US4] Define the injected external-link and local-asset gateway interfaces plus safe no-authority defaults in `apps/glitchpad/src/domain/markdown-gateway.ts`
- [x] T038 [US4] Render link and image nodes as inert Glitchpad controls/placeholders using classified candidates in `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T039 [US4] Implement the accessible destination-confirmation dialog, explicit confirm/cancel actions, bounded error state, and focus restoration in `apps/glitchpad/src/components/MarkdownSurface.tsx`
- [x] T040 [US4] Inject the renderer-scoped gateways through `apps/glitchpad/src/App.tsx` and `apps/glitchpad/src/components/DocumentSurface.tsx`, then implement the independently validating cross-platform host command in `crates/glitchpad-host/src/external_link.rs` without granting Markdown direct opener or network permissions
- [x] T041 [US4] Run the independent link/resource security and interaction tests and correct every failure in `apps/glitchpad/src/components/MarkdownSurface.test.tsx` and `apps/glitchpad/src/domain/markdown-url.test.ts`

---

## Phase 7: Polish and Cross-Cutting Verification

**Purpose**: Prove issue-level acceptance, performance, platform-neutral behavior, documentation integrity, and full repository health.

- [x] T042 [P] Add deterministic 1 MiB projection and repeated-render performance tests with digest and sample reporting in `apps/glitchpad/src/domain/markdown-performance.test.ts` and `apps/glitchpad/src/domain/markdown-performance.ts`
- [x] T043 [P] Add Markdown renderer conformance cases for size boundaries, malformed input, cancellation, disposal, accessibility, and capability parity in `apps/glitchpad/src/domain/markdown-conformance.test.ts`
- [x] T044 [P] Add shell integration and axe regressions for Markdown mode, commands, links, focus, coarse-pointer controls, and viewport ownership in `apps/glitchpad/src/components/MarkdownSurface.test.tsx`
- [x] T045 Add issue #53 changelog traceability in `changelog.d/53.added.md`
- [x] T046 Validate dependency licenses, direct declarations, lockfile integrity, source provenance, formatting, and ignored outputs through repository policy checks
- [x] T047 Run the complete quickstart including focused unit/component suites, production build, hostile fixtures, 320-by-640 smoke, and print manual check where automation is unavailable
- [x] T048 Run `pnpm check` in the foreground through completion and correct every Rust, frontend, site, browser, Android, dependency, documentation, link, Mermaid, version, encoding, mojibake, and policy failure
- [x] T049 Record acceptance-criterion, test, performance, platform, manual, and aggregate-gate evidence in `specs/014-markdown-view-edit/verification.md`
- [x] T050 Confirm every task is complete, every specification requirement has evidence, UTF-8/no-BOM and mojibake checks pass, and `git diff --check` reports no corruption

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 has no dependencies.
- Phase 2 depends on Phase 1 and blocks every user story.
- User Story 1 depends on Phase 2 and supplies the rendered surface.
- User Story 2 depends on User Story 1 because it composes rendered and source modes in one surface.
- User Story 3 depends on User Stories 1 and 2 for accepted semantic indexes and mode handoff.
- User Story 4 depends on User Story 1 for safe rendered node projection but can otherwise be validated independently.
- Phase 7 depends on all selected user stories.

### Parallel Opportunities

- T002 through T004 can proceed in parallel after T001 is decided.
- T005 through T007 are test-first tasks in separate files.
- Component-test additions are sequential within `MarkdownSurface.test.tsx`; domain tests in distinct files can run in parallel.
- T042 through T044 are separate evidence suites.

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete User Story 1 and validate the secure renderer independently.
3. Do not publish because issue #53 also requires the source-authority, navigation, and link workflows.

### Complete Slice

1. Add the exact-source editing composition in User Story 2.
2. Add semantic navigation and print in User Story 3.
3. Add deliberate external links and blocked resources in User Story 4.
4. Converge against all artifacts and run every local gate before publication.

## Notes

- Tests are written before their corresponding implementation and must demonstrate a meaningful failure first.
- Mermaid fences remain escaped code; issue #54 owns rendering and issue #56 owns embedding.
- No task may introduce direct fetch, raw HTML injection, ordinary navigable anchors, generalized native invoke access, a second source buffer, or a serialized Markdown save path.
