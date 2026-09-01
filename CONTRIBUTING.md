# Contributing to Glitchpad

Thank you for helping build Glitchpad. The project values focused changes, explicit architecture, reproducible verification, and documentation that states exactly what the software does.

## Development model

Glitchpad uses specification-driven development. Every product capability begins in Spec Kit, proceeds through clarification, planning, tasks, implementation, analysis, and convergence, and updates the normative technical specification when it changes behavior, architecture, security, platform support, or release obligations.

Do not add product features directly to the foundation shell without an approved feature specification. Keep platform code at the host boundary and keep reusable file-processing behavior in `glitchpad-core` or a dedicated core crate.

## Required shared environment

| Tool | Required version or line | Purpose |
| --- | --- | --- |
| Git | 2.45 or newer | Source control and repository checks |
| Rust | 1.96.0 with Cargo, rustfmt, and Clippy | Native workspace |
| Node.js | 24.11.0 | Frontend and documentation tooling |
| pnpm | 10.28.2 through Corepack | Reproducible JavaScript installs |
| PowerShell | 7.x | Cross-platform repository validation |
| Spec Kit | Committed `.specify` environment | Specification workflow |
| cargo-deny | 0.20.2 | Rust advisory, license, source, and dependency policy |

Use a UTF-8 capable editor that honors `.editorconfig`. Markdown prose must remain one physical line per paragraph; do not configure an automatic prose wrapper. Project-authored Mermaid flowcharts must use top-to-bottom direction with `flowchart TB` or `flowchart TD`.

The approved brand canon lives under `brand/`; read `brand/INTEGRATION.md` before consuming or replacing governed assets. Run `pnpm check:brand` for focused canon and integration validation. The Next.js and Fumadocs public site lives under `site/`, derives its technical documentation from the authoritative `docs/` tree, and is validated with `pnpm check:site`.

## Platform environments

### Windows

Install the current Visual Studio Build Tools with the Desktop development with C++ workload and a Windows 10 or 11 SDK. WebView2 is supplied by supported Windows installations but must remain available for development and smoke testing.

Repository commands on Windows must remain headless: no project-owned console child may become visible, flash, or steal desktop focus. This requirement does not prohibit the command runner, direct `git` or `gh`, builds, tests, or other commands that execute without a foreground window. If a specific launch path opens a visible console, stop that launcher, record the executable and parent command, and continue unrelated work through direct Git or another verified headless path rather than disabling terminal access.

Documentation link and Mermaid validation run as direct Node.js processes. Link checks stay inside one validator process for the complete Markdown set, while Mermaid checks reuse one Puppeteer browser for every diagram. Do not add per-file or per-diagram `pnpm`, PowerShell, command-shell, or browser launches. `pnpm check:validation` enforces this topology before the aggregate gate reaches the real validators.

### macOS

Install the current stable Xcode and command-line tools accepted by the selected Tauri release. Test on both Apple silicon and Intel runners when a release claims both architectures.

### Linux

Install the compiler, pkg-config, WebKitGTK, SSL, AppIndicator, and SVG development packages required by Tauri for the target distribution. Package names differ by distribution; use the current Tauri Linux prerequisites as the authority and record the exact CI image packages when Linux packaging is enabled.

### Android

Install Android Studio Quail 3 (2026.1.3) or a compatible newer stable release, Android SDK Platform 36, Build Tools 36.0.0, current platform and command-line tools, API 24 and API 36 handset images, and NDK 28.2.13676358. Use a supported JDK from 17 through 21; CI pins Temurin 17, while a compatible Android Studio bundled JBR 21 is valid for local work. Set `JAVA_HOME`, `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and `NDK_HOME`, then add the four Rust Android targets requested by the Tauri initializer. Release keystores and signing properties never belong in the repository.

The explicitly selected Android JDK is authoritative for Android work even when another Java version is installed globally. `cargo xtask doctor` reports the active paths so version and path mistakes are visible before a Gradle build.

Android provider lifecycle work requires headless x86_64 API 24 and API 36 emulators. From `crates/glitchpad-host/gen/android`, run `gradlew :app:testDebugUnitTest` for Kotlin policy tests and `gradlew :app:connectedDebugAndroidTest` for the controlled DocumentsProvider suite. CI additionally runs restoration seed and verify phases around `adb shell am force-stop com.shruggietech.glitchpad`; local evidence is optional when a compatible headless emulator is unavailable, but both CI matrix entries remain required for merge.

## Bootstrap

```powershell
corepack prepare pnpm@10.28.2 --activate
pnpm install --frozen-lockfile
cargo xtask doctor
```

Generate or refresh platform code only with the documented Tauri command and review every generated path before committing it. Generated files must not contain local SDK paths, signing details, caches, or build output.

## Verification

Run the aggregate gate before opening a pull request:

```powershell
cargo xtask check
```

The aggregate gate runs Rust formatting, Clippy with warnings denied, native tests, ESLint, TypeScript, Vitest, the production frontend build, Markdown formatting and linting, link checks, version consistency, strict UTF-8 checks, Mermaid direction checks, and public-surface assertions.

To diagnose documentation validation independently, run `pnpm check:validation`, `pnpm docs:links`, and `pnpm docs:mermaid` from an existing integrated terminal. On Windows, observe the desktop while running `cargo xtask docs`; any native console flash is a failure even when the command exits successfully.

When platform behavior changes, also run the affected desktop or Android build and record the result in the pull request. A platform claim requires build, smoke-test, packaging, and documentation evidence.

## Pull requests

- Keep each pull request focused on one coherent change.
- Add or update the relevant Spec Kit artifacts before implementation.
- Add tests that fail without the change and pass with it.
- Add a `changelog.d` fragment for observable changes or explain why none is needed.
- Update public and normative documentation in the same pull request.
- Complete the pull request checklist and wait for `ci-ok` and CodeQL.
- Do not commit secrets, personal paths, generated build output, signing material, or unsupported release artifacts.

## Commit style

Use concise imperative subjects. Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, `test:`, and `chore:` are preferred because they make project history easier to scan.

## Licensing

By contributing, you agree that your contribution is licensed under the Apache License, Version 2.0, and that you have the right to submit it under those terms.
