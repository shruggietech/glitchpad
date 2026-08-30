# Quickstart Validation: Repository Foundation

**Date**: 2026-08-30

## Bootstrap

```powershell
corepack prepare pnpm@10.28.2 --activate
pnpm install --frozen-lockfile
cargo xtask doctor
```

Expected result: dependencies match committed locks and doctor distinguishes satisfied shared tools from missing optional platform/release prerequisites.

## Verify

```powershell
cargo xtask check
```

Expected result: formatting, linting, type checking, unit tests, production builds, documentation, encoding, Mermaid, links, and version consistency finish in the foreground with exit code 0.

## Run the foundation shell

```powershell
pnpm tauri dev
```

Expected result: a native Glitchpad window displays the neutral v0.0.0 foundation status without claiming renderer support.

## Android scaffold

```powershell
pnpm tauri android build --debug --apk --target aarch64 --ci --config '{"version":"0.0.1"}'
```

Expected result: the generated Android project builds a non-release debug APK when the pinned SDK/JDK/NDK prerequisites are installed. Tauri rejects Android package version 0.0.0, so this validation-only override proves the package path without changing the v0.0.0 product or specification authorities; the first official binary release is v0.1.0.

## Git receipt

```powershell
git branch --show-current
git status --short
git remote
git log -1 --oneline
```

Expected result: branch `main`, empty status, no remote output, and one initial foundation commit.
