# Tasks: PDF conformance and stable activation

**Input**: Approved S050 spec/plan/research/contracts. All user stories are P1; execution intentionally front-loads US3 minified Android proof after US1 activation and before the broad US2 matrix. Security, source integrity, artifact freshness and native outcome checks are mandatory.

## Phase 1: Setup

- [x] T001 Validate actual specify/clarify/plan/tasks context, selected branch/feature and16-item quality checklist in specs/050-pdf-stable-activation/; retain phase identities in validation.md. (FR-022,023,024)
- [x] T002 Establish criterion/profile/receipt and release-preparation contracts in specs/050-pdf-stable-activation/contracts/ and data-model.md, including all12 issue criteria and publication-only dispositions. (FR-005,012,020,022)

## Phase 2: Foundations

- [x] T003 Record the twelve dated scope/process/license/staging decisions in changelog.d/S050.md and preserve existing .gitignore/.dockerignore/formatter/linter ownership; no unrelated toolchain or brand change. (FR-017,023)

## Phase 3: US1 - Native PDF acquisition

Independent test: real cold/warm native PDF delivery resolves to the existing viewer, preserves sources and retains unsupported-format/source-policy negatives.

- [x] T004 [US1] Add failing positive-PDF declaration/count/resolver and still-unsupported negative tests in scripts/check-image-activation.test.mjs, package validator tests and AndroidResolverInstrumentedTest.kt. (FR-001,002; US1/AC1-4)
- [x] T005 [US1] Promote the canonical PDF family and reconcile generated desktop/Tauri/Linux/Android declarations in packaging/desktop/capabilities.json, native package/intent/MIME contracts and the source AndroidManifest.xml. (FR-001,002)
- [x] T006 [US1] Promote governed PDF delivery without duplicate exceptions and cover cold/warm content-based source routing in crates/glitchpad-host/src/desktop_delivery.rs and existing Android instrumentation. (FR-002,003,004,006,007,011)
- [x] T007 [US1] Prepare consistent0.3.0 target identities and monotonic Android code1006 across canonical Cargo/package/Tauri/Gradle/package/workflow authorities, retaining published latest links and historical receipts. (FR-017,018,019)

## Phase 4: US3 - Front-loaded minified Android proof

Independent test: exact canonical signed/minified app and matching test APK complete real PDF open/search/navigation/print/provider disposal on API24/Chrome69 then API36, with independently captured installed/output bytes.

- [x] T008 [US3] Add failing release PDF case/mode/installed/output validation regressions in scripts/run-android-release-tests.test.mjs and validate-android-release-evidence.test.mjs. (FR-006,014,015,016; US3/AC1-4)
- [x] T009 [US3] Make pdfCompatibility release-safe through resolved intents, observedTestWebViewPackage, public print commands, PDF-visible screenshot and test-owned JSON/APK/raw-PDF capture in AndroidDeliveryInstrumentedTest.kt and fixture provider. (FR-002,003,007,010,011,015,016)
- [x] T010 [US3] Add diagnostic pdf runtime mode and mandatory PDF full-campaign case with offline setup/clean completion/output bindings in scripts/run-android-release-tests.sh, validate-android-release-evidence.mjs and android-package.yml. (FR-014,015,016,020)
- [x] T011 [US3] Run actual minified API24/Chrome69 then API36 PDF preflights, retain failures and repair demonstrated fixture/transport/R8/native defects before broad campaigns; record exact identities in validation.md. (FR-012,015,016,021)

## Phase 5: US2 - Complete PDF conformance

Independent test: original licensed codec/RTL/geometry/boundary/hostile inputs exercise the real production worker and required native profiles with measured bounded outcomes, current source/fixture identities and no hidden failed rows.

- [x] T012 [P] [US2] Add pinned OFL font/provenance and deterministic original Pillow/fonttools assets in fixtures/pdf/, fixtures/provenance.toml and a narrow scripts conformance-assets producer; preserve all S049 fixture hashes. (FR-005,017; US2/AC1-4)
- [x] T013 [US2] Reuse/extend scripts/generate-pdf-fixtures.mjs serialization for version, JPX/JBIG2, Hebrew CID/ToUnicode, mixed geometry, hostile/truncated and valid10000page cases with manifest facts/digests. (FR-005,006,008,009)
- [ ] T014 [US2] Add actual static-codec pixel, Hebrew direction/extraction/search/selection and recognized-seed bounded mutation witnesses to scripts/check-pdf-runtime.mjs and focused tests, retaining denied worker authority and stable errors. (FR-004,005,006,007,008,011,013)
- [x] T015 [US2] Add raw first-page/navigation/search/thumbnail/disposal and interaction observations with explicit methods/scopes to scripts/pdf-reading-journey.js and current runtime/native probes. (FR-010,012,013)
- [x] T016 [US2] Add truthful render/range/cache counters and sampled named process RSS/PSS observations to existing desktop/Android native journey receipts, keeping unavailable worker heap distinct. (FR-003,008,009,010,012)
- [x] T017 [US2] Exercise source revision/revocation, low-memory/degraded behavior, cancellation/suspension and real private-file disposal through current controller/source/native tests; add only missing behavioral regressions. (FR-003,006,008,009,010,011)
- [x] T018 [US2] Implement and test the narrow strict source/profile/case/latest-attempt aggregate in scripts PDF conformance validator/tests, rejecting stale/missing/newer-failed or identity-mismatched records while retaining all attempts. (FR-005,006,012,021,022)
- [ ] T019 [US2] Integrate the full conformance case/profile policy and applicable browser/native measurement checks into existing CI and specs/050-pdf-stable-activation/validation.md. (FR-005,007,008,009,010,012,013,014,015,017)

