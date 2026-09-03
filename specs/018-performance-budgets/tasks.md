# Tasks: Enforce Performance Budgets

**Input**: Design documents from `/specs/018-performance-budgets/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: S018 requires automated policy, contract, lifecycle, boundary, and smoke evidence. Test tasks precede their implementation tasks.

**Organization**: Tasks are grouped by user story so each performance capability remains independently testable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the canonical catalog, governed scenarios, and repository entry points.

- [x] T001 Create the versioned v0.1.0 metric, profile, scenario, threshold, sample, and activation catalog in fixtures/performance/budgets.json
- [x] T002 [P] Create deterministic performance scenario and policy-case descriptors in fixtures/performance/corpus.json and fixtures/performance/evidence/policy-cases.json
- [x] T003 [P] Register every S018 fixture with original Apache-2.0 provenance and exact digests in fixtures/provenance.toml
- [x] T004 Add check:performance and performance:smoke entry points without new dependencies in package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared typed classification and evidence rules before collectors or renderer integration.

**Critical**: No user-story implementation begins until catalog validation and classification contracts exist.

- [x] T005 Write failing Rust boundary, percentile, invariant, evidence, and history tests in crates/glitchpad-core/src/performance.rs and crates/glitchpad-core/tests/contract_schema.rs
- [x] T006 Implement bounded performance budget, sample summary, evidence validation, classification, comparability, warning-history, and aggregate policy in crates/glitchpad-core/src/performance.rs and export it from crates/glitchpad-core/src/lib.rs
- [x] T007 [P] Write failing TypeScript classification, evidence, privacy, and history tests in apps/glitchpad/src/domain/performance.test.ts
- [x] T008 [P] Implement the shared TypeScript performance policy consumer in apps/glitchpad/src/domain/performance.ts
- [x] T009 [P] Write failing Node catalog, fixture, evidence, classification, privacy, and warning-history tests in scripts/check-performance.test.mjs
- [x] T010 Implement the canonical repository validator and reusable policy module in scripts/check-performance.mjs and scripts/lib/performance-policy.mjs
- [x] T011 Prove canonical catalog thresholds and identifiers agree across Rust, TypeScript, and Node consumers in crates/glitchpad-core/tests/contract_schema.rs, apps/glitchpad/src/domain/performance.test.ts, and scripts/check-performance.test.mjs

**Checkpoint**: Invalid or inconsistent performance evidence fails deterministically in all consumers.

---

## Phase 3: User Story 1 - Open and edit without disruptive delay (Priority: P1)

**Goal**: Produce bounded, truthful startup, first-content, preview, and interaction measurements.

**Independent Test**: Run governed representative scenarios and verify bounded samples, deterministic p95/classification, invariant failures, and hosted-smoke separation from reference claims.

### Tests for User Story 1

- [x] T012 [P] [US1] Add failing browser-collector contract tests for bounded arguments, one browser process, loopback serving, sample fields, and cleanup in scripts/run-performance.test.mjs
- [x] T013 [P] [US1] Extend editor performance tests for nearest-rank summaries, 1 MiB transaction scenarios, repeated 100 millisecond stalls, and bounded sample retention in apps/glitchpad/src/domain/editor-performance.test.ts
- [x] T014 [P] [US1] Add Markdown and Mermaid first-content/current-preview measurement regressions using governed scenario identities in apps/glitchpad/src/domain/markdown-renderer.test.ts and apps/glitchpad/src/domain/mermaid-performance.test.ts

### Implementation for User Story 1

- [x] T015 [US1] Replace the isolated editor timing helper with shared bounded measurement and invariant classification in apps/glitchpad/src/domain/editor-performance.ts
- [x] T016 [US1] Add explicit measurement callbacks and monotonic lifecycle markers without content retention to apps/glitchpad/src/domain/markdown-renderer.ts and apps/glitchpad/src/domain/mermaid-adapter.ts
- [x] T017 [US1] Implement the production-build headless collector with one reusable browser, loopback-only server, off-origin denial, bounded samples, deterministic evidence output, and hard-smoke failure exit in scripts/run-performance.mjs
- [x] T018 [US1] Add stable shell-ready and renderer-ready markers for collection without adding visible product chrome in apps/glitchpad/src/App.tsx and apps/glitchpad/src/components/DocumentSurface.tsx

**Checkpoint**: Browser-compatible v0.1 workloads produce valid hosted-smoke evidence without claiming reference hardware performance.

---

## Phase 4: User Story 2 - Cancel or degrade expensive work safely (Priority: P1)

**Goal**: Prove exact large-source modes, cooperative scheduling, cancellation acknowledgement, and rejection of stale work.

**Independent Test**: Exercise exact thresholds and cancel/supersede each eligible operation, verifying no work publishes after 250 milliseconds and no unbounded interface allocation occurs.

### Tests for User Story 2

- [x] T019 [P] [US2] Add exact text, Markdown, Mermaid, unknown-size, and changing-size boundary cases to fixtures/performance/corpus.json and their focused domain tests
- [x] T020 [P] [US2] Add cancellation timing and post-cancellation publication tests for language, Markdown, Mermaid, checksum, large-text search, and source streams in the applicable apps/glitchpad/src/domain and crates/glitchpad-host/tests suites
- [x] T021 [P] [US2] Add event-loop yield and repeated-interaction structural tests for work that can exceed one slice in apps/glitchpad/src/domain/performance.test.ts

### Implementation for User Story 2

- [x] T022 [US2] Implement a cancellable cooperative scheduler with bounded slice accounting in apps/glitchpad/src/domain/performance.ts
- [x] T023 [US2] Route eligible language, Markdown, checksum, large-text, and Mermaid pre-dispatch work through existing workers or the cooperative scheduler in apps/glitchpad/src/domain and component call sites
- [x] T024 [US2] Repair any stale-publication or cancellation cleanup gaps found by T020 while preserving the explicit S015 cooperative Mermaid engine limitation
- [x] T025 [US2] Enforce the catalog source thresholds before allocation or publication in Rust and TypeScript policy consumers and cross-boundary tests

**Checkpoint**: Every eligible operation cancels safely and every exact source boundary selects its documented mode.

---

## Phase 5: User Story 3 - Keep inactive documents lightweight (Priority: P1)

**Goal**: Make renderer/session resource ownership explicit and prove suspension/disposal returns to a zero-resource baseline.

**Independent Test**: Run 100 activate/suspend/resume/close cycles and verify zero resource growth, idempotent disposal, preserved authoritative state, and correct suspended-tab classification.

### Tests for User Story 3

- [x] T026 [P] [US3] Write failing resource-ledger lifecycle, underflow, terminal-disposal, privacy, size-bound, and 100-cycle tests in apps/glitchpad/src/domain/resource-ledger.test.ts
- [x] T027 [P] [US3] Add renderer integration tests proving workers, timers, callbacks, surfaces, and generated URLs are released on suspend, replacement, unmount, and disposal in apps/glitchpad/src/domain and components
- [x] T028 [P] [US3] Add native stream lease cancellation/close and repeated-cycle conformance coverage in crates/glitchpad-host/tests/performance_conformance.rs

### Implementation for User Story 3

- [x] T029 [US3] Implement the closed-kind ephemeral resource ledger and suspended-tab byte classifier in apps/glitchpad/src/domain/resource-ledger.ts
- [x] T030 [US3] Integrate optional resource ownership with Markdown and Mermaid renderer clients and relevant surfaces without retaining resource objects or document content
- [x] T031 [US3] Ensure tab activation and component unmount suspend or dispose the prior renderer before new work can publish in apps/glitchpad/src/components/DocumentSurface.tsx and renderer surfaces
- [x] T032 [US3] Add a content-free native lease snapshot and idempotent release test seam in crates/glitchpad-host/src/source/mod.rs and crates/glitchpad-host/src/android_source/mod.rs

**Checkpoint**: Background and closed documents release every declared regenerable resource and native lease deterministically.

---

## Phase 6: User Story 4 - Trust release performance evidence (Priority: P2)

**Goal**: Connect complete, comparable, privacy-safe evidence to pull-request and later release gates.

**Independent Test**: Validate good and hostile evidence corpora, actual temporary artifact sizes, inactive package metrics, missing required receipts, incomparable histories, and aggregate failure behavior.

### Tests for User Story 4

- [x] T033 [P] [US4] Add actual temporary artifact size, absent artifact, traversal, stale digest, hostile key, invalid timestamp, and bounded diagnostic tests in scripts/check-performance.test.mjs and scripts/run-performance.test.mjs
- [x] T034 [P] [US4] Add aggregate required/smoke/inactive activation and two-warning regression cases to fixtures/performance/evidence/policy-cases.json
- [x] T035 [P] [US4] Add desktop working-set sampler conformance plus Android idle-PSS instrumentation evidence and safe invalid-input coverage in crates/glitchpad-host/tests/performance_conformance.rs and crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/performance/PerformanceInstrumentedTest.kt

### Implementation for User Story 4

- [x] T036 [US4] Implement explicit actual-artifact size collection, bounded desktop process working-set sampling in crates/glitchpad-host/src/performance.rs, and Android instrumentation-only `Debug.getPss()` evidence emission with profile verification and no persisted native paths in scripts/run-performance.mjs and the platform collector files
- [x] T037 [US4] Implement aggregate activation, missing receipt, invalid evidence, hard failure, and consecutive-warning gate behavior in scripts/lib/performance-policy.mjs and scripts/check-performance.mjs
- [x] T038 [US4] Integrate deterministic performance checks into crates/xtask/src/main.rs, package.json, and the pull-request aggregate in .github/workflows/ci.yml
- [x] T039 [US4] Document the release-profile command, evidence applicability, later package activation handoff, and stable diagnostics in specs/018-performance-budgets/verification.md

**Checkpoint**: Missing or invalid activation-required evidence and every hard regression block the aggregate gate without inventing package claims.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete traceability, validation, documentation impact, and final evidence.

- [x] T040 Add issue #60 traceability and the S018 documentation-impact decision in changelog.d/60.changed.md and specs/018-performance-budgets/verification.md
- [x] T041 Run focused Rust, TypeScript, Node, browser-smoke, fixture, and native conformance suites and record exact results in specs/018-performance-budgets/verification.md
- [x] T042 Run pnpm check, git diff --check, UTF-8/no-BOM and mojibake validation, and confirm a clean generated-artifact boundary before publication
- [x] T043 Reconcile every FR/SC, acceptance scenario, contract rule, and task against the implementation and append only genuine remaining work through the convergence pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on the canonical catalog and blocks every story.
- **US1 (Phase 3)**: Depends on Phase 2 and establishes measurement output consumed by US4.
- **US2 (Phase 4)**: Depends on Phase 2 and can proceed independently of US1 except for shared policy utilities.
- **US3 (Phase 5)**: Depends on Phase 2 and can proceed independently of US1/US2.
- **US4 (Phase 6)**: Depends on US1 measurement output plus foundational policy; it consumes US2/US3 structural evidence.
- **Polish (Phase 7)**: Depends on every selected story.

### User Story Dependencies

- **US1**: Independent measurement capability after the foundation.
- **US2**: Independent boundary/cancellation capability after the foundation.
- **US3**: Independent resource-lifecycle capability after the foundation.
- **US4**: Integrates evidence from US1-US3 into release-stage policy.

### Parallel Opportunities

- Catalog descriptors and provenance can be prepared in parallel after paths are fixed.
- Rust, TypeScript, and Node policy tests use different files and can be authored in parallel before their corresponding implementations.
- US2 boundary fixtures and cancellation tests can be authored independently of US3 ledger/native lease tests.
- Documentation and changelog updates can proceed after public contracts stabilize.

## Parallel Example: User Story 3

```text
Task: "Write resource-ledger lifecycle tests in apps/glitchpad/src/domain/resource-ledger.test.ts"
Task: "Add renderer integration cleanup tests in apps/glitchpad/src/domain and components"
Task: "Add native lease lifecycle tests in crates/glitchpad-host/tests/performance_conformance.rs"
```

## Implementation Strategy

### MVP first

Complete Phase 1, Phase 2, and US1 to establish truthful, bounded classification and browser-compatible evidence. Do not publish until US2-US4 and the aggregate gate are also complete because issue #60 is release-governance work rather than an independently shippable partial user feature.

### Incremental delivery

1. Lock the catalog and cross-language policy.
2. Add representative measurement collection.
3. Enforce cancellation and exact degradation boundaries.
4. Prove resource release and suspended overhead.
5. Connect evidence applicability and failure semantics to CI/release workflows.
6. Converge and run the complete local gate before any push.

## Notes

- `[P]` means distinct files with no dependency on an incomplete task.
- Story labels map directly to the four specification stories.
- Test tasks intentionally precede implementation tasks.
- Hardware-sensitive timing and memory results are never reclassified from hosted smoke to reference evidence.
- Actual package files are mandatory inputs once their later packaging slices activate those metrics.
