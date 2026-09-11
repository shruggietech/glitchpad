# Implementation Plan: Post-Merge Publication and Branch Cleanup

**Branch**: `codex/s037-post-merge-automation` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/037-post-merge-automation/spec.md`

## Summary

Publish the validated static site from successful protected-main pushes without mutating the immutable v0.1.2 release, preserve the existing release-triggered publication path, and add a least-privilege `pull_request_target` workflow that deletes only an unchanged merged same-repository head branch. Existing source-contract validation will be extended before workflow implementation, and the S037 merge will provide the two live observations that cannot occur before handoff: production revision promotion and automatic branch removal.

## Technical Context

**Language/Version**: GitHub Actions YAML, JavaScript ES modules on Node.js 24

**Primary Dependencies**: `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`, `actions/github-script@v8`, Git smart HTTP with explicit `--force-with-lease=<ref>:<expect>`, existing `yaml` validation dependency

**Storage**: Git references, GitHub Pages artifacts and deployment metadata; no application data storage

**Testing**: Node.js test runner, repository configuration validator, public-release policy tests, static-site build and production verifier, hosted GitHub Actions checks

**Target Platform**: GitHub Actions hosted Linux runners and GitHub Pages production hosting

**Project Type**: Repository automation and static-site continuous deployment

**Performance Goals**: One deployment cycle after each successful protected-main validation; branch cleanup completes in one close-event workflow without repository checkout

**Constraints**: Minimum token permissions, no PR-code execution, atomic expected-SHA branch deletion, no v0.1.2 release mutation, no product/specification version change, serialized and freshness-gated production deployment

**Scale/Scope**: Two workflows, existing configuration/public-release validation, one current production site, issues #170 and #135

## Constitution Check

- **P1 Sustainable Architecture**: PASS. The change extends existing docs/release orchestration and adds one isolated repository workflow rather than introducing an application subsystem.
- **P2 Performance**: PASS. Cleanup uses one API read and at most one delete; site deployment promotes the already-validated artifact without a second build.
- **P3 Contract Stability**: PASS. Product, file-format, command, and user-interface contracts are unchanged.
- **P4 Test-First Correctness**: PASS. Workflow policy and failure fixtures are added to existing automated validators before production workflow edits.
- **P5 Release and Specification Integrity**: PASS. v0.1.2 identity, canonical specification, release tag, release record, and assets remain immutable; release publication retains its current gated site handoff.
- **P6 Verification**: PASS. Local contract/static-site checks, hosted CI, deployment verification, and explicit merge-dependent observations cover the changed behavior.
- **P7 Explicit and Proportional Changes**: PASS WITH DOCUMENTED DEVIATION. The prior validator intentionally rejected default-branch site deployment, but that rule prevents merged documentation from reaching production and caused issue #170 to close without deployed evidence. S037 replaces it with a narrower trusted-main-or-published-release authority rule, preserves PR build-only behavior, and verifies exact deployed provenance.
- **P8 Licensing**: PASS. No dependency or license changes are introduced.

**Post-design re-check**: PASS. The contracts retain minimum Pages permissions, restrict privileged cleanup to trusted base-branch workflow code, pass event fields as data, and preserve immutable release gates.

## Project Structure

### Documentation (this feature)

```text
specs/037-post-merge-automation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── post-merge-automation.md
└── tasks.md
```

### Source Code (repository root)

```text
.github/workflows/
├── docs.yml
├── release.yml
└── delete-merged-branch.yml

scripts/
├── check-config.mjs
├── check-public-release.mjs
├── check-public-release.test.mjs
└── verify-site-deployment.mjs
```

**Structure Decision**: Keep orchestration in GitHub Actions and extend the existing repository validators. No runtime application module, dependency, package script, or checkout-based cleanup helper is added.

## Complexity Tracking

No constitution violations require justification.
