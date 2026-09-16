# Tasks: S040 Complete Image-Family Capability

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), and [contracts](contracts/image-family.md).

## Phase 1: Setup

- [x] T001 Specify #70/#71/#72/#74, assumptions and measurable scenarios in `spec.md`; validate `checklists/requirements.md` (FR-023, FR-024).
- [x] T002 Dispatch mandatory dependency/integration research agents and record decisions, constitution gates and design in `research.md`, `plan.md`, `data-model.md`, `contracts/`, and `quickstart.md` (FR-022, FR-024).
- [x] T003 Establish the reusable Linux validation scratch checkout and review/pin explicit dependencies and existing font obligations in `Cargo.toml`, core manifest/lock and platform notices (FR-022).

## Phase 2: Foundation

- [x] T004 Write common family/signature/selection/capability and budget regression tests in `crates/glitchpad-core/tests/image_family.rs` and frontend `image-contract.test.ts` (FR-001, FR-002, FR-016, FR-020).
- [x] T005 Extend common container/descriptor/family/entry schemas and pure output/admission helpers in `crates/glitchpad-core/src/images.rs` and `apps/glitchpad/src/domain/image-contract.ts`, preserving raster/privacy compatibility (FR-001, FR-002, FR-016).

## Phase 3: US1 Safe SVG

**Independent test**: Original/golden vector pixels and all hostile active/external/complexity fixtures produce inert output or classified refusal with zero escape.

- [x] T006 [US1] Add original SVG/golden/hostile preflight tests and font-policy evidence in `crates/glitchpad-core/tests/image_svg.rs` and `fixtures/images/` (FR-003 through FR-006; US1/AC1 through AC4).
- [x] T007 [US1] Implement bounded XML/content preflight, resolver/font denial and native inert rendering in `crates/glitchpad-core/src/image_svg.rs` (FR-003 through FR-006).
- [x] T008 [US1] Integrate bounded SVG content identification, render/facts/result projection through `crates/glitchpad-host/src/images.rs` and frontend image gateway/session modules (FR-001, FR-003, FR-006).

## Phase 4: US2 Animation

**Independent test**: Golden disposal/blend/timing pixels, paused control operation, finite budgets and zero scheduled background work.

- [x] T009 [US2] Add original GIF/animated WebP/golden disposal/timing/frame-bomb tests in `crates/glitchpad-core/tests/image_animation.rs` and `fixtures/images/` (FR-007 through FR-010; US2/AC1 through AC4).
- [x] T010 [US2] Implement bounded inventory/timing/loop parsing and owned incremental GIF/WebP composition/reset-replay context in `crates/glitchpad-core/src/image_animation.rs` (FR-007, FR-008).
- [x] T011 [US2] Extend single retained native decoder context, request selection validation, cancellation and suspension eviction in `crates/glitchpad-host/src/images.rs` (FR-008, FR-010, FR-020).
- [x] T012 [US2] Add foreground-only timer/selection/paused/reduced-motion/rapid-response tests in frontend `ImageSurface.test.tsx` and `image-gateway.test.ts` (FR-009, FR-010, FR-019, FR-020).
- [x] T013 [US2] Implement explicit play/pause/frame position and sequential scheduling in `apps/glitchpad/src/components/ImageSurface.tsx` and `domain/image-gateway.ts` (FR-007, FR-009, FR-010).

## Phase 5: US3 ICO Inspection and Export

**Independent test**: Every mixed directory row survives, valid PNG/BMP entries preview, explicit exports preserve original bytes under success/cancel/conflict/stale/provider failure.

