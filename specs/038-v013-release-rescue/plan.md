# Implementation Plan: Publish a Working v0.1.3 Corrective Release

**Branch**: `codex/s038-v013-release-rescue` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/038-v013-release-rescue/spec.md`

## Summary

Prepare v0.1.3 from current `main` as an immutable corrective release containing the S035 Markdown recovery and reserved-shell fixes plus the compatible S036 and S037 delivery corrections. Update every active version, package, workflow, public, and technical-specification authority in lockstep; preserve historical v0.1.2 records; require exact-package practical-use evidence in the release reconciliation; and provide an owner-controlled post-merge tag runbook. No tag, GitHub release, or release-authorized deployment occurs in the pull-request phase.

## Technical Context

**Language/Version**: Rust 1.96.0, TypeScript on Node.js 24.11.0, PowerShell 7.5 for governed Windows scripts, Kotlin/Gradle for Android package checks

**Primary Dependencies**: Tauri 2 desktop and Android hosts, React 19, Vite 7, pnpm 10.28.2, GitHub Actions package and release workflows

**Storage**: Local source files, package artifacts, JSON/TOML release contracts, workflow artifacts, and GitHub release assets; no service database

**Testing**: Rust unit and integration tests, Vitest frontend tests, Node.js contract tests, Playwright/Puppeteer production probes, Windows installer and portable lifecycle scripts, macOS/Linux package lifecycles, Android connected tests, release-policy validators, and `cargo xtask check`

**Target Platform**: Windows x86_64, macOS universal, Linux x86_64 AppImage and Debian package, Android universal/ARM64 APK and AAB, GitHub Releases, and the production documentation site

**Project Type**: Cross-platform desktop/mobile application with static documentation and governed release automation

**Performance Goals**: Preserve existing startup, interaction, memory, package-size, and lifecycle budgets; the corrective release adds no new runtime capability or performance budget

**Constraints**: Offline primary workflow, no document-content telemetry, exact-source artifact identity, v0.1.2 immutability, v0.1.3 product/specification lockstep, eight application packages, existing unsigned/non-notarized community trust model, hidden containerized local validation, and post-merge-only tag publication

**Scale/Scope**: One patch release, four platform families, eight application packages, fourteen-or-more release assets after evidence bundling, two practical-use defect lineages, and no new format associations

## Constitution Check

- **P1 File-owned viewport**: PASS. S038 ships the reserved-shell correction already reviewed in S035 and adds no permanent UI.
- **P2 Local files remain local**: PASS. Exact-package tests use local synthetic fixtures, require offline operation, and prohibit content-bearing evidence.
- **P3 Cross-platform foundation**: PASS. The governed Windows, macOS, Linux, and Android package families retain one stable capability boundary with platform-specific lifecycle evidence.
- **P4 Untrusted input fails safely**: PASS. Existing detection, containment, save, and recovery contracts remain unchanged and are exercised through exact packages.
- **P5 Specifications and releases move together**: PASS. Product manifests, technical specification, active public claims, release workflow, package contracts, and release documents advance together to 0.1.3.
- **P6 Verification precedes claims**: PASS. Publication remains gated on complete exact-package, security, documentation, and release-reconciliation evidence for one revision.
- **P7 Explicit proportional decisions**: PASS. S038 records the release-first deviation and limits changes to patch identity, practical-use evidence, release validation, and publication handoff.
- **P8 License compatibility**: PASS. No dependency or bundled-resource additions are planned; notices, SBOMs, and license evidence remain mandatory release assets.
- **Technical and documentation constraints**: PASS. UTF-8 without BOM, Mermaid TB layout where needed, pinned tools, Tauri ownership, and required documentation gates remain intact.

## Project Structure

### Documentation (this feature)

```text
specs/038-v013-release-rescue/
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── practical-use-evidence.md
│   └── release-handoff.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
.github/workflows/
├── android-package.yml
├── docs.yml
├── linux-package.yml
├── macos-package.yml
├── release.yml
└── windows-package.yml

apps/glitchpad/
├── package.json
└── src/domain/persistence.ts

crates/
├── glitchpad-core/src/lib.rs
├── glitchpad-host/
│   ├── Cargo.toml
│   ├── gen/android/app/build.gradle.kts
│   ├── tauri.conf.json
│   └── tauri.s0xx-*.conf.json
└── xtask/src/main.rs

docs/
├── glitchpad-technical-specification.md
└── releases/
    ├── v0.1.3.md
    ├── v0.1.3-operator-runbook.md
    └── v0.1.3-receipt.md

packaging/
├── android/package-contract.json
├── linux/package-contract.json
├── macos/package-contract.json
├── release/package-contract.json
└── windows/package-contract.json

scripts/
├── assemble-community-release.mjs
├── check-community-release.mjs
├── check-config.mjs
├── check-public-release.mjs
└── platform package and lifecycle validators

CHANGELOG.md
Cargo.lock
Cargo.toml
README.md
SECURITY.md
SUPPORT.md
package.json
pnpm-lock.yaml
```

**Structure Decision**: Extend the existing release authority, package contracts, lifecycle scripts, and validators. A parallel release framework would duplicate identity and evidence logic and increase the chance of another package/source mismatch.

## Implementation Phases

### Phase 0: Establish the Release Baseline

Capture the immutable v0.1.2 tag, release record, and fourteen-asset inventory; confirm v0.1.3 is absent; inventory active 0.1.2 references; and distinguish historical records from authorities that must advance.

### Phase 1: Advance the Active Release Identity

Update product and specification versions, Android version code, active package contracts, package builders, workflow triggers, artifact names, public claims, support/security authorities, and governed test expectations to v0.1.3. Historical v0.1.2 release documents and published assets remain untouched.

### Phase 2: Make Practical Use a Release Gate

Retain S035’s exact Windows installer/portable Markdown delivery and recovery coverage, verify shared desktop and Android lifecycles, and extend release assembly and policy checks so the final artifact set cannot publish without matching privacy-safe practical-use receipts from the exact package revision.

### Phase 3: Reconcile Documentation and Handoff

Write v0.1.3 release notes, receipt, and operator runbook; reconcile the technical specification, changelog, README, support/security policies, website metadata, and publication workflow; and document the reviewed merge commit placeholder as the only eventual tag authority.

### Phase 4: Validate and Review

Run focused release-policy tests first, then package-policy, public-surface, documentation, encoding, and complete repository gates in the approved container. Push the branch, open the official pull request, complete automatic review, invoke no more than one explicit second `@codex review`, resolve every thread, and stop for owner merge approval once CI is green.

## Documentation Impact

The release changes shipped-version identity and user-facing support claims. The technical specification, changelog, README, support policy, security policy, website content, package READMEs, package contracts, active workflow metadata, and new v0.1.3 release records must change together. Historical release documents remain frozen.

## Post-Design Constitution Re-check

PASS. The design preserves the file-first and offline product boundary, keeps all formats unchanged, validates exact package bytes across four platform families, excludes private content from evidence, maintains Apache-2.0 distribution records, advances specification and product identity together, and defers publication until owner-authorized merge and exact tagging.
