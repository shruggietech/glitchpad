[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$scratch = Join-Path ([System.IO.Path]::GetTempPath()) ("glitchpad-s019-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $scratch | Out-Null

try {
    $executable = Join-Path $scratch 'input.exe'
    $installer = Join-Path $scratch 'input-setup.exe'
    [System.IO.File]::WriteAllBytes($executable, [byte[]](1..32))
    [System.IO.File]::WriteAllBytes($installer, [byte[]](33..64))
    $output = Join-Path $scratch 'out'
    $manifestPath = & (Join-Path $PSScriptRoot 'assemble-package.ps1') -Version '0.1.0' -Executable $executable -Installer $installer -OutputRoot $output -SourceCommit ('a' * 40) -WorkflowIdentity 'local-contract-test' -RepositoryRoot $repositoryRoot
    $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
    if ($manifest.artifacts.Count -ne 2 -or $manifest.portable_inventory.Count -ne 4) {
        throw 'Assembly did not produce the governed manifest.'
    }
    foreach ($required in @('Glitchpad.exe', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.txt')) {
        if (-not (Test-Path -LiteralPath (Join-Path $output "portable/$required") -PathType Leaf)) {
            throw "Portable staging omitted $required."
        }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $output 'glitchpad-0.1.0-windows-x86_64.zip') -PathType Leaf)) {
        throw 'Portable ZIP was not created.'
    }
    try {
        & (Join-Path $PSScriptRoot 'assemble-package.ps1') -Version '0.1.0' -Executable $executable -Installer $installer -OutputRoot $output -SourceCommit ('a' * 40) -WorkflowIdentity 'overwrite-test' -RepositoryRoot $repositoryRoot | Out-Null
        throw 'Assembly unexpectedly overwrote an existing output root.'
    }
    catch {
        if ($_.Exception.Message -notmatch 'must not already exist') { throw }
    }
    Write-Output 'Windows package assembly contract passed.'
}
finally {
    if (Test-Path -LiteralPath $scratch) {
        Remove-Item -LiteralPath $scratch -Recurse -Force
    }
}
