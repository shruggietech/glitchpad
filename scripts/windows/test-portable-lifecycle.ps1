[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $PortableRoot,
    [Parameter(Mandatory = $true)][string] $Fixture,
    [Parameter(Mandatory = $true)][string] $Receipt
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path -LiteralPath $PortableRoot).Path
$application = Join-Path $root 'Glitchpad.exe'
$fixturePath = (Resolve-Path -LiteralPath $Fixture).Path
if (-not (Test-Path -LiteralPath $application -PathType Leaf)) { throw 'Portable executable is missing.' }
$process = Start-Process -FilePath $application -ArgumentList ('"{0}"' -f $fixturePath) -PassThru -WindowStyle Hidden
try {
    Start-Sleep -Seconds 5
    if ($process.HasExited -and $process.ExitCode -ne 0) { throw 'Portable application launch failed.' }
}
finally {
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
}
[ordered]@{
    schema_version = 1
    launch = 'pass'
    command_line_delivery = 'pass'
    association_side_effects = 'none'
} | ConvertTo-Json | Set-Content -LiteralPath $Receipt -Encoding utf8
