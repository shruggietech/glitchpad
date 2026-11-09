# Android packaging

S022 produces a universal APK, an ARM64 APK, and an Android App Bundle for the v0.3.0 candidate. The universal and Play artifacts contain ARM64 and x86_64 application libraries; the smaller direct-install APK contains ARM64 only. All three share application identifier `com.shruggietech.glitchpad`, version `0.3.0`/code `1006`, minimum API 24, and target API 36.

The merged package manifest advertises only stable Markdown, Mermaid, plain-text, and approved source-document MIME types. External viewing uses content-provider URIs, single-item sharing is supported, and broad storage permissions, wildcard MIME types, file-scheme delivery, multi-item sharing, and planned document families are prohibited.

Release signing reads ignored `crates/glitchpad-host/gen/android/keystore.properties` generated in temporary storage. Pull-request builds create disposable candidate authority and remain `blocked_candidate`. Official signing material comes from the free stable project-owned key through repository secrets during the authorized `v0.3.0` tag workflow; partial or missing official authority fails closed. Keystores, passwords, aliases, and private paths must never enter artifacts or logs.

Final-byte evidence under ignored `artifacts/android/` includes canonical artifacts, SHA-256 checksums, normalized inventories, `android-package-manifest.json`, `glitchpad-android.cdx.json`, `provenance.json`, and license notices. Evidence is generated after signing and binds the exact source commit.

Local Windows execution must use `scripts/invoke-docker-hidden.ps1` with the reusable `glitchpad-android-package:local` image. The image is built from the `android-package` target in `scripts/docker/validation.Dockerfile`; do not run Java, Gradle, Android, Node.js, Rust, or package tools directly on the Windows desktop.

Physical-device installation and manual TalkBack checks are unavailable and are not required under the 2026-11-02 owner decision. Hosted API 24/36 instrumentation covers touch, rotation, background/restore, low-memory and provider interoperability; no physical-device or manual screen-reader validation is claimed.

## Release instrumentation evidence

The test APK retains five reviewed notice assets from release-test-notices/. The package job and later accepted-input consumer compare those assets with the signed APK byte for byte. Separate test compile/runtime dependency reports record resolved module identities; the product SBOM remains the product runtime graph. JUnit and Hamcrest source/license provenance and the test-only Kotlin/tracing namespace transformation are recorded in the test notices.
