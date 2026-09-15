# Implementation Plan: S039 Bounded Raster Viewing and Metadata

**Branch**: `codex/039-bounded-raster-images` | **Date**: 2026-09-15 | **Spec**: [spec.md](spec.md)

**Input**: `specs/039-bounded-raster-images/spec.md`, bundled issues #68, #69, and #73.

## Summary

Add a native image-family contract and reviewed pure-Rust raster/metadata pipeline, integrate content-verified image sessions into existing desktop and Android source flows, and reuse the compact document surface and information drawer. Images remain an unreleased read-only capability. Existing version, associations, intent declarations, public support claims, and release assets stay authoritative for 0.1.3.

## Technical Context

**Language/Version**: Repository-pinned Rust 1.96.0/edition 2024, TypeScript 6, React 19, Tauri 2, and narrow Kotlin Android provider bridge.

**Primary Dependencies**: `image` 0.25.10 with only png/jpeg/webp/bmp/tiff features and default features disabled; `kamadak-exif` 0.6.1; `quick-xml` 0.42.0 with default features disabled; existing Serde/schema and Tauri APIs. Review mandatory transitive color/codec dependencies through cargo-deny and package notices.

**Storage**: Existing opaque native source handles; transient admitted worker buffers and active-tab object URLs only. No database, sidecars, image writes, or new persistent cache.

**Testing**: Rust contract/decode/metadata fixtures; frontend contract/gateway/viewport/inspector/revision tests; existing repository validation and all hosted platform packaging/lifecycle suites. Generated original fixtures have reproducible provenance.

**Target Platform**: Windows, macOS ARM64/Intel, Linux x86_64, and Android API 24/36 using existing source contracts.

**Project Type**: Cross-platform local document application with shared native parsing and interface composition.

**Performance Goals**: Zero synchronous decode on the interface thread; cancellation disables scheduling/publication within 250 ms; one admitted native decode at a time; completed disposal releases owned resources.

**Constraints**: Encoded source 128 MiB maximum; full image eligibility <=100,000,000 pixels; >200,000,000 pixels refuses preview; checked output/peak reservations; metadata block 1 MiB and aggregate 4 MiB; 256 facts, 1,024-character values, XML depth 32, bounded segment/entry counts; inert PNG delivery <=8 MiB. Decoder allocation hints are best-effort and are not represented as process-memory isolation.

**Scale/Scope**: Five raster codecs, bounded metadata subset, shared image-family schema, existing source/drawer/viewport integration, and issue-level evidence. Later image families are modeled but not implemented or activated.

## Constitution Check

| Principle | Pre-research | Post-design decision |
| --- | --- | --- |
| P1 viewport | Pass | Compact contextual raster actions and existing dismissible inspector |
| P2 local privacy | Pass | Native byte parsing, no network/sidecars/external XML resolution |
| P3 platform parity | Pass | One image pipeline, opaque desktop/Android adapter authority |
| P4 hostile inputs | Pass | Verified signatures, checked limits, bounded metadata, read-only sessions |
| P5 release lockstep | Pass | Unreleased delta only; official 0.1.3 and public activation unchanged |
| P6 verification | Pass | Acceptance-to-evidence ledger and complete hosted checks before handoff |
| P7 proportional decisions | Pass | Dated research/contracts; no generalized plugin or storage architecture |
| P8 licensing | Pass | Reviewed compatible crates and generated corpus; BSD-2-Clause addition explicitly recorded |

No constitution exception is required. Spec Kit setup/template/prerequisite scripts run inside the repository Docker validation image. No extension hooks are installed.

## Project Structure

### Documentation (this feature)

- `specs/039-bounded-raster-images/spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`, and `verification.md`.
- `specs/039-bounded-raster-images/contracts/image-renderer.md` and `image-metadata.md`.
- `fixtures/images/` contains generated fixtures, digests, and provenance instructions.

### Source Code (repository root)

- `crates/glitchpad-core/src/images.rs` and `image_metadata.rs`: family contracts, signature/dimension admission, raster decode, orientation/color policy, metadata extraction, and pure tests.
- `crates/glitchpad-host/src/images.rs`, `lib.rs`, `source/mod.rs`, and `android_source/mod.rs`: narrowly scoped native preview/cancellation commands, bounded source reads, revalidation, and worker admission.
- `apps/glitchpad/src/domain/image-contract.ts` and `image-gateway.ts`: typed image request/result validation and image session materialization.
- `apps/glitchpad/src/domain/contracts.ts`, desktop/Android materializers, `metadata.ts`, and `tabs.ts`: compatible optional image state and revision-safe metadata projection.
- `apps/glitchpad/src/components/ImageSurface.tsx`, `DocumentSurface.tsx`, existing inspector, and application CSS: owned object URLs, accessible viewport controls, independent diagnostics, and contextual image facts.
- Workspace manifests/lockfile, `deny.toml`, notices/provenance generation, corpus validation, and platform evidence touch-points are changed only as required by the new pipeline.

**Structure Decision**: Reuse the existing core/host/interface boundaries. Image decoding receives bytes in the core, host commands acquire bytes only from registered opaque source IDs, and the interface owns inert PNG presentation. No new workspace crate or generic renderer plugin API is needed.

## Phases

1. Complete research, image/metadata contracts, data model, tasks, and read-only cross-artifact analysis.
2. Add pure family/admission contracts and generated fixtures with failure-first contract tests.
3. Implement bounded raster decoding and native request/cancellation/source integration; connect image sessions and viewport actions.
4. Implement bounded metadata subset, redacted wire facts, inspector projection, and revision refresh.
5. Complete hostile/lifecycle/accessibility/regression validation and the issue evidence ledger; run Spec Kit convergence and remediate appended tasks.
6. Push/open official PR, process every external review, request at most one second review, converge again, and wait for all required checks before owner handoff.

## Documentation Impact

S039 is an unreleased specification delta. Its contracts document all added behavior, limits, and supported metadata subsets for reconciliation during #76. Historical technical specification and published release records are not rewritten to claim images. #74 remains open for all-family controls; #75/#76 remain open for full milestone conformance/activation; #66 remains non-blocking and incomplete.

## Complexity Tracking

No violations or additional architecture layers are introduced. Cancellation revokes publication immediately but does not pretend a synchronous decoder can be forcibly interrupted. Worker admission remains reserved until actual completion.
