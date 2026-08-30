[CmdletBinding()]
param(
    [string] $Tag = $env:GITHUB_REF_NAME
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'package.json') | ConvertFrom-Json

if ($package.version -eq '0.0.0') {
    throw 'Version 0.0.0 is a foundation state and cannot publish artifacts.'
}

if ($Tag -and $Tag -ne "v$($package.version)") {
    throw "Tag $Tag does not match product version $($package.version)."
}

$requiredEvidence = @(
    'assets/brand/brand-kit.md',
    "docs/releases/v$($package.version)-receipt.md"
)

foreach ($relativePath in $requiredEvidence) {
    if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot $relativePath) -PathType Leaf)) {
        throw "Release evidence is missing: $relativePath"
    }
}

Write-Host "Release readiness evidence exists for v$($package.version)."
