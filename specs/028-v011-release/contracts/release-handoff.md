# v0.1.1 Release Handoff Contract

## Inputs

- Current reviewed S028 revision based on merged S027 behavior.
- Product version `0.1.1`, tag `v0.1.1`, and Android version code `1001`.
- Existing stable Android release authority and five protected repository values.
- Eight governed package definitions and the v0.1.1 release documentation set.
- Existing S024 disposition for GHSA-wrw7-89jp-8q8g.

## Pull-request success

- Active version authorities and package identities agree on v0.1.1.
- Historical v0.1.0 release records remain unchanged.
- Repository, security, documentation, package-policy, candidate, and lifecycle gates pass.
- Every Codex review comment is answered and resolved, with no more than two requested rounds.
- No tag or GitHub release is created.

## Post-merge readiness success

- The source is current `main` at the reviewed merge commit.
- Release evidence and all protected Android authority values are available without exposing their contents.
- Manual readiness completes without a publication mutation.
- No existing local or remote v0.1.1 tag or GitHub release conflicts with the operation.

## Publication success

- One owner-approved annotated `v0.1.1` tag starts the four platform package workflows and release orchestrator.
- Every official package and evidence record identifies the same tag and source revision.
- One immutable GitHub release contains exactly eight application packages, four evidence bundles, checksums, and the community release manifest.

## Failure

- The operation exits non-zero before publication when any identity, authority, package, evidence, review, or gate requirement is missing or inconsistent.
- Existing release bytes are never overwritten, v0.1.0 is never moved or replaced, and no partial package family is described as a successful release.
