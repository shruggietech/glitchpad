# Feature Specification: Post-Merge Publication and Branch Cleanup

**Feature Branch**: `codex/s037-post-merge-automation`

**Created**: 2026-09-11

**Status**: Ready for Review

**Input**: User description: "Deliver S037 by closing the post-merge automation gap exposed after S036: publish validated current-release site changes from merged main without republishing immutable binaries, verify the sectioned documentation in production for issue #170, and automatically remove unchanged merged same-repository branches for issue #135."

## User Scenarios & Testing

### User Story 1 - Publish validated site changes after merge (Priority: P1)

A project maintainer merges an approved change that affects the public site and the validated static site is promoted from the resulting default-branch revision without recreating or replacing any released application artifact.

**Why this priority**: S036 is merged and locally verified, but the public site still serves the older release revision because the default-branch documentation workflow builds without deploying.

**Independent Test**: Merge a controlled site change, observe one successful publication for the merge revision, and prove that the existing release tag and all published binary assets remain unchanged.

**Acceptance Scenarios**:

1. **Given** a successful merge to the default branch, **When** the public-site workflow validates the resulting revision, **Then** that exact revision is deployed and verified on the production domain.
2. **Given** a pull-request validation run, **When** the site workflow completes, **Then** it builds and tests without receiving production deployment authority.
3. **Given** an existing immutable application release, **When** a site-only publication occurs, **Then** no release, tag, package, checksum, signature, attestation, or release asset is created, replaced, or deleted.
4. **Given** a site validation failure, **When** the default-branch workflow runs, **Then** no new production deployment is attempted.

---

### User Story 2 - Read the completed S036 documentation in production (Priority: P1)

A reader visiting `glitchpad.com` receives the sectioned Technical Specification introduced by S036, including its ordered navigation, representative content, compatibility route, diagrams, and metadata.

**Why this priority**: Issue #170 explicitly requires deployed verification, and closing the issue before that observation left its acceptance evidence incomplete.

**Independent Test**: Run the production verifier against the deployed merge revision and confirm the introduction, all navigation entries, representative early/middle/final pages, legacy route behavior, diagrams, metadata, and internal links.

**Acceptance Scenarios**:

1. **Given** the S037 merge has deployed, **When** production provenance is read, **Then** it identifies the exact merged default-branch revision and the current released product version.
2. **Given** the sectioned documentation manifest, **When** production is checked, **Then** the introduction and representative early, middle, and final section routes satisfy their documented contracts.
3. **Given** the former monolithic documentation URL, **When** it is opened in production, **Then** it presents the lightweight compatibility outcome and no monolithic specification body.

---

### User Story 3 - Remove merged feature branches safely (Priority: P2)

A maintainer completes a same-repository pull request and the unchanged merged branch is removed automatically, while unmerged, fork-owned, protected, moved, or recreated branches remain outside automatic deletion.

**Why this priority**: Repeated manual cleanup leaves stale short-lived branches and creates avoidable housekeeping after every completed slice.

**Independent Test**: Exercise the cleanup decision contract with merged, unmerged, fork, default-branch, moved-branch, missing-ref, successful-deletion, and permission-failure cases, then use the S037 pull request as controlled live evidence.

**Acceptance Scenarios**:

1. **Given** a merged pull request whose head belongs to this repository and still points to the reviewed head revision, **When** the close event is processed, **Then** the head branch is deleted.
2. **Given** a closed but unmerged pull request, a fork pull request, or the default branch as head, **When** the close event is processed, **Then** no deletion is attempted.
3. **Given** the branch moved or was recreated after the reviewed head revision, **When** cleanup runs, **Then** the branch remains and the skip reason is visible.
4. **Given** the branch is already absent, **When** cleanup runs, **Then** the result is a successful visible no-op.
5. **Given** an unexpected permission, protection, or service failure, **When** cleanup runs, **Then** the workflow fails visibly rather than claiming success.

### Edge Cases

- A direct default-branch site build succeeds while the production hosting service is temporarily unavailable.
- A pull-request run attempts to reach a deployment step without trusted default-branch authority.
- A release-tag publication and a default-branch site publication overlap and must not deploy out of order.
- Production caching temporarily exposes the prior revision after deployment completes.
- A merged branch is deleted manually before the cleanup event reaches it.
- A branch is advanced or recreated between pull-request merge and cleanup execution.
- The head repository is a fork or has a case-sensitive name mismatch.
- A branch name contains characters that would be unsafe if interpolated into executable source.
- The default branch or a protected branch is ever presented as a cleanup candidate.

## Requirements

### Functional Requirements