- [x] T014 [US3] Add original mixed-entry/duplicate/range/oversized PNG/DIB/alpha fixtures and isolated entry tests in `crates/glitchpad-core/tests/image_ico.rs` and `fixtures/images/` (FR-011 through FR-013; US3/AC1, AC2).
- [x] T015 [US3] Implement bounded independent directory/entry validation, selected native decoding and duplicate facts in `crates/glitchpad-core/src/image_ico.rs` (FR-011 through FR-013).
- [x] T016 [US3] Add source-bound export/alias/cancel/conflict/revision/byte-preservation tests in native source/image tests and Android provider unit/instrumented tests (FR-014 through FR-016; US3/AC3, AC4).
- [x] T017 [US3] Implement native regenerated PNG export command, desktop destination identity/conflict authority, atomic commit and truthful path-free receipt in `crates/glitchpad-host/src/images.rs` and `source/mod.rs` (FR-014, FR-015).
- [x] T018 [US3] Implement Android generated-entry Save As destination/original identity exclusion, revision/write verification and cleanup in Android source/plugin modules (FR-014, FR-015).
- [x] T019 [US3] Add ICO row/selection/export/cancel/error/source-save denial tests in frontend `ImageSurface.test.tsx` and `image-gateway.test.ts` (FR-011, FR-014 through FR-016).
- [x] T020 [US3] Integrate capability-driven ICO selection/facts/explicit export flow in `ImageSurface.tsx`, image domain contracts/gateway and inspector (FR-011 through FR-017).

## Phase 6: US4 Complete Controls and Session Lifecycle

**Independent test**: Every essential action succeeds with keyboard/touch/assistive technology, mobile layouts stay compact, retained presentation resumes paused and stale work never publishes.

- [x] T021 [US4] Add bounded presentation persistence/restoration/revision and suspended decode resource tests in `domain/persistence.test.ts`, `tabs.test.ts`, restoration gateways and native image tests (FR-019, FR-020; US4/AC3, AC4).
- [x] T022 [US4] Implement validated viewport/frame/entry presentation retention with no pixels/facts/autoplay authority in persistence/restoration/session modules (FR-019).
- [x] T023 [US4] Complete capability-driven keyboard/pointer/touch/pinch/assistive controls and bounded pan/mobile styles in `ImageSurface.tsx`, `ImageSurface.css` and tests (FR-017, FR-018; US4/AC1, AC2).
- [x] T024 [US4] Preserve independent metadata/privacy, source-refresh atomic invalidation, request-selection stale rejection and idempotent disposal across native/frontend image modules (FR-002, FR-019, FR-020).

## Phase 7: Evidence, Convergence, and Publication

- [x] T025 Extend fixture generator/digests and image layout/network/coverage checks in `fixtures/images/` and `scripts/check-image-layout.mjs` (FR-021; SC-002 through SC-006).
- [x] T026 Extend existing hosted desktop and API 24/36 provider/delivery/restoration evidence for SVG/animation/ICO/export without changing public associations/intents in `.github/workflows/ci.yml` and native/Android tests (FR-021; SC-001, SC-003, SC-006).
- [x] T027 Verify pinned graph, fonts/provenance/licenses/notices/advisories and package impact in four platform notice bundles and `verification.md` (FR-022).
- [x] T028 Run focused native/frontend/layout/accessibility/revision/export/hostile gates and record measured evidence in `verification.md` (FR-021; SC-001 through SC-006).
- [x] T029 Run complete `cargo xtask check`, documentation, encoding/BOM/mojibake and diff checks with real successful exit status in `verification.md` (FR-022; SC-007).
- [x] T030 Perform Spec Kit read-only analyze and convergence against every issue criterion, 24 requirements/16 scenarios/seven outcomes and eight principles; append and implement any findings in `tasks.md` (FR-023, FR-024).
- [x] T031 Record unreleased documentation delta in `changelog.d/040.added.md` and feature/PR evidence; preserve official0.1.3 and incomplete #75/#76/#66/later milestones (FR-023).
- [x] T032 Commit, automatically push and publish the official PR closing only #70/#71/#72/#74 through the hidden VCS launcher (FR-024).
- [ ] T033 Wait initial external reviews/reactions, respond to every comment, remediate with regression evidence and resolve every satisfied thread; record the ledger in `verification.md` (FR-024).
- [ ] T034 Request at most one explicit follow-up review round if needed, address/resolve every result, and wait complete latest-head CI/security/platform checks (FR-024; SC-007).
- [ ] T035 Publish one final completed verification/task receipt, wait its latest-head CI, and notify the owner for final review/merge with the PR unmerged (FR-024; SC-001, SC-007).

