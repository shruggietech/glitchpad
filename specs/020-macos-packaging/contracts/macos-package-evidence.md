# Contract: macOS Package Evidence

**Contract version**: 1

## Candidate identity

The candidate is `glitchpad-{version}-macos-universal.dmg`. Platform is exactly `macos`, architecture is exactly `universal`, and version is an explicit nonzero semantic version. The application is `Glitchpad.app`, uses bundle identifier `com.shruggietech.glitchpad`, declares macOS 13 as its minimum, and contains one main executable with exactly arm64 and x86_64 slices.

## Candidate trust state

Branch and pull-request builds use an ad-hoc application signature, are not notarized, and have no stapled ticket. Their manifest state is `candidate_valid` with `official: false`. Candidate validation fails if these limitations are omitted or if any field implies Apple-verified distribution.

## Application and DMG inventory

The application contains the approved ICNS icon plus exact copies of `LICENSE`, `NOTICE`, and `THIRD_PARTY_NOTICES.txt`. Its normalized inventory lists every regular file and symlink by relative path, semantic role, byte length, and SHA-256 digest where applicable. A deterministic inventory digest binds the whole application bundle. Traversal, absolute paths, duplicate paths, case-folding collisions, missing required files, unexpected executable content, symlinks escaping the bundle, or inconsistent digests fail validation.

The mounted DMG contains `Glitchpad.app` and an Applications destination link. The final canonical DMG digest and byte length are recorded after no further mutation is possible.

## Document declarations

Application metadata declares only extensions in `packaging/desktop/capabilities.json`. Every extension appears once, lowercased, and mapped to an appropriate editor/viewer role. The gate rejects every planned image, icon, vector, PDF, office, executable, and archive extension, even if another configuration adds it accidentally.

## Supply-chain evidence

- `SHA256SUMS` binds the final DMG bytes.
- The CycloneDX SBOM identifies Glitchpad for macOS plus locked Rust, JavaScript, and bundled runtime components and binds to the source commit and candidate version.
- Candidate provenance records repository, commit, workflow, runner image, locked tool versions, final DMG digest, and deterministic application-bundle digest without asserting a cryptographic publisher identity.
- Official provenance is a GitHub artifact attestation generated only in an authorized release context and verified against `shruggietech/glitchpad`.
- `LICENSE`, `NOTICE`, and third-party notices appear inside the application and beside release evidence.

## Official Apple trust gate

Official validation performs live checks against final bytes. It requires the exact runtime-authorized Developer ID Application identity, a valid nested application signature, hardened runtime, secure timestamp, a signed DMG, an accepted notarization submission and retained log both bound to the DMG digest, a valid stapled ticket, and an accepted Gatekeeper assessment. Missing credentials, ad-hoc signing, untrusted or expired identity, modified bytes, missing runtime or timestamp flags, rejected or stale notarization, warnings that violate policy, an unstapled ticket, or Gatekeeper rejection fails closed.

## Native clean-host receipt

The same DMG is mounted, copied, launched, and removed on native arm64 and Intel macOS hosts. The mounted application inventory must match the manifest before launch. The closed-schema receipt binds the manifest digest, GitHub workflow and source authority, governed native test suites, host architecture, macOS version, WKWebView version, automated lifecycle results, manual renderer/accessibility results, and S018 size/startup evidence. It stores no document contents, filenames, paths, account names, tool environment values, or secrets.
