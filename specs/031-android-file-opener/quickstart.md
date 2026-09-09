# Quickstart: Android File Opener Correction

## Prerequisites

- Run from the repository root on branch `codex/031-android-file-opener`.
- Build the validation image from `scripts/docker/validation.Dockerfile` when it is not already available.
- Invoke all local non-Git commands through `scripts/invoke-docker-hidden.ps1`.
- Android emulator evidence is executed by the governed CI jobs on API 24 and API 36.

## Focused local validation

Run Android package policy and parser tests inside the validation container:

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '-v', 'A:/Code/glitchpad:/workspace', '-w', '/workspace', 'glitchpad-validation', 'pnpm', 'check:android-package')
```

Run Android bridge unit tests and Kotlin compilation through the validation image's governed Android toolchain when available. Do not substitute Windows-host Gradle, Java, Node.js, or Rust tooling.

## CI instrumentation expectations

1. Install the built universal APK and test APK on API 24 and API 36.
2. Query opaque `content://` resolver cases for every governed exact media type and confirm Glitchpad eligibility.
3. Query forbidden scheme, unsupported format, broad type, directory, and multiple-document cases and confirm rejection.
4. Deliver a controlled exact-type document from a stopped state and confirm its synthetic filename and marker are visible.
5. Deliver a second controlled document to the running single task and confirm the active filename and marker change together.
6. Inspect universal and ARM64 final manifests and require equivalent normalized resolver filter groups.
7. Record only redacted synthetic case identifiers and bounded outcomes.

## Complete gate

Run the complete repository validation in the hidden validation image and record its real exit status in `verification.md` before publishing the pull request. The pull request may be published only after every locally available check passes; hosted API-level and final-package jobs then confirm platform evidence.
