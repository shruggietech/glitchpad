[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $PortableRoot,
    [Parameter(Mandatory = $true)][string] $TextFixture,
    [Parameter(Mandatory = $true)][string] $MarkdownFixtureA,
    [Parameter(Mandatory = $true)][string] $MarkdownFixtureB,
    [Parameter(Mandatory = $true)][string] $Receipt,
    [string] $ApplicationName = 'Glitchpad.exe'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path -LiteralPath $PortableRoot).Path
$application = Join-Path $root $ApplicationName
$textFixturePath = (Resolve-Path -LiteralPath $TextFixture).Path
$markdownFixtureAPath = (Resolve-Path -LiteralPath $MarkdownFixtureA).Path
$markdownFixtureBPath = (Resolve-Path -LiteralPath $MarkdownFixtureB).Path
$fixtureDigests = @{
    $textFixturePath = (Get-FileHash -LiteralPath $textFixturePath -Algorithm SHA256).Hash
    $markdownFixtureAPath = (Get-FileHash -LiteralPath $markdownFixtureAPath -Algorithm SHA256).Hash
    $markdownFixtureBPath = (Get-FileHash -LiteralPath $markdownFixtureBPath -Algorithm SHA256).Hash
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

function Test-WindowContainsText([System.Windows.Automation.AutomationElement] $Window, [string] $Text) {
    if (Find-NamedElement $Window $Text) { return $true }
    $elements = $Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($element in $elements) {
        try {
            if ($element.Current.Name.Contains($Text, [StringComparison]::Ordinal)) { return $true }
            $patternObject = $null
            if ($element.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$patternObject)) {
                if (([System.Windows.Automation.TextPattern]$patternObject).DocumentRange.GetText(-1).Contains($Text, [StringComparison]::Ordinal)) { return $true }
            }
            $patternObject = $null
            if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$patternObject)) {
                if (([System.Windows.Automation.ValuePattern]$patternObject).Current.Value.Contains($Text, [StringComparison]::Ordinal)) { return $true }
            }
        }
        catch { continue }
    }
    return $false
}

