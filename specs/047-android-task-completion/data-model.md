# S047 data model

## DocumentTaskContext

Existing session ID/revision/source authority, renderer/mode, selection/position, pending write and draft. Viewport adds measured natural/available bounds, effective scale, fit/custom mode, pan, readiness and pointer ownership. Frame/icon/background remain separate. A command captures session/revision; stale completion cannot mutate another session. Fit recomputes on available bounds; pan preserves scale; Actual size sets1; Reset returns Fit only.

## TaskSurfaceState

Application-owned kind (application menu/documents/tools/preferences/metadata/about/help), open, modal policy and invoking focus. One eligible top layer commits Back; predictive cancellation changes none. Modal containment/inertness and restore follow the pinned headless primitive; the AppFrame overlay/environment remains authoritative. Wide metadata may be nonmodal explicitly.

## ImagePreviewOutcome

Loading, ready or failure. Stable failure categories distinguish malformed, unsupported, external reference, cyclic/missing reference, resource/deadline, source_read and host_transport, retaining existing other codec categories. Failure has a user explanation and action disposition. Only recoverable read/transport paths offer retry; all failures retain original source/metadata. No usable bitmap means no successful viewport action.

## InstalledApplicationInfo

Read-only native package identifier, version/version-code where applicable, build/source identifier, channel and platform. Missing facts are explicit. Notice projection returns applicable full offline LICENSE/NOTICE/third-party text on request. Explicit external-link requests use existing policy/adapter, without content payloads.

## ControlDisposition

Literal source ID/page/group/label and all named options; owning issue(s), source/component, mounted status (interactive/passive/unmounted/unsupported-absent), case IDs and evidence references. Candidate status starts pending. Inherited S046 evidence is separate from new integrated candidate proof. Every119ID occurs once; overlaps reference one row. Report-declared150 and literal154chunks are metadata, not passing counts.

## CandidateJourneyReceipt

Ten unique journey IDs with per-variant pass/fail/not_run/N/A (reason required for N/A). Required identity: actual installed application/instrumentation SHA256, correlated source commit, package/version/channel, compile role ordinary/fault_probe, API and WebView, native/CSS frame, text scale, navigation mode, logs/screenshots and every attempt. Saved/exported/receiver readbacks carry expected/actual digest or exact synthetic result. A role/source/hash mismatch, duplicate/missing row, failed/unrun required variant or nonterminal process prevents qualification.

## PredictiveBackObservation

Private fixed saturating counters for started/progressed/cancelled/committed/requested/completed/delegated plus pending/enabled snapshot. Same callback/plugin/UI thread; no new consuming callback or JS activation. Cancel requires positive OS callbacks with zero commit/request/delegation and unchanged document/draft/layer. Commit consumes one layer. API24 progress N/A is explicit.

## 2026-11-07 05:18 UTC Android range transport

The existing provider-backed range operation retains opaque source identity, requested offset/length and operation budget. Its private Kotlin reply encodes bounded bytes as Base64 instead of individual JSON numbers; Rust validates and decodes it into the unchanged domain ReadRangeResult. Renderer callers may request binary mode on read_android_range: the raw reply is one end-of-source flag byte (0 or1), then the exact range bytes, including empty EOF payloads. Default callers retain the JSON domain result. The renderer validates the header, requested maximum and unchanged source/offset ownership before returning a Uint8Array. Abort/generation checks still reject late completions. This encoding changes transport cost, with no new content limit, source authority, network route or deadline.

Pinned Tauri2.11.6 may deliver its raw-response frame as a number array when custom-protocol response delivery is unavailable. The Android decoder accepts that framework fallback only after the same header, integer-byte and requested-length validation; it requests raw mode in both cases. No retry, larger read, alternate source or deadline extension is introduced.
