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
$application = Join-Path $installRoot 'glitchpad-host.exe'
$uninstaller = Join-Path $installRoot 'uninstall.exe'
$extensions = @((Get-Content -LiteralPath 'packaging/windows/capabilities.json' -Raw | ConvertFrom-Json).stable_extensions)

function Get-AssociationSnapshot {
    @($extensions | ForEach-Object {
        $extension = $_
        $extensionKeyPath = "Registry::HKEY_CURRENT_USER\Software\Classes\.$extension"
        $extensionKey = if (Test-Path -LiteralPath $extensionKeyPath) { Get-Item -LiteralPath $extensionKeyPath } else { $null }
        $programId = if ($extensionKey) { [string]$extensionKey.GetValue($null) } else { '' }
        $commandKeyPath = if ($programId) { "Registry::HKEY_CURRENT_USER\Software\Classes\$programId\shell\open\command" } else { '' }
        $commandKey = if ($commandKeyPath -and (Test-Path -LiteralPath $commandKeyPath)) { Get-Item -LiteralPath $commandKeyPath } else { $null }
        [ordered]@{
            extension = $extension
            registered = $null -ne $extensionKey
            program_id = $programId
            command = if ($commandKey) { [string]$commandKey.GetValue($null) } else { '' }
        }
    })
}

$associationBefore = Get-AssociationSnapshot

$install = Start-Process -FilePath $installerPath -ArgumentList '/S' -Wait -PassThru -WindowStyle Hidden
if ($install.ExitCode -ne 0) { throw 'Silent current-user installation returned a failure.' }
if (-not (Test-Path -LiteralPath $application -PathType Leaf)) { throw 'The installed application binary is missing.' }
$repair = Start-Process -FilePath $installerPath -ArgumentList '/S' -Wait -PassThru -WindowStyle Hidden
if ($repair.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $application -PathType Leaf)) { throw 'Silent repair installation failed.' }
$associationInstalled = Get-AssociationSnapshot
foreach ($association in $associationInstalled) {
    if (-not $association.registered -or -not $association.program_id) { throw 'A governed file association was not registered.' }
    if ($association.command.IndexOf('glitchpad-host.exe', [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw 'A governed file association does not target the installed application.'
    }
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
$associationAfter = Get-AssociationSnapshot
if (($associationAfter | ConvertTo-Json -Compress) -ne ($associationBefore | ConvertTo-Json -Compress)) {
    throw 'Uninstall did not restore the governed file association state.'
}

[ordered]@{
    schema_version = 1
    install = 'pass'
    repair = 'pass'
    launch = 'pass'
    uninstall = 'pass'
    document_preservation = 'pass'
    association_cleanup = 'pass'
} | ConvertTo-Json | Set-Content -LiteralPath $Receipt -Encoding utf8
