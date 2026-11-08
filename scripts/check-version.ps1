[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$release = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'packaging/release/package-contract.json') | ConvertFrom-Json
$expectedVersion = $release.version
if ($expectedVersion -notmatch '^\d+\.\d+\.\d+$' -or $release.tag -ne ('v' + $expectedVersion)) { throw 'Target release identity is invalid.' }
$failures = [System.Collections.Generic.List[string]]::new()
function Assert-VersionValue {
    param([Parameter(Mandatory)][string]$Label, [Parameter(Mandatory)][string]$Actual)
    if ($Actual -ne $expectedVersion) { $failures.Add("$Label is '$Actual'; expected '$expectedVersion'.") }
}
foreach ($manifestPath in @('package.json','apps/glitchpad/package.json','site/package.json','crates/glitchpad-host/tauri.conf.json')) {
    $manifest = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot $manifestPath) | ConvertFrom-Json
    Assert-VersionValue -Label $manifestPath -Actual $manifest.version
}
$cargo = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'Cargo.toml')
$workspace = [regex]::Match($cargo, '(?ms)^\[workspace\.package\]\r?\n(?<body>.*?)(?=^\[|\z)').Groups['body'].Value
$cargoVersion = [regex]::Match($workspace, '(?m)^version\s*=\s*"([^"]+)"').Groups[1].Value
Assert-VersionValue -Label 'Cargo workspace' -Actual $cargoVersion
$specification = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'docs/glitchpad-technical-specification.md')
if (-not $specification.StartsWith("# Glitchpad Technical Specification v$expectedVersion")) { $failures.Add('Technical specification heading differs from the target release.') }
$readme = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'README.md')
if (-not $readme.Contains("version-$expectedVersion-")) { $failures.Add('README version badge differs from the target release.') }
$android = Get-Content -Raw -LiteralPath (Join-Path $repositoryRoot 'crates/glitchpad-host/gen/android/app/build.gradle.kts')
$fallback = 'versionName = tauriProperties.getProperty("tauri.android.versionName", "' + $expectedVersion + '")'
if (-not $android.Contains($fallback)) { $failures.Add('Android fallback version differs from the target release.') }
if ($failures.Count -gt 0) { $failures | ForEach-Object { Write-Error $_ }; exit 1 }
Write-Output "Version authorities agree on $expectedVersion."
