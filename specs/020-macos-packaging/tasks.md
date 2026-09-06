# Tasks: Ship macOS Package

**Input**: Design documents from `/specs/020-macos-packaging/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: S020 requires native delivery, package contract, universal architecture, lifecycle, accessibility, performance, and Apple trust evidence. Test tasks precede their implementations.

**Organization**: Tasks are grouped by user story and ordered so the native macOS branch candidate is fully validated before pull-request publication.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish one shared desktop claim authority and governed macOS package inputs.

- [x] T001 Move the stable capability inventory from packaging/windows/capabilities.json to packaging/desktop/capabilities.json and update Windows consumers
- [x] T002 [P] Define candidate identity, bundle, size, Apple trust, and evidence rules in packaging/macos/package-contract.json
- [x] T003 [P] Add reviewed attribution material and operator boundaries in packaging/macos/THIRD_PARTY_NOTICES.txt and packaging/macos/README.md
- [x] T004 [P] Define the content-free native receipt schema in packaging/macos/clean-host-receipt.template.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create deterministic contract validation before enabling macOS output.

- [x] T005 Write failing static contract tests for shared capabilities, forbidden formats, Tauri metadata, universal identity, evidence freshness, and official fail-closure in scripts/check-macos-package.test.mjs
- [x] T006 Implement static configuration, candidate evidence, and live-official evidence validation in scripts/check-macos-package.mjs
- [x] T007 Add the macOS 13 universal DMG, approved icon, resource, association, ad-hoc signing, and identity overlay in crates/glitchpad-host/tauri.s020-macos.conf.json
- [x] T008 Refactor scripts/generate-windows-sbom.mjs around a shared desktop generator and add the macOS entry point in scripts/generate-macos-sbom.mjs
- [x] T009 Register macOS package validation with package.json, crates/xtask/src/main.rs, and .github/labeler.yml
- [x] T010 Run the static package tests and configuration gates exposed by package.json and crates/xtask/src/main.rs in the hidden validation container

**Checkpoint**: macOS package policy fails closed before any DMG is accepted.

---

## Phase 3: User Story 1 - Install and remove Glitchpad cleanly (Priority: P1) MVP

**Goal**: Build one universal DMG and prove conventional mount, copy, native launch, removal, and document preservation on both architectures.

**Independent Test**: Mount the same candidate on native arm64 and Intel hosts, copy Glitchpad into a clean application directory, launch its native slice, remove it, and verify fixture documents remain unchanged.

- [x] T011 [P] [US1] Write failing safe staging, inventory, canonical-name, digest, and architecture tests in scripts/macos/assemble-package.test.mjs
- [x] T012 [P] [US1] Write failing mount, Applications-link, copy, launch, removal, and fixture-preservation tests in scripts/macos/test-package-lifecycle.test.mjs
- [x] T013 [US1] Implement deterministic DMG staging, application inventory, live metadata collection, hashing, and candidate manifest generation in scripts/macos/assemble-package.mjs
- [x] T014 [US1] Implement non-interactive DMG mount, Applications-link verification, clean copy, native launch probe, removal, cleanup, and content-free receipt generation in scripts/macos/test-package-lifecycle.mjs
- [x] T015 [US1] Add universal Tauri construction, final-byte assembly, and candidate upload on macos-15 in .github/workflows/macos-package.yml
- [x] T016 [US1] Add native arm64 and macos-15-intel lifecycle jobs consuming the same DMG in .github/workflows/macos-package.yml

**Checkpoint**: One DMG installs and executes natively on both supported architectures without document loss.

---

## Phase 4: User Story 2 - Open only truthfully supported files (Priority: P1)

**Goal**: Route Finder and application open-document events through the existing path-private desktop source boundary.

**Independent Test**: Deliver supported, duplicate, encoded, Unicode, non-file, missing, and forbidden URLs before and after startup and verify ordered safe results, exact-once session focus, and zero serialized paths.

- [x] T017 [P] [US2] Write failing file-URL conversion, non-file rejection, order, duplicate, startup, and redaction tests in crates/glitchpad-host/src/desktop_delivery.rs
- [x] T018 [P] [US2] Add macOS open-document cases to crates/glitchpad-host/tests/desktop_delivery_conformance.rs
- [x] T019 [US2] Implement file-only URL conversion and batch enqueueing in crates/glitchpad-host/src/desktop_delivery.rs
- [x] T020 [US2] Build the Tauri application explicitly and handle macOS RunEvent::Opened with ready notification and main-window focus in crates/glitchpad-host/src/lib.rs
- [x] T021 [US2] Validate the generated application document declarations against packaging/desktop/capabilities.json in scripts/check-macos-package.mjs
- [x] T022 [US2] Run non-regression suites covering crates/glitchpad-host/src/desktop_delivery.rs, crates/glitchpad-host/tests/desktop_delivery_conformance.rs, and apps/glitchpad/src/domain/desktop-delivery-gateway.test.ts in the hidden validation container

**Checkpoint**: Finder delivery reaches the same safe source authority and no URL or path crosses into interface state.

---

## Phase 5: User Story 3 - Use an accessible native macOS host (Priority: P2)

**Goal**: Bind WKWebView renderer, accessibility, and performance evidence to the exact candidate on native macOS.

**Independent Test**: Exercise Markdown and Mermaid in the installed application, complete the macOS accessibility matrix, and validate size/startup evidence in a receipt bound to the DMG manifest.

- [x] T023 [P] [US3] Add failing receipt tests for WKWebView, keyboard, focus, scaling, contrast, reduced motion, VoiceOver, renderer, size, and startup fields in scripts/check-macos-package.test.mjs
- [x] T024 [US3] Extend scripts/macos/test-package-lifecycle.mjs to record WKWebView version, native architecture, startup samples, and truthful automated/manual candidate states
- [x] T025 [US3] Add Markdown, Mermaid, platform-shortcut, accessibility, and S018 size/startup validation to .github/workflows/macos-package.yml
- [x] T026 [US3] Extend scripts/check-macos-package.mjs to validate both native-host receipts and their exact manifest, architecture, freshness, privacy, and performance bindings

**Checkpoint**: Candidate evidence is native, architecture-specific, path-free, and truthful about manual checks.

---

## Phase 6: User Story 4 - Verify an official macOS artifact (Priority: P2)

**Goal**: Make official status unreachable without live Developer ID, notarization, stapling, Gatekeeper, supply-chain, and clean-host evidence over final bytes.

**Independent Test**: Mutate or omit every evidence component and Apple trust state, verify deterministic failure, then prove a complete ad-hoc candidate passes candidate mode but cannot pass official mode.

- [x] T027 [P] [US4] Add failing Developer ID, hardened-runtime, timestamp, notarization, stapling, Gatekeeper, digest, secret-pattern, and stale-receipt cases in scripts/check-macos-package.test.mjs
- [x] T028 [US4] Generate final-byte checksums, package inventory, candidate provenance, and CycloneDX SBOM in scripts/macos/assemble-package.mjs and .github/workflows/macos-package.yml
- [x] T029 [US4] Implement live official Apple trust and complete evidence validation in scripts/check-macos-package.mjs
- [x] T030 [US4] Add an authorized-tag-only Developer ID and notarization authority contract without enabling publication in .github/workflows/release.yml
- [x] T031 [US4] Verify .github/workflows/macos-package.yml cannot publish or satisfy official mode and .github/workflows/release.yml cannot omit required Apple or supply-chain evidence

**Checkpoint**: Candidate evidence is complete and official evaluation remains authorization-, signature-, notarization-, and clean-host-gated.

---

## Phase 7: Polish and Cross-Cutting Concerns

**Purpose**: Close traceability, documentation, convergence, and pre-publication verification.

- [x] T032 [P] Add issue #63 traceability and documentation-impact decisions in changelog.d/63.added.md and specs/020-macos-packaging/verification.md
- [x] T033 Reconcile every FR/SC, acceptance scenario, edge case, and contract against specs/020-macos-packaging/tasks.md through a Spec Kit convergence pass
- [x] T034 Run formatting, lint, unit, security, documentation, encoding, mojibake, and aggregate gates exposed by package.json and crates/xtask/src/main.rs in the hidden validation container
- [x] T035 Commit and push the branch, require .github/workflows/macos-package.yml for the exact commit to pass, and open the official pull request
- [ ] T036 Monitor the pull request checks defined by .github/workflows/ci.yml and .github/workflows/macos-package.yml and address every review thread individually, with no more than two Codex review rounds total

---

## Dependencies and Execution Order

- Phase 1 establishes shared and macOS-specific governed inputs.
- Phase 2 depends on Phase 1 and blocks every user story.
- US1 and US2 can begin after Phase 2; US1 owns the artifact lifecycle and US2 owns native document ingress.
- US3 depends on the installable artifact from US1 and shared renderer behavior.
- US4 depends on final candidate bytes plus native receipts and activates evidence gates without publishing.
- Phase 7 depends on all four stories.

## Parallel Opportunities

- T002, T003, and T004 touch independent policy files after T001.
- T011 and T012 establish separate assembly and lifecycle test surfaces.
- T017 and T018 cover unit and integration delivery behavior in separate files.
- T023 and T027 cover candidate receipt and official Apple trust mutations independently before validator integration.

## Implementation Strategy

1. Correct the shared capability authority and make the package contract fail before enabling output.
2. Complete the universal artifact and open-document P1 stories with tests first.
3. Add native arm64/Intel lifecycle, WKWebView, accessibility, size, and startup evidence.
4. Add supply-chain and official fail-closed Apple trust gates.
5. Exhaust local container validation, then require a green native macOS branch workflow before pull-request publication.

## Notes

- `[P]` marks file-independent work, not permission to bypass dependency order.
- Every user-story task carries its story label and exact file path.
- Candidate ad-hoc signing is a runtime prerequisite, never an official trust claim.
- Official validation uses live Apple tools and final bytes; fixture-only evidence cannot satisfy it.
- No test, log, workflow, or receipt may expose native paths, document names or contents, account names, credentials, or secret values.

## Phase 8: Convergence

- [x] T037 Validate the staged DMG, application inventory, checksum, SBOM, provenance, and notices as one final-byte candidate evidence set per FR-012, FR-013, and SC-001
- [x] T038 Require explicit native core-contract evidence and evidence authority before clean-host receipts can mark read, edit, save, metadata, or recovery as passed per FR-020, FR-022, and SC-003
- [x] T039 Compare live official signing authority with the exact authorized Developer ID identity per FR-015 and FR-017
- [x] T040 Bind the retained accepted notarization submission and log to the final DMG digest per FR-016 and FR-017
- [x] T041 Enforce closed content-free receipt and package-evidence schemas that reject undeclared privacy-bearing fields per FR-022
- [x] T042 Record and validate semantic roles for every application inventory entry per plan: macOS package manifest data model