## Dependencies and Parallel Opportunities

Setup/research precedes foundation. SVG, animation and ICO each depend on shared contracts and affect separate pure native modules, but host/gateway/surface integration tasks are sequential where files are shared. Tests precede implementations; every story has independent acceptance evidence. Controls/session completion follows all three family implementations. Validation/convergence precedes publication/reviews/final receipt. Mandatory research agents run independently of local specification/design work; independent test invocations can be batched once source is ready. No artificial one-issue slices or parallel markers for shared-file mutations are used.

## Implementation Strategy

Prove safe SVG first, incremental paused animation next, then independent ICO entry preview/export, and finally complete all-family controls/lifecycle. All four stories and all included issue criteria are required; the suggested US1-first order is a development checkpoint, not a reduction of the accepted slice.

## Phase 8: Convergence

- [x] T036 Exercise reduced-motion preference changes during playback and prove no subsequent frame scheduling in `ImageSurface.test.tsx` per FR-009, FR-010 and US2/AC3 (partial).

## Phase 9: Convergence

- [x] T037 Preserve every bounded ICO row and valid-neighbor decoding when another entry has an invalid range or excessive claimed length; retain unknown encoding and full bounded directory facts in native/browser tests per FR-011, FR-012, US3/AC1 and #72 (contradicts).

## Phase 10: Convergence

- [x] T038 Admit transient encoded animation buffers before preflight allocation, bound sanitized vector capacity, and retain encoded data without a Vec-to-Arc payload copy per FR-008 and plan: peak-memory admission (partial).

## Phase 11: Convergence

- [ ] T039 Exercise the real Android selected-entry native/provider export round trip, chooser cancellation, original identity and existing-destination refusal on API 24/36, and compare independent PNG/DIB golden pixels per FR-021, SC-003, SC-006 and T026 (partial).

## Phase 12: Convergence

- [ ] T040 Open Android export destinations without truncation, recheck actual descriptor size/cancellation before writing, and prove misreported-size conflict preservation in provider instrumentation per FR-015, SC-006 and #72 (partial).

## Phase 13: Convergence

- [x] T041 CRITICAL Verify every nested animated WebP VP8/VP8L header against the admitted ANMF rectangle before decoder creation, including ALPH/VP8, and add malformed/dimension-bomb regressions per Constitution P4, FR-008 and US2/AC4 (contradicts).

## Phase 14: Convergence

- [x] T042 Retain the reduced-motion preference and prevent playback scheduling while it matches; prove both initial preference and attempted restart after a preference change in `ImageSurface.test.tsx` per FR-009, FR-010, US2/AC3 and review4021351270 (partial).
- [x] T043 Preserve finite-loop progress across pause/resume and reset it only for an explicit completed-animation restart; prove encoded repeat exhaustion after resumed playback in `ImageSurface.test.tsx` per FR-007, FR-008, US2/AC2 and review4021351271 (partial).

## Phase 15: Convergence

- [ ] T044 Inspect native select option text/count directly in Android ICO inventory evidence instead of relying on body innerText for unselected options; retain every-row/DIB/duplicate assertions and run the real export round trips on API 24/36 per FR-011, FR-021, SC-003 and failed job104615332577 (contradicts).

## Phase 16: Convergence

- [ ] T045 HIGH Preserve an explicit native chooser/export across visibility-only suspension, cancel it on source/selection/session disposal, and retain its receipt independently of regenerated-preview status; add a failure-first chooser hide/resume regression and complete API 24/36 provider export per FR-014, FR-015, FR-020, US3/AC3 and failed job104622457718 (contradicts).
