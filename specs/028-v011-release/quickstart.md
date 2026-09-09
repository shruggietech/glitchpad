# Quickstart: v0.1.1 Corrective Release

## Pull-request validation

1. Run focused version, release-policy, package-contract, and documentation tests inside the repository validation container.
2. Run the complete repository gate inside the pinned validation container.
3. Confirm the platform pull-request workflows produce v0.1.1 candidates and complete their lifecycle checks.
4. Confirm no v0.1.1 tag or GitHub release exists.

Expected result: all active release identities agree, stale-version mutation tests fail as intended, every required local gate passes before push, and CI validates the same reviewed source revision.

## Advisory disposition validation

1. Confirm the locked Linux dependency graph reaches `glib` 0.18.5 only through the current Tauri/Wry/WebKitGTK/GTK family.
2. Confirm Glitchpad contains no direct use of `VariantStrIter`.
3. Confirm the cargo-deny exception remains limited to the named advisory and the S024 expiry remains unchanged.
4. Confirm the GitHub alert dismissal comment cites the S024 decision and does not claim the vulnerable code was removed.

Expected result: the alert is formally triaged as a time-bounded tolerable risk without an incompatible dependency override or a weakened advisory gate.

## Post-merge readiness

1. Confirm S028 is merged into current `main` and the reviewed commit is the intended release source.
2. Confirm the stable Android keystore and recovery material remain in owner custody outside the repository.
3. Manually dispatch the `release` workflow from current `main` and require readiness success with no release mutation.
4. Confirm neither a local nor remote `v0.1.1` tag nor a GitHub v0.1.1 release already exists.

Expected result: committed evidence and external authority are ready for one deliberate publication event.

## Owner-authorized publication

Follow `docs/releases/v0.1.1-operator-runbook.md` only after S028 is approved and merged. Create and push the exact annotated `v0.1.1` tag on the reviewed merge commit, then require every package workflow and the immutable release job to succeed before closing issue #149.
