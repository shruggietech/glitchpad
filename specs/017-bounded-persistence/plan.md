# Implementation Plan: Bounded Local Persistence

**Branch**: `[codex/017-bounded-persistence]` | **Date**: 2026-09-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/017-bounded-persistence/spec.md`

## Summary

Implement issue #59 with separate, versioned preference, session-projection, and diagnostic stores owned by the native host. Rust defines validation, migration, redaction, retention, and status contracts and performs bounded atomic file operations in application-private config/data directories. TypeScript owns user preference interaction, applies validated projections, requests session persistence through a narrow gateway, and previews the exact redacted diagnostic bundle before export. Existing recovery storage remains independent and is referenced only by opaque record identifiers.

## Technical Context

**Language/Version**: Rust 1.96.0 (edition 2024), TypeScript 6.0.2, React 19.2.8, Kotlin/JVM through the existing Android bridge

**Primary Dependencies**: Existing Tauri 2.11.5 host boundary, React shell, Serde/serde_json, atomic-write-file 0.3.1; no new production dependency

**Storage**: Separate schema-versioned JSON records in application-private config/data directories; existing recovery store remains separate; no database

**Testing**: Rust unit and host conformance tests, Vitest 4.1.11 with Testing Library and axe, Android lifecycle contract fixtures, existing `cargo xtask check` aggregate gate

**Target Platform**: Windows 11 x86_64, macOS 13+ arm64/x86_64, Ubuntu 22.04-baseline x86_64, Android API 24 through 36

**Project Type**: Tauri desktop/mobile application with a shared React renderer and Rust domain/native host

**Performance Goals**: Load and validate the maximum bounded state without delaying the reference startup path beyond one second; preference interactions remain below 50 ms; session writes coalesce around active UI work

**Constraints**: Offline-only, no database, no document content outside recovery, atomic writes, future-schema preservation, typed diagnostic allowlist, deterministic quotas and cleanup, UTF-8 without BOM

**Scale/Scope**: One preference record, one window projection, at most 32 session projections, at most 128 extension overrides, and diagnostics bounded to 2,000 events, 2 MiB, and seven days

## Constitution Check

_GATE: Passed before research and after design._

- **P1**: Pass. Preferences and diagnostics use compact dismissible sheets and add no permanent navigation or workspace surface.
- **P2**: Pass. All state is local, account-free, offline, and contains no telemetry path.
- **P3**: Pass. Shared value contracts serve every platform while desktop locators and Android URI grants remain native-owned.
- **P4**: Pass. Every record, field, migration, write, cleanup, and diagnostic projection is bounded and hostile-input tested.
- **P5**: Pass. S017 records the unreleased behavioral delta and changelog fragment for release reconciliation.
- **P6**: Pass. Schema, lifecycle, privacy, atomicity, reset, and UI acceptance paths map to automated evidence or named manual checks.
- **P7**: Pass. Separate small JSON records extend existing adapters and explicitly reject database, workspace, account, and synchronization scope.
- **P8**: Pass. The design introduces no dependency or external asset.

## Project Structure

### Documentation (this feature)

```text
specs/017-bounded-persistence/
├── checklists/requirements.md
├── contracts/application-state.md
├── contracts/diagnostics.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
├── tasks.md
└── verification.md
```

### Source Code (repository root)

```text
apps/glitchpad/src/
├── App.tsx
├── App.test.tsx
├── components/{PreferencesPanel,DiagnosticsPanel}*.tsx
├── domain/{contracts,persistence,persistence-gateway,use-persistence}*.ts
└── styles.css
crates/glitchpad-core/src/{lib,persistence}.rs
crates/glitchpad-core/tests/contract_schema.rs
crates/glitchpad-host/src/{lib,app_state}.rs
crates/glitchpad-host/tests/app_state_conformance.rs
fixtures/persistence/
```

**Structure Decision**: Extend the existing ports-and-adapters boundary. The native host owns all durable bytes and platform references. The shared interface sees validated preference and presentation projections, opaque recovery references, stable safe statuses, and already-redacted diagnostic previews.

## Design Decisions and Deviation

- Recent-source references are represented only inside the bounded session-restoration projection. This resolves the issue wording without violating the v0.1 technical specification's explicit prohibition on a recent-file preference or general history list.
- State is separated into purpose-specific files rather than one aggregate document. A future or corrupt diagnostic/session record therefore cannot prevent valid preferences from loading, and category reset remains narrow.
- Future-schema files are preserved in place and make writes to that category fail safely until an explicit category reset. Silently replacing them with defaults would destroy downgrade/upgrade information.
- Diagnostic events use enumerated fields and stable identifiers rather than a free-form message plus arbitrary context map. Redaction after collecting arbitrary strings is not a reliable privacy boundary.
- Session persistence stores only safe interface projection plus native-owned restoration evidence. Dirty bytes remain exclusively in the recovery store.
- The shared controller exposes the validated startup projection but does not reinterpret ephemeral runtime source IDs as durable evidence or bypass the existing native source-delivery adapters.
- UI persistence is routed through an injected gateway and degrades to defaults in browser tests or unavailable native contexts. A native-storage failure cannot block document interaction.

## Complexity Tracking

No constitution violation requires an exception.