function Wait-WindowText([Diagnostics.Process] $Process, [string] $Text, [int] $Seconds = 10) {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($Seconds)
    do {
        $window = Get-WindowRoot $Process
        if ($window -and (Test-WindowContainsText $window $Text)) { return }
        Start-Sleep -Milliseconds 50
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "Portable UI did not expose text '$Text'."
}

function Wait-SafeMarkdownOutcome([Diagnostics.Process] $Process, [string] $ExpectedHeading, [string] $RawSentinel, [int] $Seconds = 20) {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($Seconds)
    do {
        $window = Get-WindowRoot $Process
        if ($window) {
            if (Test-WindowContainsText $window $RawSentinel) { throw "Rendered-mode delivery exposed raw sentinel '$RawSentinel'." }
            if (Find-NamedElement $window 'Markdown source while preview renders') { throw 'Rendered-mode delivery exposed the legacy raw-source pending surface.' }
            if (Find-NamedElement $window $ExpectedHeading) { return }
            if (Find-NamedElement $window 'Markdown preview failed safely. Source remains available.') { throw "Markdown rendering failed before '$ExpectedHeading' became usable." }
            if (Find-NamedElement $window 'This document could not be displayed. The application remains available.') { throw "Document containment activated before '$ExpectedHeading' became usable." }
        }
        Start-Sleep -Milliseconds 50
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "Portable UI did not expose safe Markdown content '$ExpectedHeading'."
}

function Send-MarkdownDelivery([string] $Path, [Diagnostics.Process] $HostProcess, [string] $ExpectedHeading, [string] $RawSentinel) {
    $delivery = Start-Process -FilePath $application -ArgumentList ('"{0}"' -f $Path) -PassThru -WindowStyle Hidden -Environment $isolatedEnvironment
    try { Wait-SafeMarkdownOutcome $HostProcess $ExpectedHeading $RawSentinel }
    finally {
        $delivery.WaitForExit(1000) | Out-Null
        if (-not $delivery.HasExited) { Stop-Process -Id $delivery.Id -Force }
    }
}

function Wait-NamedButton([Diagnostics.Process] $Process, [string] $Name, [int] $Seconds = 10) {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($Seconds)
    $condition = New-Object System.Windows.Automation.AndCondition(
        (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $Name)),
        (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button))
    )
    do {
        $window = Get-WindowRoot $Process
        if ($window) {
            $button = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
            if ($button) { return $button }
        }
        Start-Sleep -Milliseconds 50
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "Portable UI did not expose button '$Name'."
}

function Invoke-NamedButton([Diagnostics.Process] $Process, [string] $Name) {
    $button = Wait-NamedButton $Process $Name
    $patternObject = $null
    if ($button.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$patternObject)) {
        ([System.Windows.Automation.InvokePattern]$patternObject).Invoke()
        return
    }
    if ($button.Current.IsOffscreen) { throw "Portable UI button '$Name' is offscreen and cannot be activated." }
    $point = $button.GetClickablePoint()
    $previousCursor = [System.Windows.Forms.Cursor]::Position
    try {
        [GlitchpadNativeInput]::SetForegroundWindow($Process.MainWindowHandle) | Out-Null
        [GlitchpadNativeInput]::SetCursorPos([Math]::Round($point.X), [Math]::Round($point.Y)) | Out-Null
        Start-Sleep -Milliseconds 50
        [GlitchpadNativeInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
        [GlitchpadNativeInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
    }
    finally {
        [GlitchpadNativeInput]::SetCursorPos($previousCursor.X, $previousCursor.Y) | Out-Null
    }
}

function Close-Document([Diagnostics.Process] $Process, [string] $Path) {
    Invoke-NamedButton $Process ("Close {0}" -f [IO.Path]::GetFileName($Path))
}

function Assert-MenuGeometry([Diagnostics.Process] $Process) {
    $trigger = Wait-NamedButton $Process 'Menu'
    $before = $trigger.Current.BoundingRectangle
    Invoke-NamedButton $Process 'Menu'
    $menu = Wait-NamedElement $Process 'Glitchpad menu'
    $during = (Wait-NamedButton $Process 'Menu').Current.BoundingRectangle
    foreach ($field in @('X', 'Y', 'Width', 'Height')) {
        if ([Math]::Abs($before.$field - $during.$field) -gt 1) { throw "Menu trigger moved while disclosed ($field)." }
    }
    $window = Get-WindowRoot $Process
    $scrollCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::ScrollBar)
    foreach ($scrollbar in $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $scrollCondition)) {
        $scrollRect = $scrollbar.Current.BoundingRectangle
        foreach ($surface in @($during, $menu.Current.BoundingRectangle)) {
            $intersects = $surface.Left -lt $scrollRect.Right -and $surface.Right -gt $scrollRect.Left -and $surface.Top -lt $scrollRect.Bottom -and $surface.Bottom -gt $scrollRect.Top
            if ($intersects) { throw 'Application menu intersects a document scrollbar hit region.' }
        }
    }
    Invoke-NamedButton $Process 'Menu'
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(5)
    do { Start-Sleep -Milliseconds 25; $window = Get-WindowRoot $Process } while ((Find-NamedElement $window 'Glitchpad menu') -and [DateTimeOffset]::UtcNow -lt $deadline)
    if (Find-NamedElement $window 'Glitchpad menu') { throw 'Application menu did not close.' }
    $after = (Wait-NamedButton $Process 'Menu').Current.BoundingRectangle
    foreach ($field in @('X', 'Y', 'Width', 'Height')) {
        if ([Math]::Abs($before.$field - $after.$field) -gt 1) { throw "Menu trigger moved after disclosure ($field)." }
    }
}

