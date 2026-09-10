# v0.1.2 Release Handoff Contract

## Inputs

- Current reviewed S032 revision based on merged S029-S031 behavior.
- Product version `0.1.2`, tag `v0.1.2`, and Android version code `1002`.
- Existing stable Android release authority and protected repository values.
- Eight governed package definitions and the v0.1.2 release documentation set.

## Pull-request success

- Active version authorities and package identities agree on v0.1.2.
- Historical v0.1.0 and v0.1.1 records remain unchanged.
- Repository, security, documentation, package-policy, candidate, and lifecycle gates pass.
- Every Codex and security review comment is answered and resolved, with no more than two Codex rounds.
- No tag or GitHub release is created.

## Post-merge readiness success

- The source is current `main` at the reviewed merge commit.
- Release evidence and protected Android authority values are available without exposing their contents.
- Manual readiness completes without a publication mutation.
- No existing local or remote v0.1.2 tag or GitHub v0.1.2 release conflicts with the operation.

## Publication success

- One owner-approved annotated `v0.1.2` tag starts the four platform package workflows and release orchestrator.
- Every official package and evidence record identifies the same tag and source revision.
- One immutable GitHub release contains exactly eight application packages, four evidence bundles, checksums, and the community release manifest.
- Production documentation identifies the published version and links to the existing release.

## Failure

- The operation exits non-zero before publication when any identity, authority, package, evidence, review, or gate requirement is missing or inconsistent.
- Existing release bytes are never overwritten, prior tags are never moved, and no partial package family is described as successful.
