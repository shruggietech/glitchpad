# Quickstart: Markdown Recovery and Reserved Shell Chrome

Run every local non-Git command through the hidden Linux validation launcher from the repository root.

## 1. Build the pinned validation image

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('build', '--tag', 'glitchpad-validation:local', '--file', 'scripts/docker/validation.Dockerfile', '.')
```

## 2. Install locked dependencies

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', 'A:/Code/glitchpad:/workspace', '--workdir', '/workspace', 'glitchpad-validation:local', 'pnpm', 'install', '--frozen-lockfile')
```

## 3. Run focused Markdown and shell tests

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', 'A:/Code/glitchpad:/workspace', '--workdir', '/workspace', 'glitchpad-validation:local', 'pnpm', '--filter', '@shruggietech/glitchpad', 'exec', 'vitest', 'run', '--maxWorkers=2', 'src/App.test.tsx', 'src/components/ApplicationMenu.test.tsx', 'src/components/DocumentErrorBoundary.test.tsx', 'src/components/DocumentSurface.test.tsx', 'src/components/MarkdownSurface.test.tsx', 'src/components/EmbeddedMermaidSurface.test.tsx', 'src/domain/markdown-pipeline.test.ts', 'src/domain/markdown-renderer.test.ts', 'src/domain/desktop-delivery-gateway.test.ts', 'src/runtime-polyfills.test.ts')
```

## 4. Run production geometry and Windows package policy checks

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', 'A:/Code/glitchpad:/workspace', '--workdir', '/workspace', 'glitchpad-validation:local', 'pnpm', 'run', 'check:shell-layout')
```

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', 'A:/Code/glitchpad:/workspace', '--workdir', '/workspace', 'glitchpad-validation:local', 'pnpm', 'run', 'check:windows-package')
```

## 5. Run the complete repository gate

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', 'A:/Code/glitchpad:/workspace', '--workdir', '/workspace', 'glitchpad-validation:local', 'cargo', 'xtask', 'check')
```

## 6. Validate repository integrity

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--volume', 'A:/Code/glitchpad:/workspace', '--workdir', '/workspace', 'glitchpad-validation:local', 'pwsh', '-NoLogo', '-NoProfile', '-File', 'scripts/check-encoding.ps1')
```

Run `git diff --check` through `scripts/invoke-vcs-hidden.ps1` as the separate whitespace-integrity gate.

## 7. Hosted final-byte evidence

Push the branch and open the official pull request. Wait for the Windows package workflow to execute the exact NSIS and portable candidates, and for the macOS/Linux shared-shell plus repository aggregate checks. Do not claim Windows OS scaling or final-byte behavior from local browser evidence.
