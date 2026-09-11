# Contract: Post-Merge Automation

## Public-site publication

1. The docs workflow runs validation for pull requests, protected-main pushes, manual dispatches, and the existing reusable release call.
2. Artifact upload and deployment are authorized only by `(push && ref == refs/heads/main) || (deploy == true && release_tag == v0.1.2)`. The second path is supplied only through the declared reusable-workflow inputs, while manual dispatch exposes no such inputs.
3. The upload step uses the exact `site/out` tree produced by the successful build job.
4. The deploy job depends on that build, has only `contents: read`, `pages: write`, and `id-token: write`, targets `github-pages`, and shares one serialized production concurrency group across both authorization paths.
5. Inside the serialized job, the candidate revision must equal the repository's current default-branch revision before checkout, deployment, or verification. A stale release or delayed main candidate exits visibly without changing production.
6. The production verifier receives the workflow revision and version `0.1.2`; a mismatch fails the deployment job.
7. No site-only path invokes release creation, tag mutation, package assembly, signing, attestation, or asset upload.

## Merged-branch cleanup

1. The workflow source comes from the default branch and listens only for `pull_request_target` close events.
2. The workflow has only `contents: write`; it has no checkout, package installation, action-provided PR code, or pull-request code execution. Its single fixed inline shell treats event fields only as quoted environment data.
3. Job eligibility requires a merged pull request, exact same-repository head, a non-empty branch, and a head branch different from the default branch.
4. Event-derived repository, branch, and revision values enter the script through environment variables and are treated only as API data.
5. The workflow reads exactly `refs/heads/<branch>` immediately before deletion.
6. An absent ref returns `already-absent`; revision mismatch returns `moved`; neither requests deletion.
7. Revision equality permits a deletion refspec only with an explicit force-with-lease that requires the remote ref still equal the reviewed SHA atomically.
8. A rejected deletion triggers one diagnostic re-read: concurrent absence is success, concurrent movement is a safe skip, and unchanged permission, protection, or transport failure remains a workflow failure.

## Merge-dependent evidence

The pull request can prove configuration, negative cases, builds, and hosted CI before merge. The exact production revision and deletion of `codex/s037-post-merge-automation` are observable only after the user performs the merge ritual; these two observations remain explicitly pending at handoff.
