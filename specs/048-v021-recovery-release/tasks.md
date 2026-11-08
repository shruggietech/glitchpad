# Tasks: v0.2.1 product-recovery release

**Input**: Design artifacts in specs/048-v021-recovery-release/.

**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/ and quickstart.md. The resolved repository tasks template is retained with the hosted tasks initialization receipt.

**Tests**: Meaningful release/source/authority/byte/capture regressions and existing validation suites are required by the specification. Reversible prose/version edits use existing checks; do not add tests that merely mirror literals.

**Organization**: User-story phases are independently assessable. All tasks begin unchecked; implementation records actual completion after its checklist gate. Shared files are edited sequentially.

## Phase 1: Setup

- [x] T001 Verify accepted S048 branch, dependency closure, live release/tag state and exact feature pointer in specs/048-v021-recovery-release/spec.md and .specify/feature.json (FR-002/015).
- [x] T002 Reconcile specification, resolved plan/research/contracts and the sixteen-item quality checklist in specs/048-v021-recovery-release/ (FR-012/015).
- [x] T003 Verify scoped ignore/configuration and approved hidden/hosted execution; retain phase contexts and failed wrapper evidence in .codex-tmp/s048/ (FR-016).

## Phase 2: Foundational

- [x] T004 Add target-release identity loading and consistency regressions in scripts/lib/release-identity.mjs and its test, using packaging/release/package-contract.json (FR-001/002).
- [x] T005 Synchronize product manifests, own Cargo/fuzz lock entries, Android fallback and packaging/*/package-contract.json to 0.2.1 without third-party/history changes (FR-001/004/005).
- [x] T006 Replace historical S045 current authority with the S048 preparation boundary in scripts/check-community-release.mjs, scripts/check-public-release.mjs, version/config/public guards and their meaningful negative tests (FR-002/007/012/015).

**Checkpoint**: Current release identity and preparation authority are coherent before story implementation.

## Phase 3: User Story 1 - Understand the recovered product (Priority: P1)

**Independent Test**: Current source/public documentation, generated preview and installed identity match the recovery release definition; latest-published links remain valid without publishing.

- [x] T007 [US1] Reconcile README.md, CHANGELOG.md, docs/glitchpad-technical-specification.md, current packaging READMEs and docs/releases/v0.2.1.md with S046/S047 behavior and explicit limits (FR-001/002/003/004/014).
- [x] T008 [US1] Separate preview and authorized published deployment metadata in site/scripts/prebuild.mjs, site/scripts/postbuild.mjs, current homepage/introduction and site contract tests; regenerate only existing tracked outputs (FR-002/003/004).
- [x] T009 [US1] Align native/frontend About/version/source metadata and current test expectations in crates/glitchpad-core/src/lib.rs, crates/glitchpad-host/src/application_info.rs and affected build workflows (FR-001/005).
- [x] T010 [US1] Run focused public/config/version/site checks and record actual results in specs/048-v021-recovery-release/validation.md (FR-007; SC-001).

## Phase 4: User Story 2 - Operate the identified recovery candidate (Priority: P1)

**Independent Test**: The unchanged minified canonical release APK is installed on API24/API36, produces correct release/source/byte identities and completes the declared native tasks with exact readbacks.

- [x] T011 [US2] Add validated opt-in release testBuildType and matching-signature test assembly in crates/glitchpad-host/gen/android/app/build.gradle.kts; explicitly mark only the AndroidTest application test-only/debuggable in its manifest (FR-009/016).
- [x] T012 [US2] Add narrowly named streamed APK evidence capture through crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/FixtureDocumentsProvider.java and test-owned storage without production permissions/debug changes (FR-009/011).
- [x] T013 [US2] Add release identity/capture and visible Back/About checks around reused ordinary delivery/authoring/Diagnostics/exact recovery flows in crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidDeliveryInstrumentedTest.kt (FR-005/009/010/013).
- [x] T014 [US2] Add a bounded release-runtime runner/validator and source/role/byte/missing-attempt rejection tests in scripts/run-android-release-tests.sh, scripts/validate-android-release-evidence.mjs and their regression fixtures (FR-009/010/011/013).
- [x] T015 [US2] Add manual stable-key staging, exact native/frontend source env, matching AndroidTest artifact and API24/API36 release-runtime jobs to .github/workflows/android-package.yml; retain ordinary PR disposable signing (FR-005/008/009/011/015).
- [ ] T016 [US2] Prove release variant/signature/startup capture compatibility on both required APIs before full campaigns, then qualify Back/About in its bounded release case, retaining every attempt in .codex-tmp/s048/ and specs/048-v021-recovery-release/validation.md (FR-009/010/013).

## Phase 5: User Story 3 - Review a complete release handoff (Priority: P1)

**Independent Test**: Staged payload/manifest/native evidence binds one actual source, all selected artifacts independently read back, and the handoff preserves historical scopes/limits.

- [x] T017 [US3] Stage desktop community metadata before manifest-bound native receipts in .github/workflows/{windows,macos,linux}-package.yml, scripts/promote-community-package.mjs and applicable package validators/tests (FR-007/011/012/017).
- [x] T018 [US3] Derive actual target SBOM/promotion identity, preserve signing/trust distinctions and update current licensing/package guards in scripts/generate-{windows,android}-sbom.mjs and packaging/release/package-contract.json (FR-001/006/012).
- [x] T019 [US3] Write the current preparation receipt, campaign/index schema and issue acceptance map in docs/releases/v0.2.1-receipt.md and specs/048-v021-recovery-release/contracts/, referencing immutable S047 dispositions and #66/#239 limits (FR-012/013/014).
- [x] T020 [US3] Preserve and exercise exact-source/non-official/wrong-manifest/native-receipt rejection in scripts/assemble-community-release.mjs and its tests; add only necessary staged-unpublished semantics (FR-011/012/017).
- [x] T021 [US3] Run focused platform/release policy checks and exact pinned BrandBuilder probe/verifier/glyph checks through scripts/verify-brandbuilder.py; retain actual results and skips in specs/048-v021-recovery-release/validation.md (FR-006/007/014).

## Phase 6: User Story 4 - Retain owner finalization control (Priority: P1)

**Independent Test**: Future publication resolves explicit accepted immutable staging inputs without rebuilding, while this session cannot publish, merge or close the release issues.

- [ ] T022 [US4] Implement strict accepted-source/platform-run/artifact/payload validation in scripts/accepted-release-inputs.mjs and meaningful negative/positive tests, then consume it in .github/workflows/release.yml without a rebuild path (FR-011/015/017).
- [x] T023 [US4] Document future owner-authorized annotated tag/staging-input publication and accepted-source-versus-squash-merge rules in docs/releases/v0.2.1-operator-runbook.md (FR-012/015/017).
- [x] T024 [US4] Exercise preparation-only/manual/tag/site authorization gates and staging-input selection without tag/release/deployment side effects in scripts/check-community-release.test.mjs, scripts/check-public-release.test.mjs and accepted-release-input tests (FR-002/015/017).
- [x] T025 [US4] Prepare current PR/review/issue/project handoff state and a two-round review counter in specs/048-v021-recovery-release/handoff.md; keep #244/#255 open and avoid closing references (FR-012/014/015).

## Phase 7: Polish and final qualification

- [ ] T026 Format/regenerate affected files, check links/UTF-8/mojibake/TB Mermaid and reconcile all focused failures before final qualification; record results in specs/048-v021-recovery-release/validation.md (FR-003/006/007/016).
- [ ] T027 Run exact final-source CI, browser/geometry aggregate, all four ordinary/fault-probe API24/API36 debug campaigns and staged Windows/macOS/Linux/Android package/native/release-runtime campaigns (FR-007/008/009; SC-002/003).
- [ ] T028 Independently read and hash every selected archive, all eight release payloads and installed Android app/test packages; reconcile source/version/certificate/manifest/native/readback/attempt identities in the retained S048 index and final PR evidence (FR-010/011/012/013; SC-002/003).
- [ ] T029 Reconcile seven issue criteria, historical/conditional/supplemental/manual limits, checkpoint receipt and final-source PR confirmation without self-SHA churn in docs/releases/v0.2.1-receipt.md and specs/048-v021-recovery-release/contracts/issue-acceptance-map.md (FR-012/013/014; SC-004/005).
- [ ] T030 Push/open the reviewable PR automatically, monitor applicable CI and resolve external findings within two rounds; record exact reviewed/current heads and retained failures in specs/048-v021-recovery-release/handoff.md (FR-007/015; SC-006).
- [ ] T031 Perform formal present-code Spec-Kit convergence against all requirements/scenarios, plan decisions and constitution; preserve specs/048-v021-recovery-release/tasks.md byte-for-byte when clean (FR-012/015).
- [ ] T032 Verify final public/local source, terminal applicable checks, selected artifacts, resolved threads, open issue/project state and no merge/auto-merge/tag/release/deployment; hand the PR to the owner with current evidence and limits in its final handoff (FR-012/014/015/017; SC-004/005/006).

## Dependencies and execution order

Setup precedes foundation; foundation blocks all stories. US1 copy, US2 runtime, US3 metadata/evidence and US4 future publication each have their own independent validation, but common identity/policy files remain sequential. T015 depends on T011-T014; T016 validates that path before expensive final campaigns. T017-T020 prepare final package metadata before native qualification. All implementation and focused checks in T004-T026, including US4, precede T027. T028 follows complete current campaigns. A checkpoint receipt plus final PR confirmation avoids repeated self-SHA updates; any newly changed observed source input receives fresh final-source qualification. T030 consumes at most two external rounds, T031 follows implementation, and T032 stops at the owner boundary.

## Parallel examples

After foundation, public-copy validation (US1), Android helper research/isolated fixture validation (US2), platform archive readback (US3) and pure staging-input unit cases (US4) may overlap when files and prerequisites are disjoint. Independent artifact downloads/hash reads may run together; mutations, same-file edits, source publication and approvals remain sequential. Parallel opportunity does not bypass dependency or phase gates.

## Requirement coverage

| Requirement | Task IDs |
| --- | --- |
| FR-001 | T004,T005,T007,T009,T018 |
| FR-002 | T001,T004,T006,T007,T008,T024 |
| FR-003 | T007,T008,T026 |
| FR-004 | T005,T007,T008 |
| FR-005 | T005,T009,T013,T015 |
| FR-006 | T018,T021,T026 |
| FR-007 | T006,T010,T017,T021,T026,T027,T030 |
| FR-008 | T015,T027 |
| FR-009 | T011,T012,T013,T014,T015,T016,T027 |
| FR-010 | T013,T014,T016,T028 |
| FR-011 | T012,T014,T015,T017,T020,T022,T028 |
| FR-012 | T002,T006,T017,T018,T019,T020,T022,T023,T025,T028,T029,T031,T032 |
| FR-013 | T013,T014,T016,T019,T028,T029 |
| FR-014 | T007,T019,T021,T025,T029,T032 |
| FR-015 | T001,T002,T006,T015,T022,T023,T024,T025,T030,T031,T032 |
| FR-016 | T003,T011,T026 |
| FR-017 | T017,T020,T022,T023,T024,T032 |
| SC-001 | T004,T005,T007,T008,T009,T010 |
| SC-002 | T013,T014,T015,T016,T027,T028 |
| SC-003 | T017,T018,T020,T021,T027,T028 |
| SC-004 | T019,T023,T025,T029,T032 |
| SC-005 | T019,T025,T029,T032 |
| SC-006 | T024,T025,T030,T032 |

## Implementation strategy

US1 is the first independently reviewable increment, but S048 delivers all four stories as one coherent release-preparation slice. Write meaningful policy/transport/signature regressions before their implementation, use existing checks for reversible identity/prose edits, and validate each fixture failure before full reruns. Do not deploy an interim increment. Publication and final issue closure remain later owner-controlled work.
