# Implementation Plan: Conflict-Safe Recovery

**Branch**: `codex/012-safe-recovery` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-safe-recovery/spec.md`

## Summary

S012 closes the remaining silent-loss paths around save receipts, external conflicts, dirty close/reload/exit, and abnormal termination. The portable Rust core owns lifecycle and recovery policy; the Rust host owns a private atomic record store rooted in Tauri application-local data; TypeScript projects only the actionable state and never independently authorizes data loss. Recovery source and revision evidence is domain-separated and hashed before persistence, Android backup rules exclude recovery text, and a recovered buffer without independently revalidated authority opens dirty and conflicted with Save As.

## Technical Context

**Language/Version**: Rust 1.96.0 edition 2024, TypeScript 5.9.3, React 19.2.4, Kotlin/JVM 17 only for existing Android instrumentation and backup configuration

**Primary Dependencies**: existing Tauri 2.11.5, serde 1.0.229, serde_json 1.0.145, schemars 1.2.2, uuid 1.26.0, atomic-write-file 0.3.1; direct `sha2` 0.10.9 for non-secret integrity and redacted identity evidence

**Storage**: independent versioned JSON records below the native application-local `recovery-v1` directory; no manifest, database, cache directory, roaming state, document-controlled path, or Android provider URI

**Testing**: Rust unit and integration tests with injected clocks, quotas, and persistence failpoints; Vitest and Testing Library state/interaction tests; existing API 24 and API 36 Android instrumentation matrix; repository aggregate checks

**Target Platform**: Windows, macOS, Linux, and Android API 24 through API 36

**Project Type**: Tauri desktop/mobile application with shared Rust domain policy, native host adapters, and React interface projection

**Performance Goals**: snapshot eligibility after 2 seconds idle and at least every 30 seconds while dirty; bounded inventory and exact serialized-byte quota accounting; no document-content scan outside the one active record being serialized or verified

**Constraints**: fully offline, no telemetry, no routine clean-session restore, maximum one 16 MiB recovery payload per current save bound, seven-day lifetime, 256 MiB desktop quota, 128 MiB Android quota, UTF-8 without BOM, no raw path/URI/provider identifier in persisted recovery evidence or diagnostics

**Scale/Scope**: at most 32 live sessions, independent recovery records bounded by platform quota, one application process under the existing singleton-host contract

## Constitution Check

_GATE: Passed before research and after design._

| Principle | Result | Design evidence |
| --- | --- | --- |
| P1. The file owns the viewport | PASS | S012 adds only contextual conflict/recovery banners and a modal resolution surface; it adds no permanent navigation or workspace UI. |
| P2. Local files remain local | PASS | Recovery stays in application-local private storage, Android backup/transfer excludes it, and no network or account dependency is introduced. |
| P3. Cross-platform behavior is foundational | PASS | Rust owns shared state, schema, scheduling, quota, and cleanup policy; native differences are limited to storage roots, permissions, quotas, and source revalidation evidence. |
| P4. Untrusted input fails safely | PASS | Save revalidation precedes mutation, receipts are fully bound, record allocation is bounded before parsing, corruption is isolated, and atomic publication preserves prior coverage. |
| P5. Specifications and releases move together | PASS | S012 remains an unreleased Spec-Kit delta and does not change product version or stable-format declarations. |
| P6. Verification precedes claims | PASS | Every acceptance path maps to deterministic core, store, interface, or Android evidence and the full repository gate runs locally before publication. |
| P7. Decisions are explicit and proportional | PASS | Research records storage, hashing, lifecycle, and quota decisions. Production editor work, routine restore, and generalized persistence remain excluded. |
| P8. Apache-2.0 and license compatibility | PASS | The only new direct dependency is dual MIT/Apache-2.0 and already present transitively; existing BSD-3-Clause atomic-write-file remains allowed. |

The post-design check remains PASS. No constitution exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/012-safe-recovery/
├── checklists/requirements.md
├── contracts/
│   ├── recovery-store.md
│   └── session-safety.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
crates/glitchpad-core/src/
├── recovery.rs
├── session.rs
└── source.rs

crates/glitchpad-host/src/
├── lib.rs
└── recovery.rs

crates/glitchpad-host/tests/
└── recovery_conformance.rs

apps/glitchpad/src/
├── App.test.tsx
├── App.tsx
├── components/RecoveryResolution.tsx
└── domain/
    ├── contracts.ts
    ├── recovery.test.ts
    ├── recovery.ts
    ├── tabs.test.ts
    └── tabs.ts

crates/glitchpad-host/gen/android/app/src/main/res/xml/
├── backup_rules.xml
└── backup_rules_legacy.xml
```

**Structure Decision**: Extend the existing ports-and-adapters split. `glitchpad-core` owns portable transitions and value contracts, `glitchpad-host` owns private filesystem mechanics and Tauri commands, and `apps/glitchpad` projects the shared decisions into accessible interaction state. No new crate, database, Kotlin policy layer, or editor subsystem is introduced.

## Complexity Tracking

No constitution violations require justification.
