# S048 data model

## Target release identity

The existing packaging/release/package-contract.json owns version0.2.1, target tagv0.2.1, repository, eight payload names, platform trust states and required practical-use receipts. Product manifests and platform contracts remain independent checked projections. This record describes the target and grants no publication permission.

## Candidate source

A forty-character source SHA identifies the code actually built and observed by native/frontend/package metadata. A PR merge commit and branch head are separate sources even when their trees are equal. Owner merge verification compares contents only; later tagging preserves the accepted candidate SHA.

## Staged artifact

Fields: platform/workflow/run/attempt, actual source SHA, staging context, artifact ID/name/created_at, archive byte count/SHA256, canonical manifest/provenance digests, payload role/name/size/SHA256 and actual certificate/community trust class. IDs are unique; all expected payload names come from the target contract. Desktop trust metadata is finalized before the native receipt binds its digest. Android project-key signing is verified against the configured public certificate fingerprint; no key material is recorded.

States: built_unqualified -> staged_unpublished -> qualified_preparation_unpublished -> later_owner_accepted_publication -> published_verified. A failed required observation blocks qualification. A stable signature, successful build or eligible-official manifest alone does not imply a published release.

## Qualification observation

Fields: campaign role (ordinary_debug, fault_probe_debug or release_runtime), source/native/frontend identities, tested app/test APK hashes, package/version/channel, minified/nondebuggable inventory, Android/API/WebView, native/CSS viewport and text/nav profile, task/method/results, exact readbacks, attempt/JUnit/marker/crash status, screenshots/logs and explicit not-applicable/conditional/unrun disposition. Source-only, synthetic-browser, installed-debug, installed-release, artifact, publication and physical trust classes remain separate.

The release runtime uses the unmodified canonical minified universal APK on API24/API36. Test-owned provider files transport installed APK copies/JSON/PNG; only the test APK is debuggable. Provider APK evidence names are fixed, transport is streamed and capture validates actual bytes. No product permission or source authority changes.

## Accepted staging input

A versioned JSON record carried by a later owner-authorized annotated tag identifies accepted_source_commit, version/tag, four platform run IDs and exact artifact sets, plus eight accepted payload digests. Validate complete/unique platforms and payloads, full source SHA, positive immutable IDs, expected names, archive hashes and source/run/artifact binding. The publisher downloads these selected bytes and runs existing strict assembly/native checks; it does not rebuild or choose an older successful fallback.

## Handoff and reviews

A tracked checkpoint receipt may name its already-existing implementation source. The final PR confirmation binds the eventual current head and all fresh final artifacts after record publication. Review state records maximum2, rounds_used, exact reviewed source, findings/resolved threads, subsequent qualified changes and owner boundary. This session ends PR-ready/unmerged/auto-merge-off, with #244/#255 open.

## Historical scope

S047's immutable ledger retains119 controls/459 scoped cases and its exact implementation/final-PR identities. S048 references its dispositions and adds current campaigns separately;98 supplemental cases are not individual installed passes. Existing waivers, unavailable incident data, #66/#239 and unrun manual GUI/VoiceOver observations keep their literal state.
