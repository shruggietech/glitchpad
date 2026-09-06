# Data Model: Ship Linux Packages

## Desktop capability inventory

- `schema_version`: Contract revision.
- `release`: Capability release target.
- `families[]`: Stable family identifier, description, extensions, media types, renderer, association eligibility, and dialog eligibility.
- `forbidden_extensions[]`: Planned or unsupported extensions prohibited from package claims.

Linux validation requires globally unique lowercase stable extensions and exact agreement with the Linux MIME map, Tauri association overlay, desktop entry, package integration, and dialog declarations.

## Linux MIME map

- `schema_version`: Mapping revision.
- `families[]`: Stable family identifier with one or more freedesktop media types and the exact stable extensions served by each type.
- `package_owned_types[]`: Media types whose glob definitions are installed by Glitchpad rather than inherited from the platform database.

Every family and extension must exist in the desktop capability inventory. Media types are unique, syntactically valid, and absent from the forbidden format catalog. Package-owned types must provide deterministic lowercase globs and must never delete or override unrelated platform definitions.

## Linux package contract

- `schema_version`: Contract revision.
- `platform`, `architecture`, `candidate_version`: Exact candidate identity.
- `build_baseline`: Required distribution, release, architecture, glibc ceiling, WebKitGTK family, and named container target.
- `artifacts[]`: Canonical AppImage and Debian kinds and names.
- `desktop_entry`: Installed identity, safe file field code, terminal state, categories, icon name, and exact MIME list.
- `required_files`: Per-package license, notice, executable, icon, desktop, and integration paths.
- `dependency_policy`: Required Debian dependency families and prohibited bundled runtime/browser components.
- `size_budget`, `performance`: S018 artifact and hosted-smoke limits.
- `candidate_trust`: Required non-official candidate state.
- `official`: Authorized event/tag and required repository-attestation facts and evidence files.

## Linux package manifest

- `schema_version`, `version`, `platform`, `architecture`: Candidate identity.
- `source_commit`, `workflow_identity`, `build_baseline`: Reproducibility authority.
- `official`, `gate_status`: Candidate or official state.
- `artifacts[]`: Kind, canonical name, byte length, SHA-256, size classification, normalized inventory digest, and package metadata.
- `desktop_entry`, `mime_map`, `dependencies`: Normalized integration claims.
- `evidence_files[]`: Exact evidence inventory required for the current trust state.

The manifest transitions from `candidate_valid` to `official_valid` only after live repository-attestation verification binds both unchanged final artifacts.

## Build-baseline evidence

- `schema_version`: Evidence contract revision.
- `container_target`, `base_image`: Governed build-environment identity.
- `distribution`, `release`, `architecture`: Normalized operating-system identity.
- `rust`, `node`, `pnpm`, `compiler`, `linker`, `glibc`, `webkitgtk`: Pinned or observed toolchain facts.
- `imported_glibc_versions[]`: Sorted GLIBC symbol versions imported by the final executable.
- `maximum_imported_glibc`: Highest imported symbol version, which must not exceed the contract ceiling.

The evidence contains no environment dump, host path, account name, token, or raw authorization response.

## Clean-environment receipt

- `schema_version`: Receipt revision.
- `candidate_manifest_sha256`: Binding to the exact manifest.
- `evidence_authority`: Workflow identity, source commit, and governed native test suites.
- `linux`: Distribution, release, architecture, package form, installed version, and WebKitGTK version.
- `automated`: Integrity, install/extract, registration, launch, delivery, read, edit, save, metadata, recovery, removal, cleanup, document preservation, and performance outcomes.
- `manual`: Dialog, drag and drop, Save As, print, keyboard, focus, text scale, contrast, reduced motion, assistive technology, Markdown, and Mermaid outcomes.
- `performance`: Startup evidence class, samples, percentile, classification, and artifact-size classification.
- `content_free`, `completed_utc`: Privacy assertion and freshness time.

Candidate receipts permit `not_run_candidate` only for explicitly manual fields. Official receipts require every governed result to pass and remain within the contract freshness window. All objects are closed schemas so undeclared content is rejected.

## Repository attestation evidence

- `schema_version`: Evidence revision.
- `repository`, `source_commit`, `workflow_identity`, `release_version`: Authorized subject identity.
- `artifacts[]`: Canonical artifact name, SHA-256, attestation subject digest, verification status, and verification time.
- `issuer`, `predicate_type`: Approved attestation authority and statement type.

Raw tokens, certificates, signatures, and tool output are excluded. The normalized result is valid only when both final artifact subjects verify.
