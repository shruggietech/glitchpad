# Data Model: Ship Windows Packages

## Capability Family

Represents one stable v0.1.0 text family eligible for Windows claims.

- `id`: Stable family identifier.
- `description`: User-facing association description.
- `extensions`: Unique lowercase extensions without leading dots.
- `media_types`: Declared text media types where applicable.
- `association`: Whether Windows installation may register the family.
- `dialog`: Whether native open dialogs may offer the family.
- `renderer`: Stable renderer identifier.

Validation requires globally unique extensions, at least one renderer, and exact exclusion of every forbidden planned or unsupported extension.

## Desktop Delivery

Represents one trusted native request to acquire a desktop file.

- `kind`: `dialog`, `drop`, `command_line`, or `association`.
- `native_path`: Host-private path that is never serialized.
- `working_directory`: Host-private base used only to resolve a relative command-line input.
- `sequence`: Monotonic queue order.

The delivery transitions from `received` to `normalized`, then `acquired` or `rejected`. Only acquired summaries or path-free rejections enter the interface queue.

## Desktop Delivery Result

Represents the safe item drained by interface code.

- `sequence`: Monotonic delivery order.
- `kind`: Trusted channel classification.
- `status`: `opened`, `duplicate`, or `rejected`.
- `source`: Safe desktop source summary for opened or duplicate results.
- `error`: Stable content-free error for rejected results.

The result never contains a native path, working directory, command line, environment value, or document content.

## Windows Package Candidate

Represents one built artifact before official authorization.

- `schema_version`: Evidence schema version.
- `version`: Explicit nonzero candidate version.
- `platform`: `windows`.
- `architecture`: `x86_64`.
- `kind`: `nsis` or `portable_zip`.
- `file_name`: Canonical artifact name.
- `sha256`: Digest of final bytes.
- `bytes`: Compressed size.
- `classification`: `pass`, `warning`, or `failure` under S018 policy.
- `source_commit`: Exact source revision.
- `official`: Always `false` for pull-request or branch candidates.

## Package Inventory Entry

Represents one governed file in the portable archive or installed application.

- `relative_path`: Portable, traversal-free path.
- `role`: Executable, runtime, license, project notice, or third-party notice.
- `sha256`: Digest of the staged file.
- `bytes`: File size.
- `required`: Whether absence fails validation.

Paths must be relative, unique, separator-normalized, and free of `..`, drive, device, or absolute prefixes.

## Signature Evidence

Represents Authenticode verification for an official artifact.

- `artifact_sha256`: Digest of the exact signed bytes.
- `signature_status`: Verified trust outcome.
- `subject`: Expected publisher identity.
- `issuer`: Certificate issuer identity.
- `timestamp_status`: Verified timestamp outcome.
- `verification_time`: UTC verification time.
- `authorized_context`: Release environment and triggering ref.

Only a trusted signature and timestamp bound to matching final bytes can transition a candidate from `unsigned_candidate` to `signed_candidate`; official status additionally requires the complete release gate.

## Windows Evidence Set

Aggregates candidate metadata, inventory, checksums, CycloneDX SBOM, provenance, signature evidence when required, and clean-machine receipt.

- `candidate_manifest`: Both candidate records.
- `checksums`: Exact final artifact digest map.
- `sbom`: CycloneDX document and digest.
- `provenance`: Source/workflow identity bound to artifact digests.
- `signature_evidence`: Required only for authorized official evaluation.
- `clean_machine_receipt`: Lifecycle, entry, accessibility, and performance outcomes.
- `gate_status`: `candidate_valid`, `official_valid`, or `failed`.

`official_valid` is unreachable when any required field is absent, mismatched, unsigned, unauthorized, or failed.
