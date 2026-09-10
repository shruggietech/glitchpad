# Data Model: Publish v0.1.2

## Corrective release identity

| Field | Rule |
| --- | --- |
| Product version | `0.1.2` across active manifests and public authorities |
| Tag | Exact `v0.1.2` |
| Source revision | Full reviewed merge commit |
| Android version code | `1002`, greater than v0.1.1 code `1001` |
| Historical predecessors | Immutable v0.1.0 and v0.1.1 releases and records |

## Governed package inventory

| Platform | Packages | Trust state                            |
| -------- | -------: | -------------------------------------- |
| Windows  |        2 | Unsigned community                     |
| macOS    |        1 | Ad-hoc signed, non-notarized community |
| Linux    |        2 | Repository-attested                    |
| Android  |        3 | Stable project key                     |

Every package owns a unique v0.1.2 filename, final-byte SHA-256 digest, source revision, manifest entry, software bill of materials, provenance, license and notice material, and platform trust evidence.

## Publication state transitions

1. **Prepared**: S029-S031 are merged, active version authorities are updated, and release documentation is reconciled.
2. **Reviewing**: S032 is an official pull request; platform candidates, lifecycle tests, CI, security bots, and no more than two Codex rounds run.
3. **Ready**: S032 is merged into current `main`, protected release authority is present, and manual readiness succeeds without publishing.
4. **Publishing**: The owner authorizes one annotated `v0.1.2` tag on the reviewed merge commit.
5. **Published**: All platform tag workflows succeed, one immutable GitHub release contains the governed inventory, and production documentation identifies v0.1.2.

Any stale identity, failed gate, missing signing authority, existing tag or release, mismatched revision, incomplete inventory, or unresolved review moves the attempt to **Blocked** before publication.
