[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $PortableRoot,
    [Parameter(Mandatory = $true)][string] $TextFixture,
    [Parameter(Mandatory = $true)][string] $MarkdownFixtureMinimal,
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
$markdownFixtureMinimalPath = (Resolve-Path -LiteralPath $MarkdownFixtureMinimal).Path
$markdownFixtureAPath = (Resolve-Path -LiteralPath $MarkdownFixtureA).Path
$markdownFixtureBPath = (Resolve-Path -LiteralPath $MarkdownFixtureB).Path
$fixtureDigests = @{
    $textFixturePath = (Get-FileHash -LiteralPath $textFixturePath -Algorithm SHA256).Hash
    $markdownFixtureMinimalPath = (Get-FileHash -LiteralPath $markdownFixtureMinimalPath -Algorithm SHA256).Hash
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

function Find-LargestNamedElement([System.Windows.Automation.AutomationElement] $Window, [string] $Name) {
    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $Name)
    $largest = $null
    $largestArea = 0
    foreach ($element in $Window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)) {
        $bounds = $element.Current.BoundingRectangle
        $area = $bounds.Width * $bounds.Height
        if ($area -gt $largestArea) {
            $largest = $element
            $largestArea = $area
        }
    }
    return $largest
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

function Assert-MenuGeometry([Diagnostics.Process] $Process, [string] $DocumentName) {
    $trigger = Wait-NamedButton $Process 'Menu'
    $before = $trigger.Current.BoundingRectangle
    if ($before.Width -lt 31 -or $before.Height -lt 31) { throw 'Menu trigger is smaller than the compact desktop target.' }
    $window = Get-WindowRoot $Process
    $document = Find-LargestNamedElement $window $DocumentName
    if (-not $document) { throw 'The active document client region could not be measured.' }
    $documentBefore = $document.Current.BoundingRectangle
    if ($before.Bottom -gt ($documentBefore.Top + 1)) { throw 'Persistent application toolbar intersects the document client region.' }
    $scrollPatternObject = $null
    $scrollBefore = $null
    if ($document.TryGetCurrentPattern([System.Windows.Automation.ScrollPattern]::Pattern, [ref]$scrollPatternObject)) {
        $scrollBefore = @(([System.Windows.Automation.ScrollPattern]$scrollPatternObject).Current.HorizontalScrollPercent, ([System.Windows.Automation.ScrollPattern]$scrollPatternObject).Current.VerticalScrollPercent)
    }
    Invoke-NamedButton $Process 'Menu'
    $menu = Wait-NamedElement $Process 'Glitchpad menu'
    $during = (Wait-NamedButton $Process 'Menu').Current.BoundingRectangle
    foreach ($field in @('X', 'Y', 'Width', 'Height')) {
        if ([Math]::Abs($before.$field - $during.$field) -gt 1) { throw "Menu trigger moved while disclosed ($field)." }
    }
    $window = Get-WindowRoot $Process
    $windowBounds = $window.Current.BoundingRectangle
    $menuBounds = $menu.Current.BoundingRectangle
    if ($menuBounds.Top -lt ($during.Bottom - 1)) { throw 'Application menu popup covers its trigger.' }
    if ($menuBounds.Left -lt ($windowBounds.Left - 1) -or $menuBounds.Right -gt ($windowBounds.Right + 1) -or $menuBounds.Bottom -gt ($windowBounds.Bottom + 1)) { throw 'Application menu popup escaped the application viewport.' }
    $documentDuring = (Find-LargestNamedElement $window $DocumentName).Current.BoundingRectangle
    foreach ($field in @('X', 'Y', 'Width', 'Height')) {
        if ([Math]::Abs($documentBefore.$field - $documentDuring.$field) -gt 1) { throw "Document client reflowed while the menu was disclosed ($field)." }
    }
    $scrollCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::ScrollBar)
    foreach ($scrollbar in $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $scrollCondition)) {
        $scrollRect = $scrollbar.Current.BoundingRectangle
        foreach ($surface in @($during, $menu.Current.BoundingRectangle)) {
            $intersects = $surface.Left -lt $scrollRect.Right -and $surface.Right -gt $scrollRect.Left -and $surface.Top -lt $scrollRect.Bottom -and $surface.Bottom -gt $scrollRect.Top
            if ($intersects) { throw 'Application menu intersects a document scrollbar hit region.' }
        }
    }
    [GlitchpadNativeInput]::SetForegroundWindow($Process.MainWindowHandle) | Out-Null
    [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(5)
    do { Start-Sleep -Milliseconds 25; $window = Get-WindowRoot $Process } while ((Find-NamedElement $window 'Glitchpad menu') -and [DateTimeOffset]::UtcNow -lt $deadline)
    if (Find-NamedElement $window 'Glitchpad menu') { throw 'Application menu did not close.' }
    $after = (Wait-NamedButton $Process 'Menu').Current.BoundingRectangle
    foreach ($field in @('X', 'Y', 'Width', 'Height')) {
        if ([Math]::Abs($before.$field - $after.$field) -gt 1) { throw "Menu trigger moved after disclosure ($field)." }
    }
    $documentAfterElement = Find-LargestNamedElement (Get-WindowRoot $Process) $DocumentName
    $documentAfter = $documentAfterElement.Current.BoundingRectangle
    foreach ($field in @('X', 'Y', 'Width', 'Height')) {
        if ([Math]::Abs($documentBefore.$field - $documentAfter.$field) -gt 1) { throw "Document client changed after menu disclosure ($field)." }
    }
    if ($scrollBefore) {
        $scrollAfterObject = $null
        if ($documentAfterElement.TryGetCurrentPattern([System.Windows.Automation.ScrollPattern]::Pattern, [ref]$scrollAfterObject)) {
            $scrollAfter = @(([System.Windows.Automation.ScrollPattern]$scrollAfterObject).Current.HorizontalScrollPercent, ([System.Windows.Automation.ScrollPattern]$scrollAfterObject).Current.VerticalScrollPercent)
            if ($scrollBefore[0] -ne $scrollAfter[0] -or $scrollBefore[1] -ne $scrollAfter[1]) { throw 'Menu disclosure changed document scroll position.' }
        }
    }
    $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
    if (-not $focused -or $focused.Current.Name -ne 'Menu') { throw 'Escape did not restore focus to the application menu trigger.' }
}

