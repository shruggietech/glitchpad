# Feature Specification: v0.2.0 Image Release Publication

**Feature Branch**: `codex/045-image-release-publication`

**Created**: 2026-11-02

**Status**: Specified

**Input**: Owner authorizes S045 under Spec-Kit and autopilot, automatic push and official PR, at most two external review rounds, and v0.2.0 tagging/publication once qualified, followed by owner final PR review and merge.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Qualify one release source (Priority: P1)

A release operator can identify one reviewed source and complete the required image, security, packaging, runtime, and provenance checks before creating an immutable v0.2.0 tag.

**Why this priority**: A published version must correspond to demonstrably qualified source and artifacts.

**Independent Test**: A candidate receipt binds all applicable terminal checks, both review rounds if requested, and four platform package campaigns to one source commit without relabeling earlier S044 evidence.

**Acceptance Scenarios**:

1. **Given** completed S044 on main and a repeated Linux provenance failure, **When** S045 repairs and qualifies the release path, **Then** the selected source includes the repair and receives its own applicable checks and review disposition before tagging.
2. **Given** a failed or missing required check, **When** qualification is evaluated, **Then** publication stays pending with the actual failure retained.

### User Story 2 - Obtain the official image release (Priority: P1)

A user can download v0.2.0 for Windows, macOS, Linux, or Android and compare published packages against their checksums, provenance, notices, and tested capability claims.

**Why this priority**: This completes the image release child issue #76 and epic #10 with a usable public increment.

**Independent Test**: Independently read back every public asset and release identity, verify expected package inventory and source binding, and confirm the public site matches the release tag.

**Acceptance Scenarios**:

1. **Given** a qualified source and owner publication authority, **When** the official tag is pushed, **Then** all four platform release workflows and the publisher succeed and publish the eight packages and their complete evidence.
2. **Given** partial publication or mismatched bytes, **When** independent readback occurs, **Then** closeout remains incomplete and existing tags/assets are not silently replaced.

### User Story 3 - Review a truthful closeout (Priority: P2)

The owner receives a reviewable PR with issue-level traceability, actual release evidence, resolved bot feedback, green applicable checks, and explicit remaining limitations.

**Why this priority**: Publication authority does not grant authority to merge the PR or imply unperformed manual qualification.

**Independent Test**: The PR stays open for owner review, includes the public release and site receipt, and distinguishes completed #76/#10 from remaining #66/#239 work.

**Acceptance Scenarios**:

1. **Given** all release criteria met, **When** S045 closes out, **Then** #76 and #10 have evidence-backed dispositions and the owner receives the open PR for final review and merge.
2. **Given** startup reference classification failure or unperformed manual rows, **When** release claims are written, **Then** those limitations remain visible and are not described as reference-hardware or manual passes.

### Edge Cases

- Fresh dependency retrieval fails after package assembly: provenance must use the already acquired locked inputs and fail closed for missing inputs.
- Source changes after qualification: prior source-bound receipts remain historical; requalify the changed source before tagging.
- Existing v0.2.0 tag or release: inspect identity and stop conflicting replacement; never force a tag or overwrite published bytes.
- Tag workflows or Pages fail after tag creation: retain failure evidence, repair the demonstrated cause, and report publication incomplete until the exact public result is verified.
- No separate security bot receipt arrives: record absence and rely only on actual applicable security checks and received reviews.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: S045 MUST trace #76 and #10 separately and exclude deferred dependency upgrades, PDF work, and unrelated manual qualification.
- **FR-002**: Qualification MUST identify the exact source, required terminal check outcomes, package campaigns, and external review disposition before v0.2.0 tagging.
- **FR-003**: Final provenance MUST derive from the unchanged locked dependency graph already acquired during preparation; missing cached inputs MUST fail rather than trigger a fresh network dependency during final assembly.
- **FR-004**: All eight official platform packages MUST retain their expected version, source identity, byte hashes, notices, SBOM, signatures or declared signing status, and repository attestations.
- **FR-005**: The official release MUST expose the complete expected asset inventory and its tag/source identity; every downloaded asset MUST be independently checked against its public checksum and manifest.
- **FR-006**: Public release notes, product/specification matrices, associations/intents, and site MUST agree on v0.2.0 and activate only the already tested image formats; PDF and office support MUST remain unadvertised.
- **FR-007**: The operator MUST retain failed campaigns and actual evidence classes, including hosted startup results and reference classification failures; unavailable physical ARM64 Android and manual screen-reader checks MUST NOT become release gates. Under the owner decision dated 2026-11-03, the legacy reference-hardware startup prerequisite is retired for v0.2.0; the existing automated hosted checks and 10000 ms ceiling remain required, with actual 1500/2500 ms classifications visible and #239 open.
- **FR-008**: The operator MUST automatically push and open the official PR, respond to every received review comment, resolve actionable findings, and use at most two external review rounds.
- **FR-009**: The operator MUST publish the immutable v0.2.0 tag and release only after qualification, then leave the S045 PR open for the owner's final review and merge. This explicit publish-before-final-merge authority permits the reviewed, qualified S045 source to be tagged without merging the PR.
- **FR-010**: Partial publication, failed checks, mismatched assets, and unfulfilled issue criteria MUST remain reported as incomplete; existing public tags and release assets MUST NOT be replaced silently.

### Key Entities

- **Candidate**: Exact source commit with applicable check runs, review rounds, failed and successful campaigns, and qualification disposition.
- **Published release**: Immutable tag and source, eight packages, four evidence archives, aggregate checksum file, community manifest, and public site identity.
- **Closeout receipt**: Public readback results, issue dispositions, review resolution, current PR head, and explicit remaining limitations.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: One exact candidate has all applicable required checks terminal and successful, complete four-platform qualification evidence, and no unresolved actionable review feedback before tagging.
- **SC-002**: v0.2.0 exposes all 14 expected public assets, including eight packages, with independent hash, inventory, version, and source verification and a matching public site.
- **SC-003**: Every received review comment has an explicit disposition within at most two review rounds, and the final PR head has green applicable CI.
- **SC-004**: #76 and #10 close only with their actual release criteria met; #66 and #239 retain any remaining work, and no unperformed physical/manual/reference-hardware pass is claimed.
- **SC-005**: The final handoff links the published release and open PR and names any unverified behavior or deviation.

## Assumptions

- S044 merged source acdd4347582af8b5e2871fca77b8b6611aabaaa8 provides the image implementation; its original 7187403 receipts are historical and cannot be relabeled.
- Existing hosted runners and stable Android signing authority remain available; qualification must demonstrate their operation without exposing secrets.
- New PR #242 and remaining #226 upgrades change the native graph and remain deferred absent a demonstrated release blocker.
- A final receipt-only commit after publication may document the released source separately; it does not change or relabel the immutable release source, and receives its own applicable CI.

## Clarifications

### Session 2026-11-02

- Q: May S045 publish before the owner merges its PR? A: Yes. The owner's current instruction explicitly authorizes publication once qualified and asks for final review/merge afterward; tag the reviewed, fully qualified S045 source and leave the PR open.
- Q: Should deferred dependencies or unavailable physical/manual gates be added? A: No. Preserve current scope and S043 owner decisions; record real #66/#239 limitations.
- Q: Is unavailable reference-hardware startup evidence mandatory for v0.2.0? A: No. On 2026-11-03 the owner explicitly retired that legacy prerequisite and selected the existing hosted checks; numeric budgets and truthful reference classifications remain unchanged.
- Q: May repeated online provenance failures be bypassed? A: No. Repair the preparation/final-assembly boundary, retain locked complete metadata, and demonstrate fail-closed offline behavior.
