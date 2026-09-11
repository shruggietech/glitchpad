# Quickstart: Sectioned Technical Specification Documentation

Run every local non-Git command through the hidden Linux validation launcher from the repository root.

## 1. Build the pinned validation image

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('build', '--tag', 'glitchpad-validation:local', '--file', 'scripts/docker/validation.Dockerfile', '.')
```

## 2. Install locked dependencies

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', 'A:/Code/glitchpad:/workspace', '--workdir', '/workspace', 'glitchpad-validation:local', 'pnpm', 'install', '--frozen-lockfile')
```

## 3. Run focused generator and content tests

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', 'A:/Code/glitchpad:/workspace', '--workdir', '/workspace', 'glitchpad-validation:local', 'pnpm', '--filter', '@shruggietech/glitchpad-site', 'run', 'prebuild')
```

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', 'A:/Code/glitchpad:/workspace', '--workdir', '/workspace', 'glitchpad-validation:local', 'pnpm', '--filter', '@shruggietech/glitchpad-site', 'run', 'test:unit')
```

## 4. Run the complete static-site gate

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', 'A:/Code/glitchpad:/workspace', '--workdir', '/workspace', 'glitchpad-validation:local', 'pnpm', 'run', 'check:site')
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

## 7. Hosted evidence

Push the branch and open the official pull request. Wait for all required checks and both allowed review rounds. After the user completes the merge ritual, confirm that the documentation deployment job verifies the merged revision on `glitchpad.com`; do not claim production evidence before deployment.
