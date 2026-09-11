# Data Model: Post-Merge Publication and Branch Cleanup

## SitePublicationCandidate

| Field | Type | Rules |
| --- | --- | --- |
| eventName | string | Eligible only when `push` or an authorized reusable release call |
| sourceRef | string | Direct publication requires exactly `refs/heads/main` |
| sourceRevision | SHA-1 string | Must identify the revision used by the successful build |
| deployInput | boolean | Reusable publication requires `true` |
| releaseTagInput | string | Reusable publication requires exactly `v0.1.2` |
| artifactPath | string | Exactly `site/out` |

**Eligibility transition**: `validation-only` becomes `deployable` only after the build, tests, generated-content check, and artifact upload succeed. Any failure transitions to `rejected` and cannot reach deployment.

## ProductionProvenance

| Field | Type | Rules |
| --- | --- | --- |
| version | semantic version | Remains `0.1.2` in S037 |
| revision | SHA-1 string | Must equal the deployed workflow revision |
| builtAt | ISO-8601 timestamp | Emitted by the existing site build |
| releaseUrl | HTTPS URL | Remains the immutable v0.1.2 release destination |

**Validation transition**: `deployed` becomes `verified` only when the production verifier observes the expected version, revision, routes, navigation, diagrams, metadata, compatibility behavior, and links. A mismatch becomes `failed`.

## CleanupCandidate

| Field | Type | Rules |
| --- | --- | --- |
| merged | boolean | Must be `true` |
| headRepository | `owner/name` string | Must exactly equal the base repository full name |
| headBranch | string | Must be non-empty and differ from the default branch |
| reviewedHeadRevision | SHA-1 string | Snapshot from the merged pull request |
| defaultBranch | string | Protected from cleanup |

## CurrentBranchReference

| Field | Type | Rules |
| --- | --- | --- |
| ref | string | `refs/heads/<headBranch>` returned by GitHub |
| currentRevision | SHA-1 string | Read immediately before deletion |

## CleanupOutcome

| Outcome | Condition | Terminal behavior |
| --- | --- | --- |
| `ineligible` | Unmerged, fork-owned, missing head, or default branch | Successful skip with visible reason |
| `already-absent` | Ref lookup returns 404 | Successful idempotent no-op |
| `moved` | Current revision differs from reviewed revision | Successful skip with visible reason |
| `deleted` | Candidate eligible and revisions equal | Delete exact head ref and report success |
| `failed` | Unexpected lookup or delete error | Fail workflow visibly |

**Safety invariant**: Only `eligible + currentRevision == reviewedHeadRevision` can request deletion, and the remote accepts that deletion only while its ref still equals `reviewedHeadRevision`. A concurrent move invalidates the lease and cannot transition to `deleted`.
