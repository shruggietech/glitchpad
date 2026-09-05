[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $Version,
    [Parameter(Mandatory = $true)][string] $Executable,
    [Parameter(Mandatory = $true)][string] $Installer,
    [Parameter(Mandatory = $true)][string] $OutputRoot,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-f0-9]{40,64}$')][string] $SourceCommit,
    [Parameter(Mandatory = $true)][string] $WorkflowIdentity,
    [string] $RepositoryRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($Version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$' -or $Version -eq '0.0.0') {
    throw 'Version must be an explicit nonzero semantic version.'
}

$resolvedRepository = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$resolvedExecutable = (Resolve-Path -LiteralPath $Executable).Path
$resolvedInstaller = (Resolve-Path -LiteralPath $Installer).Path
$resolvedOutputParent = Split-Path -Parent $OutputRoot
if (-not (Test-Path -LiteralPath $resolvedOutputParent -PathType Container)) {
    throw 'The output parent must already exist.'
}
$resolvedOutputParent = (Resolve-Path -LiteralPath $resolvedOutputParent).Path
$outputLeaf = Split-Path -Leaf $OutputRoot
if ([string]::IsNullOrWhiteSpace($outputLeaf) -or $outputLeaf -in @('.', '..')) {
    throw 'The output root must name a dedicated child directory.'
}
$resolvedOutput = Join-Path $resolvedOutputParent $outputLeaf
if (Test-Path -LiteralPath $resolvedOutput) {
    throw 'The output root must not already exist.'
}

$contract = Get-Content -Raw -LiteralPath (Join-Path $resolvedRepository 'packaging/windows/package-contract.json') | ConvertFrom-Json
if ($contract.candidate_version -ne $Version) {
    throw 'Version does not match the governed Windows package contract.'
}

$installerName = "glitchpad-$Version-windows-x86_64-setup.exe"
$portableName = "glitchpad-$Version-windows-x86_64.zip"
$stage = Join-Path $resolvedOutput 'portable'
New-Item -ItemType Directory -Path $stage -Force | Out-Null

$portableSources = [ordered]@{
    'Glitchpad.exe' = $resolvedExecutable
    'LICENSE' = (Join-Path $resolvedRepository 'LICENSE')
    'NOTICE' = (Join-Path $resolvedRepository 'NOTICE')
    'THIRD_PARTY_NOTICES.txt' = (Join-Path $resolvedRepository 'packaging/windows/THIRD_PARTY_NOTICES.txt')
}
foreach ($entry in $portableSources.GetEnumerator()) {
    Copy-Item -LiteralPath $entry.Value -Destination (Join-Path $stage $entry.Key)
}

$installerTarget = Join-Path $resolvedOutput $installerName
Copy-Item -LiteralPath $resolvedInstaller -Destination $installerTarget
$portableTarget = Join-Path $resolvedOutput $portableName
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $portableTarget -CompressionLevel Optimal

$inventory = foreach ($entry in $portableSources.GetEnumerator()) {
    $path = Join-Path $stage $entry.Key
    [ordered]@{
        relative_path = $entry.Key
        sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
        bytes = (Get-Item -LiteralPath $path).Length
    }
}

function Get-SizeClassification([long] $Bytes) {
    if ($Bytes -le [long]$contract.size_budget.target_bytes) { return 'pass' }
    if ($Bytes -le [long]$contract.size_budget.hard_limit_bytes) { return 'warning' }
    return 'failure'
}

$artifacts = foreach ($candidate in @(
    @{ kind = 'nsis'; name = $installerName; path = $installerTarget },
    @{ kind = 'portable_zip'; name = $portableName; path = $portableTarget }
)) {
    $bytes = (Get-Item -LiteralPath $candidate.path).Length
    [ordered]@{
        kind = $candidate.kind
        name = $candidate.name
        sha256 = (Get-FileHash -LiteralPath $candidate.path -Algorithm SHA256).Hash.ToLowerInvariant()
        bytes = $bytes
        size_classification = Get-SizeClassification $bytes
        signature_status = 'not_applicable_unsigned_candidate'
    }
}
if ($artifacts.Where({ $_.size_classification -eq 'failure' }).Count -gt 0) {
    throw 'A Windows candidate exceeds the 60 MiB hard limit.'
}

$manifest = [ordered]@{
    schema_version = 1
    version = $Version
    platform = 'windows'
    architecture = 'x86_64'
    source_commit = $SourceCommit
    workflow_identity = $WorkflowIdentity
    official = $false
    gate_status = 'candidate_valid'
    artifacts = @($artifacts)
    portable_inventory = @($inventory)
}
$manifestPath = Join-Path $resolvedOutput 'windows-package-manifest.json'
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8

$checksumLines = $artifacts | ForEach-Object { "$($_.sha256)  $($_.name)" }
$checksumLines | Set-Content -LiteralPath (Join-Path $resolvedOutput 'SHA256SUMS') -Encoding utf8

$provenance = [ordered]@{
    schema_version = 1
    predicate_type = 'https://slsa.dev/provenance/v1'
    candidate_only = $true
    repository = 'shruggietech/glitchpad'
    source_commit = $SourceCommit
    workflow_identity = $WorkflowIdentity
    subjects = @($artifacts | ForEach-Object { [ordered]@{ name = $_.name; sha256 = $_.sha256 } })
}
$provenance | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $resolvedOutput 'provenance.json') -Encoding utf8

Write-Output $manifestPath
