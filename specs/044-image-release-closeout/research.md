# Research: S044

## Dependency convergence

**Decision**: Integrate #240 and selected application patch fixes from #226, with shared fuzz locks and current notices.

**Rationale**: roxmltree0.21.2 replaces recursive content parsing; notify8.2.1 updates Mac native watcher dependencies. Both intersect current image/native qualification. Current SVG preflight rejects excessive depth before DOM parsing. Existing vendored Tauri plugins remain necessary for maintained zbus6.

**Alternatives considered**: Blindly merge every bot group (unrelated major/minor migration risk); defer every dependency (miss compatible fixes before final qualification).

## Startup evidence

**Decision**: Persist all attempted startup phases and own PID cleanup before readiness waits; compare retained baseline/candidate with one sampler on the same hosted Mac runner.

**Rationale**: Research traced lost failure evidence to lifecycle classification before receipt write, and possible orphan process to late activePid assignment. Existing endpoint is shell-ready, not document-ready. Repeated starts reuse OS caches; no fresh OS-cold claim is supported.

**Alternatives considered**: Raise thresholds, trim first sample or treat hosted smoke as reference (all would alter or misstate evidence); rebuild the old source (changes baseline toolchain and bytes).

## Native observations

**Decision**: Add fixed-field Windows/AppFrame diagnostics and retain limits.

**Rationale**: Prior failures recovered without code/assertion changes; no application defect is demonstrated. Capture state before cleanup, and never invoke JS again to diagnose a stuck JS callback.

**Alternatives considered**: More retries or longer deadlines (no diagnosis); raw UI/process/window dumps (unnecessary content exposure).

## Release handoff

**Decision**: Bind exact S044 packages and checks in a retained inventory, with merge/tag/publication/Pages pending.

**Rationale**: Existing readiness script validates declarations and evidence presence; its success is not native runtime or publication evidence. #76/#10 remain open until actual release completion.

**Sources**: Current #66/#76/#239/#240/#226 issue/PR bodies; lifecycle/validators/workflows at386097b; published v0.1.4 asset inventory; two read-only planning agents. No unresolved technical clarification remains.
