# Quickstart: Validate S037

## Immutable release baseline

Captured before implementation on 2026-09-11:

- Tag `v0.1.2` resolves to commit `1d9b227b6ec6b343eac7d69578376a4c26ec45d7`.
- The official release was published at `2026-09-11T05:34:25Z` and contains 14 assets.
- The asset inventory consists of `community-release-manifest.json`, `SHA256SUMS`, four Android deliverables/evidence files, three Linux deliverables/evidence files, two macOS deliverables/evidence files, and three Windows deliverables/evidence files.
- S037 does not edit `.github/workflows/release.yml`; the final pre-push comparison must report the same tag resolution, publication timestamp, asset names, sizes, and update timestamps.

## Local validation

Run all repository commands through the approved hidden Docker launcher:

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '-v', 'A:\Code\glitchpad:/workspace', '-w', '/workspace', 'glitchpad-validation:latest', 'bash', '-lc', 'pnpm check:public-release && pnpm check:config && pnpm docs:format && pnpm docs:lint && pnpm check:site')
```

Confirm the workflow policy tests reject untrusted deployment conditions, missing SHA comparison, pull-request checkout, excess permissions, and swallowed unexpected API failures.

## Local evidence

Completed on 2026-09-11 before pull-request publication:

- `pnpm check:public-release`: 22 tests passed, including stale-deployment, cleanup trigger, permission, identity, atomic lease, absent-ref, and error-propagation regressions.
- `node scripts/check-config.mjs`: 113 JSON and YAML files parsed and all exact workflow contracts passed.
- `pnpm docs:format` and `pnpm docs:lint`: formatting passed and 359 Markdown files produced zero lint issues.
- `pnpm check:site`: the introduction, 38 sections, compatibility route, 18 unit tests, and 73 browser tests passed.
- `cargo xtask check`: the complete repository gate passed in the rebuilt approved validation container, including Rust, frontend, platform-package, configuration, link, UTF-8, and mojibake checks.
- An isolated bare-repository probe proved that the exact-SHA lease deletes the unchanged ref and rejects deletion after a concurrent branch advance.

## Requirement traceability

| Scope | Requirements | Pre-merge evidence | Merge-dependent evidence |
| --- | --- | --- | --- |
| Issue #170 | FR-001 through FR-011, FR-019 through FR-021 | Exact deployment predicate, same-artifact dependency, serialized Pages job, full local site contract | Main deployment provenance equals the S037 merge revision and the production verifier passes all routes |
| Issue #135 | FR-012 through FR-019, FR-021 | Least-privilege source contract and 12 cleanup-focused negative mutation cases within the 22-test suite | Close-event run deletes the unchanged remote S037 branch or exposes an actionable failure |
| Release integrity | FR-005, FR-006, FR-020 | v0.1.2 tag and 14-asset baseline; release workflow unchanged | Post-publication tag, release record, names, sizes, and update timestamps remain identical |

## Pull-request validation

1. Push `codex/s037-post-merge-automation` and open the official pull request with `Closes #170` and `Closes #135`.
2. Confirm every required hosted check is green and the pull-request docs run builds without a Pages deployment.
3. Address every automated review comment, resolve its thread, and request at most one manual second Codex review round.
4. Compare the v0.1.2 release tag and asset inventory with the pre-change baseline; no identity or bytes may change.

## Post-merge observation

1. Confirm the main-branch docs run built, uploaded, deployed, and verified the exact merge revision.
2. Read `https://glitchpad.com/deployment.json` and confirm version `0.1.2`, the merge revision, build time, and the canonical v0.1.2 release URL.
3. Confirm the production introduction, 38 ordered section routes, representative early/middle/final content, diagrams, metadata, navigation, internal links, and legacy compatibility route pass the verifier.
4. Confirm `codex/s037-post-merge-automation` no longer exists remotely, or capture the visible cleanup failure without deleting any other branch.
5. Confirm issues #170 and #135 close only with the merge and their final evidence is recorded during housekeeping.
