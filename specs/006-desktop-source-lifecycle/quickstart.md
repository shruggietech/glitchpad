# Quickstart: Verify S006

## Prerequisites

Use the versions pinned by `rust-toolchain.toml`, `.node-version`, `Cargo.lock`, and `pnpm-lock.yaml`. The repository task runner guarantees hidden Windows child processes and is the only approved aggregate command path for non-Git tools in this desktop environment.

## Automated verification

From the repository root, run the aggregate gate:

```powershell
cargo xtask check
```

For focused native development, run:

```powershell
cargo test -p glitchpad-core source
cargo test -p glitchpad-host --test desktop_source_conformance
cargo test -p glitchpad-host source
```

## Platform conformance

The shared `desktop_source_conformance` suite must run on Windows, macOS, and Linux. It creates only temporary regular files and covers trusted acquisition kinds, strong or explicitly weak identity, bounded reads, safe metadata, watcher invalidation, authoritative revalidation, stale-save conflict, durable save receipts, close invalidation, and external-link policy.

## Manual desktop checks

1. Select a regular file through the native dialog integration and confirm the interface receives a display name and opaque source ID but no full path.
2. Drop the same file and deliver it through a command-line or association launch, then confirm strong identity focuses the existing session when the platform provides it.
3. Modify, rename, and delete a watched file externally and confirm each condition becomes a stable visible source state without discarding local dirty content.
4. Edit a source externally after Glitchpad records its revision, attempt save, and confirm the operation reports conflict without replacing either revision.
5. On a filesystem fixture with a weaker durability guarantee, confirm the guarantee is disclosed and no write begins before explicit acknowledgement.
6. Select allowed and rejected external links and confirm only explicit user actions can produce one-use authorizations.

## Evidence expectations

Record platform, filesystem, identity strength, watcher backend, durability guarantee, and any environment-limited manual step in `verification.md`. Do not describe a platform as conformant from compilation alone.
