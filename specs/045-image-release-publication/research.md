# S045 Research Decisions

## 2026-11-02: Linux provenance boundary

**Decision**: Share job-scoped registry and git cache directories across all three Linux build containers, fetch the complete graph with cargo fetch --locked before validation, prove metadata succeeds offline in an independent network-disabled container, and use full cargo metadata --locked --offline during final SBOM generation.

**Rationale**: Main run41553554695 attempts1/2 assembled both packages but failed fresh quote/proc-macro2 sparse-index TLS requests in the final container. Cargo target binaries were shared, registry/git inputs were discarded. Full all-target metadata is necessary for the existing SBOM's dependency graph. Job-scoped mounts avoid stale cross-run graph assumptions and preserve installed Cargo binaries.

**Alternatives considered**: Repeated retries leave a structural final-network dependency. --no-deps, omitted graph entries, or skipped SBOM weaken provenance. Mounting all CARGO_HOME hides installed binaries. Dependency upgrades are unrelated.

## 2026-11-02: Publication authority and source

**Decision**: Amend the operator runbook and matching policy validator to tag the exact reviewed and fully qualified S045 source, before the owner's final PR merge, as explicitly authorized. All PR/head checks and review dispositions precede tagging. Tag-triggered official packages and publisher still require exact source identity and their existing gates.

**Rationale**: The runbook's merge-first wording is an operator rule enforced by text validation, not a tag technical constraint. The owner explicitly requested publish once qualified and final review/merge afterward. S044 source7187403 receipts cannot qualify a changed S045 source. Use exact branch-head dispatches where PR synthetic commits differ; preserve actual SHA/tree evidence.

**Alternatives considered**: Auto-merging violates the owner boundary. Tagging base acdd434 omits the demonstrated workflow repair and still fails Linux. Publishing an unchecked branch or relabeling old evidence violates evidence-before-claims.

## 2026-11-02: Scope and remaining evidence

**Decision**: Keep PR242 and other deferred dependency upgrades/PDF outside S045. Close #76 then #10 only after public readback. Leave remaining #66 manual work and #239 reference-startup work visible. Preserve unsigned Windows and ad-hoc non-notarized macOS community trust declarations.

**Rationale**: Native dependency changes invalidate the current graph without delivering the requested release. Owner removed unavailable physical Android and manual screen-reader gates; existing other manual rows remain unperformed. Hosted evidence is not reference-hardware evidence.

**Alternatives considered**: Folding new native dependency churn or inventing manual acceptance prerequisites delays the release without a demonstrated blocker.
