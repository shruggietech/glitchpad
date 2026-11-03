# Data Model: S044

## Startup attempt

An attempt has package identity (baseline/candidate), global order, package-local index, first-launch/cache-warm-process category, source revision and application digest; monotonic elapsed phase timestamps for launch request, launch-command exit, process discovery, shell-ready and document-ready; outcome and fixed failure code; cleanup outcome. Persist attempts before gating. Failed attempts have no invented successful duration.

## Paired comparison

A comparison binds sampler source, exact baseline/candidate package hashes and manifests, OS/build/architecture/WebKit and shared runner identity to alternating AB/BA ordered attempts. Raw attempts are authoritative; p95 includes every successful attempt and any failed attempt makes the campaign fail. Reference classification and hosted ceiling are separate fields.

## Candidate handoff

The final source revision binds workflow/check identities and all eight package byte digests/sizes/provenance. Lifecycle, image, fuzz, security/license and issue dispositions reference actual receipts. Merge SHA, tag, release assets and Pages fields remain pending until authorized publication. No private content, paths or credentials are part of these entities.