function Wait-DeviceScaleMarker([string] $Directory) {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(10)
    do {
        $markers = @(Get-ChildItem -LiteralPath $Directory -Filter 'device-scale-*.marker' -File)
        if ($markers.Count -gt 1) { throw 'The packaged WebView recorded conflicting device scales.' }
        if ($markers.Count -eq 1) {
            if ([IO.File]::ReadAllText($markers[0].FullName, [Text.Encoding]::UTF8) -ne "ready`n") { throw 'The packaged WebView device-scale marker was invalid.' }
            return $markers[0].BaseName
        }
        Start-Sleep -Milliseconds 100
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw 'The packaged WebView did not record its device scale.'
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
    Assert-MenuGeometry $process ([IO.Path]::GetFileName($markdownFixtureBPath))
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
$minimalState = Join-Path ([IO.Path]::GetTempPath()) ("glitchpad-s035-minimal-{0}" -f [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $minimalState -Force | Out-Null
$minimalEnvironment = @{ APPDATA = $minimalState; LOCALAPPDATA = $minimalState }
$minimalProcess = Start-Process -FilePath $application -ArgumentList ('"{0}"' -f $markdownFixtureMinimalPath) -PassThru -WindowStyle Hidden -Environment $minimalEnvironment
try {
    Wait-NamedElement $minimalProcess 'S035 Minimal Markdown 5E8A' | Out-Null
    if ((Get-TabCount $minimalProcess) -ne 0) { throw 'A single minimal Markdown document exposed tab chrome.' }
}
finally {
    if (-not $minimalProcess.HasExited) { Stop-Process -Id $minimalProcess.Id -Force }
    Remove-Item -LiteralPath $minimalState -Recurse -Force -ErrorAction SilentlyContinue
}
$webviewState = Join-Path ([IO.Path]::GetTempPath()) ("glitchpad-s035-webview-{0}" -f [Guid]::NewGuid().ToString('N'))
$webviewProbe = Join-Path $webviewState 'probe'
New-Item -ItemType Directory -Path $webviewProbe -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $webviewProbe 'enabled.marker'), "enabled`n", [Text.UTF8Encoding]::new($false))
$webviewEnvironment = @{
    APPDATA = $webviewState
    LOCALAPPDATA = $webviewState
    GLITCHPAD_LIFECYCLE_PROBE_DIR = $webviewProbe
}
$webviewProcess = Start-Process -FilePath $application -ArgumentList ('"{0}"' -f $markdownFixtureMinimalPath) -PassThru -WindowStyle Hidden -Environment $webviewEnvironment
try {
    Wait-NamedElement $webviewProcess 'S035 Minimal Markdown 5E8A' | Out-Null
    Wait-DeviceScaleMarker $webviewProbe | Out-Null
    Assert-MenuGeometry $webviewProcess ([IO.Path]::GetFileName($markdownFixtureMinimalPath))
}
finally {
    if (-not $webviewProcess.HasExited) { Stop-Process -Id $webviewProcess.Id -Force }
    Remove-Item -LiteralPath $webviewState -Recurse -Force -ErrorAction SilentlyContinue
}
$associationAfter = Get-AssociationSnapshot | ConvertTo-Json -Compress
if ($associationAfter -cne $associationBefore) { throw 'Portable launch changed governed file associations.' }
foreach ($fixture in $fixtureDigests.GetEnumerator()) {
    if ((Get-FileHash -LiteralPath $fixture.Key -Algorithm SHA256).Hash -ne $fixture.Value) { throw 'Portable lifecycle modified a user document fixture.' }
}
[ordered]@{
    schema_version = 4
    content_free = $true
    clean_launch = 'pass'
    fixture_absence = 'pass'
    text_delivery = 'pass'
    markdown_delivery = 'pass'
    markdown_minimal = 'pass'
    markdown_alpha_beta = 'pass'
    markdown_beta_alpha = 'pass'
    blank_viewport_absence = 'pass'
    pending_source_absence = 'pass'
    active_document_identity = 'pass'
    menu_geometry = 'pass'
    toolbar_reserved_region = 'pass'
    trigger_stability = 'pass'
    popup_viewport_containment = 'pass'
    document_scroll_preserved = 'pass'
    escape_focus_restoration = 'pass'
    webview_device_scale_observed = 'pass'
    conditional_tabs = 'pass'
    direct_close = 'pass'
    association_side_effects = 'none'
    document_preservation = 'pass'
} | ConvertTo-Json | Set-Content -LiteralPath $Receipt -Encoding utf8
