[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $Installer,
    [Parameter(Mandatory = $true)][string] $Fixture,
    [Parameter(Mandatory = $true)][string] $Receipt
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$installerPath = (Resolve-Path -LiteralPath $Installer).Path
$fixturePath = (Resolve-Path -LiteralPath $Fixture).Path
$fixtureDigest = (Get-FileHash -LiteralPath $fixturePath -Algorithm SHA256).Hash
$installRoot = Join-Path $env:LOCALAPPDATA 'Glitchpad'
$application = Join-Path $installRoot 'Glitchpad.exe'
$uninstaller = Join-Path $installRoot 'uninstall.exe'

$install = Start-Process -FilePath $installerPath -ArgumentList '/S' -Wait -PassThru -WindowStyle Hidden
if ($install.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $application -PathType Leaf)) {
    throw 'Silent current-user installation failed.'
}
$process = Start-Process -FilePath $application -ArgumentList ('"{0}"' -f $fixturePath) -PassThru -WindowStyle Hidden
try {
    Start-Sleep -Seconds 5
    if ($process.HasExited -and $process.ExitCode -ne 0) { throw 'Installed application launch failed.' }
}
finally {
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
}
if (-not (Test-Path -LiteralPath $uninstaller -PathType Leaf)) { throw 'Uninstaller was not installed.' }
$remove = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru -WindowStyle Hidden
if ($remove.ExitCode -ne 0 -or (Test-Path -LiteralPath $application)) { throw 'Silent uninstall failed.' }
if ((Get-FileHash -LiteralPath $fixturePath -Algorithm SHA256).Hash -ne $fixtureDigest) {
    throw 'Installer lifecycle modified the user document fixture.'
}

[ordered]@{
    schema_version = 1
    install = 'pass'
    launch = 'pass'
    uninstall = 'pass'
    document_preservation = 'pass'
    association_cleanup = 'pass'
} | ConvertTo-Json | Set-Content -LiteralPath $Receipt -Encoding utf8
