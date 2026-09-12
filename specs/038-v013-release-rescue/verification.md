# Verification: Publish a Working v0.1.3 Corrective Release

## Immutable v0.1.2 Baseline

Captured before S038 implementation on 2026-09-11.

| Authority | Baseline |
| --- | --- |
| Peeled tag commit | `1d9b227b6ec6b343eac7d69578376a4c26ec45d7` |
| GitHub release database ID | `386806490` |
| Published at | `2026-09-11T05:34:25Z` |
| Release URL | `https://github.com/shruggietech/glitchpad/releases/tag/v0.1.2` |
| Release state | Published, not draft, not prerelease |
| Asset count | 14 |

| Asset | Bytes | Updated at |
| --- | --: | --- |
| `community-release-manifest.json` | 2,514 | `2026-09-11T05:34:22Z` |
| `glitchpad-0.1.2-android-arm64.apk` | 14,304,843 | `2026-09-11T05:34:23Z` |
| `glitchpad-0.1.2-android-evidence.tar.gz` | 30,712,847 | `2026-09-11T05:34:24Z` |
| `glitchpad-0.1.2-android-universal.aab` | 13,246,743 | `2026-09-11T05:34:23Z` |
| `glitchpad-0.1.2-android-universal.apk` | 25,426,431 | `2026-09-11T05:34:24Z` |
| `glitchpad-0.1.2-linux-evidence.tar.gz` | 14,512,131 | `2026-09-11T05:34:24Z` |
| `glitchpad-0.1.2-linux-x86_64.AppImage` | 7,662,072 | `2026-09-11T05:34:24Z` |
| `glitchpad-0.1.2-linux-x86_64.deb` | 6,745,074 | `2026-09-11T05:34:24Z` |
| `glitchpad-0.1.2-macos-evidence.tar.gz` | 22,333,240 | `2026-09-11T05:34:25Z` |
| `glitchpad-0.1.2-macos-universal.dmg` | 10,874,374 | `2026-09-11T05:34:25Z` |
| `glitchpad-0.1.2-windows-evidence.tar.gz` | 14,885,027 | `2026-09-11T05:34:25Z` |
| `glitchpad-0.1.2-windows-x86_64-setup.exe` | 4,134,911 | `2026-09-11T05:34:25Z` |
| `glitchpad-0.1.2-windows-x86_64.zip` | 5,161,264 | `2026-09-11T05:34:25Z` |
| `SHA256SUMS` | 821 | `2026-09-11T05:34:22Z` |

GitHub did not expose asset digests in the release-view response, so name, size, and update timestamp form the remote immutability comparison. Published `SHA256SUMS` remains part of the frozen asset set.

## Pre-Publication Boundary

- Local tag `v0.1.3`: absent.
- Remote tag `v0.1.3`: absent.
- GitHub release `v0.1.3`: absent.
- S035 merge: `fcae175a6181933fb3bcd0a075c5147c06e53225`.
- S036 merge: `c0527b15975338014f9756dcae545bbd055f810f`.
- S037 merge: `bd6f83d7677855b4322afa6fb20edbb63c23949d`.
- Issue #171: closed by S035 on `2026-09-11T16:09:29Z`.
- Issue #172: closed by S035 on `2026-09-11T16:09:30Z`.

The S038 pull request may prepare non-official candidates but cannot create or push the tag, create the GitHub release, or perform the release-authorized deployment. After owner merge, only the reviewed S038 merge commit may receive the annotated tag.

## Active-Version Change Map

The following active authorities advance from 0.1.2 to 0.1.3: workspace and application manifests, host configurations, Android version name and code, runtime diagnostics, active package contracts and builders, package and release workflow triggers and artifact names, current README/support/security/site claims, the technical specification, changelog, performance and provenance authorities, and release-policy expectations.

The following records remain frozen: `docs/releases/v0.1.2.md`, `docs/releases/v0.1.2-receipt.md`, `docs/releases/v0.1.2-operator-runbook.md`, prior Spec Kit artifacts, the v0.1.2 tag and GitHub release, and all fourteen v0.1.2 assets.

## Validation Ledger

