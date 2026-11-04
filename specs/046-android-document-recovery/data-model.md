# Data Model: S046

- Draft/copy session: stable local session and recovery identity, Markdown/text kind, content/revision, dirty state, optional native source only after verified creation. Recovery-only identity never grants overwrite authority.
- Action descriptor: id, targetSessionId/targetRevision, role/group/rank, enabled/reason. Pending operation captures target/revision and cancellation; results are performed, failed, cancelled or unavailable with stable bounded reason.
- Destination request: operation identity, expected local revision, suggested name/MIME and bounded UTF-8 bytes. Existing-source Save As additionally validates source identity/revision. Receipt returns verified destination summary and byte count; reducer binds only the captured current document and preserves newer dirty edits.
- Failure event: allowlisted component, stage, reason and random correlation; no exception text, content/name/path/URI/link target. Existing bounded retention applies.
- Diagnostic export: frozen serialized JSON bytes and operation state. Save returns verified byte count; Share returns handoff/cancelled without claiming delivery. Native environment supplies version/build/source/API/Android/WebView facts or explicit unavailable values.

Transitions: draft dirty -> pending destination -> verified bound/clean only for saved revision; cancellation/failure -> original dirty session. Edits during pending stay dirty. Close/discard cannot resolve through pending writes. Recovery returns local authority only until an independently revalidated provider source exists.