## Phase 6: US4 - Release preparation and staged-byte proof

Independent test:0.3.0 source/docs/claims/packages agree, exact staged artifacts pass PDF/core/native gates and the real accepted-byte consumer/assembler can consume them without publishing.

- [x] T020 [US4] Reconcile technical specification, current PDF guidance, README/help/site canonical inputs, CHANGELOG and v0.3.0 notes/receipt/runbook while preserving office/advanced-tool planned status and current-public download authority. (FR-004,018,019,022; US4/AC1-4)
- [x] T021 [US4] Add machine-readable prepared documentation-pass JSON and focused validation/tests, declaring PDF release scope instead of stale recovery scope, with truthful pending owner approval. (FR-017,018,019,020,022)
- [ ] T022 [US4] Qualify actual staged Windows/macOS/Linux native PDF acquisition/reading/printing and bind proof into existing package/lifecycle archives across all declared profiles. (FR-001,002,014,016,020,021)
- [ ] T023 [US4] Extend accepted-release-inputs.mjs, assemble-community-release.mjs and existing tag-only publisher/tests to require staged PDF/documentation-pass bindings and later observed PR merge evidence, without new approval/source mutation loops. (FR-017,020,021,022,024)
- [ ] T024 [US4] Regenerate site/registrations/notices/SBOM inputs and validate version/docs/links/Mermaid/encoding/brand plus every package/source/security gate through existing scripts. (FR-017,018,019,023)
- [ ] T025 [US4] Run focused complete implementation checks and pre-candidate conformance/native diagnostics, resolve their findings and retain original failed attempts in validation.md. (FR-005,012,013,014,015,016,017,021)

## Phase 7: Review, freeze and final handoff

- [ ] T026 Push/open the implementation PR automatically with issue-level traceability, monitor applicable CI and record the first actual external review head/round in handoff.md. (FR-021,022,024)
- [ ] T027 Resolve first-round findings with fresh applicable focused/native proof and resolved threads; preserve reviewed/fixed source identities in handoff.md. (FR-021,024)
- [ ] T028 Complete at most one further external round, resolve actionable findings and do not request a third; record the actual cap and final differences in handoff.md. (FR-024)
- [ ] T029 Run present-code convergence, format/regenerate/check encoding and freeze every tracked final input/checkpoint before final qualification in specs/050-pdf-stable-activation/. (FR-020,021,023,024)
- [ ] T030 Qualify full exact-head CI plus all four stage_release:true workflows as complete successful latest attempts on the frozen source; retain exact run/attempt/artifact identities in the authoritative external receipt. (FR-014,015,017,020,021)
- [ ] T031 Independently read all8 canonical payloads, actual installed APK copies, staged native PDF facts/manifest bindings and printed PDFs, checking full hashes/lengths/source/runtime identities in the authoritative external receipt. (FR-014,015,016,020,021)
- [ ] T032 Construct the accepted preparation record and rehearse actual accepted-release-inputs/strict assembler byte consumption without publication; bind documentation-pass digest and PR identity in the authoritative external receipt. (FR-018,019,020,021)
- [ ] T033 Reconcile all12 criterion dispositions, keep #82/#11 actual publication gates open and confirm final issue/project/review state in the authoritative external receipt. (FR-022,024)
- [ ] T034 Complete final convergence/readback and stop ready/unmerged/auto-merge off with zero unresolved actionable findings or applicable failed/pending checks, using the authoritative external receipt without changing its own frozen source. (FR-021,022,024; SC-001-006)

## Dependencies and implementation strategy

Setup/contracts → US1 declaration/native acquisition and target identity → US3 release-safe preflight on24then36 → US2 broad corpus/measurements/aggregate → US4 release documentation/staged proof/consumer → bounded PR reviews → tracked freeze → exact-source complete staging/readback/rehearsal → owner-ready stop. T022 desktop proof may be prepared independently after the shared PDF receipt settles; any same-file edits remain sequential.

## Parallel opportunities

Fixture provenance/assets are separate from Android release capture; aggregate pure validators are separate from canonical version/docs updates once contracts are fixed. Mandatory planning research used three read-only agents. No implementation-agent delegation is inferred.

## Frozen final-gate execution records

At final source freeze, T030-T034 may retain their freeze-time checkbox states. Their completed execution is bound to one authoritative external PR receipt, linked from handoff.md before freeze. A pending receipt never qualifies the candidate. No tracked self-SHA checkbox/receipt edit is made after its own final qualification.