| Gate | Result | Evidence |
| --- | --- | --- |
| Spec quality | Pass | 16 of 16 checklist items checked |
| Cross-artifact analysis | Pass | The initial 24 requirements, 12 buildable outcomes, 13 acceptance scenarios, and 25 tasks mapped with zero findings; review and CI convergence appended T026-T036, with all 36 tasks completed and mapped to the affected release requirements |
| Red-phase focused release contracts | Expected failure | 51 tests ran; 17 failed for unimplemented v0.1.3 identity, S038 handoff, active public authority, and practical-use receipt validation while 34 existing guards passed |
| Rust workspace compilation | Pass | `cargo check --workspace --all-targets` completed for v0.1.3 and refreshed only the four workspace package entries in `Cargo.lock` |
| Focused Windows release contracts | Pass | 77 release, public, assembly, Android, and Windows tests passed after the receipt schema and exact-manifest binding were implemented; both Windows lifecycle scripts parsed successfully in PowerShell |
| Cross-platform package contracts | Pass | 118 Windows, macOS, Linux, Android, aggregate assembly, promotion, and public-authority tests passed |
| Documentation generation | Pass | The generator produced the introduction, 38 ordered specification sections, compatibility route, and repository-derived facts; all 18 site unit and export-contract tests passed after advancing the revision-date assertion |
| Initial Spec Kit convergence | Pass | The pre-review requirement-to-task audit found every S038 acceptance requirement covered by T001-T025 |
| First automated review | Required changes | Four valid gaps were identified: Windows tag promotion occurred after receipts hashed the manifest, recovery evidence did not drive the packaged failure path, `main` could deploy release copy before v0.1.3 existed, and geometry evidence did not report each governed scale independently |
| Review-remediation convergence | Pass | T026-T030 moved tag promotion ahead of receipt creation, added a fixed one-shot packaged recovery probe and UI regression, emitted exact-manifest-bound 100/125/150/200 scale results across 48 production-CSS cases, restricted deployment to the release workflow after publication, and recorded the explicit S037 deviation |
| Second automated review | Required changes | The one permitted explicit `@codex review` completed on `3be35a8` and identified two valid gaps: tag-promoted Windows evidence still reached the candidate-mode validator, and the release-only site path could skip deployment permanently if `main` advanced during publication |
| Updated-commit Windows CI | Expected remediation | Both duplicate Windows candidate runs failed at the new scale proof because the Windows runner had no Puppeteer headless-shell installation; all other completed package, CodeQL, docs, security, and shared checks were green when the failure was inspected |
| Second-round convergence | Pass | T031-T034 split candidate and official Windows validation, installed the pinned Puppeteer headless shell before the scale proof, and replaced the skippable main-freshness rule with exact published-release/tag-commit authorization plus a guarded manual retry; 36 focused tests, all three live policy validators, YAML parsing, formatting, and 372-file Markdown lint passed |
| Final Windows receipt parsing convergence | Pass | The browser setup advanced both Windows jobs into the installed lifecycle. T035 replaced strict nested member access with explicit `ConvertFrom-Json -AsHashtable` schema extraction; the next run exposed runner-version-sensitive ordered-dictionary index binding, so T036 now resolves every receipt key by strict ordinal enumeration and guards that resolver. Both lifecycle scripts parse, all 12 focused Windows tests pass, and the live Windows policy validator succeeds before the next CI run. |
| Diff and ignore hygiene | Pass | Ignore authorities were unchanged, the tracked and untracked inventory contains only S038 sources and generated authorities, and `git diff --check` passed |
| Focused release and package regression | Pass | The v0.1.3 application production build, 20 performance and provenance tests, and PowerShell parsing for both modified Windows lifecycle scripts passed; the final post-review run passed 43 Windows and aggregate release tests plus both live policy validators |
| Complete repository gate | Pass | The post-remediation `cargo xtask check` exited 0 through `scripts/invoke-docker-hidden.ps1`; Rust format, Clippy, workspace tests, cargo-deny, 268 frontend tests, production builds, browser tests, package policies, public release checks, documentation format and links, 46 Mermaid renders, version consistency, and public-surface checks all passed |
| Encoding and corruption | Pass | The complete gate validated 955 text files as UTF-8 without BOM or common mojibake markers |
| Final diff integrity | Pass | `git diff --check` exited 0 after the last implementation change |
| Post-gate diff review | Pass | Manual review separated the installed and portable editable Markdown fixtures so each exact package lifecycle begins from pristine content, then hardened receipt sanitization against case-shifted sensitive keys and failure markers nested in arrays; focused policy and configuration gates passed after both corrections |
| Frozen v0.1.2 comparison | Pass | The peeled tag remains `1d9b227b6ec6b343eac7d69578376a4c26ec45d7`; release database ID, publication state and timestamp, and all 14 asset names, sizes, and update timestamps match the captured baseline |
| Final pre-publication boundary | Pass | Rechecked on 2026-09-12: local and remote `v0.1.3` tags remain absent and the GitHub releases API returns 404 for `v0.1.3`; no tag, release, or release-authorized deployment was created during S038 |

## Final Pre-Publication State

Revalidated after first-round automated review remediation and the complete repository gate on 2026-09-12. The reviewed branch contains only release-candidate source and evidence authorities. Official publication remains reserved for the owner-approved post-merge ritual in `docs/releases/v0.1.3-operator-runbook.md`.
