# Quickstart: Publish a Working v0.1.3 Corrective Release

## 1. Capture the immutable baseline

1. Confirm the current branch is `codex/s038-v013-release-rescue` and the worktree is clean before implementation.
2. Record the peeled v0.1.2 tag commit, GitHub release identity, publication time, and complete fourteen-asset inventory.
3. Confirm local and remote `v0.1.3` tags and a v0.1.3 GitHub release are absent.
4. Record the S035, S036, and S037 merge revisions and the closure state of issues #171 and #172.

## 2. Validate identity reconciliation

Run the focused version, package-contract, public-release, and community-release checks in the approved validation container. Expected outcome: every active authority reports 0.1.3 or v0.1.3, historical v0.1.2 records remain explicitly historical, Android uses the next stable version code, and no new format is activated.

## 3. Validate practical-use evidence

Run focused lifecycle-policy tests before implementation and prove they reject a missing, stale, wrong-digest, wrong-source, privacy-bearing, or failed practical-use receipt. After implementation, require the Windows installer and portable policies to cover rendered Markdown, delivery paths, save/preview, source/retry recovery, governed display scales, and cleanup. Require shared macOS/Linux shell and Markdown smoke plus the governed Android installed-package matrix.

## 4. Run complete local validation

Use `scripts/invoke-docker-hidden.ps1` with the repository validation image for every non-Git command. Run focused release and package tests, configuration validation, public-surface checks, documentation formatting and linting, encoding and mojibake checks, and the complete `cargo xtask check` gate. Git and GitHub operations run only through `scripts/invoke-vcs-hidden.ps1`.

## 5. Publish the pull request

Confirm the v0.1.3 tag and release remain absent and v0.1.2 remains unchanged. Commit the reviewed source, push the S038 branch, open the official pull request, and identify #171 and #172 as fixed-but-not-yet-released defect lineage. Wait for all CI and automatic reviews, address every comment, resolve every thread, and invoke at most one explicit second `@codex review`.

## 6. Owner merge and later publication

Stop once the pull request is mergeable, all required checks are green, every review is satisfied, and the single permitted second review is complete. After owner merge, follow [release-handoff.md](contracts/release-handoff.md) and the generated v0.1.3 operator runbook to tag only the reviewed merge commit, publish the complete release, verify the primary installed-user workflow, and recheck v0.1.2 immutability.

## Evidence Matrix

| Scope | Required result |
| --- | --- |
| Version lockstep | Product, specification, package, workflow, public, and release authorities agree on 0.1.3 |
| Windows usability | Both exact package forms render Markdown and pass delivery, edit/save, recovery, geometry, termination, and cleanup scenarios |
| macOS/Linux usability | Exact packages launch, show representative Markdown, preserve shell geometry, terminate, and clean up |
| Android usability | Exact installed packages retain resolver discovery plus cold/warm provider-backed visible content and cleanup |
| Evidence completeness | Every package maps to digest, notices, SBOM, provenance, trust state, and required lifecycle receipts |
| Publication boundary | No v0.1.3 tag or release before owner merge; exact reviewed merge commit only afterward |
| Historical integrity | v0.1.2 tag, release metadata, and fourteen assets remain unchanged |
