# Data Model: v0.1.1 Corrective Release

## Patch release identity

| Field | Rule |
| --- | --- |
| Product version | `0.1.1` across active manifests and public authorities |
| Tag | Exact `v0.1.1` |
| Source revision | Full reviewed merge commit |
| Android version code | `1001`, strictly greater than v0.1.0 code `1000` |
| Historical predecessor | Immutable v0.1.0 release and records |

## Governed package inventory

| Platform | Packages | Trust state                            |
| -------- | -------: | -------------------------------------- |
| Windows  |        2 | Unsigned community                     |
| macOS    |        1 | Ad-hoc signed, non-notarized community |
| Linux    |        2 | Repository-attested                    |
| Android  |        3 | Stable project key                     |

Every package owns a unique v0.1.1 filename, final-byte SHA-256 digest, source revision, package manifest entry, software bill of materials, provenance, license and notice material, and platform trust evidence.

## Advisory disposition

| Field | Rule |
| --- | --- |
| Advisory | GHSA-wrw7-89jp-8q8g / RUSTSEC-2024-0429 |
| Resolved package | Transitive `glib` 0.18.5 on Linux |
| Dependency path | Tauri 2.11.5 through the current Wry/WebKitGTK/GTK 0.18 family |
| Direct affected API use | None in Glitchpad |
| Treatment | Tolerable risk under the merged S024 exception |
| Owner | Glitchpad maintainers |
| Expiry | First compatible Tauri GTK transition or v0.2 dependency pass, whichever occurs first |

## Publication state transitions

1. **Prepared**: S027 is merged, current version authorities are updated, documentation is reconciled, and the advisory disposition is recorded.
2. **Reviewing**: S028 is pushed as an official pull request; platform candidates, lifecycle tests, CI, and no more than two Codex rounds run.
3. **Ready**: S028 is merged into current `main`, protected release authority is present, and manual readiness succeeds without publishing.
4. **Publishing**: The owner authorizes one annotated `v0.1.1` tag on the reviewed merge commit.
5. **Published**: All platform tag workflows succeed and one immutable GitHub release contains the governed inventory and evidence.

Any stale identity, failed gate, missing signing authority, existing tag or release, mismatched source revision, incomplete inventory, or unresolved review transitions the attempt to **Blocked** before publication.
