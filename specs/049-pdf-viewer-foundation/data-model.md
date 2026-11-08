# S049 data model

## PdfDocumentState (contract version1)

A ShellSession may own pdf_document with owner_id, source revision, load state, page_count, current page/label, zoom/fit/rotation/layout, degraded status, capabilities and bounded metadata/navigation projections. Source identity/authority and external revision remain existing host/session facts; document bytes are never normalized as text or made writable. Processing IDs are opaque document-owned tokens, not source IDs or locators.

Load states are idle, loading, spooling, password_required, ready, limited, cancelled, failed and disposed. Stable reasons distinguish malformed, incorrect_password, unsupported_encryption, source_limit, page_limit, surface_limit, source_changed, permission_revoked, worker_failure and unavailable. A password is an in-memory continuation only, never part of persisted session, metadata or logs.

## PdfSourceLease

A parent-owned lease captures source_id, identity/external revision, length, platform profile, bounded read/cancel/close operations and optional private native cache lease. Seekable sources use bounded ranges with at most two in flight; worker requests are validated before native reads. Stream-only input spools to a private native file under the source hard limit and quota, reporting progress, finishing/revalidating before exposing random reads, and deleting partial or closed leases. Unknown source length is observed from the bounded spool without inventing provider modification facts.

## PdfController and resource owner

One active controller owns actual worker/loading/document instances, page proxies, render/text/search/thumbnail tasks, source lease, owned surfaces and subscriptions. Every asynchronous result carries owner/revision/request identity. Cancel/close invalidates that identity immediately, aborts actual work and disposes resources before releasing ledger entries. Background documents retain compact navigation state and reacquire processing on activation. Cancellation acknowledgement retains the existing250ms hard limit.

## Page and navigation projections

Page indices are zero-based internally and displayed as user-facing page/label facts. Each loaded page supplies finite positive dimensions, rotation and text geometry. Only visible/adjacent surfaces are admitted under desktop200MiB/Android96MiB budget. Invalid dimensions and multiplication overflow fail before allocation. A reduced-cache state shrinks look-ahead and disables thumbnails. The document hard limit is10000pages, source512MiB desktop/256MiB Android.

Outline/destination/text/search/thumbnail projections are document-owned, depth/count/string/result bounded and cancellable. Search yields ordered page matches/context rather than storing all document text. Invalid destinations, recursive trees and over-budget output receive stable outcomes. No navigation state writes the source or grants external authority.

## PdfMetadataContribution

The renderer contributes bounded typed version, page count/labels/dimensions, encryption/permissions, title/author/subject/keywords, creator/producer, creation/modification, outline and unsupported-feature facts. Existing FactValue, provenance, availability, units, sensitivity and copy policy remain authoritative. Host source facts are not reclassified as parsed PDF facts. Permission flags are informational. A failed fact may be unsupported/failed without failing otherwise readable content.

## PdfPrintJob

An explicit user action captures document owner/source revision and a validated all/current/range selection. Staging renders bounded page snapshots, validates dimensions/encoded bytes and seals page digests. A job owns page metadata and private buffers/cache; no original-PDF native parser is introduced. Resource failure is a concrete limited result with a smaller-range remedy, never an invented successful print.

Desktop states are preparing, ready, system_handoff, released, failed and cancelled_before_handoff. The result reports an observed dialog request, not paper completion; afterprint may release resources but does not prove printing/cancellation. A retained task can release its owned snapshot after the user finishes system UI when the platform provides no terminal callback. Android states additionally record native layout/write/write_cancelled/write_failed/adapter_finished and separately observed PrintJob state. onFinish is not physical output and activity pause is not cancellation. One pending native job owns chunked private PNG files until genuine terminal cleanup. OS page ranges are intersected with prepared page ordinals and only the OS output descriptor is written.

## QualificationObservation

Each observation identifies actual source, artifact/run/attempt, installed bytes when applicable, platform/WebView, fixture digest, test mode/profile and evidence class. Browser-only, early diagnostic, installed candidate and print-handoff/spool outcomes remain distinct. Failed/unrun/manual/waived rows are never converted to unrelated passes.
