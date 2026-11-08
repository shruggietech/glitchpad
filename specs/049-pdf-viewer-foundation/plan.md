# Implementation Plan: PDF viewer foundation

**Branch**: `codex/049-pdf-viewer-foundation` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Owner-approved S049, #77-#80.

## Summary

Deliver the complete candidate PDF reading journey through a pinned isolated parser/worker, bounded native source adapter and one shared document controller. Reuse current session/command/metadata and compact brand surfaces. Add truthful native print handoff plus an Android raster-print adapter, and measure minimum-WebView compatibility before broad qualification. Stable activation remains #81/#82; publication is not part of this session.

## Technical Context

**Language/Version**: Existing Rust1.96, TypeScript6.0.2/React19.3.1, Node24.11.0/pnpm10.28.2, Tauri2.11.6/Wry0.55.1 and Android Kotlin/SDK36/NDK authorities; no incidental upgrades.

**Primary Dependencies**: New exact pdfjs-dist6.5.438; existing core-js3.50.0 and Vite8.3.5 chrome69/classic-worker compilation. Existing pinned BrandBuilder2.0.3/brand1.1.1.

**Storage**: Existing native source handles, revision/metadata and private state stores. PDF read cache and Android print staging are bounded, job-owned private temporary data; source bytes and passwords never become general persistent session state.

**Testing**: Contract/unit/property and actual parser/browser fixtures, current/Chromium69 composed-browser checks, ordinary installed API24 then API36 preflight, complete PDF keyboard/touch/accessibility/resource/metadata/link/print journeys and actual representative packaged WebViews on Windows/macOS/Linux; standard regression/package/security/docs/license/brand checks.

**Target Platform**: Existing Windows11 x86_64, macOS13+ universal, Ubuntu22.04/24.04 x86_64, Android API24/API36 including actual Chromium69-class minimum profile.

**Project Type**: Existing shared Tauri desktop/Android application.

**Performance Goals**: Existing source/page/surface limits (512/256MiB,10000pages,200/96MiB), 250ms cancellation hard limit, active-tab priority and UI responsiveness. Never relax a budget to get a pass.

**Constraints**: Worker has no native/document-controlled network route; no PDF execution/scripting or source mutation. System/generic fallback for unembedded fonts, no distributed GPL Liberation TTFs, and explicit non-color-managed ICC limitation for this engine transport mode. Hidden approved VCS and isolated hosted tooling; UTF-8 without BOM, single-line prose, MermaidTB. At most two external review rounds; stop ready/unmerged/auto-merge off.

**Scale/Scope**:24FR,6SC,16scenario/issue-acceptance rows across4stories and4issues. Representative conformance is required now; exhaustive #81 and release activation #82 remain separately traceable.

## Constitution Check

Initial and post-design gates pass. P1: existing compact contextual controls; PDF content owns the viewport. P2: local sources/resources, no accounts/uploads/network-dependent viewing. P3: one shared document contract, native URI semantics and four-platform evidence; no Electron. P4: bounded source/canvas/cache/worker operations, denied execution/network/native routes, deterministic failures and source preservation. P5: version0.2.1/historical receipts stay authoritative; S049 records the unreleased PDF delta without stable association activation or publication. P6: all16 issue criteria map to actual tests/current evidence; no synthetic/native substitution. P7: dated R1-R12 decisions before implementation, proportional renderer/source/print additions rather than a new platform. P8: exact compatible dependency/resource pins, GPL font assets excluded, provenance/notices/fixture hashes and exact delivered brand verification. No exception or amendment.

## Phase 0: Research decisions

[research.md](research.md) resolves engine/browser compatibility, static decoders/resources, font license/fallback, worker CSP, source/cache/lifecycle, compact UI/navigation, metadata/link authority, print outcomes, evidence and owner boundary. Three mandatory read-only research agents grounded these in current code and pinned primary sources. Hosted setup-plan run42518201133 copied the resolved template against source9ee0425; its context archive is retained. No unresolved technical selection is hidden as a user requirement.

## Phase 1: Architecture and contracts

The shared PDF contract/controller sits beside Markdown/Mermaid/image domains. Source materializers detect PDF before allocating text, then retain only a descriptor and source-owned adapter. A PDFDataRangeTransport supplies bounded ranges; stream-only Android input uses a private native disk spool and truthful progress. Source/revision belongs to the adapter; the worker sees only bounded document bytes.

