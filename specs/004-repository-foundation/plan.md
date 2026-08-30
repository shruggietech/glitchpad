# Implementation Plan: Repository Foundation

**Branch**: `004-repository-foundation` | **Date**: 2026-08-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-repository-foundation/spec.md`

## Summary

Create the v0.0.0 monorepo foundation defined by the technical specification: a Rust 1.96 workspace, a TypeScript 6/React 19/Vite 8 shared application, a Tauri 2 host with generated Android project, and a Rust `xtask` verification surface. Add public-ready community documentation, badges, Git attributes and ignores, GitHub CI/security/release automation, locked dependencies, and a clean local `main` initial commit without a remote. The application remains an honest foundation shell and implements no document renderer.

## Technical Context

**Language/Version**: Rust 1.96.0 edition 2024; TypeScript 6.0.2 on Node.js 24.11.0; generated Kotlin/Gradle versions owned by Tauri Android output

**Primary Dependencies**: Tauri CLI 2.11.4/API 2.11.1/Rust 2.11.5, React 19.2.8, Vite 8.2.2, Vitest 4.1.11, ESLint 10.9.1 with typescript-eslint 8.68.0, Prettier 3.9.6, markdownlint-cli2 0.23.2, pnpm 10.28.2

**Storage**: Source tree, committed Cargo/pnpm/Gradle locks, and Git object database; no application database or runtime persistence in this slice

**Testing**: Cargo format/Clippy/unit tests; ESLint, TypeScript, Vitest, Testing Library, production Vite build; Prettier, markdownlint, links, Mermaid, UTF-8/BOM/mojibake, YAML/TOML/JSON and version checks; Git tracked/ignored/attribute assertions

**Target Platform**: Foundation checks on Windows 11 x86_64 and GitHub-hosted Ubuntu; Tauri host structured for Windows, macOS, Linux, and Android API 24+; platform packaging remains gated until brand/signing evidence exists

**Project Type**: Cross-platform desktop and Android application monorepo

**Performance Goals**: Fresh shared dependency installation in under 10 minutes on the reference workstation; warm aggregate shared check in under 5 minutes; initial web production bundle below 500 KiB compressed; foundation shell interactive within the existing specification budgets

**Constraints**: No Electron, no remote repository writes, no temporary logo, no unsupported capability claims, UTF-8 without BOM, unwrapped Markdown prose, top-to-bottom project Mermaid diagrams, Apache-2.0, minimal workflow permissions, no secrets or signing material

**Scale/Scope**: Three Rust workspace members, one frontend workspace package, one generated Android host, public community-health files, three core workflows plus Dependabot, one initial Git commit

## Constitution Check

_GATE: Passed before research and re-checked after design._

| Principle | Plan evidence | Result |
| --- | --- | --- |
| P1. The file owns the viewport | The initial shell contains only a compact identity/status surface and open-file affordance placeholder; no navigation, workspace, or dashboard | Pass |
| P2. Local files remain local | No network, account, telemetry, upload, or remote renderer is introduced | Pass |
| P3. Cross-platform behavior is foundational | Tauri host and Android project are generated from the first scaffold; all four platform families are represented in workflows and docs | Pass |
| P4. Untrusted input fails safely | No file parser lands in this slice; Tauri capabilities are deny-by-default and limited to core window behavior | Pass |
| P5. Specifications and releases move together | Product/manifests/spec remain 0.0.0; CI adds version and documentation-impact gates | Pass |
| P6. Verification precedes claims | One foreground `cargo xtask check` surface and aggregate CI gate own verification claims | Pass |
| P7. Decisions are explicit and proportional | Only foundation code and public repository surfaces are added; viewers and release packaging stay outside scope | Pass |
| P8. Apache-2.0 and license compatibility | Package metadata, deny policy, LICENSE, NOTICE, dependency review, SBOM-ready release structure, and license checks are established | Pass |

## Project Structure

### Documentation (this feature)

```text
specs/004-repository-foundation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   ├── repository.md
│   └── verification.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
apps/glitchpad/
├── src/
├── tests/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
crates/
├── glitchpad-core/
├── glitchpad-host/
│   ├── capabilities/
│   ├── gen/android/
│   ├── src/
│   └── tauri.conf.json
└── xtask/
docs/
fixtures/
scripts/
.github/
├── ISSUE_TEMPLATE/
├── workflows/
├── CODEOWNERS
├── dependabot.yml
└── pull_request_template.md
```

**Structure Decision**: Follow the technical specification's explicit monorepo layout rather than Tauri's common root-frontend/`src-tauri` arrangement. The root package owns tooling; the frontend is a pnpm workspace package; `crates/glitchpad-host/tauri.conf.json` is the Tauri CLI marker; root scripts enter that directory before invoking the root-installed Tauri CLI. This preserves core/host separation and keeps generated Android material under the host crate.

## Design Decisions

### D1. Pin specification-selected majors, not every registry latest

Use TypeScript 6 and pnpm 10 because the technical specification selects those supported lines, even though newer majors exist. Lock current compatible patch releases and update them only through reviewed dependency changes. Use current Tauri 2 and React 19 patches after registry and license review.

### D2. Keep v0.0.0 runnable but visibly pre-application

The initial UI is a neutral foundation screen with product name, version, foundation status, and a disabled explanatory open action. It proves the shared application and native host wiring without simulating tabs, editing, metadata, or renderer behavior. No placeholder brand image is committed.

### D3. Use `xtask` as the executable contributor contract

`cargo xtask doctor` reports tool and platform prerequisites without mutation. `cargo xtask docs` runs documentation checks. `cargo xtask check` runs native checks, frontend checks, documentation checks, and version consistency sequentially while propagating failures. Root package scripts remain thin entry points.

### D4. Separate pull-request verification from release publication

`ci.yml` runs pull-request, manual, and nightly checks and exposes `ci-ok`. `codeql.yml` performs scheduled and pull-request source analysis. `release.yml` is tag-driven but begins with documentation/version/license readiness and refuses v0.0.0 binary publication or missing platform evidence. Dependabot covers Cargo, pnpm, Gradle, and GitHub Actions.

### D5. Treat README claims as generated-release-adjacent state

The README uses final repository URLs and standard CI/version/license/status/platform badges, but describes current v0.0.0 as repository foundation with no binaries. It links the technical specification, contributing, security, code of conduct, and license. Capability lists are labeled roadmap rather than availability.

### D6. Initialize Git last and do not configure a remote

Validate the untracked tree first, initialize with `git init -b main`, inspect ignore and attributes, stage only intended files, run secret/artifact checks, and create one initial commit using the existing Git identity. `.specify/feature.json` remains local and ignored. GitHub repository creation, push, rulesets, labels, and branch protection are later operator actions.

## Implementation Ordering

1. Create version authorities, workspace manifests, root tool configuration, attributes, and ignore rules.
2. Create Rust core, Tauri host, `xtask`, shared React application, tests, and lockfiles.
3. Generate and normalize the Android host without committing SDK paths, caches, signing data, or build output.
4. Add README, community-health documents, changelog-fragment policy, and public metadata.
5. Add CI, CodeQL, release-readiness, Dependabot, and workflow validation.
6. Run all local checks, initialize Git on `main`, inspect the staged tree, create the initial commit, and verify clean/no-remote state.
7. Run Spec Kit convergence against the committed foundation.

## Open Risks

| Risk | Containment | Blocking gate |
| --- | --- | --- |
| Tauri custom monorepo path breaks CLI assumptions | Root scripts invoke CLI from host marker directory; desktop and Android init smoke tests | Scaffold build gate |
| Android generator embeds machine-specific values | Generated-tree scan, `.gitignore`, Gradle local-properties exclusion, clean regeneration check | Initial commit gate |
| Public badges are unavailable before repository creation | Use final stable URLs and validate syntax; document that availability begins after public creation | README review |
| Current action majors differ from older sibling conventions | Use official current release tags with minimal permissions and Dependabot updates | Workflow validation |
| No approved application icon exists | Disable distributable bundling and binary publication until brand assets and packaging gate land | Release readiness |

## Post-Design Constitution Check

The design preserves all eight principles and introduces no exception. Disabling distributable bundling before approved brand and platform evidence is a required truthful-release constraint, not a missing foundation capability.
