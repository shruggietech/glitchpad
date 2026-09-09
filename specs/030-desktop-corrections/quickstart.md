# Quickstart: Desktop Rendering and Shell Corrections

## Prerequisites

- Run from the repository root on branch `codex/030-desktop-corrections`.
- Build the validation image from `scripts/docker/validation.Dockerfile` when it is not already available.
- Invoke all local non-Git commands through `scripts/invoke-docker-hidden.ps1`.

## Focused validation

Run the frontend checks and tests inside the validation container:

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '-v', 'A:/Code/glitchpad:/workspace', '-w', '/workspace', 'glitchpad-validation', 'pnpm', '--filter', '@shruggietech/glitchpad', 'check')
```

Run the Windows package policy tests inside the same image:

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '-v', 'A:/Code/glitchpad:/workspace', '-w', '/workspace', 'glitchpad-validation', 'pnpm', 'check:windows-package')
```

Run documentation and public-surface checks:

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '-v', 'A:/Code/glitchpad:/workspace', '-w', '/workspace', 'glitchpad-validation', 'pnpm', 'docs')
```

## End-to-end expectations

1. Delayed Markdown rendering shows only `Rendering preview`; a raw-only sentinel is absent from both the visual and accessibility trees.
2. The corpus opens A-to-B and B-to-A with matching active filename and content.
3. Injected renderer and projection failures stay inside the document and preserve View source, Close, and menu access.
4. The menu trigger remains stationary and left-anchored while its popup opens below it without touching document scrollbars.
5. Windows package policy requires both Markdown orders, blank/source-flash detection, identity checks, and menu geometry evidence.
6. The README no longer includes the Platforms badge and retains its supported-platform section.

## Complete gate

Run the repository aggregate validation in the hidden validation image and record its real exit status in `verification.md` before publishing the pull request.