Build-only preparation pins/transforms the exact PDF.js package, emits the small allowlisted resource module and retains license/hash manifest. Both worker and display import compatibility APIs before the engine. A dedicated worker entry uses a caller-owned classic port, static decoder fallback factories, denied response CSP and real startup/isolation observations. Fake fallback cannot qualify the candidate. The same configured main WebView is created once after managed state setup so its bundled worker response policy applies on actual native protocols.

The PDF controller owns loading/password state, page proxies, visible/adjacent render/text layers, search, labels/outline/destinations, bounded thumbnails and disposal. Commands capture the current owner/revision. PdfSurface supplies the existing AppFrame with contextual document tools and TaskSurface for password/search/outline/print, using current semantic tokens and48dp Android control targets. Metadata integrates existing renderer contributions; opener execution follows existing explicit-action validation.

Printing uses prepared bounded PNG snapshots rather than another untrusted-PDF parser. Desktop invokes its real native dialog path and reports handoff only. Android stages chunked job-owned PNGs, validates sealed pages and uses a custom adapter to write selected OS-requested pages. Source/revision checks precede invocation. Staging cancellation and OS callback outcomes stay separate; activity pause for OS UI is not a cancellation.

Candidate routing does not expand stable package associations/intents/public claims. All16 included criteria receive current automated/native proof. The final checkpoint plus external PR confirmation avoids self-SHA edits; any changed observed input receives applicable fresh qualification. Keep manual/physical/reference waivers, unrun GUI/VoiceOver and separate #66/#239 scopes literal.

## Project Structure

Feature artifacts live in specs/049-pdf-viewer-foundation/{spec,plan,research,data-model,quickstart,tasks,validation,handoff}.md and contracts/.

Shared domain additions: apps/glitchpad/src/domain/pdf-contract.ts, pdf-controller.ts, pdf-source-gateway.ts, pdf-resources.ts, pdf-worker.ts, pdf-print-gateway.ts and focused tests. Reuse contracts.ts, metadata.ts, commands.ts, resource-ledger.ts, desktop-delivery-gateway.ts and android-restoration-gateway.ts. UI additions: components/PdfSurface.tsx and scoped styles; integrate DocumentSurface.tsx and App.tsx.

Build/security additions: scripts/prepare-pdf-assets.mjs and tests, exact engine compatibility transform in apps/glitchpad/vite.config.ts, native PDF worker response policy and main-window setup in crates/glitchpad-host/src/lib.rs / tauri.conf.json; package/dependency lock and licensing/notices integration.

Native data/print additions: narrow PDF command/model wrappers in crates/glitchpad-host/src/{source,android_source}/ and crates/glitchpad-android-source/src/; Kotlin PdfSourceCache.kt, PdfPrintStore.kt and PdfPrintAdapter.kt beside AndroidSourcePlugin.kt/Models.kt. No general filesystem or print service is exposed to the renderer.

Proof additions: fixtures/pdf/ and fixture provenance, scripts/check-pdf-runtime.mjs, focused browser/production-worker evidence, existing Android instrumentation/provider and bounded runners, desktop package/lifecycle probes, applicable CI/package definitions, changelog.d/S049.md and honest unreleased documentation.

## Execution and verification sequence

Finish design, tasks and blocking cross-artifact analysis before product edits. Implement focused contracts/fixture/compatibility preparation and the smallest composed PDF read path first. Run TypeScript/unit/production-browser grammar/runtime checks, then actual installed ordinary API24 PDF worker/load/render/cancel/isolation preflight, followed by API36. Retain all failures and repair the fixture/transport/application boundary before broad UI and final matrices.

Complete viewing/navigation/metadata/link/print behavior with meaningful tests before the full candidate campaign. Format and regenerate before the final source freeze. Qualify actual source on standard CI plus all four platform package/native PDF journeys, browser/geometry/accessibility aggregates and actual supported print smoke. Independently read selected artifacts, package bytes and observation identities. Publish/monitor the PR and address findings within two rounds; perform formal present-code convergence and stop ready for owner review.

## Complexity Tracking

No constitution violations. The compatibility transform, private spool and native print adapter close demonstrated integration gaps without changing platform promises, granting generic native authority or creating an unrelated service.
