# Tasks: Ship Windows Packages

**Input**: Design documents from `/specs/019-windows-packaging/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: S019 requires contract, native delivery, package assembly, artifact, and clean-machine evidence. Test tasks precede their implementations.

**Organization**: Tasks are grouped by user story and ordered so the Windows branch build is fully validated before pull-request publication.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish governed package inputs and dependencies.

- [x] T001 Create the stable text-family and forbidden-extension inventory in packaging/windows/capabilities.json
- [x] T002 [P] Define candidate names, inventory, size, signing, and evidence rules in packaging/windows/package-contract.json
- [x] T003 [P] Add the reviewed third-party attribution inventory in packaging/windows/THIRD_PARTY_NOTICES.txt
- [x] T004 Add compatible official dialog and single-instance plugin versions to Cargo.toml, crates/glitchpad-host/Cargo.toml, Cargo.lock, and deny.toml

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the shared contracts required by every package and delivery story.

- [x] T005 Write failing static contract tests for capabilities, forbidden formats, Tauri overlay metadata, candidate names, and official signing fail-closure in scripts/check-windows-package.test.mjs
- [x] T006 Implement the static Windows package contract validator in scripts/check-windows-package.mjs
- [x] T007 Add the explicit current-user NSIS, icon, resource, association, and WebView2 overlay in crates/glitchpad-host/tauri.s019-windows.conf.json
- [x] T008 [P] Add package-contract documentation and operator boundaries in packaging/windows/README.md
- [x] T009 Register Windows package validation with package.json, crates/xtask/src/main.rs, scripts/validation-files.mjs, and .github/labeler.yml
- [x] T010 Run the static package tests and repository configuration gates in the hidden validation container

**Checkpoint**: Package policy and validation are authoritative before product or workflow integration.

---

## Phase 3: User Story 1 - Install and remove Glitchpad cleanly (Priority: P1) MVP

**Goal**: Produce and validate a current-user NSIS candidate with clean lifecycle behavior.

**Independent Test**: Build on Windows 11, install silently as the current user, launch and probe the application, repair or upgrade, uninstall, and verify binaries/associations are removed while fixture documents remain unchanged.

- [x] T011 [P] [US1] Write failing installer assembly and destructive-target safety tests in scripts/windows/test-assemble-package.ps1
- [x] T012 [P] [US1] Write failing installer lifecycle contract tests in scripts/check-windows-package.test.mjs
- [x] T013 [US1] Implement deterministic candidate staging, canonical renaming, hashing, and receipt generation in scripts/windows/assemble-package.ps1
- [x] T014 [US1] Implement non-interactive current-user install, launch probe, repair, uninstall, document-preservation, and registration-cleanup smoke in scripts/windows/test-installer-lifecycle.ps1
- [x] T015 [US1] Extend scripts/check-windows-package.mjs to validate installer inventory, lifecycle receipts, exact versions, icons, associations, and final-byte size classification
- [x] T016 [US1] Add Windows release-mode NSIS construction and lifecycle smoke to .github/workflows/windows-package.yml
- [x] T017 [US1] Run the PowerShell contract suite in a hidden container and record passing static lifecycle evidence

**Checkpoint**: The installer path is independently buildable and fails closed on incomplete lifecycle evidence.

---

## Phase 4: User Story 2 - Open only truthfully supported files (Priority: P1)

**Goal**: Route dialog, drop, command-line, association, and secondary-instance delivery through one native path-private source boundary.

**Independent Test**: Deliver supported, duplicate, relative, Unicode, long, shell-significant, missing, symlink, directory, and forbidden files through every native channel and verify ordered safe summaries, exact-once session focus, and zero serialized paths.

- [x] T018 [P] [US2] Write failing Rust normalization, bounded queue, redaction, ordering, overflow, and duplicate-delivery tests in crates/glitchpad-host/src/desktop_delivery.rs
- [x] T019 [P] [US2] Write failing cross-channel host conformance tests in crates/glitchpad-host/tests/desktop_delivery_conformance.rs
- [x] T020 [P] [US2] Write failing safe-summary decoding and exact-once interface tests in apps/glitchpad/src/domain/desktop-delivery-gateway.test.ts
- [x] T021 [P] [US2] Write failing App integration tests for Open, delivered session focus, Save As, and Print in apps/glitchpad/src/App.test.tsx
- [x] T022 [US2] Implement the path-private native delivery queue, process argument normalization, acquisition, dialog selection, and Save As boundary in crates/glitchpad-host/src/desktop_delivery.rs and crates/glitchpad-host/src/source/mod.rs
- [x] T023 [US2] Register single-instance first, dialog handling, startup arguments, drop handling, safe drain commands, and main-window focus in crates/glitchpad-host/src/lib.rs
- [x] T024 [US2] Implement bounded summary decoding and native delivery polling in apps/glitchpad/src/domain/desktop-delivery-gateway.ts
- [x] T025 [US2] Integrate Open, delivered source sessions, duplicate focus, Save As, and Print without persistent chrome in apps/glitchpad/src/App.tsx and apps/glitchpad/src/domain/commands.ts
- [ ] T026 [US2] Run Rust, TypeScript, path-redaction, cancellation, source-integrity, metadata, recovery, and persistence non-regression suites in the hidden validation container

**Checkpoint**: Every Windows entry path reaches the established source authority and no path crosses into interface state.

---

## Phase 5: User Story 3 - Run the portable distribution (Priority: P2)

**Goal**: Produce a self-contained portable ZIP without installation or association side effects.

**Independent Test**: Assemble and extract the ZIP, validate every inventory entry and digest, run from a user-writable directory, exercise non-association delivery, then delete the directory and verify no registration remains.

- [x] T027 [P] [US3] Write failing portable traversal, case-collision, required-file, unexpected-executable, and inventory-digest tests in scripts/check-windows-package.test.mjs
- [x] T028 [P] [US3] Add portable staging and ZIP round-trip cases to scripts/windows/test-assemble-package.ps1
- [x] T029 [US3] Extend scripts/windows/assemble-package.ps1 with deterministic portable inventory and ZIP construction
- [x] T030 [US3] Implement portable launch, command-line delivery, cleanup, and no-association smoke in scripts/windows/test-portable-lifecycle.ps1
- [x] T031 [US3] Add portable lifecycle validation and candidate upload to .github/workflows/windows-package.yml

**Checkpoint**: The portable artifact is independently runnable, enumerable, and side-effect free.

---

## Phase 6: User Story 4 - Verify an official Windows artifact (Priority: P2)

**Goal**: Bind complete supply-chain evidence to final bytes and make official status unreachable without authorized signatures and clean-machine evidence.

**Independent Test**: Mutate or omit every evidence component and signature state, verify deterministic failure, then validate a complete unsigned candidate while proving it cannot pass official mode.

- [x] T032 [P] [US4] Write failing candidate versus official evidence, digest mismatch, secret-pattern, and stale-receipt tests in scripts/check-windows-package.test.mjs
- [x] T033 [P] [US4] Define the content-free clean-machine receipt template in packaging/windows/clean-machine-receipt.template.json
- [x] T034 [US4] Generate final-byte checksums, package inventory, candidate provenance, and CycloneDX SBOM inputs in scripts/windows/assemble-package.ps1 and .github/workflows/windows-package.yml
- [x] T035 [US4] Implement complete candidate and fail-closed official evidence validation in scripts/check-windows-package.mjs
- [x] T036 [US4] Add an authorized-tag-only signing and GitHub attestation contract without enabling publication in .github/workflows/release.yml
- [x] T037 [US4] Verify unsigned branch candidates cannot satisfy official mode and release contexts cannot omit signature, timestamp, SBOM, provenance, or clean-machine evidence
- [ ] T038 [US4] Run package-size collection for the actual NSIS and ZIP candidates through scripts/run-performance.mjs and validate S018 classification

**Checkpoint**: Candidate evidence is complete and official evaluation remains strictly signature- and authorization-gated.

---

## Phase 7: Polish and Cross-Cutting Concerns

**Purpose**: Close traceability, documentation, and pre-publication verification.

- [x] T039 [P] Add issue #62 traceability and documentation-impact decision in changelog.d/62.added.md and specs/019-windows-packaging/verification.md
- [x] T040 Reconcile every FR/SC, acceptance scenario, edge case, contract, and task through a Spec Kit convergence pass
- [x] T041 Run formatting, lint, unit, security, documentation, encoding, mojibake, and aggregate repository gates in the hidden validation container
- [ ] T042 Commit and push the branch, dispatch .github/workflows/windows-package.yml against the exact commit, and require the native Windows run to pass before opening a pull request
- [ ] T043 Open the pull request only after T042 passes, then monitor CI and address every review thread with at most two requested Codex review rounds

---

## Dependencies and Execution Order

- Phase 1 establishes governed inputs and dependencies.
- Phase 2 depends on Phase 1 and blocks every user story.
- US1 and US2 can begin after Phase 2; US1 owns the installer and US2 owns entry behavior.
- US3 depends on candidate staging from US1 but remains independently runnable.
- US4 depends on both final candidate forms and activates evidence gates without publishing.
- Phase 7 depends on all four stories.

## Parallel Opportunities

- T002 and T003 can proceed after T001 without touching the same files.
- T011/T012 and T018/T019/T020/T021 cover separate test surfaces.
- T027 and T028 cover separate portable validation layers.
- T032 and T033 establish independent evidence inputs.

## Implementation Strategy

1. Make the governed package contract fail before enabling any bundle output.
2. Complete installer and delivery P1 stories with tests first.
3. Add the portable artifact using the same final-byte staging contract.
4. Add supply-chain and official fail-closed gates.
5. Exhaust local container validation, then require a green native Windows branch workflow before pull-request publication.

## Notes

- `[P]` marks file-independent work, not permission to bypass dependency order.
- Every user-story task carries its story label and exact file path.
- The official gate must fail when signing authority is absent; self-signed test artifacts never satisfy it.
- No test or workflow may expose native paths, fixture contents, account names, or secret values in evidence.
