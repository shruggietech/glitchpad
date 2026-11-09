# S050 research decisions

All decisions dated2026-11-09. Three mandatory read-only planning agents inspected activation, conformance and release identity. They made no source edits or validation claims.

## R01: Execution and phase identity

Decision: use installed repository Spec-Kit helpers and isolated hosted Linux/native CI. Docker client exists but its Linux engine pipe is unavailable; WSL lacks Node/pnpm/Cargo/PowerShell and DNS. Built-in file/data access and scripts/invoke-vcs-hidden.ps1 remain local. Intermediate diagnostic snapshots are not qualified candidates; explicit source-bound phases run separately from the final full campaign. Rationale: preserve the approved hidden desktop boundary and reuse available CI. Alternatives: direct Windows tools or installing another workstation toolchain would violate the selected execution contract or add unrelated work. Clarification42569534292 and plan initialization42569624158 ran against0933b9747988c5112d1c1090628d0d773b475dc6. Both actual contexts identify050-pdf-stable-activation; the active spec template resolves to the existing project template and no extension hooks exist.

## R02: Stable PDF activation

Decision: add one PDF family/application-pdf row to packaging/desktop/capabilities.json and regenerate/reconcile existing Windows/macOS/Linux/Android declarations. Promote PDF into GOVERNED_EXTENSIONS and remove the candidate-only exception; keep DOCX/ODT, generic-MIME/file-scheme/SEND_MULTIPLE negatives. Linux uses system-owned application/pdf via its MIME map/desktop registration, not a duplicate XML type. Rationale: the existing source and PDF renderer paths already work. Alternatives: a second format whitelist or new native authority adds drift without value. Inventory tests change only the expected added extension/MIME and positive resolver path.

## R03: Minified Android PDF proof first

Decision: reuse pdfCompatibility through production resolved cold/warm delivery, observedTestWebViewPackage and the existing test-owned fixture-provider evidence channel. Keep direct app-internal PdfPrintNativeStoreChecks in debug proof; the release journey exercises public print commands. Add focused pdf runtime mode as diagnostic_only and include PDF in full minified release qualification. Capture PDF-visible screenshot, installed app/test copies and selected/all raw print PDFs before switching away for disposal. Rationale: nondebuggable app run-as and R8-renamed internal classes cannot qualify release behavior. Alternatives: another debug run or a component-only intent bypasses the material gap.

## R04: Original conformance corpus

Decision: preserve every S049 fixture/hash. Extend its existing PDF writer with original PDF-version/codec, mixed geometry, hostile, valid10000page and Hebrew CID/ToUnicode fixtures. Use pinned Pillow12.3.0 for reversible raw JPEG2000 and TIFF Group4 strip encoding; wrap Group4 in original embedded JBIG2 page-info48/type38-MMR/end-page49 segments. Assert strip shape/compression/fill order and use actual decoder-specific asymmetric pixel witnesses. No encoder CLI dependency or third-party PDF corpus is needed. Rationale: existing tests do not execute both static decoder paths or real RTL extraction. Alternatives: source-string checks, generic ink or unlicensed downloaded PDFs are insufficient. Source-supported recipes still require the first focused runtime execution.

