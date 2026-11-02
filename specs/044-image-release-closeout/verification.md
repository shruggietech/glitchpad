# Verification: S044

## Scope and dependency disposition

Cargo PR #240's six Cargo updates are integrated, with27 changed/new transitive registry identities. The shared fuzz lock aligns roxmltree0.21.2, serde_json1.0.154, schemars/schemars_derive1.2.3 with the application. Existing licensed zbus6 plugin patches remain unchanged. The SVG preflight still rejects depth above128 before DOM parsing; no product exposure is inferred from the upstream parser fix.

npm PR #226 is partially integrated: React/ReactDOM19.3.1 on all workspace consumers, DOMPurify3.4.17, CodeMirror autocomplete6.20.4 and view6.43.15. Remaining site/toolchain/minor-runtime changes are deferred for separate qualification; #226 is not implicitly closed. The unrelated major tooling PRs remain outside S044.

All four package notice files retain upstream license texts for the32 changed Cargo/npm identities. Omitted registry license files are resolved from exact upstream source revisions or the canonical SPDX MPL2.0 text; sources/digests are retained with the candidate.

## Focused evidence

- New sampler suite initially failed because the helper was absent, then passed6/6 behavior cases (separate shell/document phases, retained timeout, unobserved-launch cleanup, cleanup failure, AB/BA ordering and preserved over-budget samples).
- Comparison tests exposed an incomplete-campaign false pass and an invalid reference pass after a failed sample; both regressions were fixed and all3 comparison cases pass.
- Current macOS package contract suite passes27 tests (plus a subsequent real child-process cleanup regression) and validates31 extensions/one artifact contract.
- Portable diagnostic tests pass for exited/running/no-window state and reject arbitrary scenario identifiers; hostile extra path/title/argument fields never enter output. PowerShell lifecycle parser passes in Linux.
- Published v0.1.4 evidence archive SHA2569fe15e6a216789eae5e595e8aa6a4ef41cd4bace286f23b6b84b799e9c3e681a verified locally. Its manifest binds source1d7dcd46689fb0ea68e4cee5c3d43a06d94bc94b and DMG SHA2560d116cf8f8d0528e2d84f54adc934a3368f9d221b07935bb8324d2213a8bfcff.

## Aggregate environment correction

The first aggregate run passed Rust formatting/Clippy/native tests, Cargo advisory/license/source policy and frontend checks. It later stopped at the Mermaid browser launch because the validation image pinned Puppeteer25.10.0 while the workspace pins25.12.0. The Dockerfile pin is corrected and the reusable qualification image rebuilt successfully. Browser gates now pass. A Windows mutation-test ambiguity was repaired by scoping the required fallback to its actual function; the targeted test failed before that repair and passes afterward. The subsequent aggregate reached documentation lint, which rejected two issue-reference paragraphs beginning with a hash; their prose is corrected. The final aggregate rerun completed with exit0 (log `.tmp/s044-aggregate4.log`). It validated474 Markdown link inventories,47 rendered Mermaid diagrams and1922 UTF-8 text files, with version authorities agreeing on0.2.0. No browser assertion is disabled.

## Pending validation

The aggregate gate, community release policy (31 tests), declaration/evidence-presence readiness check and current fuzz valid-seed test pass. The community gate also required retaining the explicit S043 image-activation sentence and lowercase issue-reference traceability in the S044 release notes; these documentation gaps are corrected. The readiness script confirms declarations/evidence presence only, not native qualification or publication. Final-source native CI, paired measurements, eight-package readback, review rounds and final issue dispositions are pending. No pending result is a pass. #66 non-waived manual rows remain explicit; #76/#10 publication criteria remain open. No tag, official release or Pages publication is authorized in this run.
