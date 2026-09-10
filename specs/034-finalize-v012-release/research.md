# Research: Finalize v0.1.2 Release

## Decision: Move publication authority to S034

**Rationale**: S033 was merged after S032 and changes the dependency graph that will ship. Tagging the S032 commit would omit the release-blocking advisory fixes.

**Alternatives considered**: Keep S032 as the tag target and separately document S033. Rejected because the published bytes would contradict the release epic and security posture. Tag the current unreviewed branch. Rejected because publication must follow owner-approved merge.

## Decision: Validate the active handoff as one contract

**Rationale**: The notes, receipt, runbook, and changelog can drift independently. One deterministic validator can require S033, issue #167, and S034 authority across the exact active sources.

**Alternatives considered**: Rely on reviewer inspection. Rejected because the stale S032 instruction already survived review. Rewrite historical S032 artifacts. Rejected because they accurately record their original scope and must remain immutable.

## Decision: Preserve the post-merge tag ritual

**Rationale**: The current workflow already limits publication to the exact `v0.1.2` tag and refuses release replacement. S034 only needs to correct the source authority and evidence.

**Alternatives considered**: Publish automatically from the pull request or merge. Rejected because it removes the deliberate owner checkpoint and conflicts with the established release contract.
