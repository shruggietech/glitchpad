[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $PortableRoot,
    [Parameter(Mandatory = $true)][string] $TextFixture,
    [Parameter(Mandatory = $true)][string] $MarkdownFixture,
    [Parameter(Mandatory = $true)][string] $Receipt
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path -LiteralPath $PortableRoot).Path
$application = Join-Path $root 'Glitchpad.exe'
$textFixturePath = (Resolve-Path -LiteralPath $TextFixture).Path
$markdownFixturePath = (Resolve-Path -LiteralPath $MarkdownFixture).Path
$fixtureDigests = @{
    $textFixturePath = (Get-FileHash -LiteralPath $textFixturePath -Algorithm SHA256).Hash
    $markdownFixturePath = (Get-FileHash -LiteralPath $markdownFixturePath -Algorithm SHA256).Hash
}
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
        [ordered]@{ extension = $_; program_id = $programId; command = if ($commandKey) { [string]$commandKey.GetValue($null) } else { '' } }
    })
}

function Get-WindowRoot([Diagnostics.Process] $Process) {
    $Process.Refresh()
    if ($Process.HasExited) { throw "Portable application exited unexpectedly (exit $($Process.ExitCode))." }
    if ($Process.MainWindowHandle -eq [IntPtr]::Zero) { return $null }
    return [System.Windows.Automation.AutomationElement]::FromHandle($Process.MainWindowHandle)
}

function Find-NamedElement([System.Windows.Automation.AutomationElement] $Window, [string] $Name) {
    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $Name)
    return $Window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
}

function Wait-NamedElement([Diagnostics.Process] $Process, [string] $Name, [int] $Seconds = 20) {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($Seconds)
    do {
        Start-Sleep -Milliseconds 250
        $window = Get-WindowRoot $Process
        if ($window) {
            $element = Find-NamedElement $window $Name
            if ($element) { return $element }
        }
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "Portable UI did not expose '$Name'."
}

function Wait-ElementText([Diagnostics.Process] $Process, [string] $ElementName, [string] $ExpectedText, [int] $Seconds = 20) {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($Seconds)
    do {
        Start-Sleep -Milliseconds 250
        $window = Get-WindowRoot $Process
        if ($window) {
            if (Find-NamedElement $window $ExpectedText) { return }
            $element = Find-NamedElement $window $ElementName
            if ($element) {
                $patternObject = $null
                if ($element.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$patternObject)) {
                    $observed = ([System.Windows.Automation.TextPattern]$patternObject).DocumentRange.GetText(-1)
                    if ($observed.Contains($ExpectedText, [StringComparison]::Ordinal)) { return }
                }
                $patternObject = $null
                if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$patternObject)) {
                    $observed = ([System.Windows.Automation.ValuePattern]$patternObject).Current.Value
                    if ($observed.Contains($ExpectedText, [StringComparison]::Ordinal)) { return }
                }
            }
        }
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "Portable UI did not expose expected content '$ExpectedText'."
}

function Get-TabCount([Diagnostics.Process] $Process) {
    $window = Get-WindowRoot $Process
    if (-not $window) { return 0 }
    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::TabItem)
    return $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition).Count
}

function Send-Delivery([string] $Path) {
    $delivery = Start-Process -FilePath $application -ArgumentList ('"{0}"' -f $Path) -PassThru -WindowStyle Hidden -Environment $isolatedEnvironment
    try { $delivery.WaitForExit(5000) | Out-Null }
    finally { if (-not $delivery.HasExited) { Stop-Process -Id $delivery.Id -Force } }
}

$associationBefore = Get-AssociationSnapshot | ConvertTo-Json -Compress
Add-Type -AssemblyName UIAutomationClient
$isolatedState = Join-Path ([IO.Path]::GetTempPath()) ("glitchpad-s027-{0}" -f [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $isolatedState -Force | Out-Null
$isolatedEnvironment = @{ APPDATA = $isolatedState; LOCALAPPDATA = $isolatedState }
$process = Start-Process -FilePath $application -PassThru -WindowStyle Hidden -Environment $isolatedEnvironment
try {
    Wait-NamedElement $process 'Open file…' | Out-Null
    if ((Get-TabCount $process) -ne 0) { throw 'A clean launch exposed document tabs.' }
    $window = Get-WindowRoot $process
    foreach ($prohibited in @('welcome.md', 'diagram.mmd', 'notes.txt', 'draft.md', 'guide.md', 'architecture.rs', 'preview.webp', 'Recover draft.md?')) {
        if (Find-NamedElement $window $prohibited) { throw "A clean launch exposed prohibited fixture UI '$prohibited'." }
    }

    Send-Delivery $textFixturePath
    Wait-NamedElement $process ([IO.Path]::GetFileName($textFixturePath)) | Out-Null
    Wait-ElementText $process ("{0} text editor" -f [IO.Path]::GetFileName($textFixturePath)) 'S027 TXT CONTENT 7E5A'
    if ((Get-TabCount $process) -ne 0) { throw 'The first delivered document exposed tab chrome.' }

    Send-Delivery $markdownFixturePath
    Wait-NamedElement $process ([IO.Path]::GetFileName($markdownFixturePath)) | Out-Null
    Wait-NamedElement $process 'S027 Markdown Content 4C9B' | Out-Null
    if ((Get-TabCount $process) -ne 2) { throw 'Two delivered documents did not expose exactly two tabs.' }
    Wait-NamedElement $process ("Close {0}" -f [IO.Path]::GetFileName($textFixturePath)) | Out-Null
    $closeMarkdown = Wait-NamedElement $process ("Close {0}" -f [IO.Path]::GetFileName($markdownFixturePath))
    $invoke = [System.Windows.Automation.InvokePattern]$closeMarkdown.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invoke.Invoke()
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(10)
    do { Start-Sleep -Milliseconds 250 } while ((Get-TabCount $process) -ne 0 -and [DateTimeOffset]::UtcNow -lt $deadline)
    if ((Get-TabCount $process) -ne 0) { throw 'Closing from two documents back to one did not hide the tab strip.' }
    Wait-ElementText $process ("{0} text editor" -f [IO.Path]::GetFileName($textFixturePath)) 'S027 TXT CONTENT 7E5A'
}
finally {
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    Remove-Item -LiteralPath $isolatedState -Recurse -Force -ErrorAction SilentlyContinue
}
$associationAfter = Get-AssociationSnapshot | ConvertTo-Json -Compress
if ($associationAfter -cne $associationBefore) { throw 'Portable launch changed governed file associations.' }
foreach ($fixture in $fixtureDigests.GetEnumerator()) {
    if ((Get-FileHash -LiteralPath $fixture.Key -Algorithm SHA256).Hash -ne $fixture.Value) { throw 'Portable lifecycle modified a user document fixture.' }
}
[ordered]@{
    schema_version = 2
    clean_launch = 'pass'
    fixture_absence = 'pass'
    text_delivery = 'pass'
    markdown_delivery = 'pass'
    conditional_tabs = 'pass'
    direct_close = 'pass'
    association_side_effects = 'none'
    document_preservation = 'pass'
} | ConvertTo-Json | Set-Content -LiteralPath $Receipt -Encoding utf8
