# Validation Guide: S046

Use the image built from scripts/docker/validation.Dockerfile through scripts/invoke-docker-hidden.ps1. Git/GitHub use scripts/invoke-vcs-hidden.ps1. Native UI checks run only on isolated hosted CI.

1. Run installed Spec-Kit prerequisite/setup scripts inside Linux with the S046 feature selector.
2. Run focused Vitest contracts/components and Rust destination/persistence/recovery suites, including negative provider identity/write and diagnostic redaction cases.
3. Run cargo xtask check through completion, including documentation/brand/encoding/security/package checks.
4. Build and retain the actual APK used by hosted API24/API36 provider/WebView journeys. Record SHA-256, source, package/version, Android/API/WebView and geometry/font scale. Independently read saved document/diagnostic bytes, exercise receiver-granted Share, cancellation/failure and process recreation. Extend Windows portable Markdown corpus regression.
5. Push/open official PR, inspect final branch-head and affected native/package checks, resolve every finding within at most two review rounds, and reconcile issue acceptance/evidence without closing broader aggregate/release issues.

Dedicated Tauri UI invocations use the journey driver or the scoped CI arguments, including waitForActivitiesToComplete=false. Their owned Activities stop at CREATED before the runner reports its result. Qualification requires the requested marker, positive JUnit completion, zero adb status and no explicit instrumentation failure; a marker emitted before process termination is diagnostic evidence only.

Missing original incident bytes and unperformed physical/manual checks remain explicit. A passing source test or callback does not establish native write or exact release-byte qualification.
