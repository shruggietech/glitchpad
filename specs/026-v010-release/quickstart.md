# Quickstart: v0.1.0 Release Publication

## Pull-request validation

1. Run `pnpm run check:community-release` inside the repository validation container.
2. Run `cargo xtask check` inside the repository validation container.
3. Confirm no tag or GitHub release was created.

Expected result: release-policy tests and the complete repository gate pass before push.

## Post-merge readiness

1. Confirm the stable Android keystore and recovery material are held outside the repository.
2. Configure the five repository secrets named in the [readiness contract](contracts/readiness-contract.md).
3. Manually dispatch the `release` workflow from current `main`.
4. Confirm `Validate release preparation` succeeds and no GitHub release is created.

Expected result: the workflow proves committed evidence and secret availability without publishing.

## Owner-authorized publication

Follow `docs/releases/v0.1.0-operator-runbook.md` only after S026 is approved and merged. Create and push the exact annotated `v0.1.0` tag on the reviewed merge commit, then require every package and release job to succeed before closing the release issue.
