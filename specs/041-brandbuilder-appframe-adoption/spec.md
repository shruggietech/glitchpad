# Feature Specification: BrandBuilder AppFrame Adoption

**Feature Branch**: `codex/041-brandbuilder-appframe-adoption`

**Created**: 2026-09-19

**Status**: Ready for Planning

**Input**: Adopt the exact verified BrandBuilder S042 Glitchpad kit and prove the shared AppFrame shell in the actual Android WebView and Windows Tauri hosts.

## Clarifications

### Session 2026-09-19

- Q: Which layer owns mobile safe-area and keyboard geometry? A: Generated AppFrame owns safe-area and IME geometry. Tauri supplies host capabilities and retains native titlebar regions, with no duplicate content padding.
- Q: What counts as host evidence? A: Android evidence runs in Glitchpad's real WebView on emulators or devices, and Windows evidence builds and smokes the real Tauri shell. Browser simulation is supporting evidence only.
- Q: How should missing historical timing or review-round data be handled? A: Record the limitation and establish a prospective baseline. Never invent observations.

## User Scenarios & Testing

### User Story 1 - Consume one pinned shell contract (Priority: P1)

As a Glitchpad maintainer, I can import one complete verified kit and compose the application through its generated AppFrame without reconstructing adapter behavior locally.

**Independent Test**: Sync the immutable upstream artifact, verify its receipt and manifest, and prove the production root imports the generated full-bleed AppFrame plus dependency-free environment bridge.

**Acceptance Scenarios**:

1. **Given** a successful upstream S042 workflow artifact, **When** it is synced into `brand/`, **Then** the complete manifest is verified and the receipt identifies the exact upstream revision and workflow.
2. **Given** the imported kit, **When** the frontend starts, **Then** one generated AppFrame owns the document root and the existing product shell is its child.

### User Story 2 - Preserve reachable Android controls (Priority: P2)

As an Android user, I can reach menus and document controls in portrait, landscape, cutout, and keyboard-visible states without duplicate inset consumption or competing root scrollers.

**Independent Test**: Real WebView instrumentation measures AppFrame ownership, safe-area variables, visual viewport/IME behavior, menu visibility, focus, and root scrolling on API 24 and API 36.

**Acceptance Scenarios**:

1. **Given** portrait or landscape Android host geometry, **When** the WebView renders, **Then** controls remain inside usable bounds and AppFrame is the sole web safe-area owner.
2. **Given** a focused editor with the IME visible, **When** visual viewport geometry changes, **Then** generated environment variables update and the active control remains reachable.

### User Story 3 - Preserve the Windows shell (Priority: P3)

As a Windows user, I retain the compact Tauri titlebar and document-first layout after shared AppFrame adoption.

**Independent Test**: Frontend shell checks and the Windows Tauri build/smoke prove titlebar separation, keyboard focus, menu reachability, and a single root scroll owner at narrow and normal widths.

**Acceptance Scenarios**:

1. **Given** the Windows Tauri host, **When** AppFrame is mounted, **Then** web content does not consume native titlebar geometry a second time.
2. **Given** narrow and normal desktop widths, **When** keyboard and menu interactions run, **Then** existing compact shell behavior remains available.

### User Story 4 - Hand over reproducible evidence (Priority: P4)

As a future agent, I can locate the pinned contract, authority order, recovery path, exceptions, verification commands, and truthful pilot observations without conversation memory.

**Independent Test**: Start from repository instructions and follow only committed links to locate the receipt, generated guidance, host evidence, limitations, and upstream/downstream traceability.

## Requirements

### Functional Requirements

- **FR-001**: The repository MUST consume the complete, exact upstream S042 verified-kit artifact and record its immutable source revision, workflow, artifact identity, manifest version, and checksums.
- **FR-002**: Production Glitchpad MUST render through generated AppFrame using its bounded `full-bleed` layout and dependency-free environment bridge.
- **FR-003**: AppFrame MUST be the sole web owner of safe-area, visual viewport/IME, and document-root geometry. Existing Tauri-native titlebar ownership MUST remain separate.
- **FR-004**: The root viewport MUST declare `viewport-fit=cover`, retain exactly one web safe-area owner, and reject duplicate or missing ownership in automated checks.
- **FR-005**: The existing application menu, document surface, keyboard focus, and compact responsive behavior MUST remain reachable.
- **FR-006**: Android evidence MUST execute against the real Glitchpad WebView for portrait, landscape, IME, and display-cutout profiles on the existing API 24 and API 36 jobs.
- **FR-007**: Windows evidence MUST include the real Tauri build or package contract plus frontend shell assertions. Browser-only evidence MUST NOT satisfy the host claim.
- **FR-008**: Generated BrandBuilder agent governance MUST be merged into root `AGENTS.md` without replacing human-maintained repository instructions.
- **FR-009**: Upstream issue #219, downstream issue #196, both pull requests, revisions, tests, observations, limitations, and merge order MUST be cross-linked.
- **FR-010**: The adoption MUST introduce no network runtime dependency and MUST retain exact offline recovery.

### Key Entities

- **Pinned Kit Receipt**: Immutable identity for the imported upstream artifact and every included file.
- **AppFrame Ownership Contract**: The generated DOM, layout variant, environment variables, and host ownership boundary.
- **Host Evidence Record**: A non-substitutable result for Android WebView or Windows Tauri behavior.
- **Pilot Handover**: Linked observations, limitations, recovery steps, and follow-up capability gaps.

## Success Criteria

- **SC-001**: Kit synchronization and brand verification report zero missing, extra, or changed files.
- **SC-002**: Frontend tests reject bypassing AppFrame, duplicate safe-area ownership, missing `viewport-fit=cover`, and competing root scroll ownership.
- **SC-003**: API 24 and API 36 real-WebView evidence passes portrait, landscape, IME, and cutout assertions.
- **SC-004**: Windows Tauri build/package and shell checks pass with the adopted AppFrame.
- **SC-005**: A fresh session can recover the exact contract and verification entry points from committed repository instructions.
- **SC-006**: The aggregate documented validation gate passes, with zero UTF-8 BOMs, mojibake findings, or untracked generated artifacts outside the governed kit.

## Assumptions and Constraints

- Upstream S042 merges before this downstream branch. Until then, the exact successful upstream workflow artifact is the candidate authority.
- Existing native titlebar ownership is correct and is not redesigned in this slice.
- Screenshot approval is not substituted for measured host behavior, and browser emulation is not substituted for real-host evidence.
