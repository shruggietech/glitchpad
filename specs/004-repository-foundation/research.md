# Research: Repository Foundation

**Date**: 2026-08-30

## R1. Repository conventions

**Decision**: Reuse the refined sibling pattern of centered identity/badges, concise public status, a single aggregate `ci-ok` branch-protection target, changelog fragments, reviewed pull requests, and tag-driven releases. Preserve Glitchpad's one-line Markdown paragraph rule instead of copying sibling hard wrapping.

**Rationale**: These conventions are already understood by the organization and solve public landing-page, parallel-change, and branch-protection needs. Glitchpad's constitution explicitly overrides the older prose formatting style.

**Alternatives considered**: Copying the older application repository would reintroduce obsolete browser-extension and web-build assumptions. Copying the complete service-oriented sibling CI would add databases, containers, and deployment complexity unrelated to this application.

## R2. Tauri monorepo placement

**Decision**: Keep the Tauri project in `crates/glitchpad-host` and the frontend in `apps/glitchpad`, invoking the CLI from the host directory with the root-installed package.

**Rationale**: Tauri identifies a project through `tauri.conf.json` and permits the Rust project to be a workspace member. Relative `frontendDist` and before-command paths can reach the frontend package. This satisfies the technical specification's dependency boundary while retaining standard Tauri generation.

**Alternatives considered**: Root frontend plus `src-tauri` is simpler but contradicts the approved repository layout. A second package manifest inside the host crate duplicates JavaScript authorities. Moving core logic into the Tauri crate weakens the host boundary.

**Primary evidence**: [Tauri project structure](https://v2.tauri.app/start/project-structure/), [Tauri configuration](https://v2.tauri.app/reference/config/), [Tauri manual setup](https://v2.tauri.app/start/create-project/)

## R3. Tool and dependency versions

**Decision**: Pin Rust 1.96.0, Node 24.11.0, pnpm 10.28.2, TypeScript 6.0.2, Tauri 2.11.x, React 19.2.8, and Vite 8.2.2. Lock exact JavaScript graphs with pnpm and exact Rust graphs with Cargo while allowing compatible manifest ranges inside the selected majors.

**Rationale**: Rust, Node, pnpm major, TypeScript, React, Vite, and Tauri lines are already selected by the technical specification. Registry inspection on 2026-08-30 shows newer TypeScript and pnpm majors, but adopting them would be an architecture change rather than routine scaffolding.

**Alternatives considered**: Floating `latest` makes clean setup non-reproducible. Using older versions from the prior application ignores current security and platform maintenance. Adopting TypeScript 7 or pnpm 11 silently violates the approved stack.

## R4. Android generation

**Decision**: Run Tauri's Android initializer from `crates/glitchpad-host` in CI mode, using the installed Android SDK and JDK 17 runtime, while leaving release signing and distributable packaging disabled.

**Rationale**: Tauri's CLI provides `android init`, `dev`, `run`, and `build`; generating the project now exposes path and build assumptions early. Signing and final icons are release concerns and must not be faked.

**Alternatives considered**: Deferring all Android material contradicts the foundation requirement. Hand-writing Gradle/Kotlin files would drift from Tauri generation. Committing signing placeholders risks secret mistakes.

**Primary evidence**: [Tauri Android CLI](https://v2.tauri.app/ja/reference/cli/)

## R5. GitHub automation

**Decision**: Use official current action release lines, minimal explicit permissions, Dependabot for action updates, a pull-request/manual/nightly CI trigger, and one `ci-ok` aggregate job. Keep release automation tag-driven and blocked until version, documentation, brand, license, and platform evidence agree.

**Rationale**: The sibling aggregate-gate pattern prevents skipped path jobs from leaving branch protection without a status. Current official action versions reduce reliance on deprecated runtimes. Minimal permissions limit supply-chain impact.

**Alternatives considered**: A push-only CI misses review gating. Requiring every matrix job directly complicates path skips. Publishing from `main` violates the release contract. Granting write permissions globally is unnecessary.

## R6. Public README before brand assets

**Decision**: Use centered text and shields without a logo until the approved brand kit lands. Present roadmap capabilities and target platforms separately from current status, and use the final GitHub organization path in badges and links.

**Rationale**: A polished text-first README is better than a temporary logo that later becomes public residue. Honest status prevents visitors from mistaking repository scaffolding for an installable application.

**Alternatives considered**: A generated placeholder logo conflicts with the brand requirement. Omitting status invites incorrect assumptions. Linking an unrelated live domain creates a false product surface.

## R7. Git initialization

**Decision**: Initialize locally on `main` only after validation, use the existing Git identity, ignore the Spec Kit active pointer, create one initial commit, and configure no remote.

**Rationale**: The user requested first Git setup but has not authorized organization repository creation or push. A clean local commit gives the future public repository an inspectable starting point without external mutation.

**Alternatives considered**: Creating or pushing a GitHub repository expands scope and organization state. Committing before lockfiles and generated-file inspection weakens the first snapshot. Inventing identity is prohibited.
