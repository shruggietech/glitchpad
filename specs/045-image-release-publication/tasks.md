# Tasks: v0.2.0 Image Release Publication

**Input**: Design documents in specs/045-image-release-publication/. **Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/publication.md, quickstart.md. **Organization**: Chronological phases with issue traceability to #76 and #10; remaining #66/#239 work stays explicit.

## Phase 1: Setup

- [x] T001 Create S045 branch/selector and specification in specs/045-image-release-publication/spec.md.
- [x] T002 Complete clarification, checklists, research and design in specs/045-image-release-publication/plan.md.

## Phase 2: Foundation

- [x] T003 Perform blocking cross-artifact analysis of specs/045-image-release-publication/{spec,plan,tasks}.md and record the gate disposition in verification.md.

## Phase 3: US1 - Qualify one source (P1, MVP)

**Goal**: Remove final provenance network dependency without changing the dependency graph; qualify a reviewed exact source. **Independent Test**: Full metadata succeeds across independent containers with networking disabled and unchanged lock digest; missing cache fails; candidate CI and package evidence bind the selected SHA.

- [x] T004 [US1] Add focused authority/cache-policy negative cases in scripts/check-community-release.test.mjs and observe failure before changing the policy.
- [x] T005 [US1] Share job-local registry/git inputs, prefetch full locked graph, prove network-disabled metadata and require offline final metadata in .github/workflows/linux-package.yml.
- [x] T006 [US1] Amend source/tag authority in docs/releases/v0.2.0-operator-runbook.md and scripts/check-community-release.mjs for explicit owner publish-before-final-merge direction.
- [x] T007 [US1] Run focused and aggregate validation, retain offline-boundary results and lock identity in specs/045-image-release-publication/verification.md.
- [ ] T008 [US1] Push/open official PR, resolve first bot round and any one second round, and qualify exact-head CI/platform campaigns; retain receipt in .tmp/s045-candidate-handoff.json.

## Phase 4: US2 - Official image release (P1)

**Goal**: Publish immutable v0.2.0 and verify complete public packages/evidence and site. **Independent Test**: All14 official assets pass independent inventory/hash/source/trust checks and Pages tag/source matches.

- [ ] T009 [US2] Pin the qualified source and create/push annotated v0.2.0; monitor existing .github/workflows/release.yml and four tag package workflows without replacing public identities.
- [ ] T010 [US2] Download and independently verify all14 assets and public Pages identity; retain readback in .tmp/s045-public-readback/.
- [ ] T011 [US2] Record actual published source, campaigns, signing/trust, evidence limits, public asset hashes and site identity in docs/releases/v0.2.0-receipt.md.

## Phase 5: US3 - Owner closeout (P2)

**Goal**: Truthful issue-level closeout and an open green PR for owner review. **Independent Test**: #76/#10 actual criteria have evidence-backed dispositions, all bot feedback addressed and final applicable checks green; owner retains merge control.

- [ ] T012 [US3] Close #76 then #10 only after complete public release verification, retain #66/#239 limitations, and record disposition in docs/releases/v0.2.0-receipt.md.
- [ ] T013 [US3] Verify final PR head CI and every review disposition, retaining current state in .tmp/s045-state.json; never exceed two review rounds.

## Phase 6: Polish and handoff

- [ ] T014 Run final cross-artifact/convergence review, UTF-8/mojibake and diff sanity checks; update specs/045-image-release-publication/verification.md and tasks.md with actual outcomes.
- [ ] T015 Stop S045 owned container, retain evidence/caches, and ping owner with open PR/release links and actual limits documented in docs/releases/v0.2.0-receipt.md.

## Dependencies and execution order

Setup -> foundation -> US1 -> US2 -> US3 -> handoff. T004 precedes T005/T006; T007 precedes PR qualification; exact source freezes before T009. Final receipt commits are separately identified and receive CI without moving the release tag.

## Parallel opportunities

Within US1, read-only CI and bot inspection may overlap independent platform campaigns after source freeze. Within US2, the four independent public platform archives can be read back concurrently; mutation/publication and dependent verification remain sequential. Within US3, CI observation and issue criteria assessment can overlap; issue closure waits for verified publication. No parallel editing of shared source paths is required.

## Implementation strategy

Deliver US1's provenance repair and exact-source qualification first, then publish through the existing tag workflow and independently prove US2. Finish US3 and evidence-only handoff without auto-merging. No unrelated application feature, dependency upgrade, or newly invented manual gate is included.

## Phase 7: Convergence

Qualification found one HIGH partial gap against FR-004/FR-007/SC-001: Linux official mode upgrades unperformed read/edit/save/metadata/recovery rows, and macOS hardcodes the same operations. S021 FR-018 explicitly forbids borrowing separately run source suites as clean-package passes. The following remediation blocks unfinished T008-T015 and publication; the existing tasks remain unchanged.

- [x] T016 Add failing guarded-native, real-bridge failure-injection and receipt-negative cases in crates/glitchpad-host/src/lifecycle_probe.rs, apps/glitchpad/src/domain/package-workflow-probe.test.ts and scripts/{linux,macos}/test-package-lifecycle.test.mjs per FR-004/FR-007 (partial).
- [x] T017 Implement a one-shot fixed-fixture native begin/complete guard and packaged production-bridge workflow in crates/glitchpad-host/src/lifecycle_probe.rs, crates/glitchpad-host/src/lib.rs, apps/glitchpad/src/domain/package-workflow-probe.ts and apps/glitchpad/src/App.tsx per FR-004/SC-001 (missing).
- [x] T018 Exercise the separate proof launch in scripts/linux/test-package-lifecycle.mjs and scripts/macos/test-package-lifecycle.mjs, bind actual observed workflow evidence in receipt validators and scripts/assemble-community-release.mjs, and preserve all startup samples/manual limitations per FR-004/FR-007 (partial).
- [ ] T019 Review the proof internally, run full validation, and requalify the changed exact source before completing T008/T009; record the two external review rounds already used and their earlier source coverage in specs/045-image-release-publication/verification.md per FR-002/FR-008/FR-009 (partial).

- [x] T020 Apply the owner-approved v0.2.0 reference-hardware eligibility amendment in specs/021-linux-packaging/spec.md, scripts/check-linux-package.mjs and scripts/check-linux-package.test.mjs; retain the10000ms hosted gate, actual classifications and #239 per FR-007/SC-004.
