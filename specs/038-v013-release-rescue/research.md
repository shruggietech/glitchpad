# Research: Publish a Working v0.1.3 Corrective Release

## Decision 1: Use v0.1.3 as a new immutable patch release

**Decision**: Publish the post-v0.1.2 corrections as v0.1.3 rather than modifying v0.1.2 or waiting for v0.2.0.

**Rationale**: The official v0.1.2 tag predates S035, which fixed the universal Markdown preview failure and persistent menu overlap reported against installed packages. A patch release is the smallest truthful vehicle for those compatible corrections.

**Alternatives considered**: Replacing v0.1.2 assets was rejected because published releases are immutable. Waiting for the image release was rejected because it would leave the stable primary workflow practically unusable. Naming the release v0.2.0 was rejected because no image capability is activated.

## Decision 2: Treat exact-package Markdown success as publication evidence

**Decision**: A source-tree or browser-only pass is insufficient. Publication must consume privacy-safe lifecycle receipts generated from exact installer, portable, disk-image, distribution-package, and Android candidates, with Windows explicitly proving rendered Markdown and recovery through supported delivery paths.

**Rationale**: The v0.1.2 regression escaped extensive source validation and was reported only after installation. The release gate therefore needs proof bound to the downloadable bytes and package revision.

**Alternatives considered**: Relying on component tests was rejected because they do not exercise packaged WebView and host delivery. A manual-only smoke was rejected because it cannot gate repeatable publication. Recording screenshots or document bodies was rejected because release evidence must remain privacy-safe and machine-verifiable.

## Decision 3: Reuse and strengthen the existing release pipeline

**Decision**: Advance the current manifests, package contracts, platform workflows, assembly logic, and release validator to v0.1.3, then make their existing S035 lifecycle receipts mandatory and mutually consistent.

**Rationale**: The repository already builds the governed eight-package matrix and S035 already added exact Windows delivery, recovery, scaling, and shared-shell checks. Strengthening reconciliation is proportional and avoids a second source of release truth.

**Alternatives considered**: A new release orchestrator was rejected as duplicative. Rebuilding v0.1.2 workflow code at runtime was rejected because historical source is already preserved by the v0.1.2 tag. Publishing only Windows was rejected because the project contract requires all four platform families.

## Decision 4: Advance active authorities while freezing historical records

**Decision**: Update active manifests, current public claims, technical specification, package contracts, workflows, and validators to 0.1.3. Add new v0.1.3 notes, receipt, and runbook. Do not edit v0.1.2 release documents, tag, release metadata, or assets.

**Rationale**: The constitution requires the current product and specification to move together, while immutable historical release records must continue describing the bytes they governed.

**Alternatives considered**: A repository-wide blind replacement was rejected because it would corrupt historical specifications and release evidence. Leaving active documentation at v0.1.2 was rejected because it would make current release claims inconsistent.

## Decision 5: Keep publication post-merge and owner-controlled

**Decision**: S038 prepares and validates the release in a pull request. The v0.1.3 tag is created only after the owner approves and merges the reviewed commit; the exact tag triggers platform packages, release assembly, and the release-authorized documentation handoff.

**Rationale**: A tag created from an unmerged or subsequently amended branch would not identify the reviewed mainline release source. The existing repository release model correctly separates review from publication authority.

**Alternatives considered**: Publishing from the pull-request head was rejected because review changes could invalidate the bytes. Automatically tagging immediately after CI was rejected because the user explicitly reserved the final review and merge ritual.

**Review-convergence deviation**: S037 allowed every successful `main` push to deploy the current site. S038 intentionally removes that authority because the v0.1.3 site links to an official release that does not exist until the tag transaction finishes. Pull requests and `main` pushes still build and validate the artifact. The release workflow supplies the exact reusable-workflow inputs after publication, and an operator may retry only the site handoff by supplying the same inputs manually; both routes check out the exact release tag and fail unless a non-draft release exists at that commit.

## Decision 6: Defer images and leave #66 open

**Decision**: S038 adds only release-critical stable-core evidence and does not claim to complete the broad #66 conformance matrix or begin issue #68.

**Rationale**: The urgent outcome is a usable official application. Completing every long-horizon conformance dimension or beginning a new renderer family would enlarge risk and delay the corrective package.

**Alternatives considered**: Bundling image architecture was rejected as unrelated to correcting the release. Closing #66 based on focused S038 evidence was rejected because its independent security, accessibility, and conformance scope remains broader.
