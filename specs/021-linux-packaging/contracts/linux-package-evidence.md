# Contract: Linux Package Evidence

**Contract version**: 1

## Candidate identity

The candidate pair is `glitchpad-{version}-linux-x86_64.AppImage` and `glitchpad-{version}-linux-x86_64.deb`. Platform is exactly `linux`, architecture is exactly `x86_64`, and version is an explicit nonzero semantic version. Both artifacts originate from the same source commit, workflow identity, build baseline, executable, stable capability inventory, and notice set.

## Candidate trust state

Branch and pull-request builds are non-official review candidates. Their manifest state is `candidate_valid` with `official: false` and repository attestation status `not_generated_candidate`. Candidate validation fails if these limitations are omitted or if any field implies verified publication authority.

## Build baseline and dependency boundary

The build-baseline receipt identifies the named Ubuntu 22.04 x86_64 build target, pinned language toolchain, observed compiler/linker/glibc/WebKitGTK versions, and imported GLIBC symbol set. The validator rejects a newer distribution baseline, wrong architecture, missing WebKitGTK 4.1 build/runtime family, imported symbol newer than the governed ceiling, or a bundled browser/WebKit substitute.

The Debian control metadata contains only reviewed runtime dependencies and accurately declares its architecture and version. The AppImage inventory is inspected for unexpected executables and disallowed bundled components.

## Package inventories and integration

Normalized inventories list each regular file and link by package-relative path, semantic role, byte length, and SHA-256 digest where applicable. Traversal, absolute archive paths, duplicates, unsafe links, missing required files, unexpected executable content, version drift, and digest inconsistency fail validation.

The actual desktop entries and MIME declarations must satisfy [linux-desktop-integration.md](linux-desktop-integration.md) and match each other across both package forms.

## Supply-chain evidence

- `SHA256SUMS` binds both final artifacts.
- The CycloneDX SBOM identifies Glitchpad for Linux plus locked Rust, JavaScript, native runtime, and bundled components and binds to source commit and candidate version.
- Candidate provenance records repository, commit, workflow, baseline identity, locked tool versions, and both final artifact digests without asserting cryptographic publisher identity.
- Official repository attestation is generated only in an authorized release context and verified against `shruggietech/glitchpad`, the source commit, workflow identity, release version, and both final subjects.
- `LICENSE`, `NOTICE`, and third-party notices appear inside each package and beside release evidence.

## Clean-environment receipts

The exact pair is exercised on clean Ubuntu 22.04 and Ubuntu 24.04 environments. Closed-schema receipts bind the manifest digest, workflow/source authority, package form, distribution, architecture, WebKitGTK version, governed native test suites, automated lifecycle results, manual accessibility/rendering results, and S018 size/startup evidence. A candidate receipt reports `not_run_candidate` for read, edit, save, metadata, recovery, and manual interface scenarios that the clean package harness does not exercise; separately executed conformance suites cannot turn those clean-environment results into passes. Candidate startup measurements identify themselves as `hosted_smoke`, retain truthful reference-budget classification, and fail above 10 seconds. Official receipts identify `reference` startup evidence, require every governed result to pass, and fail above the S018 desktop hard limit.

Receipts store no document contents, filenames, paths, account names, environment values, or secrets. Official validation requires fresh passing receipts for both package forms on both environments. One missing or failed receipt blocks the pair.

## Official repository authority gate

Official validation performs live verification against unchanged final bytes. It requires authorized tag context, the expected repository and workflow identity, verified artifact subjects for both digests, matching source commit and release version, complete checksums/SBOM/provenance/baseline evidence, and four clean-environment receipts. Missing, stale, mismatched, modified, unauthorized, incomplete, or unverifiable evidence fails closed. Publication remains separately authorized by issue #67.
