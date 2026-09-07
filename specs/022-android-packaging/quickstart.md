# Quickstart: Ship Android Packages

## Prerequisites

- Docker Desktop with Linux containers available.
- The repository dependencies already installed from `pnpm-lock.yaml`.
- All Windows-hosted commands invoked through `scripts/invoke-docker-hidden.ps1`.
- No official signing secrets are required for pull-request candidate validation.

## Build the reusable Android package image

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('build', '--target', 'android-package', '-t', 'glitchpad-android-package:local', '-f', 'scripts/docker/validation.Dockerfile', '.')
```

Expected result: the image contains the pinned Java, Android SDK/NDK, Rust Android targets, Node.js, pnpm, bundletool, and package inspection tools. Build it once and reuse it.

## Run focused package tests

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '-v', "${PWD}:/workspace", '-w', '/workspace', 'glitchpad-android-package:local', 'pnpm', 'run', 'check:android-package')
```

Expected result: contract, mutation, assembly, SBOM, manifest, ABI, size, signing-authority, and evidence tests pass without a device or emulator.

## Build candidate artifacts

Use the Android packaging workflow commands documented in `packaging/android/README.md` from the reusable image. Candidate mode generates a disposable keystore under container temporary storage, creates the universal APK/AAB and ARM64 APK, normalizes final names under `artifacts/android`, and generates evidence after signing.

Expected outputs:

- `artifacts/android/glitchpad-0.1.0-android-universal.apk`
- `artifacts/android/glitchpad-0.1.0-android-arm64.apk`
- `artifacts/android/glitchpad-0.1.0-android-universal.aab`
- `artifacts/android/SHA256SUMS`
- `artifacts/android/android-package-manifest.json`
- `artifacts/android/glitchpad-android.cdx.json`
- `artifacts/android/provenance.json`

## Run the aggregate repository gate

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '-v', "${PWD}:/workspace", '-w', '/workspace', 'glitchpad-validation:local', 'cargo', 'xtask', 'check')
```

Expected result: native, frontend, documentation, security, package, encoding, and Android static gates pass before push.

## Deferred validation

Physical-device installation, TalkBack, touch, rotation, background/restore, low-memory, and provider interoperability start after v0.1.0 is published. They do not block S022 completion or release publication.
