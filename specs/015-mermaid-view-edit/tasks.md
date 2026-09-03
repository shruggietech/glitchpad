# Tasks: Mermaid Viewing and Editing

**Input**: Design documents from `specs/015-mermaid-view-edit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Security, contract, integration, accessibility, performance, host, and platform evidence are mandatory under the specification and constitution.

**Organization**: Tasks are grouped by user story. S015 bundles GitHub issues #54 through #57 because they share one renderer contract and form one reviewable end-to-end capability.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it affects different files and has no dependency on unfinished work.
- **[Story]**: Maps the task to a user story from spec.md.
- Every task names its intended file path.

## Phase 1: Setup and governed inputs

**Purpose**: Pin auditable runtime dependencies and establish governed fixtures before implementation.

- [x] T001 Pin Mermaid 11.17.2 and DOMPurify 3.4.14 in `apps/glitchpad/package.json` and `pnpm-lock.yaml`
- [x] T002 Record Mermaid and DOMPurify licensing and distribution notices in `NOTICE` and dependency policy inputs
- [x] T003 Tighten document-content CSP for connections, objects, frames, media, base changes, and inert blob images in `crates/glitchpad-host/tauri.conf.json`
- [x] T004 [P] Add valid, malformed, unsupported, hostile, accessible, directional, and boundary fixtures in `fixtures/mermaid/corpus.json` and `fixtures/mermaid/sources/`
- [x] T005 [P] Add Mermaid fixture digests, origins, licenses, purposes, and expected results in `fixtures/provenance.toml`

## Phase 2: Foundational renderer boundary

**Purpose**: Define and test the one shared, bounded, revision-keyed adapter required by every user story.

- [x] T006 Write exact limit, classification, metadata, accessibility, and viewport contract tests in `apps/glitchpad/src/domain/mermaid-contract.test.ts`
- [x] T007 Implement typed requests, results, diagnostics, accessibility facts, measurements, limits, and viewport helpers in `apps/glitchpad/src/domain/mermaid-contract.ts`
- [x] T008 Write hostile SVG element, attribute, CSS, URL, identifier, and accessibility sanitizer tests in `apps/glitchpad/src/domain/mermaid-sanitizer.test.ts`
- [x] T009 Implement the final DOMPurify plus application-owned SVG allowlist, request-scoped identifier rewriting, safe metadata extraction, and inert serialization in `apps/glitchpad/src/domain/mermaid-sanitizer.ts`
- [x] T010 Write parse, strict-configuration, directive-policy, classification, redaction, output-limit, and deadline tests in `apps/glitchpad/src/domain/mermaid-pipeline.test.ts`
- [x] T011 Implement strict Mermaid parse/render orchestration without host, link, storage, or network capabilities in `apps/glitchpad/src/domain/mermaid-pipeline.ts`
- [x] T012 Write debounce, scheduler, concurrency, cancellation, timeout, and 100-revision stale-result tests in `apps/glitchpad/src/domain/mermaid-adapter.test.ts`
- [x] T013 Implement the 300 ms latest-wins owner adapter and bounded shared scheduler in `apps/glitchpad/src/domain/mermaid-adapter.ts`

**Checkpoint**: The renderer boundary safely returns only current, bounded, inert diagram results.

## Phase 3: User Story 1 - Open a Mermaid diagram as a document (Priority: P1)

**Goal**: Route valid standalone Mermaid files to a first-class rendered document surface.

**Independent Test**: Open representative `.mmd` and `.mermaid` sessions and verify local rendering, fit-to-view, source preservation, and safe fallback.

- [x] T014 [P] [US1] Extend standalone Mermaid detection, frontmatter, extension-conflict, BOM, and newline tests in `crates/glitchpad-core/src/detection.rs`
- [x] T015 [P] [US1] Extend desktop MIME and source-delivery conformance for Mermaid in `crates/glitchpad-host/tests/desktop_source_conformance.rs`
- [x] T016 [US1] Add Mermaid session projection and renderer state to `apps/glitchpad/src/domain/contracts.ts`
- [x] T017 [US1] Write standalone routing, rendered default, empty/error source default, and safe fallback tests in `apps/glitchpad/src/components/MermaidSurface.test.tsx`
- [x] T018 [US1] Implement the standalone Mermaid document surface and compose the existing text editor in `apps/glitchpad/src/components/MermaidSurface.tsx`
- [x] T019 [US1] Route Mermaid sessions through `apps/glitchpad/src/components/DocumentSurface.tsx` and wire state in `apps/glitchpad/src/App.tsx`
- [x] T020 [US1] Add standalone Mermaid layout and content-first responsive styling in `apps/glitchpad/src/styles.css`

**Checkpoint**: User Story 1 is independently usable without editing or embedded diagrams.

## Phase 4: User Story 2 - Edit and validate a Mermaid diagram (Priority: P1)

**Goal**: Provide conflict-safe source editing with debounced preview revisions and stale-preview diagnostics.

**Independent Test**: Edit, invalidate, recover, save, reopen, and externally conflict a Mermaid document without source loss or stale preview commits.

- [x] T021 [US2] Add Mermaid state reducer tests for current revisions, stale updates, source mode, last-valid preview, and tab lifecycle in `apps/glitchpad/src/domain/tabs.test.ts`
- [x] T022 [US2] Add revision-guarded Mermaid state updates in `apps/glitchpad/src/domain/tabs.ts`
- [x] T023 [US2] Add Mermaid mode, search, copy, zoom, save, Save As, and line-navigation command tests in `apps/glitchpad/src/domain/commands.test.ts`
- [x] T024 [US2] Project Mermaid-aware command labels and capabilities in `apps/glitchpad/src/domain/commands.ts`
- [x] T025 [US2] Implement debounced source preview, reliable diagnostics, explicit stale-preview labeling, and source routing in `apps/glitchpad/src/components/MermaidSurface.tsx`
- [x] T026 [US2] Prove Mermaid source uses existing encoding, newline, dirty recovery, atomic save, and conflict behavior in `apps/glitchpad/src/domain/editor-conformance.test.ts` and `apps/glitchpad/src/domain/recovery.test.ts`

**Checkpoint**: User Story 2 preserves the text source lifecycle and rejects stale preview state.

## Phase 5: User Story 3 - Read and edit Mermaid blocks in Markdown (Priority: P1)

**Goal**: Render bounded fenced Mermaid blocks independently inside Markdown while the parent source remains authoritative.

**Independent Test**: Render a Markdown document containing at least 20 mixed valid, malformed, and over-limit blocks and verify unaffected prose and diagrams remain usable.

- [x] T027 [US3] Write fence recognition, exact ranges, stable owner identity, 64-block, 256 KiB block, 1 MiB aggregate, and independent-failure tests in `apps/glitchpad/src/domain/mermaid-markdown.test.ts`
- [x] T028 [US3] Implement bounded Mermaid fence extraction and parent-revision identities in `apps/glitchpad/src/domain/mermaid-markdown.ts`
- [x] T029 [US3] Extend the safe Markdown projection with inert Mermaid placeholders and search/source ranges in `apps/glitchpad/src/domain/markdown-contract.ts` and `apps/glitchpad/src/domain/markdown-pipeline.ts`
- [x] T030 [US3] Add mixed-block, stale-parent, source-route, and rendered-search integration tests in `apps/glitchpad/src/components/MarkdownSurface.test.tsx`
- [x] T031 [US3] Implement independent embedded diagram ownership and fallback UI in `apps/glitchpad/src/components/EmbeddedMermaidSurface.tsx`
- [x] T032 [US3] Render Mermaid placeholders through the shared adapter without transferring parent source ownership in `apps/glitchpad/src/components/MarkdownSurface.tsx`

**Checkpoint**: User Story 3 keeps every block failure local and preserves all Markdown source.

## Phase 6: User Story 4 - Use diagrams safely and accessibly (Priority: P2)

**Goal**: Make standalone and embedded diagrams navigable, searchable, inspectable, and accessible without exposing active output.

**Independent Test**: Complete keyboard, pointer, touch, screen-reader, security, and metadata scenarios against annotated and unannotated fixtures.

- [x] T033 [US4] Write fit, actual size, 0.1-to-8.0 zoom, bounded pan, keyboard, pointer, touch, and focus tests in `apps/glitchpad/src/components/DiagramViewport.test.tsx`
- [x] T034 [US4] Implement the reusable inert diagram viewport and navigation controls in `apps/glitchpad/src/components/DiagramViewport.tsx`
- [x] T035 [US4] Add rendered-label search, authored and fallback accessible names, source route, live diagnostic, and metadata tests in `apps/glitchpad/src/components/MermaidSurface.test.tsx`
- [x] T036 [US4] Implement rendered-label search, accessible diagram naming, source route, and bounded metadata projection in `apps/glitchpad/src/components/MermaidSurface.tsx` and `apps/glitchpad/src/components/EmbeddedMermaidSurface.tsx`
- [x] T037 [US4] Add critical/serious axe checks and 200 percent zoom/reflow coverage for Mermaid surfaces in `apps/glitchpad/src/components/MermaidSurface.test.tsx`

**Checkpoint**: User Story 4 meets the security and accessibility contract with static diagram output.

## Phase 7: Cross-cutting validation and documentation

**Purpose**: Prove the bundled issues as one complete reviewable slice before publication.

- [x] T038 Add real-browser runtime security instrumentation for zero network, navigation, dialog, and native invocation in `scripts/check-mermaid-runtime.mjs` and `scripts/check-mermaid-runtime.test.mjs`
- [x] T039 Wire the Mermaid runtime security gate into `package.json` and `crates/xtask/src/main.rs`
- [x] T040 Add deterministic performance and boundary evidence in `apps/glitchpad/src/domain/mermaid-performance.test.ts`
- [x] T041 Extend Android controlled-provider delivery coverage for `text/vnd.mermaid` and exact source bytes in `crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidSourceInstrumentedTest.kt`
- [x] T042 Add a S015 changelog fragment for issues #54 through #57 in `changelog.d/54.added.md`
- [x] T043 Reconcile implementation decisions, issue traceability, and local evidence in `specs/015-mermaid-view-edit/verification.md`
- [x] T044 Run focused Mermaid suites, Rust detection/host tests, browser security checks, Android target check, desktop debug build, full `pnpm check`, diff/encoding/mojibake checks, and record real outcomes in `specs/015-mermaid-view-edit/verification.md`

## Dependencies and execution order

- Phase 1 has no code dependency and establishes governed inputs.
- Phase 2 depends on pinned dependencies and blocks every user story.
- User Story 1 depends on Phase 2.
- User Story 2 composes User Story 1 and the existing text lifecycle.
- User Story 3 depends on Phase 2 and the S014 Markdown projection.
- User Story 4 composes standalone and embedded surfaces.
- Phase 7 depends on all user stories.
- Tests precede their corresponding implementations in every phase.

## Parallel opportunities

- T004 and T005 can proceed independently once the corpus inventory is agreed.
- T014 and T015 affect different languages and can run in parallel.
- Standalone reducer/command test preparation can proceed independently of Markdown fence extraction after Phase 2.
- Android delivery evidence can proceed independently after the exact format contract is stable.

## Implementation strategy

1. Establish dependency, CSP, fixtures, and the typed renderer contract.
2. Build and verify the sanitizer before invoking Mermaid.
3. Implement the revision-safe adapter and standalone experience.
4. Compose editing from the existing source lifecycle rather than duplicating it.
5. Add bounded Markdown block projections through the same adapter.
6. Complete navigation, accessibility, metadata, browser security, platform, and aggregate validation.
7. Publish only after the complete local gate is green.

## Notes

- `pnpm docs:mermaid` validates repository documentation diagrams and is not runtime evidence for S015.
- The five-second engine deadline is cooperative inside one WebView; hard preflight limits and stale-result rejection are the enforceable controls.
- Raw Mermaid SVG must never enter React through `dangerouslySetInnerHTML`.
- Completed tasks must be marked `[x]`.
