# Quickstart: Verify S012

## Prerequisites

- Use the pinned Rust, Node.js, pnpm, Java, Android SDK, and NDK authorities documented by the repository.
- Run Android instrumentation through a verified headless emulator on API 24 and API 36 before publication.

## Focused contract checks

```powershell
cargo test -p glitchpad-core recovery
cargo test -p glitchpad-core session
cargo test -p glitchpad-host --test recovery_conformance
pnpm --dir apps/glitchpad test -- --run
```

Expected result: dirty close is guarded, source conflicts preserve edits, only bound receipts clear dirty state, valid recovery round-trips exactly, and corruption/quota/expiry failures remain isolated and redacted.

## Android evidence

Run the repository Android instrumentation suite on API 24 and API 36. The suite must prove application-local recovery survives process termination, backup rules exclude recovery, temporary or revoked source authority restores only as conflicted recovery, and cleanup removes exactly the resolved record.

## Full local gate

```powershell
pnpm check
```

Expected result: formatting, Rust lint and tests, frontend lint/type/test/build, documentation, dependency/license, secret, UTF-8/mojibake, Android compilation, and all configured repository checks complete successfully before the branch is pushed.

## Manual interaction check

At 200 percent zoom and with keyboard-only interaction, request close on a dirty active tab and on a dirty overflow tab. Verify that Save/Save As, Discard, and Cancel remain reachable, focus enters and returns from the resolution dialog, cancellation preserves exact content, and no permanent surface reduces the document below the existing viewport contract.