- **FR-001**: A successful default-branch public-site validation MUST produce one production deployment of the exact validated revision.
- **FR-002**: Pull-request and other untrusted workflow contexts MUST build and test the public site without receiving production deployment authority.
- **FR-003**: The deployment artifact MUST be the same static export produced by the successful validation job for that revision.
- **FR-004**: Production verification MUST run after deployment and MUST fail the workflow when the deployed revision, released version, routes, navigation, diagrams, metadata, compatibility outcome, or internal links do not match the approved site contract.
- **FR-005**: A site-only publication MUST NOT create, replace, mutate, or delete the current release tag, GitHub release, application packages, checksums, signatures, attestations, SBOMs, or release evidence.
- **FR-006**: Release-tag publication MUST retain its existing site-publication path and immutable release gates.
- **FR-007**: Concurrent site-publication attempts MUST serialize so an older revision cannot overwrite a newer approved production revision.
- **FR-008**: A failed build, test, generated-content check, or export audit MUST prevent production deployment.
- **FR-009**: Production deployment authority MUST be limited to the minimum repository permissions required for Pages publication and provenance verification.
- **FR-010**: Production deployment evidence MUST record the exact source revision, current released product version, build time, and current immutable release destination.
- **FR-011**: The live site MUST satisfy every deployed-result acceptance criterion that remained open in GitHub issue #170.
- **FR-012**: A branch-cleanup workflow MUST process only pull-request close events and MUST attempt deletion only when the pull request was merged, the head repository exactly matches this repository, and the head is not the default branch.
- **FR-013**: Branch cleanup MUST make the pull request's reviewed head revision an atomic server-side precondition of deletion and MUST preserve a branch moved or recreated before or during cleanup.
- **FR-014**: Branch cleanup MUST treat an already-absent branch as a successful visible no-op.
- **FR-015**: Unexpected branch protection, permission, or service failures MUST remain visible workflow failures.
- **FR-016**: The branch-cleanup workflow MUST receive only repository-content write authority, MUST NOT check out repository or pull-request content, and MUST NOT execute pull-request-controlled code.
- **FR-017**: Event-derived branch names and revisions MUST be passed as data and MUST NOT be interpolated into executable source.
- **FR-018**: Automated contract validation MUST cover successful deletion, merged-state gating, same-repository gating, default-branch exclusion, revision mismatch, already-absent behavior, and unexpected failures.
- **FR-019**: The S037 pull request MUST provide controlled post-merge evidence that the production site reaches the merged revision and that its unchanged feature branch is removed.
- **FR-020**: S037 MUST preserve product version 0.1.2, current capability claims, canonical Technical Specification content, and immutable v0.1.2 release assets.
- **FR-021**: S037 MUST record requirement-to-evidence traceability for GitHub issues #170 and #135 and report any merge-dependent evidence explicitly before handoff.

### Key Entities

- **Site revision**: The exact default-branch commit whose static export passed validation and is eligible for production publication.
- **Site artifact**: The validated static export promoted to production without rebuilding or changing release binaries.
- **Production provenance**: The deployed version, source revision, build timestamp, and immutable release destination used to prove what readers receive.
- **Cleanup candidate**: A closed pull request described by merge state, head repository, head branch, reviewed head revision, and default branch.
- **Current branch reference**: The repository branch state read immediately before a deletion decision.
- **Cleanup outcome**: Deleted, skipped as ineligible, skipped because moved, already absent, or failed unexpectedly.
- **Immutable release authority**: The existing v0.1.2 tag, release record, packages, checksums, signatures, attestations, SBOMs, and evidence that site-only publication cannot mutate.

## Success Criteria

### Measurable Outcomes

- **SC-001**: One hundred percent of successful default-branch site validations deploy the exact validated static artifact, while zero pull-request validation runs receive deployment authority.
- **SC-002**: Production provenance reports the S037 merge revision and product version 0.1.2 within one completed deployment cycle.
- **SC-003**: Production verification reports zero failures across the documentation introduction, 38 ordered section routes, representative content, legacy compatibility behavior, diagrams, metadata, navigation, and internal links.
- **SC-004**: Comparison of the v0.1.2 release before and after site publication reports zero changed tags, release records, or release assets.
- **SC-005**: One hundred percent of eligible unchanged same-repository merged branches are deleted, while zero unmerged, fork, default, moved, recreated, or protected branches are deleted by the cleanup workflow.
- **SC-006**: All governed cleanup outcomes have automated contract coverage, including one successful deletion and every required safe skip or visible failure class.
- **SC-007**: The S037 branch is absent from the remote repository after merge, or the cleanup run exposes an actionable failure without deleting any other branch.
- **SC-008**: All local and hosted format, documentation, security, workflow-contract, static-site, and repository regression gates complete with zero failures before handoff.
- **SC-009**: Every acceptance criterion from issues #170 and #135 maps to automated evidence or an explicit merge-dependent production observation.

## Assumptions

- The public site represents the current released product while its implementation and documentation may receive corrective presentation updates between binary releases.
- A successful push to the protected default branch is a trusted publication source after the same static artifact passes the full site validation gate.
- The current release remains v0.1.2 throughout S037, and changing release content or capability claims requires a separate release slice.
- GitHub Pages remains the production host and supports serialized deployments through the repository's protected environment.
- A repository-owned close-event workflow is preferable to enabling opaque native deletion alone because issue #135 requires an auditable revision guard and visible failure behavior.
- The S037 merge event can serve as the controlled production and branch-cleanup observation, so both final observations remain explicitly pending at pull-request handoff.

## Scope Boundaries

- S037 changes public-site deployment orchestration, branch-cleanup automation, their contract validation, and issue-level evidence for #170 and #135.
- S037 does not publish or replace application binaries, create a release, change the product/specification version, add product capabilities, or modify the canonical Technical Specification.
- Image architecture (#68), stable-core conformance expansion (#66), and unrelated platform behavior remain separate work.