Pillow source: [JPEG2000 encoder options](https://github.com/python-pillow/Pillow/blob/12.3.0/src/PIL/Jpeg2KImagePlugin.py#L394-L442), [codec availability/version](https://github.com/python-pillow/Pillow/blob/12.3.0/src/PIL/features.py#L69-L110). Segment recipe reference: [PDFium JBIG2 parser](https://pdfium.googlesource.com/pdfium/+/bb1f9f71e7b15afdd5937adf8cfe5807522b882f/core/fxcodec/jbig2/jbig2_context.cpp), [MMR decoding](https://pdfium.googlesource.com/pdfium/+/bb1f9f71e7b15afdd5937adf8cfe5807522b882f/core/fxcodec/jbig2/jbig2_grd_proc.cpp#545). That revision supports the recipe and is not asserted as the exact provenance of the shipped fallback. Runtime useWasm:false plus the exact reviewed transform, real worker, expected image pixels and zero .wasm/network fetches establish the actual shipped static path.

## R05: Licensed real RTL font

Decision: use Noto Sans Hebrew at Google Fonts commit8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5, original112640bytes/SHA2567ef36a2c3593758cdb622e1bdef4f84523e92fbc3ccc667438dd80ff54c2de88, retaining OFL1.1. Existing kit fonts lack Hebrew/Arabic glyphs. Instantiate wght400/wdth100 and subset original fixture text with existing fonttools4.65.0; record original/derivative hashes. Embed correct CID widths/glyph/ToUnicode maps and assert logical Unicode, visible direction, search and selection. Rationale: real content needs real glyphs; the fixture font is not a UI/brand font. Alternatives: Latin-only/box glyphs do not prove RTL; Hebrew does not imply Arabic shaping. [Pinned source and license](https://github.com/google/fonts/tree/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notosanshebrew).

## R06: Measured performance and resources

Decision: extend existing reading/native receipts with raw identified operation samples for first useful canvas+text, cold/warm page navigation, search, thumbnail availability and disposal. Preserve512/256MiB source,10000pages,200/96MiB surfaces,250ms cancellation and repeated50ms interaction-task contracts. Use supported long-task observation and truthfully labelled interaction/operation fallback measurements; RAF responsiveness is never relabelled exact task duration. Record render/range/cache accounting separately from sampled host/process RSS/PSS and optional realm heap. Parser heap is not inferred from surface bytes or main-realm heap. Rationale: PDF has no independent first-page/search numeric reference budget; inventing one would change the contract. Missing required evidence cannot become zero or a pass.

## R07: Strict candidate aggregation

Decision: one narrow source/profile/case-aware PDF conformance validator aggregates existing receipt files. It retains all attempts, selects the greatest required current attempt and rejects a newer failed/missing/stale/package-mismatched/unbounded result, even when an older pass exists. Browser/source/native/package/manual/waived scopes remain separate. Rationale: current independent representative receipts need an actual release-level join. Alternatives: any-success selection or historical archive reuse would conceal failure.

## R08: Version and current-public authority

Decision: target0.3.0 through the existing release identity authority, all canonical/mirrored manifests/contracts and generated documentation. Increment stable Android release versionCode1005 to1006, preserving application ID and signer continuity. Preserve version-independent parser test data and every historical0.2.1 receipt. Existing /releases/latest and source-version-is-not-publication wording keep public downloads honest. Rationale: target-version and actual-public identity already have a supported separation. Alternatives: a second published-version registry or global textual replacement would introduce drift or corrupt history.

## R09: Release scope and documentation-pass record

Decision: replace the active recovery-specific handoff gate with narrowly declared current release scope S049/S050/#81/#82/#11, retaining #66/#239 independent. Add a machine-readable prepared documentation-pass JSON and validator covering required versions/slices/sections/claims/platform/security/tooling/fragments/time. Its approval state remains pending_owner_review with null actor/evidence. Rationale: the normative release contract requires a machine-readable record and existing gates check only Markdown existence. Alternatives: copying old recovery words or inventing an approver cannot satisfy that contract.

## R10: Owner approval without source mutation

Decision: accepted preparation records bind the immutable documentation-pass digest and S050 PR number. The existing tag-only publisher later verifies live merged PR/head, immutable merge-tree agreement and merge ancestry before emitting observed merge actor/time into external verification evidence. An unrelated later main commit does not rename or invalidate already accepted bytes. Actual publication still requires the later owner instruction. Rationale: owner final review/merge is the existing authority; no new approval ceremony or self-SHA source edit is introduced. Premerge consumer/assembler rehearsal remains a byte/content check and does not pretend approval/publication occurred.

## R11: Final staged-byte PDF qualification

Decision: attach PDF proof to existing staged native/package/runtime archives and validate those bindings in accepted-release-inputs.mjs and assemble-community-release.mjs. Freeze source after review fixes, then run four stage_release:true workflows as complete successful latest attempts. The existing consumer rejects partial rerun sets whose reused artifacts predate the latest attempt. Independently read all8 canonical payloads, installed copies, native PDF facts and Android print outputs; rehearse the real consumer/assembler without publishing. Rationale: debug PDF archives plus a core-only minified campaign cannot qualify the staged release bytes. Alternatives: weakening freshness/source checks or another evidence service are unnecessary.

## R12: Review and issue closure

Decision: publish one PR, count at most two actual external review rounds and retain every reviewed/final head. Resolve threads and freeze completion records before final qualification; final external receipt records execution without editing its own source hash. #81 can close on merge after its matrix passes; #82/#11 remain open for actual tag/publication/public readback. Rationale: this is the owner-approved stop boundary. Existing physical/manual-screen-reader/reference waivers persist and automated observations are never relabelled manual.

## R13 - Correct hosted/reference classification (2026-11-09)

Actual minified API24 functional/JUnit/print/cache checks completed in run42576973414, but an S050-added validator incorrectly rejected any hosted main-realm long task above50ms. The canonical repeated_interaction_task metric applies to three named reference release profiles, while approved FR-012 preserves the existing reference-hardware waiver and forbids unsupported reference claims. Remove the newly introduced hosted timing gate, preserve raw50-104ms observations and the unchanged reference budget, and report reference performance as not_run_existing_owner_reference_waiver. Reuse the exact signed app/test inputs for fresh diagnostic-only API24 then API36 execution; final accepted qualification still requires fresh complete current-source staging.
