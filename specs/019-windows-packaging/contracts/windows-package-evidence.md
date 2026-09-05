# Contract: Windows Package Evidence

**Contract version**: 1

## Candidate names

- NSIS: `glitchpad-{version}-windows-x86_64-setup.exe`
- Portable: `glitchpad-{version}-windows-x86_64.zip`

The version is an explicit semantic version, platform is exactly `windows`, and architecture is exactly `x86_64`.

## Candidate manifest

Each artifact entry contains schema version, kind, canonical name, byte length, lowercase SHA-256 digest, S018 size classification, source commit, workflow identity, and `official: false` unless the authorized official gate has completed.

## Portable inventory

The archive root contains the application executable, required runtime files, `LICENSE`, `NOTICE`, and `THIRD_PARTY_NOTICES.txt`. The inventory lists every file using a normalized relative path, role, byte length, and SHA-256 digest. Missing required files, extra executable content, duplicate paths, traversal, absolute paths, alternate data stream syntax, or case-colliding paths fail validation.

## Association inventory

The package declares only extensions in `packaging/windows/capabilities.json`. Every configured extension appears once, lowercased and without a leading dot in source configuration. The gate rejects all planned image, icon, vector, PDF, office, executable, and archive extensions even if another consumer adds them accidentally.

## Supply-chain evidence

- `SHA256SUMS` covers the final NSIS and ZIP bytes and no intermediate file.
- The CycloneDX SBOM identifies the Glitchpad application plus locked Rust, JavaScript, and bundled runtime components and binds to the source commit and candidate version.
- Candidate provenance records repository, commit, workflow, runner image, locked tool versions, and artifact digests without asserting a cryptographic publisher identity.
- Official provenance is a GitHub artifact attestation generated only in an authorized release context and verified against `shruggietech/glitchpad`.
- `LICENSE`, `NOTICE`, and third-party notices are present both in installed/portable inventory as applicable and beside release artifacts.

## Signature gate

Candidate validation requires signature status to be explicitly `not_applicable_unsigned_candidate`. Official validation requires trusted Authenticode on the application executable and NSIS installer, a valid timestamp, the expected publisher subject, matching final digests, and an authorized release environment. Unknown, absent, invalid, expired, untrusted, mismatched, or stale evidence fails closed.

## Clean-machine receipt

The receipt identifies candidate digests, Windows edition/build, x86_64 architecture, WebView2 version, test time, and outcomes for install, launch, dialog, drop, command line, association, read, edit, save, Save As, metadata, recovery, print, upgrade or repair, uninstall, portable execution, cleanup, keyboard, focus, text scale, forced colors, screen-reader naming, and S018 performance. It stores no document contents, filenames, paths, account names, environment values, or secrets.
