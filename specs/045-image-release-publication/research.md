# S045 Research Decisions

## 2026-11-02: Linux provenance boundary

**Decision**: Share job-scoped registry and git cache directories across all three Linux build containers, fetch the complete graph with cargo fetch --locked before validation, prove metadata succeeds offline in an independent network-disabled container, and use full cargo metadata --locked --offline during final SBOM generation.

**Rationale**: Main run 41553554695 attempts1/2 assembled both packages but failed fresh quote/proc-macro2 sparse-index TLS requests in the final container. Cargo target binaries were shared, registry/git inputs were discarded. Full all-target metadata is necessary for the existing SBOM's dependency graph. Job-scoped mounts avoid stale cross-run graph assumptions and preserve installed Cargo binaries.

**Alternatives considered**: Repeated retries leave a structural final-network dependency. --no-deps, omitted graph entries, or skipped SBOM weaken provenance. Mounting all CARGO_HOME hides installed binaries. Dependency upgrades are unrelated.

## 2026-11-02: Publication authority and source

**Decision**: Amend the operator runbook and matching policy validator to tag the exact reviewed and fully qualified S045 source, before the owner's final PR merge, as explicitly authorized. All PR/head checks and review dispositions precede tagging. Tag-triggered official packages and publisher still require exact source identity and their existing gates.

**Rationale**: The runbook's merge-first wording is an operator rule enforced by text validation, not a tag technical constraint. The owner explicitly requested publish once qualified and final review/merge afterward. S044 source 7187403 receipts cannot qualify a changed S045 source. Use exact branch-head dispatches where PR synthetic commits differ; preserve actual SHA/tree evidence.

**Alternatives considered**: Auto-merging violates the owner boundary. Tagging base acdd434 omits the demonstrated workflow repair and still fails Linux. Publishing an unchecked branch or relabeling old evidence violates evidence-before-claims.

## 2026-11-02: Scope and remaining evidence

**Decision**: Keep PR242 and other deferred dependency upgrades/PDF outside S045. Close #76 then #10 only after public readback. Leave remaining #66 manual work and #239 reference-startup work visible. Preserve unsigned Windows and ad-hoc non-notarized macOS community trust declarations.

**Rationale**: Native dependency changes invalidate the current graph without delivering the requested release. Owner removed unavailable physical Android and manual screen-reader gates; existing other manual rows remain unperformed. Hosted evidence is not reference-hardware evidence.

**Alternatives considered**: Folding new native dependency churn or inventing manual acceptance prerequisites delays the release without a demonstrated blocker.

## 2026-11-02: Observed packaged document proof

**Decision**: Execute an opt-in workflow inside the actual installed/extracted app through its production JS-to-Rust bridges, on a native-owned fixed synthetic fixture, and independently read back the saved bytes. Require observed proof for read/edit/save/metadata/recovery in both candidate and official receipts.

**Rationale**: The existing flag-driven receipt builder fabricates results and contradicts S021 FR-018. Separate source tests are useful but cannot prove the package path. A fixed one-shot native guard and production bridge helper prove the existing app behavior without adding general command/file authority. Keep the workflow outside startup percentile samples and remove only its owned recovery record/source.

**Alternatives considered**: Inheriting source-suite passes violates explicit requirements. Dropping required rows weakens qualification. Broad native UI/keyboard automation would add platform permission/focus dependencies when real packaged bridges and existing synthetic fixture opt-in can exercise the required data operations. Keyboard, focus and other manual UI rows remain unperformed and explicit.

## 2026-11-03: Owner startup eligibility amendment

Internal review found the older S021 FR-020/SC-006 reference-hardware prerequisite was not explicitly retired by S044/S045. The owner approved retiring it for v0.2.0 and using the existing automated hosted checks. Linux tag validation now uses the unchanged 10000 ms hosted ceiling while preserving actual 1500/2500 ms classifications. A focused regression first failed with the old gate; the approved behavior accepts a truthful2600 ms reference classification failure as hosted smoke and still rejects10001 ms. #239 remains open, and no reference-hardware pass is inferred. See [reference-gate-decision.md](reference-gate-decision.md).

## 2026-11-03: Published-site verification reconciliation

The automatic tag deployment was environment-denied. Existing approved-main docs workflow_dispatch supports deploy=true/release_tag=v0.2.0, checks out the exact published tag, verifies authority and successfully deployed f6a1515. Its post-deployment verifier demanded a literal version-tag homepage anchor despite approved generated facts using releases/latest. Changing published content/source was unnecessary; correct the operator assertion to require the actual approved anchor to resolve to the exact repository/version while retaining SHA/version/docs/brand checks. Internal review found quoted-attribute/script-text false positives in the first extractor;19 tests now cover actual anchors, raw/inert content, authority, redirect and status failures. Full live verification passes. Original workflow failures remain retained, and no environment policy, tag or public bytes changed.
