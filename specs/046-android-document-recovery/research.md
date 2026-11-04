# Research: S046

## 2026-11-03

### Native destination creation and integrity

Decision: introduce a source-independent create-document operation and retain source-bound Save As. Rationale: AndroidSourceHost.save_as requires prior source/revision while Kotlin saveAsResult already creates/writes/syncs/readbacks/acquires a destination. Alternatives: fabricated source identity is invalid; duplicate writers would diverge. Generic Save As must adopt image-export destination identity/nonempty guards and conditional cleanup.

### Recovery and Markdown failures

Decision: use existing bounded source-independent snapshots, preserve recovered Markdown type and flush at lifecycle/restart. Root loading/recovery must exist outside static application imports; document boundary and asynchronous projection failures feed one bounded event path. Inspected gaps are not proof of the unavailable owner's incident cause.

### Action outcomes

Decision: await typed operation results including clipboard failures and no-handler cases. Rationale: current executeCommand returns applied after validation and App reuses it after false renderer result. Image/diagram providers must share local viewport methods. Alternatives: special-case Save only would leave other false success paths intact.

### Diagnostic Save/Share and identity

Decision: freeze exact JSON bytes, reuse verified create/write for Save and existing FileProvider with temporary read access for Share. Add actual native Android/WebView/build facts and explicit unavailable values. Share handoff is distinct from recipient delivery. Existing browser anchor export has no native receipt.

### Qualification identity

Decision: retain the APK actually installed and tested with SHA-256, source, package/version and runtime facts. Rationale: current CI debug build overrides version to 0.0.1 and uploads reports without tested APK; another same-source release artifact does not prove identical bytes were exercised. Preserve failures/retries separately.

Research used dedicated native-contract and frontend-boundary agents, as required by speckit-plan Phase 0. No new engine, architecture platform or product policy is introduced.

### 2026-11-04: Actual-app findings

Production-bundle task/layout checks exposed a default preview preference overriding new Markdown source mode and Add document overlap at maximum text scale. Correct the actual state/composition and reserve measured control height. Packaged fault injection uses a test-build-only activation seam; a normal-build negative check proves it is unavailable to released builds.
