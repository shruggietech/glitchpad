# Quickstart: Brand Kit Refresh Validation

Run all commands through the repository's hidden Docker launcher from the repository root.

## Focused validation

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', "${PWD}:/workspace", '--workdir', '/workspace', 'glitchpad-validation:local', 'pnpm', 'check:brand')
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', "${PWD}:/workspace", '--workdir', '/workspace', 'glitchpad-validation:local', 'pnpm', 'check:site')
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', "${PWD}:/workspace", '--workdir', '/workspace', 'glitchpad-validation:local', 'pnpm', 'check:android-package')
```

Expected result: each command exits zero, all copied assets match canonical sources, and no foundation packaging icon is accepted.

## Full validation

```powershell
./scripts/invoke-docker-hidden.ps1 -DockerArguments @('run', '--rm', '--cpus', '2', '--memory', '6g', '--volume', "${PWD}:/workspace", '--workdir', '/workspace', 'glitchpad-validation:local', 'cargo', 'xtask', 'check')
```

Expected result: the complete repository gate exits zero before push or pull-request publication.
