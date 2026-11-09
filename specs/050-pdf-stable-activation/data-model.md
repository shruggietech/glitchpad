# S050 data model

## ActivatedPdfCapability

One canonical PDF family owns extension pdf, application/pdf, renderer pdf and associated/dialog availability. Generated desktop/Tauri/Linux/Android declarations mirror it; content identification, source authority and unsupported-format negatives remain independent. Target release0.3.0 and Android update code1006 retain existing application IDs and signer/trust states.

## PdfFixtureCase

A stable case ID maps to criterion IDs, expected success/failure/degradation, original/provenance/license/source/derivative digests, byte/page/geometry/text/image facts and required witnesses. Original S049 cases are immutable. New asset metadata records exact font/tool/codec versions. Corpus metadata never substitutes for actual worker output.

## PdfOperationObservation

An observation includes operation/method/scope, raw samples_ms and sample count, cold/warm phase, p95/max, fixture/source/profile/runtime identity, before/peak/after accounting and outcome. Render bytes/count, ranged-read bytes/concurrency, private-cache files/bytes, named process RSS/PSS and optional realm heap are separate quantities. Unsupported measurements are null with a reason, never zero. No parser-worker heap claim is inferred from other scopes.

## PdfCandidateReceipt

Version1 identifies evidence class, source, workflow/run/job/attempt, package/manifest/installed app/test digests where applicable, runtime/OS/architecture/API/WebView/build profile, fixture manifest/hash, required cases, actual outcomes, timing/resources, source preservation, print/cancellation/cleanup and retained attempts. States are passed, failed, not_run or explicitly waived. Only existing manual/physical/reference waivers are eligible for waived status. Runtime diagnostics remain diagnostic_only and cannot qualify a candidate.

The aggregate groups by current source, required profile and case ID. It selects the greatest current attempt, requires terminal success and matching identities/clean applicable native completion, and preserves all earlier attempts. A newer failed/missing result blocks; an older successful row cannot rescue it. Historical source observations remain historical.

## PreparedDocumentationPass

The immutable prepared source record includes schema/kind, target/prior versions, S049/S050, changed sections/capabilities/platform/security/tooling rows, actual fragment set, preparation time and pending_owner_review approval with null actor/evidence. It is not a publication receipt. The accepted preparation references its SHA256 and eventual S050 PR number.

## AcceptedReleasePreparation

Reuse the current four-run accepted record and8 canonical payload identities. All required source/run/attempt/artifact/native/manifest/PDF bindings must pass; selected platform attempts are complete/fresh, not partial rerun artifact mixtures. The assembler consumes exact bytes without replacement/rebuild. Later tag-only publication verifies actual PR head/merge-tree/ancestry and emits observed merge actor/time externally, preserving immutable prepared source and later owner authorization.
