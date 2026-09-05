# Data Model: Ship macOS Package

## Desktop capability inventory

- `schema_version`: Contract revision.
- `release`: Capability release target.
- `families[]`: Stable renderer family identifier, description, extensions, media types, renderer, association eligibility, and dialog eligibility.
- `forbidden_extensions[]`: Planned or unsupported extensions that must never appear in package claims.

Validation requires globally unique lowercase extensions, exact agreement with stable editor/native delivery inventories, and no overlap with forbidden extensions.

## macOS package contract

- `schema_version`: Contract revision.
- `platform`: Exactly `macos`.
- `architecture`: Exactly `universal`.
- `candidate_version`: Explicit nonzero semantic version.
- `artifact`: Canonical DMG kind and name.
- `document_extensions`: Exact stable extension set bound to the shared desktop capability inventory.
- `bundle`: Product name, bundle identifier, main executable relative path, minimum system version, required resources, and approved icon.
- `size_budget`: Target and hard-limit bytes inherited from S018.
- `candidate_trust`: Required ad-hoc signature and non-notarized state.
- `official`: Authorized event/tag plus required identity, signature, runtime, timestamp, notarization, stapling, Gatekeeper, evidence files, and maximum evidence age.

## macOS package manifest

- `schema_version`, `version`, `platform`, `architecture`: Candidate identity.
- `source_commit`, `workflow_identity`: Reproducibility authority.
- `official`, `gate_status`: Candidate or official state.
- `artifact`: Canonical name, bytes, SHA-256, size classification, signature status, notarization status, and stapling status.
- `application`: Bundle name, identifier, version, minimum system version, executable path/digest, deterministic bundle-inventory digest, architecture set, signature status, hardened-runtime status, and timestamp status.
- `application_inventory[]`: Deterministically ordered relative path, semantic role, byte length, and SHA-256 digest.
- `document_extensions[]`: Sorted declared stable extensions.
- `evidence_files[]`: Exact official evidence inventory when official.

The manifest transitions from `candidate_valid` to `official_valid` only after live verification binds all official evidence to unchanged final bytes.

## Apple trust evidence

- `schema_version`: Evidence contract revision.
- `application`: Live `codesign` validity, authority chain, team identifier, designated requirement, hardened-runtime flag, timestamp result, and executable digest.
- `dmg`: Live `codesign` validity and final digest.
- `notarization`: Submission identifier, accepted status, submitted artifact digest, completion time, log digest, and warning count.
- `stapling`: Live DMG ticket validation result.
- `gatekeeper`: Live assessment type, source, authority, and accepted result.

Secret material and raw tool output are prohibited. Only normalized verification facts are retained.

## Clean-host receipt

- `schema_version`: Receipt contract revision.
- `candidate_manifest_sha256`: Binding to the exact manifest.
- `evidence_authority`: Exact GitHub workflow identity, source commit, and governed native test-suite inventory that authorize automated pass results.
- `macos`: Product version, build version, architecture, hardware architecture, and WKWebView version.
- `automated`: Mount, copy, launch, Finder event, running-instance event, read, edit, save, metadata, recovery, removal, cleanup, universal architecture, and performance outcomes.
- `manual`: Dialog, drag and drop, Save As, print, keyboard, focus, text scale, increased contrast, reduced motion, VoiceOver, Markdown WKWebView, and Mermaid WKWebView outcomes.
- `content_free`: Must be true.
- `completed_utc`: Fresh completion timestamp.

Candidate receipts permit `not_run_candidate` for manual fields. Official receipts require every field to equal `pass` and must remain within the contract freshness window.

Receipt, host, authority, automated, manual, and performance objects are closed schemas. Any undeclared field is rejected so a `content_free` assertion cannot conceal filenames, paths, account names, or document content.
