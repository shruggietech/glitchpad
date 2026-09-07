# Tasks: Ship Linux Packages

**Input**: Design documents from `specs/021-linux-packaging/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Package, assembly, lifecycle, evidence, baseline, integration, and regression tests are required by the specification and precede their corresponding implementations.

**Organization**: Tasks are grouped by user story so each delivery concern remains independently testable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish governed Linux package inputs and the reproducible baseline environment.

- [x] T001 Create Linux package policy, notice, MIME map, receipt template, and operator guide in `packaging/linux/`
- [x] T002 [P] Add the Linux-only Tauri package overlay and desktop-entry template in `crates/glitchpad-host/tauri.s021-linux.conf.json` and `crates/glitchpad-host/linux/glitchpad.desktop.hbs`
- [x] T003 [P] Add a named Ubuntu 22.04 Linux-package target with pinned toolchains to `scripts/docker/validation.Dockerfile`
- [x] T004 [P] Register Linux package validation commands in `package.json` and `crates/xtask/src/main.rs`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define failing contract tests and shared final-byte evidence helpers before implementation.

- [x] T005 Add failing policy, desktop-entry, MIME, dependency, baseline, candidate-authority, and official-authority tests in `scripts/check-linux-package.test.mjs`
- [x] T006 [P] Add failing final-byte naming, inventory, checksum, and provenance tests in `scripts/linux/assemble-package.test.mjs`
- [x] T007 [P] Add failing AppImage/DEB lifecycle, receipt-privacy, exact-once delivery, removal, and performance tests in `scripts/linux/test-package-lifecycle.test.mjs`
- [x] T008 Extend the generic desktop SBOM platform contract for Linux and cover it in `scripts/generate-windows-sbom.mjs`, `scripts/generate-linux-sbom.mjs`, and package tests

**Checkpoint**: Contract tests fail for the missing Linux implementation while existing Windows/macOS behavior remains green.

---

## Phase 3: User Story 1 - Install and remove Glitchpad on supported Linux systems (Priority: P1) MVP

**Goal**: Produce and exercise portable AppImage and installable Debian candidates from the declared baseline.

**Independent Test**: Build both candidates in the governed Ubuntu 22.04 environment, run the AppImage and install/remove the Debian package in clean environments, and prove user documents remain unchanged.

- [x] T009 [US1] Implement deterministic AppImage and Debian final-byte assembly in `scripts/linux/assemble-package.mjs`
- [x] T010 [US1] Configure canonical AppImage and Debian construction, identity, icons, notices, and package metadata in `crates/glitchpad-host/tauri.s021-linux.conf.json`
- [x] T011 [US1] Implement package-form-aware extraction, installation, launch, removal, and preservation orchestration in `scripts/linux/test-package-lifecycle.mjs`
- [x] T012 [US1] Add the governed build, assembly, and clean Ubuntu 22.04/24.04 package matrix in `.github/workflows/linux-package.yml`
- [x] T013 [US1] Validate AppImage and Debian lifecycle scenarios locally with the named package image and record results in `specs/021-linux-packaging/verification.md`

**Checkpoint**: Both package forms build from Ubuntu 22.04 and complete their independent clean-environment install/run/remove path.

---

## Phase 4: User Story 2 - Open only truthfully supported documents (Priority: P1)

**Goal**: Provide precise freedesktop integration for stable document types and exact-once native delivery.

**Independent Test**: Compare actual package entries with the governed capability/MIME inventories, query installed state, and deliver supported and forbidden fixtures before and after startup.

- [x] T014 [US2] Implement the reviewed desktop entry and stable freedesktop mapping in `crates/glitchpad-host/linux/glitchpad.desktop.hbs` and `packaging/linux/mime-map.json`
- [x] T015 [US2] Implement static cross-contract desktop-entry, MIME, icon, and forbidden-format validation in `scripts/check-linux-package.mjs`
- [x] T016 [US2] Validate package-installed desktop/MIME state and post-removal cleanup in `scripts/linux/test-package-lifecycle.mjs`
- [x] T017 [US2] Exercise ordered startup and running-instance delivery for spaces, Unicode, leading dashes, duplicates, missing files, and non-file inputs in `scripts/linux/test-package-lifecycle.mjs`
- [x] T018 [US2] Add Linux delivery regression coverage to `crates/glitchpad-host/tests/desktop_delivery_conformance.rs` only if platform behavior exposes an uncovered contract gap

**Checkpoint**: Every advertised type is stable, every forbidden type is absent, and supported file-manager/command-line delivery reaches the active session exactly once.

---

## Phase 5: User Story 3 - Use an accessible and responsive native Linux host (Priority: P2)

**Goal**: Bind native WebKitGTK rendering, accessibility, startup, and package-size evidence to exact candidates.

**Independent Test**: Run Markdown/Mermaid and accessibility scenarios under the clean-environment matrix and validate closed receipts plus S018 performance classifications.

- [x] T019 [US3] Implement the closed clean-environment receipt and privacy validation in `packaging/linux/clean-environment-receipt.template.json` and `scripts/check-linux-package.mjs`
- [x] T020 [US3] Capture WebKitGTK identity, content-free readiness acknowledgements, hosted-smoke startup samples, and artifact-size classifications in `scripts/linux/test-package-lifecycle.mjs`
- [x] T021 [US3] Bind governed renderer, keyboard, focus, scaling, contrast, reduced-motion, and assistive-technology result fields to the lifecycle matrix in `.github/workflows/linux-package.yml`
- [x] T022 [US3] Verify both artifacts against S018 target/hard limits and reference-authority rules in `scripts/check-linux-package.mjs`

**Checkpoint**: Each package/environment receipt is closed, content-free, digest-bound, and truthfully classified without promoting hosted evidence to reference authority.

---

## Phase 6: User Story 4 - Verify official Linux delivery evidence (Priority: P2)

**Goal**: Bind both final artifacts to baseline, dependency, supply-chain, and fail-closed repository authority evidence.

**Independent Test**: Mutate or omit every governed evidence component and prove deterministic rejection, then validate a complete non-official candidate while official mode remains unavailable without authorized live attestation.

- [x] T023 [US4] Implement normalized package inventories, pair manifest, final checksums, and candidate provenance in `scripts/linux/assemble-package.mjs`
- [x] T024 [US4] Implement Ubuntu baseline, ELF architecture, imported GLIBC symbol, WebKitGTK, Debian dependency, and bundled-runtime gates in `scripts/check-linux-package.mjs`
- [x] T025 [US4] Implement the Linux CycloneDX wrapper and bind locked Rust/JavaScript/native facts in `scripts/generate-linux-sbom.mjs`
- [x] T026 [US4] Implement candidate versus official authority validation, pair completeness, evidence freshness, and live-attestation requirements in `scripts/check-linux-package.mjs`
- [x] T027 [US4] Add Linux authority preflight without publication to `.github/workflows/release.yml`
- [x] T028 [US4] Upload only explicit non-official candidates and content-free receipts from `.github/workflows/linux-package.yml`

**Checkpoint**: Candidate mode validates complete final bytes without authority inflation, and official mode fails closed unless both artifacts have live authorized repository evidence.

---

## Phase 7: Polish and Cross-Cutting Concerns

**Purpose**: Complete traceability, documentation, regression protection, and pre-publish evidence.

- [x] T029 [P] Document package usage, removal, data preservation, baseline, MIME behavior, candidate limits, and official evidence in `packaging/linux/README.md`
- [x] T030 [P] Record the user-visible Linux delivery increment in `changelog.d/64.added.md`
- [x] T031 [P] Register Linux package paths for labels and validation coverage in `.github/labeler.yml` and `scripts/validation-files.mjs`
- [x] T032 Run focused Node, Rust, frontend, formatting, desktop/MIME, and lifecycle contract tests in the approved hidden containers
- [x] T033 Build the actual AppImage and Debian pair locally in the governed Ubuntu 22.04 image and validate final bytes before any push
- [x] T034 Run the complete `cargo xtask check` repository gate in `glitchpad-validation:local`
- [x] T035 Check all changed text for UTF-8 without BOM and mojibake, then finalize `specs/021-linux-packaging/verification.md`
- [x] T036 Mark every implemented task complete in `specs/021-linux-packaging/tasks.md` and verify spec, plan, contracts, implementation, and evidence agree

---

## Dependencies and Execution Order

- **Setup**: Starts immediately.
- **Foundational**: Depends on setup and blocks implementation.
- **US1**: Depends on foundational tests and supplies final artifacts to later stories.
- **US2**: Depends on US1 package layouts and reuses the existing desktop delivery boundary.
- **US3**: Depends on US1 lifecycle orchestration and final artifact identities; can proceed alongside late US2 validation.
- **US4**: Depends on final package integration from US1/US2 and receipt definitions from US3.
- **Polish**: Depends on all stories; the complete local gate must pass before push or pull-request publication.

## Parallel Opportunities

- T002, T003, and T004 affect independent setup files.
- T006 and T007 define independent assembly and lifecycle tests after the central policy test begins.
- T019/T020 and T024/T025 affect separate receipt, lifecycle, validation, and SBOM surfaces once artifact layouts stabilize.
- T029, T030, and T031 are independent documentation and repository-integration updates.

## Implementation Strategy

1. Establish policy, package overlays, baseline tooling, and failing tests.
2. Deliver the AppImage/DEB pair and prove independent install/remove behavior.
3. Add exact freedesktop declarations and delivery evidence.
4. Add accessibility/performance receipts and final supply-chain/authority gates.
5. Run focused checks, actual package construction, clean-environment smoke, then the complete repository gate.
6. Push and open the pull request only after local evidence is green.

## Notes

- S021 includes issue #64 only.
- Tests precede implementation for every new contract.
- The Linux package image is built once and reused; do not install toolchains repeatedly in disposable containers.
- Branch and pull-request artifacts remain non-official and cannot publish.
- No task is complete until its real exit status and produced evidence have been inspected.
