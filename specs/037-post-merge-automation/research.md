# Research: Post-Merge Publication and Branch Cleanup

## Decision 1: Publish the validated artifact after successful protected-main pushes

**Decision**: Allow the existing docs workflow to upload and deploy `site/out` when the event is a push to `refs/heads/main`, while retaining the existing authorized reusable release inputs for `v0.1.2`. Pull requests and manual dispatches remain validation-only. The reusable path must not test `github.event_name == 'workflow_call'` because GitHub associates the called workflow's `github` context with the caller workflow.

**Rationale**: GitHub's Pages guidance describes the standard custom-workflow flow as build on pull requests and default-branch pushes, upload the generated artifact, and deploy only for a default-branch push. The current release-only gate left approved post-release documentation stranded after merge.

**Alternatives considered**: Republishing the v0.1.2 release was rejected because immutable release assets must not change. A separate duplicate Pages workflow was rejected because it could rebuild a different artifact and duplicate validation logic. Manual dispatch was rejected because it would preserve the housekeeping gap.

**Primary sources**: [Configuring a publishing source for GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Reusing workflow configurations](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations)

## Decision 2: Serialize every production Pages deployment in one job-level group

**Decision**: Put the deploy job in a shared production concurrency group, retain GitHub's bounded `queue: max`, and compare the candidate revision with the repository's current default-branch revision inside the serialized job before any deployment or verification step.

**Rationale**: GitHub documents job-level concurrency as the mechanism for limiting a deployment target to one active deployment and currently documents `queue: max` as valid workflow/job concurrency syntax. GitHub also states that job start order is not guaranteed, so serialization alone cannot establish revision order. The freshness read ensures any release or delayed main candidate older than current `main` exits before deployment regardless of scheduling order.

**Alternatives considered**: Keeping only `docs-${{ github.ref }}` was rejected because release-tag and main deployments could overlap. Relying only on the environment was rejected because environments and concurrency are independent. Assuming FIFO meant commit order was rejected because GitHub orders from wait time, not dispatch or revision order.

**Primary sources**: [Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [Control workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)

## Decision 3: Use a hardened `pull_request_target` close-event workflow

**Decision**: Add a base-branch-owned workflow triggered only by `pull_request_target: closed`, grant only `contents: write`, do not check out any code, and use `actions/github-script@v8` with event values passed through environment variables.

**Rationale**: The cleanup operation needs repository write authority after a pull request closes. GitHub documents that `pull_request_target` executes the workflow from the base repository's default branch and warns that checking out or executing pull-request code turns that authority into a supply-chain risk. A no-checkout API-only job keeps the privileged boundary narrow.

**Alternatives considered**: The repository's native delete-on-merge setting was rejected because issue #135 requires auditable SHA comparison and visible failure behavior. `pull_request` was rejected because fork contexts intentionally receive restricted tokens. `workflow_run` was rejected as an unnecessary second workflow and artifact trust boundary.

**Primary source**: [Securely using pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target)

## Decision 4: Make the reviewed SHA an atomic deletion precondition

**Decision**: Read the exact remote head with `git ls-remote`, treat its absence as an idempotent success, and delete with `git push --force-with-lease=refs/heads/<branch>:<reviewed-sha> <remote> :refs/heads/<branch>`. Re-read after a rejected push to distinguish a concurrent absence or move from an actionable permission, protection, or transport failure.

**Rationale**: Close-event metadata is a snapshot. A same-named branch may move or be recreated before cleanup runs, so repository identity and branch name alone are insufficient deletion authority. Git's explicit lease form makes the expected reviewed SHA a server-side condition of the deletion itself; the operation fails if the ref changes after the observation.

**Alternatives considered**: The issue's suggested REST `getRef` then `deleteRef` sequence was rejected during review because deletion is unconditional and leaves a time-of-check/time-of-use race. A list-branches scan was rejected as broader and less precise. Swallowing all Git failures was rejected because permission, protection, and service failures must remain actionable.

**Primary source**: [git-push documentation](https://git-scm.com/docs/git-push)

## Decision 5: Extend existing validators instead of adding runtime tooling

**Decision**: Encode the trusted deployment condition and cleanup workflow shape in `check-config.mjs`; extend the existing public-release test suite with negative mutation cases for untrusted deployment and unsafe cleanup regressions.

**Rationale**: This preserves the existing validation topology and issue #135's constraint against a new package script or repository helper. Source-contract checks are appropriate for declarative workflow security boundaries, while the S037 merge supplies the required live integration evidence.

**Alternatives considered**: A standalone cleanup script and package script were rejected as unnecessary repository surface. Executing the embedded workflow JavaScript locally was rejected because it would test a copied harness rather than GitHub's runtime. Relying only on hosted execution was rejected because unsafe workflow mutations need pre-merge rejection.
