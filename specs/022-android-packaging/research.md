# Research: Ship Android Packages

## Decision 1: Build one universal pair and one ABI-specific APK

**Decision**: Run the pinned Tauri Android build once for a universal APK and AAB containing `aarch64` and `x86_64`, then run the split-per-ABI APK path for `aarch64` only. Normalize the resulting bytes into the three canonical release names after signing.

**Rationale**: Tauri's Android build command produces universal APK/AAB outputs by default for the selected targets and produces per-ABI outputs with `--split-per-abi`. Google Play expects an AAB, while direct installation benefits from both a broadly usable universal APK and the smaller ARM64 APK required by issue #65.

**Alternatives considered**: Build all four Tauri Android targets, rejected because v0.1.0 requires ARM64 and x86_64 only; configure a second Gradle application flavor, rejected because Tauri already exposes the required universal and split modes; derive the direct-install APK from the AAB, rejected because the required downloadable ARM64 APK should remain a first-class signed build output.

**Primary sources**: [Tauri Google Play distribution](https://v2.tauri.app/distribute/google-play/), [Android ABI split guidance](https://developer.android.com/build/configure-apk-splits).

## Decision 2: Keep signing material outside the repository

**Decision**: Teach the Android application Gradle build to load the ignored `gen/android/keystore.properties` file documented by Tauri. Pull-request builds create a disposable keystore under runner temporary storage and label it candidate-only. Official tag builds must receive the repository's persistent Android signing material through secrets and fail closed when any input is missing.

**Rationale**: APKs and AABs must be signed for distribution, but committing a private key or credentials would permanently compromise update identity. Using the platform build's signing configuration ensures signatures cover the final package bytes.

**Alternatives considered**: Commit an encrypted keystore, rejected because repository access and encryption-key handling would broaden the secret surface; sign after evidence generation, rejected because checksums and inventories must describe final bytes; treat a disposable key as official, rejected because it cannot provide stable update identity.

**Primary source**: [Tauri Android code signing](https://v2.tauri.app/distribute/sign/android/).

## Decision 3: Inspect final APK and AAB bytes with Android-native tooling

**Decision**: Use pinned Android Build Tools 36.0.0 for APK metadata and signature inspection, `jarsigner` for AAB signature verification, and pinned bundletool 1.18.3 for AAB structure and manifest inspection. Also inspect ZIP inventories directly to enforce native ABI contents and prohibited bundled files.

**Rationale**: Build configuration is an input, not proof of the emitted artifact. Android-native tools understand binary manifests and signing blocks, while direct ZIP inventory makes ABI and accidental-bundling checks deterministic.

**Alternatives considered**: Trust Gradle task names, rejected because output contents can drift; parse binary Android manifests in project code, rejected as unnecessary protocol duplication; use `apksigner` for both formats, rejected because Android documents that `apksigner` does not sign or verify app bundles.

**Primary sources**: [Android bundletool](https://developer.android.com/tools/bundletool), [Android app-bundle base module](https://developer.android.com/guide/app-bundle/configure-base).

## Decision 4: Extend the existing locked-input SBOM model with Android dependencies

**Decision**: Reuse the deterministic Cargo and production JavaScript component collector and add parsed Maven coordinates from the universal release runtime dependency report. The Android SBOM identifies Glitchpad for Android and includes all three artifact hashes as external evidence properties.

**Rationale**: Android packages include Rust, web, Kotlin/Java, and AndroidX material. Omitting the Gradle runtime graph would understate bundled dependencies and conflict with the repository's license policy.

**Alternatives considered**: Reuse the desktop SBOM unchanged, rejected because it omits Android runtime dependencies; introduce a new third-party SBOM plugin, rejected because it adds dependency and network surface for a small deterministic transformation; scan only ZIP filenames, rejected because Maven identity and license provenance are not reliably encoded there.

## Decision 5: Build the local Android package environment once and reuse it

**Decision**: Add an `android-package` target to `scripts/docker/validation.Dockerfile` with Java 17, Android command-line tools 15859902, Platform 36, Build Tools 36.0.0, NDK 28.2.13676358, Rust Android targets, and bundletool 1.18.3. Pin direct downloads by SHA-256 and reuse a named local image for all S022 builds and checks.

**Rationale**: The project prohibits direct Windows build tooling and repeated disposable toolchain installation. A named image supplies the same non-interactive Linux boundary used by CI and keeps visible desktop consoles out of the workflow.

**Alternatives considered**: Use the host Android SDK through WSL or Windows, rejected by project execution policy; install packages on every container run, rejected as slow and wasteful; defer all Android compilation to CI, rejected because packaging should be exercised before pull-request publication.

**Primary source**: [Android command-line tools downloads](https://developer.android.com/studio).

## Decision 6: Defer manual and physical-device validation without weakening artifact checks

**Decision**: S022 requires automated build, package structure, intent surface, signing-path, size, metadata, checksum, SBOM, provenance, repository, and encoding checks. Physical devices, TalkBack, touch, rotation, background/restore, low-memory, clean-install, and provider interoperability remain explicitly post-release and do not block issue #65 or v0.1.0 publication.

**Rationale**: The product owner changed the v0.1 tracking policy to release first and collect real-world defects afterward. Artifact assembly checks are still required because a missing, corrupt, unsigned-official, or mislabeled file is not a releasable artifact.

**Alternatives considered**: Preserve the previous pre-release manual matrix, rejected by the current issue authority; remove all automated package checks, rejected because that would permit absent or malformed deliverables and violate the repository constitution's verification-before-claims rule.