$associationBefore = Get-AssociationSnapshot | ConvertTo-Json -Compress
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class GlitchpadNativeInput
{
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr window);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint flags, uint x, uint y, uint data, UIntPtr extraInfo);
}
'@
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

    Send-MarkdownDelivery $markdownFixtureAPath $process 'S030 Markdown Alpha 2B7C' 'S030_ALPHA_RAW_SENTINEL'
    Wait-NamedElement $process ([IO.Path]::GetFileName($markdownFixtureAPath)) | Out-Null
    Wait-WindowText $process 'S030 Alpha Footnote 6A1E'
    if ((Get-TabCount $process) -ne 2) { throw 'Two delivered documents did not expose exactly two tabs.' }
    Wait-NamedElement $process ("Close {0}" -f [IO.Path]::GetFileName($textFixturePath)) | Out-Null
    Send-MarkdownDelivery $markdownFixtureBPath $process 'S030 Markdown Beta 9D4E' 'S030_BETA_RAW_SENTINEL'
    Wait-NamedElement $process ([IO.Path]::GetFileName($markdownFixtureBPath)) | Out-Null
    Wait-NamedElement $process 'S030 Markdown Beta 9D4E' | Out-Null
    Wait-NamedElement $process 's030-beta.md diagram 1' | Out-Null
    Assert-MenuGeometry $process
    if ((Get-TabCount $process) -ne 3) { throw 'Three delivered documents did not expose exactly three tabs.' }
    Close-Document $process $markdownFixtureBPath
    Close-Document $process $markdownFixtureAPath
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(10)
    do { Start-Sleep -Milliseconds 250 } while ((Get-TabCount $process) -ne 0 -and [DateTimeOffset]::UtcNow -lt $deadline)
    if ((Get-TabCount $process) -ne 0) { throw 'Closing from two documents back to one did not hide the tab strip.' }
    Wait-ElementText $process ("{0} text editor" -f [IO.Path]::GetFileName($textFixturePath)) 'S027 TXT CONTENT 7E5A'
}
finally {
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    Remove-Item -LiteralPath $isolatedState -Recurse -Force -ErrorAction SilentlyContinue
}


$reverseState = Join-Path ([IO.Path]::GetTempPath()) ("glitchpad-s030-reverse-{0}" -f [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $reverseState -Force | Out-Null
$isolatedEnvironment = @{ APPDATA = $reverseState; LOCALAPPDATA = $reverseState }
$reverseProcess = Start-Process -FilePath $application -PassThru -WindowStyle Hidden -Environment $isolatedEnvironment
try {
    Wait-NamedElement $reverseProcess 'Open file…' | Out-Null
    Send-MarkdownDelivery $markdownFixtureBPath $reverseProcess 'S030 Markdown Beta 9D4E' 'S030_BETA_RAW_SENTINEL'
    Wait-NamedElement $reverseProcess 's030-beta.md diagram 1' | Out-Null
    if ((Get-TabCount $reverseProcess) -ne 0) { throw 'The first reverse-order document exposed tab chrome.' }
    Send-MarkdownDelivery $markdownFixtureAPath $reverseProcess 'S030 Markdown Alpha 2B7C' 'S030_ALPHA_RAW_SENTINEL'
    Wait-WindowText $reverseProcess 'S030 Alpha Footnote 6A1E'
    if ((Get-TabCount $reverseProcess) -ne 2) { throw 'The reverse-order pair did not expose exactly two tabs.' }
}
finally {
    if (-not $reverseProcess.HasExited) { Stop-Process -Id $reverseProcess.Id -Force }
    Remove-Item -LiteralPath $reverseState -Recurse -Force -ErrorAction SilentlyContinue
}
$associationAfter = Get-AssociationSnapshot | ConvertTo-Json -Compress
if ($associationAfter -cne $associationBefore) { throw 'Portable launch changed governed file associations.' }
foreach ($fixture in $fixtureDigests.GetEnumerator()) {
    if ((Get-FileHash -LiteralPath $fixture.Key -Algorithm SHA256).Hash -ne $fixture.Value) { throw 'Portable lifecycle modified a user document fixture.' }
}
[ordered]@{
    schema_version = 3
    clean_launch = 'pass'
    fixture_absence = 'pass'
    text_delivery = 'pass'
    markdown_delivery = 'pass'
    markdown_alpha_beta = 'pass'
    markdown_beta_alpha = 'pass'
    blank_viewport_absence = 'pass'
    pending_source_absence = 'pass'
    active_document_identity = 'pass'
    menu_geometry = 'pass'
    conditional_tabs = 'pass'
    direct_close = 'pass'
    association_side_effects = 'none'
    document_preservation = 'pass'
} | ConvertTo-Json | Set-Content -LiteralPath $Receipt -Encoding utf8
