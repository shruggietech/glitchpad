# Quickstart: Validate Android Source Lifecycle

## Prerequisites

- Install the repository-pinned Rust, Node.js, pnpm, Java, Android SDK 36, Build Tools 36.0.0, NDK 28.2.13676358, and x86_64 API 24/API 36 emulator images described by the technical specification.
- Enable hardware virtualization and use a headless emulator launch. Do not use a launcher that opens or flashes a console window.

## Shared contract validation

```text
cargo test -p glitchpad-core --locked
cargo test -p glitchpad-host --test android_source_contract --locked
cargo clippy --workspace --all-targets --all-features -- -D warnings
```

Expected result: optional provider metadata, grant states, delivery policy, bounded requests, identity strength, revision comparison, restoration decisions, safe errors, and desktop compatibility all pass.

## Android JVM validation

From `crates/glitchpad-host/gen/android`, run the debug unit-test task with Java 17 and the configured Android SDK.

```text
gradlew :app:testDebugUnitTest
```

Expected result: intent normalization, duplicate share compatibility, unsupported-shape rejection, grant-mode intersection, capability mapping, restoration-record bounds, and stable error redaction pass without an emulator.

## Android instrumentation validation

Start one headless x86_64 emulator at API 24 or API 36, build the matching x86_64 Rust library and debug test APKs, then run:

```text
gradlew :app:connectedDebugAndroidTest
```

Run the restoration test twice with instrumentation argument `restorationPhase` set first to `seed` and then to `verify`, with `adb shell am force-stop com.shruggietech.glitchpad` between the runs. Expected result: controlled provider acquisition, reads, picker results, verified Save As, optional metadata, and restoration all pass. Repeat on both required API levels. The immutable CI job is the canonical command transcript.

## Aggregate validation

```text
pnpm check
```

Expected result: formatting, lint, Rust and frontend tests, documentation, dependency or license checks, encoding, public-surface validation, and Android configuration checks all pass. CI additionally proves API 24, API 36, and ARM64 packaging on the pushed pull-request head.
