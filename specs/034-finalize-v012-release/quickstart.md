# Quickstart: Finalize v0.1.2 Release

## Pull-request validation

1. Run the community-release policy tests and live contract validation inside the pinned repository validation container.
2. Confirm mutation coverage rejects S032 as the active tag target and rejects missing S033 or issue #167 traceability.
3. Run the complete repository gate inside the pinned validation container.
4. Confirm no local or remote v0.1.2 tag and no GitHub v0.1.2 release exist.

Expected result: active release records describe the final S034 source boundary, all deterministic checks pass before push, and pull-request work performs no publication mutation.

## Post-merge readiness

1. Confirm S034 is merged and local `main` matches the reviewed remote merge commit.
2. Confirm all exact-main packaging and required CI checks are green.
3. Manually dispatch the release workflow from current `main` and require readiness success.
4. Confirm the stable Android key recovery copy is accessible and the v0.1.2 tag and release remain absent.

Expected result: the exact reviewed main commit is ready for the one owner-authorized tag action.

## Owner-authorized publication

Follow `docs/releases/v0.1.2-operator-runbook.md` after merge. Create and push the annotated v0.1.2 tag on the reviewed S034 merge commit, then require every package workflow, release publication job, and production-site deployment to succeed before closing issue #157.
