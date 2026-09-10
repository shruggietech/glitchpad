# Implementation Plan: Clear v0.1.2 Dependency Advisories

**Branch**: `codex/033-dependency-advisories` | **Date**: 2026-09-10 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/033-dependency-advisories/spec.md`

## Summary

Patch Next.js from 16.3.0 to 16.3.3, override the transitive `smol-toml` resolution to 1.7.1 because the current latest `markdownlint-cli2` release still pins 1.7.0, regenerate the lockfile, and prove the resulting dependency graph is free of the five known high-or-critical advisory records. Preserve every v0.1.2 release authority and public behavior.

## Technical Context

**Language/Version**: Node.js 24.11.x, pnpm 10.28.2, Rust workspace toolchain as pinned by the repository

**Primary Dependencies**: Next.js, React, markdownlint-cli2, smol-toml

**Storage**: Repository manifests and `pnpm-lock.yaml`; no application data changes

**Testing**: pnpm audit, focused repository checks, and `cargo xtask check`

**Target Platform**: Static exported documentation site and cross-platform release repository

**Project Type**: Monorepo containing desktop, Android, website, documentation, and release automation

**Performance Goals**: No runtime or build-performance change required

**Constraints**: Patch-only dependency changes, reproducible lockfile, no product version change, no release tag, no new runtime capability, hidden containerized local execution

**Scale/Scope**: Two dependency resolutions, five Dependabot alert records, one tracking issue (#167)

## Constitution Check

- **P1 Product identity and scope**: Pass. This slice changes dependency resolution only.
- **P2 Local-first and privacy**: Pass. No data flow or telemetry changes.
- **P3 Platform behavior**: Pass. No platform behavior changes.
- **P4 Safety and security**: Pass. The slice removes known vulnerable resolutions and validates the final graph.
- **P5 Release discipline**: Pass. v0.1.2 authorities remain unchanged and no tag or release is created.
- **P6 Verification**: Pass. Focused checks and the full local gate must pass before push.
- **P7 Proportionality**: Pass. Exact patch upgrades and one narrow transitive override are the smallest compatible solution.
- **P8 Licensing**: Pass. Next.js remains MIT and smol-toml remains BSD-3-Clause.

The post-design re-check also passes. Research and contracts introduce no new constitutional exception.

## Documentation Impact

No public documentation or normative product specification changes are required. The slice specification, plan, tasks, lockfile diff, and pull-request evidence record the dependency provenance and release invariants.

## Project Structure

### Documentation (this feature)

```text
specs/033-dependency-advisories/
├── checklists/requirements.md
├── contracts/dependency-security-contract.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json
pnpm-lock.yaml
site/package.json
scripts/
tests/
```

**Structure Decision**: Keep the implementation entirely within existing package authorities. Update the direct Next.js declaration in `site/package.json`, place the transitive security override in the root `package.json`, and regenerate the root lockfile.

## Complexity Tracking

No constitutional violations or complexity exceptions are required.
