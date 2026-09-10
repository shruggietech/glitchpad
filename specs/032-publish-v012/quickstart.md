# Quickstart: Publish v0.1.2

## Pull-request validation

1. Run focused version, release-policy, package-contract, public-surface, and documentation tests inside the repository validation container.
2. Run the complete repository gate inside the pinned validation container.
3. Confirm platform pull-request workflows produce v0.1.2 candidates and complete lifecycle checks.
4. Confirm no v0.1.2 tag or GitHub release exists.

Expected result: all active release identities agree, stale-version mutations fail as intended, every required local gate passes before push, and CI validates the same reviewed revision without publishing.

## Post-merge readiness

1. Confirm S032 is merged into current `main` and the reviewed commit is the intended source.
2. Confirm the stable Android keystore and recovery material remain in owner custody outside the repository.
3. Manually dispatch the `release` workflow from current `main` and require readiness success with no release mutation.
4. Confirm neither a local nor remote `v0.1.2` tag nor a GitHub v0.1.2 release exists.

Expected result: committed evidence and external authority are ready for one deliberate publication event.

## Owner-authorized publication

Follow `docs/releases/v0.1.2-operator-runbook.md` only after S032 is approved and merged. Create and push the exact annotated `v0.1.2` tag on the reviewed merge commit, then require every package workflow, immutable release job, and documentation deployment to succeed before closing issue #157.
