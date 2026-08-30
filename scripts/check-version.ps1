[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$expectedVersion = '0.0.0'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

function Assert-VersionValue {
    param(
        [Parameter(Mandatory)] [string] $Label,
        [Parameter(Mandatory)] [string] $Actual
    )

    if ($Actual -ne $expectedVersion) {
        $failures.Add("$Label is '$Actual'; expected '$expectedVersion'.")
    }
}

$rootPackage = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'package.json') | ConvertFrom-Json
$appPackage = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'apps/glitchpad/package.json') | ConvertFrom-Json
$tauriConfig = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'crates/glitchpad-host/tauri.conf.json') | ConvertFrom-Json
$cargoManifest = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'Cargo.toml')
$technicalSpecification = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'docs/glitchpad-technical-specification.md')
$readme = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'README.md')
$androidManifest = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'crates/glitchpad-host/gen/android/app/build.gradle.kts')

Assert-VersionValue -Label 'root package version' -Actual $rootPackage.version
Assert-VersionValue -Label 'application package version' -Actual $appPackage.version
Assert-VersionValue -Label 'Tauri version' -Actual $tauriConfig.version

if ($cargoManifest -notmatch '(?m)^version = "0\.0\.0"$') {
    $failures.Add('Cargo workspace version authority is not 0.0.0.')
}

if ($technicalSpecification -notmatch '^# Glitchpad Technical Specification v0\.0\.0') {
    $failures.Add('Technical specification heading is not v0.0.0.')
}

if ($readme -notmatch 'version-0\.0\.0') {
    $failures.Add('README version badge is not 0.0.0.')
}

if ($androidManifest -notmatch 'versionName = tauriProperties\.getProperty\("tauri\.android\.versionName", "0\.0\.0"\)') {
    $failures.Add('Android fallback version is not 0.0.0.')
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host "Version authorities agree on $expectedVersion."
