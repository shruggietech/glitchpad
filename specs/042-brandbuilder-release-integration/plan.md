# Implementation Plan: BrandBuilder Release Integration

**Branch**: `codex/042-brandbuilder-release-integration` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

## Summary

Import the formal `glitchpad-brand-1.1.1-bb2.0.3.zip` release through the existing governed `brand/` boundary, replace artifact-era provenance with a release-backed receipt, and propagate the released web and Android icon roles to site and package inputs. Extend the current brand checks and documentation so the complete delivery remains pinned and drift is visible. Keep S041 AppFrame composition and the approved identity geometry.

## Technical Context

**Language/Version**: Node.js 24.11.0, pnpm 10.28.2, Rust 1.96.0, JSON, Markdown, CSS, Android XML

**Primary Dependencies**: Existing Node brand sync/check scripts, released BrandBuilder 2.0.3 archive, Tauri 2 package inputs, Next.js site

**Storage**: Governed files under `brand/`, project-owned integration receipt, exact consumer copies

**Testing**: Node contract tests, site unit/browser checks, Android resource and package checks, desktop package checks, `cargo xtask check`, CI platform jobs

**Target Platform**: Web, Windows, macOS, Linux, Android

**Project Type**: Cross-platform application and public site

**Performance Goals**: No runtime download and no new application rendering dependency

**Constraints**: Exact release package pin; offline recovery; one documented README link correction; hidden Linux validation on an interactive Windows desktop; UTF-8 without BOM; no product release

**Scale/Scope**: One full brand kit, explicit mapped consumer copies, three GitHub issues, one reviewable PR

## Constitution Check

| Principle | Pre-design | Post-design | Evidence |
| --- | --- | --- | --- |
| P1 File viewport | PASS | PASS | Existing AppFrame and file shell stay in place; only brand delivery and mappings change. |
| P2 Local files | PASS | PASS | All runtime assets remain bundled; network is used only to retrieve the build-time release. |
| P3 Cross-platform | PASS | PASS | Web, desktop, and Android source mappings are accounted for together. |
| P4 Untrusted input | PASS | PASS | Import rejects malformed paths, missing files, and digest mismatches before replacing the governed directory. |
| P5 Specs and releases | PASS | PASS | S042 records an unreleased delta; the product technical specification remains a v0.1.3 historical authority until a release documentation pass. |
| P6 Verification | PASS | PASS | Focused and aggregate gates, with actual exit results and host limits, are part of the done gate. |
| P7 Proportional decisions | PASS | PASS | Reuse current sync/check boundary and existing package copies; no new design system or renderer. |
| P8 Licensing | PASS | PASS | Preserve released `LICENSE`, `LICENSE-BRAND.md`, `NOTICE`, font terms, and exact provenance. |

## Decisions

### 2026-09-24: Formal release authority

Use the formal v2.0.3 archive and `SHA256SUMS` instead of current sibling `main` or hosted derivative files. The release has a canonical immutable package ID and source revision. Hosted freshness remains an independent optional comparison. A newer release during S042 requires reassessment before repinning.

### 2026-09-24: Retain the governed kit boundary and one legal-link correction

The released README still points to `../../LICENSE-BRAND.md`, which is unreachable from Glitchpad's embedded `brand/` location. Retain the established deterministic integration correction to the newly bundled local `LICENSE-BRAND.md`; record both the untouched source manifest digest and the integrated manifest digest. The release archive's `LICENSE`, `LICENSE-BRAND.md`, and `NOTICE` are outside its manifest, so the receipt separately records their digests. Every other governed file remains byte-identical to the release.

### 2026-09-24: Fail closed on incomplete delivery

The current sync script can recover missing source files from the previous installed kit. The formal archive is complete, so this fallback obscures incomplete deliveries and is removed. Verify the archive's complete file inventory before mutating `brand/`.

### 2026-09-24: Preserve existing shell and native ownership

The current AppFrame uses Web/React adapter 1.1.0, unchanged in the released contract. Update the complete vendored egui 1.0.2 adapter but do not add an egui application call site to a React/Tauri product. Repin platform icon roles in existing copy locations and require distinct web maskable assets.

## Project Structure

```text
specs/042-brandbuilder-release-integration/
  spec.md
  checklists/requirements.md
  plan.md
  research.md
  data-model.md
  contracts/brand-delivery.md
  quickstart.md
  tasks.md
  verification.md
brand/
  INTEGRATION.json
  INTEGRATION.md
  manifest.json
  enforcement/
  icons/
  native/egui/
site/public/
apps/glitchpad/public/
crates/glitchpad-host/icons/
crates/glitchpad-host/gen/android/app/src/main/res/
scripts/sync-brand-kit.mjs
scripts/check-brand.mjs
scripts/check-brand.test.mjs
site/tests/content-contract.test.mjs
AGENTS.md
changelog.d/202.changed.md
```

**Structure Decision**: Preserve the existing canonical `brand/` directory and explicit consumer copies. The integration receipt and verification belong to Glitchpad; the generated kit content belongs to the released BrandBuilder package.

## Delivery Order

1. Verify and stage the archive and its complete file manifest.
2. Add failing regression checks for release receipt and icon roles.
3. Update sync logic, import the kit, refresh the agent block, and map platform copies.
4. Update verifier, tests, integration docs, the changelog fragment, and S042 evidence.
5. Run local gates where the approved Linux validation runtime is available, then run CI for all supported hosts. Keep unavailable local checks explicit.
6. Push, publish one PR closing #202, #203, and #204, resolve first Codex review, optionally request one final review round, and return for merge approval only when CI and review threads are clear.
