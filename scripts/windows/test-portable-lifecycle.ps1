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
$fixtureDigest = (Get-FileHash -LiteralPath $fixturePath -Algorithm SHA256).Hash
if (-not (Test-Path -LiteralPath $application -PathType Leaf)) { throw 'Portable executable is missing.' }
$capabilities = Get-Content -LiteralPath 'packaging/desktop/capabilities.json' -Raw | ConvertFrom-Json
$extensions = @($capabilities.families | ForEach-Object { $_.extensions } | Sort-Object -Unique)

function Get-AssociationSnapshot {
    @($extensions | ForEach-Object {
        $extensionKeyPath = "Registry::HKEY_CURRENT_USER\Software\Classes\.$_"
        $extensionKey = if (Test-Path -LiteralPath $extensionKeyPath) { Get-Item -LiteralPath $extensionKeyPath } else { $null }
        $programId = if ($extensionKey) { [string]$extensionKey.GetValue($null) } else { '' }
        $commandKeyPath = if ($programId) { "Registry::HKEY_CURRENT_USER\Software\Classes\$programId\shell\open\command" } else { '' }
        $commandKey = if ($commandKeyPath -and (Test-Path -LiteralPath $commandKeyPath)) { Get-Item -LiteralPath $commandKeyPath } else { $null }
        [ordered]@{
            extension = $_
            program_id = $programId
            command = if ($commandKey) { [string]$commandKey.GetValue($null) } else { '' }
        }
    })
}

$associationBefore = Get-AssociationSnapshot | ConvertTo-Json -Compress
Add-Type -AssemblyName UIAutomationClient
$process = Start-Process -FilePath $application -ArgumentList ('"{0}"' -f $fixturePath) -PassThru -WindowStyle Hidden
try {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(20)
    $delivered = $null
    do {
        Start-Sleep -Milliseconds 250
        $process.Refresh()
        if ($process.HasExited) { throw "Portable application exited before delivery evidence (exit $($process.ExitCode))." }
        if ($process.MainWindowHandle -ne [IntPtr]::Zero) {
            $rootElement = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
            $condition = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::NameProperty,
                [IO.Path]::GetFileName($fixturePath)
            )
            $delivered = $rootElement.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
        }
    } while (-not $delivered -and [DateTimeOffset]::UtcNow -lt $deadline)
    if (-not $delivered) { throw 'Portable command-line delivery was not exposed by the application UI.' }
}
finally {
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
}
$associationAfter = Get-AssociationSnapshot | ConvertTo-Json -Compress
if ($associationAfter -cne $associationBefore) { throw 'Portable launch changed governed file associations.' }
if ((Get-FileHash -LiteralPath $fixturePath -Algorithm SHA256).Hash -ne $fixtureDigest) {
    throw 'Portable lifecycle modified the user document fixture.'
}
[ordered]@{
    schema_version = 1
    launch = 'pass'
    command_line_delivery = 'pass'
    association_side_effects = 'none'
    document_preservation = 'pass'
} | ConvertTo-Json | Set-Content -LiteralPath $Receipt -Encoding utf8
