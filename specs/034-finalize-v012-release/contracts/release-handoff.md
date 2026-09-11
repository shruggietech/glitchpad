# v0.1.2 Final Release Handoff Contract

## Pull-request success

- The active release notes, receipt, runbook, and changelog include S033 and issue #167.
- The runbook reserves the exact v0.1.2 tag for the reviewed S034 merge commit on current `main`.
- Release-policy mutation tests reject stale S032 publication authority and missing security traceability.
- Focused and complete local validation pass before push.
- Pull-request CI and every automated review are settled before owner handoff.
- No tag, release, or production deployment is created.

## Post-merge readiness success

- The checkout and remote default branch identify the same reviewed S034 merge commit.
- The manual release-readiness job passes on that exact `main` commit.
- The stable Android release authority is available without exposing its values.
- No local tag, remote tag, or GitHub release named v0.1.2 exists.

## Publication success

- One annotated `v0.1.2` tag on the reviewed S034 merge commit starts the four package workflows and release orchestrator.
- The immutable GitHub release contains exactly eight application packages, four evidence bundles, `SHA256SUMS`, and `community-release-manifest.json`.
- Every artifact and evidence record identifies version 0.1.2 and the tagged S034 source revision.
- The production site deploys only after the GitHub release exists and links to it.

## Failure

- Any stale authority, missing security traceability, failed check, inconsistent artifact, missing signing authority, or pre-existing release stops publication.
- Historical release bytes and tags are never replaced or moved.
