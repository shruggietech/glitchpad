# Android Package Evidence Contract

## Required artifact set

| Role | Canonical filename | Format | Required native ABIs |
| --- | --- | --- | --- |
| Universal direct install | `glitchpad-0.1.0-android-universal.apk` | APK | `arm64-v8a`, `x86_64` |
| ARM64 direct install | `glitchpad-0.1.0-android-arm64.apk` | APK | `arm64-v8a` only |
| Google Play upload | `glitchpad-0.1.0-android-universal.aab` | AAB | `arm64-v8a`, `x86_64` |

No additional architecture is part of the v0.1.0 Android delivery contract.

## Required final-byte evidence

- `SHA256SUMS` with exactly one entry for each canonical artifact.
- `android-package-manifest.json` binding roles, filenames, byte lengths, SHA-256 digests, inventories, source revision, version, and authority.
- One normalized inventory per artifact.
- `glitchpad-android.cdx.json` using CycloneDX 1.6 and covering locked Cargo, production JavaScript, and Android runtime dependencies.
- `provenance.json` binding the source revision, workflow context, pinned toolchain, build mode, and final artifacts.
- `LICENSE`, `NOTICE`, and `THIRD_PARTY_NOTICES.txt` beside the downloadable artifacts.

## Candidate authority

Pull-request and branch package sets use disposable signing material generated in temporary runner storage. All three signatures must verify, use the same candidate certificate, and be recorded as `candidate_valid`. Candidate provenance must state `publication_status: blocked_candidate` and may never be interpreted as official authority.

## Official authority

Official eligibility requires repository `shruggietech/glitchpad`, tag `v0.1.0`, a complete repository-provisioned signing secret set, successful APK and AAB signature verification, one stable certificate SHA-256 digest across all deliverables, and final evidence generated after signing. Missing or partial authority fails closed.

The signing key, encoded keystore, passwords, aliases, temporary properties, and private paths are prohibited from artifacts, logs, inventories, software bills of materials, and provenance.

## Package facts

Every inventory must report:

- Application identifier `com.shruggietech.glitchpad`.
- Version name `0.1.0` and one positive, consistent version code.
- Minimum API 24 and target API 36.
- Release mode with debugging and cleartext traffic disabled.
- Exact role-specific ABI inventory.
- Exact allowed intent surface and absence of forbidden permissions or components.
- Final size and universal-APK budget classification.
- Public signing certificate SHA-256 digest and signature verification result.

## Rejection rules

The package set is rejected when an artifact or evidence file is missing, duplicated, stale, modified, internally inconsistent, incorrectly named, over the hard size limit, built for a wrong ABI, broadens the intent surface, contains forbidden permissions, lacks required notices, leaks sensitive data, or claims authority it does not possess.

Manual installation, device behavior, accessibility, lifecycle, and provider interoperability are post-release activities and are not required evidence for S022.
