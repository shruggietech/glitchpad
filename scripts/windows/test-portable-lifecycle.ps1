[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $PortableRoot,
    [Parameter(Mandatory = $true)][string] $TextFixture,
    [Parameter(Mandatory = $true)][string] $MarkdownFixtureMinimal,
    [Parameter(Mandatory = $true)][string] $MarkdownFixtureEditable,
    [Parameter(Mandatory = $true)][string] $MarkdownFixtureRecovery,
    [Parameter(Mandatory = $true)][string] $MarkdownFixtureA,
    [Parameter(Mandatory = $true)][string] $MarkdownFixtureB,
    [Parameter(Mandatory = $true)][string] $Manifest,
    [Parameter(Mandatory = $true)][string] $ScaleMatrixReceipt,
    [Parameter(Mandatory = $true)][string] $Receipt,
    [string] $ApplicationName = 'Glitchpad.exe'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. "$PSScriptRoot/startup-diagnostics.ps1"
$startupDiagnostics = [Collections.Generic.List[object]]::new()
$script:readinessWaitKind = 'none'
$script:readinessWaitCallerLine = 0
$script:documentActionObservation = $null
$script:recoveryObservation = $null

$root = (Resolve-Path -LiteralPath $PortableRoot).Path
$manifestPath = (Resolve-Path -LiteralPath $Manifest).Path
$manifestDocument = [System.Text.Json.JsonDocument]::Parse([IO.File]::ReadAllText($manifestPath))
try {
    $manifestSourceCommit = $manifestDocument.RootElement.GetProperty('source_commit').GetString()
    $manifestWorkflowIdentity = $manifestDocument.RootElement.GetProperty('workflow_identity').GetString()
}
finally { $manifestDocument.Dispose() }
if ($manifestSourceCommit -cnotmatch '^[a-f0-9]{40}$') { throw 'Package manifest source commit is invalid.' }
if ([string]::IsNullOrWhiteSpace($manifestWorkflowIdentity)) { throw 'Package manifest workflow identity is invalid.' }
$manifestDigest = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
$scaleMatrixReceiptPath = (Resolve-Path -LiteralPath $ScaleMatrixReceipt).Path
$scaleMatrixDocument = [System.Text.Json.JsonDocument]::Parse([IO.File]::ReadAllText($scaleMatrixReceiptPath))
try {
    if ($scaleMatrixDocument.RootElement.GetProperty('candidate_manifest_sha256').GetString() -cne $manifestDigest) { throw 'Scale matrix receipt does not bind the exact package manifest.' }
    if ($scaleMatrixDocument.RootElement.GetProperty('evidence_authority').GetProperty('source_commit').GetString() -cne $manifestSourceCommit) { throw 'Scale matrix receipt source commit is stale.' }
    if (-not $scaleMatrixDocument.RootElement.GetProperty('content_free').GetBoolean()) { throw 'Scale matrix receipt is not content-free.' }
    foreach ($scale in @(100, 125, 150, 200)) {
        $property = "geometry_scale_$scale"
        if ($scaleMatrixDocument.RootElement.GetProperty($property).GetString() -cne 'pass') { throw "Scale matrix receipt did not pass $scale percent." }
    }
}
finally { $scaleMatrixDocument.Dispose() }
$application = Join-Path $root $ApplicationName
$textFixturePath = (Resolve-Path -LiteralPath $TextFixture).Path
$markdownFixtureMinimalPath = (Resolve-Path -LiteralPath $MarkdownFixtureMinimal).Path
$markdownFixtureEditablePath = (Resolve-Path -LiteralPath $MarkdownFixtureEditable).Path
$markdownFixtureRecoveryPath = (Resolve-Path -LiteralPath $MarkdownFixtureRecovery).Path
$markdownFixtureAPath = (Resolve-Path -LiteralPath $MarkdownFixtureA).Path
$markdownFixtureBPath = (Resolve-Path -LiteralPath $MarkdownFixtureB).Path
$fixtureDigests = @{
    $textFixturePath = (Get-FileHash -LiteralPath $textFixturePath -Algorithm SHA256).Hash
    $markdownFixtureMinimalPath = (Get-FileHash -LiteralPath $markdownFixtureMinimalPath -Algorithm SHA256).Hash
    $markdownFixtureRecoveryPath = (Get-FileHash -LiteralPath $markdownFixtureRecoveryPath -Algorithm SHA256).Hash
    $markdownFixtureAPath = (Get-FileHash -LiteralPath $markdownFixtureAPath -Algorithm SHA256).Hash
    $markdownFixtureBPath = (Get-FileHash -LiteralPath $markdownFixtureBPath -Algorithm SHA256).Hash
}
if (-not (Test-Path -LiteralPath $application -PathType Leaf)) { throw 'Portable executable is missing.' }
$capabilities = Get-Content -LiteralPath 'packaging/desktop/capabilities.json' -Raw | ConvertFrom-Json
$extensions = @($capabilities.families | ForEach-Object { $_.extensions } | Sort-Object -Unique)

function Save-StartupDiagnostic([Diagnostics.Process] $Process, [string] $Scenario, [Diagnostics.Stopwatch] $Clock, [bool] $Succeeded) {
    $observation = @{ exited = $false; exit_code = $null; main_window_present = $false; main_window_visible = $null; automation_descendant_present = $null; process_state_available = $false }
    try {
        $Process.Refresh()
        $observation.exited = $Process.HasExited
        if ($observation.exited) { $observation.exit_code = $Process.ExitCode }
        else {
            $handle = $Process.MainWindowHandle
            $observation.main_window_present = $handle -ne [IntPtr]::Zero
            if ($observation.main_window_present) {
                $observation.main_window_visible = [GlitchpadNativeInput]::IsWindowVisible($handle)
                try {
                    $automationRoot = [System.Windows.Automation.AutomationElement]::FromHandle($handle)
                    $observation.automation_descendant_present = $null -ne $automationRoot.FindFirst([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
                } catch { }
            }
        }
        $observation.process_state_available = $true
    } catch { }
    $record = New-PortableStartupDiagnostic -Observation $observation -Scenario $Scenario -Stage $script:readinessStage -SourceCommit $manifestSourceCommit -ManifestDigest $manifestDigest -Succeeded $Succeeded -ElapsedMilliseconds $Clock.ElapsedMilliseconds -WaitKind $script:readinessWaitKind -WaitCallerLine $script:readinessWaitCallerLine -DocumentAction $(if ($Scenario -eq 'editable') { $script:documentActionObservation } else { $null }) -RecoveryObservation $(if ($Scenario -eq 'recovery') { $script:recoveryObservation } else { $null })
    $startupDiagnostics.Add($record)
    [IO.File]::WriteAllText([IO.Path]::GetFullPath("$Receipt.startup.json"), (ConvertTo-Json -InputObject @($startupDiagnostics.ToArray()) -Depth 5) + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

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
    $script:readinessWaitKind = 'named_element'
    $script:readinessWaitCallerLine = $MyInvocation.ScriptLineNumber
    $script:readinessStage = 'named_element_wait'
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($Seconds)
    do {
        Start-Sleep -Milliseconds 250
        $window = Get-WindowRoot $Process
        if ($window) {
            $element = Find-NamedElement $window $Name
            if ($element) {
                $script:readinessStage = 'named_element_ready'
                $script:readinessWaitKind = 'none'
                $script:readinessWaitCallerLine = 0
                return $element
            }
        }
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw 'portable_named_element_timeout'
}

function Wait-ElementText([Diagnostics.Process] $Process, [string] $ElementName, [string] $ExpectedText, [int] $Seconds = 20) {
    $script:readinessStage = 'content_wait'
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
    throw 'portable_text_readiness_timeout'
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

function Wait-WindowText([Diagnostics.Process] $Process, [string] $Text, [int] $Seconds = 10, [int] $PollMilliseconds = 50) {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($Seconds)
    do {
        $window = Get-WindowRoot $Process
        if ($window -and (Test-WindowContainsText $window $Text)) { return }
        Start-Sleep -Milliseconds $PollMilliseconds
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "Portable UI did not expose text '$Text'."
}

function Wait-FileText([string] $Path, [string] $ExpectedText, [int] $Seconds = 10) {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($Seconds)
    do {
        if ((Test-Path -LiteralPath $Path -PathType Leaf) -and [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) -ceq $ExpectedText) { return }
        Start-Sleep -Milliseconds 50
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "Packaged save did not persist expected content to '$Path'."
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
    $script:readinessWaitKind = 'named_button'
    $script:readinessWaitCallerLine = $MyInvocation.ScriptLineNumber
    $script:readinessStage = 'named_button_wait'
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($Seconds)
    $condition = New-Object System.Windows.Automation.AndCondition(
        (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $Name)),
        (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button))
    )
    do {
        $window = Get-WindowRoot $Process
        if ($window) {
            $button = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
            if ($button) {
                $script:readinessStage = 'named_button_ready'
                $script:readinessWaitKind = 'none'
                $script:readinessWaitCallerLine = 0
                return $button
            }
        }
        Start-Sleep -Milliseconds 50
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "Portable UI did not expose button '$Name'."
}

function Find-DocumentToolsMenu([System.Windows.Automation.AutomationElement] $Window) {
    $condition = New-Object System.Windows.Automation.AndCondition(
        (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'Document tools')),
        (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Menu))
    )
    return $Window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
}

function Wait-ActionableNamedElement([Diagnostics.Process] $Process, [string] $Name, [string] $Shortcut = '', [int] $Seconds = 10) {
    $script:documentActionObservation['phase'] = 'action_wait'
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($Seconds)
    do {
        $window = Get-WindowRoot $Process
        $menu = if ($window) { Find-DocumentToolsMenu $window } else { $null }
        $script:documentActionObservation['menu_available'] = $null -ne $menu
        if ($menu -and -not $menu.Current.IsOffscreen -and $menu.Current.IsEnabled) {
            $candidates = [Collections.Generic.List[System.Windows.Automation.AutomationElement]]::new()
            $exact = Find-NamedElement $menu $Name
            if ($exact) { $candidates.Add($exact) }
            if ($Shortcut) {
                $shortcutName = '^{0}\s*{1}$' -f [Regex]::Escape($Name), [Regex]::Escape($Shortcut)
                foreach ($candidate in $menu.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)) {
                    try { if ($candidate.Current.Name -match $shortcutName) { $candidates.Add($candidate) } }
                    catch { continue }
                }
            }
            $script:documentActionObservation['candidate_available'] = $candidates.Count -gt 0
            foreach ($candidate in $candidates) {
                try {
                    $owner = $candidate
                    while ($owner -and -not [System.Windows.Automation.Automation]::Compare($owner, $menu)) {
                        $owner = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($owner)
                    }
                    $script:documentActionObservation['menu_owned'] = $null -ne $owner
                    if (-not $owner) { continue }
                    $element = $candidate
                    while ($element -and -not [System.Windows.Automation.Automation]::Compare($element, $menu)) {
                        $patternObject = $null
                        if ($element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$patternObject)) {
                            $script:documentActionObservation['enabled'] = $element.Current.IsEnabled
                            if (-not $element.Current.IsEnabled) { break }
                            $scrollItem = $null
                            if ($element.TryGetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern, [ref]$scrollItem)) {
                                $script:documentActionObservation['scroll_requested'] = $true
                                ([System.Windows.Automation.ScrollItemPattern]$scrollItem).ScrollIntoView()
                            }
                            $bounds = $element.Current.BoundingRectangle
                            $windowBounds = $window.Current.BoundingRectangle
                            $visible = -not $element.Current.IsOffscreen -and $bounds.Width -gt 0 -and $bounds.Height -gt 0 -and $bounds.Left -ge $windowBounds.Left -and $bounds.Top -ge $windowBounds.Top -and $bounds.Right -le $windowBounds.Right -and $bounds.Bottom -le $windowBounds.Bottom
                            $script:documentActionObservation['visible'] = $visible
                            if ($visible) {
                                $script:documentActionObservation['phase'] = 'action_ready'
                                return $element
                            }
                            break
                        }
                        $element = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($element)
                    }
                }
                catch {
                    $script:documentActionObservation['resolver_error'] = $true
                    if ($_.FullyQualifiedErrorId -eq 'MethodNotFound') { $script:documentActionObservation['resolver_method_missing'] = $true }
                    continue
                }
            }
        }
        Start-Sleep -Milliseconds 50
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw "Portable UI did not expose actionable element '$Name'."
}

function Wait-ApplicationForeground([Diagnostics.Process] $Process, [int] $Seconds = 10) {
    $script:readinessWaitKind = 'foreground'
    $script:readinessWaitCallerLine = $MyInvocation.ScriptLineNumber
    $script:readinessStage = 'foreground_wait'
    $Process.Refresh()
    $handle = $Process.MainWindowHandle
    if ($handle -eq [IntPtr]::Zero) { throw 'portable_foreground_window_missing' }
    if ([GlitchpadNativeInput]::GetForegroundWindow() -ne $handle) {
        [GlitchpadNativeInput]::SetForegroundWindow($handle) | Out-Null
    }
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($Seconds)
    do {
        if ([GlitchpadNativeInput]::GetForegroundWindow() -eq $handle) {
            $script:readinessStage = 'foreground_ready'
            $script:readinessWaitKind = 'none'
            $script:readinessWaitCallerLine = 0
            return
        }
        Start-Sleep -Milliseconds 50
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw 'portable_foreground_window_timeout'
}

function Click-AutomationElement([Diagnostics.Process] $Process, [System.Windows.Automation.AutomationElement] $Element, [string] $Description) {
    # Foreground activation can change modal ownership and screen geometry.
    Wait-ApplicationForeground $Process
    if ($Element.Current.IsOffscreen) { throw "Portable UI element '$Description' is offscreen and cannot be clicked." }
    try {
        $point = $Element.GetClickablePoint()
        $clickX = $point.X
        $clickY = $point.Y
    }
    catch {
        $bounds = $Element.Current.BoundingRectangle
        if ($bounds.Width -le 0 -or $bounds.Height -le 0) { throw "Portable UI element '$Description' has no usable click geometry." }
        $clickX = $bounds.X + ($bounds.Width / 2)
        $clickY = $bounds.Y + ($bounds.Height / 2)
    }
    $previousCursor = [System.Windows.Forms.Cursor]::Position
    try {
        [GlitchpadNativeInput]::SetCursorPos([Math]::Round($clickX), [Math]::Round($clickY)) | Out-Null
        Start-Sleep -Milliseconds 50
        $foreground = [GlitchpadNativeInput]::GetForegroundWindow() -eq $Process.MainWindowHandle
        if ($script:documentActionObservation) { $script:documentActionObservation['foreground_at_click'] = $foreground }
        if (-not $foreground) { throw 'portable_foreground_lost_before_click' }
        [GlitchpadNativeInput]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
        [GlitchpadNativeInput]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
    }
    finally {
        [GlitchpadNativeInput]::SetCursorPos($previousCursor.X, $previousCursor.Y) | Out-Null
    }
}

function Invoke-AutomationElement([Diagnostics.Process] $Process, [System.Windows.Automation.AutomationElement] $Element, [string] $Description) {
    $patternObject = $null
    if ($Element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$patternObject)) {
        try {
            ([System.Windows.Automation.InvokePattern]$patternObject).Invoke()
            return
        }
        catch { }
    }
    Click-AutomationElement $Process $Element $Description
}

function Invoke-NamedButton([Diagnostics.Process] $Process, [string] $Name) {
    $button = Wait-NamedButton $Process $Name
    Invoke-AutomationElement $Process $button $Name
}

function Invoke-DocumentCommand([Diagnostics.Process] $Process, [string] $Name, [string] $Shortcut = '') {
    $script:documentActionObservation = @{ phase = 'menu_wait'; foreground_before_menu = $false; foreground_at_click = $null; menu_available = $false; candidate_available = $false; menu_owned = $false; enabled = $null; visible = $null; scroll_requested = $false; click_dispatched = $false; resolver_error = $false; resolver_method_missing = $false }
    Wait-ApplicationForeground $Process
    $script:documentActionObservation['foreground_before_menu'] = $true
    Invoke-NamedButton $Process 'Document tools'
    $item = Wait-ActionableNamedElement $Process $Name $Shortcut
    Click-AutomationElement $Process $item $Name
    $script:documentActionObservation['click_dispatched'] = $true
    $script:documentActionObservation['phase'] = 'click_dispatched'
}

function Wait-EditorNativeFocus([Diagnostics.Process] $Process, [string] $EditorName) {
    $deadline = [DateTimeOffset]::UtcNow.AddSeconds(10)
    $focusRequested = $false
    $consecutiveFocused = 0
    $script:readinessStage = 'editor_focus_wait'
    $script:readinessWaitKind = 'editor_focus'
    $script:readinessWaitCallerLine = $MyInvocation.ScriptLineNumber
    do {
        $window = Get-WindowRoot $Process
        $menu = if ($window) { Find-DocumentToolsMenu $window } else { $null }
        $menuClosed = -not $menu -or $menu.Current.IsOffscreen
        $script:documentActionObservation['editor_menu_closed'] = $menuClosed
        if ($window -and $menuClosed) {
            $editor = Find-NamedElement $window $EditorName
            if ($editor -and $editor.Current.IsEnabled -and -not $editor.Current.IsOffscreen) {
                if (-not $focusRequested) {
                    $editor.SetFocus()
                    $focusRequested = $true
                    $script:documentActionObservation['editor_focus_requested'] = $true
                }
                $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
                $ownsFocus = $false
                for ($depth = 0; $focused -and $depth -lt 16; $depth++) {
                    if ([System.Windows.Automation.Automation]::Compare($focused, $editor)) { $ownsFocus = $true; break }
                    $focused = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($focused)
                }
                $foreground = [GlitchpadNativeInput]::GetForegroundWindow() -eq $Process.MainWindowHandle
                $script:documentActionObservation['editor_focus_observed'] = $ownsFocus
                $script:documentActionObservation['editor_foreground'] = $foreground
                if ($ownsFocus -and $foreground) { $consecutiveFocused++ } else { $consecutiveFocused = 0 }
                if ($consecutiveFocused -ge 2) {
                    $script:readinessStage = 'editor_focus_ready'
                    $script:readinessWaitKind = 'none'
                    $script:readinessWaitCallerLine = 0
                    return $editor
                }
            }
        } else { $consecutiveFocused = 0 }
        Start-Sleep -Milliseconds 50
    } while ([DateTimeOffset]::UtcNow -lt $deadline)
    throw 'portable_editor_native_focus_timeout'
}

function Exercise-MarkdownEditSavePreview([Diagnostics.Process] $Process, [string] $Path) {
    $name = [IO.Path]::GetFileName($Path)
    $initialText = 'S038 Editable Markdown 1A2B'
    $savedText = 'S038 Saved Markdown 4C7D'
    Wait-NamedElement $Process $initialText | Out-Null
    Invoke-DocumentCommand $Process 'Edit'
    $editor = Wait-NamedElement $Process ("{0} text editor" -f $name)
    $editor = Wait-EditorNativeFocus $Process ("{0} text editor" -f $name)
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    [System.Windows.Forms.SendKeys]::SendWait($savedText)
    Wait-WindowText $Process $savedText
    Invoke-DocumentCommand $Process 'Save' 'Ctrl+S'
    $script:documentActionObservation['phase'] = 'save_wait'
    try { Wait-FileText $Path $savedText }
    catch {
        $saveFailure = $_
        try {
            $window = Get-WindowRoot $Process
            if ($window) {
                $script:documentActionObservation['menu_available'] = $null -ne (Find-DocumentToolsMenu $window)
                $script:documentActionObservation['feedback_saved'] = Test-WindowContainsText $window 'Saved after native verification.'
                $script:documentActionObservation['feedback_pending'] = Test-WindowContainsText $window 'Saving. Waiting for a verified native write receipt.'
                $script:documentActionObservation['feedback_cancelled'] = Test-WindowContainsText $window 'Cancelled. Your document and edits remain available.'
                $script:documentActionObservation['feedback_unavailable'] = Test-WindowContainsText $window 'This action is unavailable for the current document.'
                $script:documentActionObservation['feedback_default_failure'] = Test-WindowContainsText $window 'Save did not complete. Try again or choose another destination. Your edits remain open.'
            }
        } catch { }
        throw $saveFailure
    }
    Invoke-DocumentCommand $Process 'Read'
    Wait-SafeMarkdownOutcome $Process $savedText 'S038_EDIT_RAW_SENTINEL'
    if ([IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) -ne $savedText) {
        throw 'The exact packaged application did not persist the expected Markdown edit.'
    }
}

function Exercise-MarkdownRecovery([Diagnostics.Process] $Process, [string] $Path, [string] $ProbeDirectory) {
    $name = [IO.Path]::GetFileName($Path)
    $pausedText = 'Rendered preview is paused after a contained failure. Source remains available.'
    $script:recoveryObservation = @{ phase = 'view_source'; view_source_invoked = $false; capture_available = $false }
    try {
        Wait-NamedButton $Process 'View source' | Out-Null
        Invoke-NamedButton $Process 'View source'
        $script:recoveryObservation['view_source_invoked'] = $true
        $script:recoveryObservation['phase'] = 'paused_content'
        $script:readinessStage = 'content_wait'
        Wait-WindowText $Process $pausedText -Seconds 20 -PollMilliseconds 250
        $script:recoveryObservation['phase'] = 'source_editor'
        Wait-NamedElement $Process ("{0} text editor" -f $name) | Out-Null
        $script:recoveryObservation['phase'] = 'source_content'
        Wait-WindowText $Process 'S038 Recovery Markdown 6D2E'
        $script:recoveryObservation['phase'] = 'retry_preview'
        Invoke-NamedButton $Process 'Retry preview'
        Wait-SafeMarkdownOutcome $Process 'S038 Recovery Markdown 6D2E' 'S038_RECOVERY_RAW_SENTINEL'
        if (-not (Test-Path -LiteralPath (Join-Path $ProbeDirectory 'markdown-failure-consumed.marker') -PathType Leaf)) {
            throw 'The packaged application did not consume the requested Markdown failure.'
        }
    }
    catch {
        $recoveryFailure = $_
        try {
            $window = Get-WindowRoot $Process
            if ($window) {
                $script:recoveryObservation['paused_text_present'] = Test-WindowContainsText $window $pausedText
                $script:recoveryObservation['source_editor_present'] = $null -ne (Find-NamedElement $window ("{0} text editor" -f $name))
                $script:recoveryObservation['source_marker_present'] = Test-WindowContainsText $window 'S038 Recovery Markdown 6D2E'
                $script:recoveryObservation['retry_present'] = $null -ne (Find-NamedElement $window 'Retry preview')
                $script:recoveryObservation['view_source_present'] = $null -ne (Find-NamedElement $window 'View source')
                $script:recoveryObservation['contained_failure_present'] = (Test-WindowContainsText $window 'This document could not be displayed. The application remains available.') -or (Test-WindowContainsText $window 'Markdown preview failed safely. Source remains available.')
                $script:recoveryObservation['probe_consumed'] = Test-Path -LiteralPath (Join-Path $ProbeDirectory 'markdown-failure-consumed.marker') -PathType Leaf
                $script:recoveryObservation['capture_available'] = $true
            }
        } catch { }
        throw $recoveryFailure
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
    # TaskSurface owns accessibility and focus while open. Background controls and
    # the document are inert; measure them again only after Escape closes the modal.
    $window = Get-WindowRoot $Process
    $surface = Find-LargestNamedElement $window 'Application menu'
    if (-not $surface) { throw 'The application menu modal could not be measured.' }
    $close = Wait-NamedButton $Process 'Close Application menu'
    if ($close.Current.IsOffscreen -or -not $close.Current.IsEnabled) { throw 'Application menu close control is unavailable.' }
    $windowBounds = $window.Current.BoundingRectangle
    $surfaceBounds = $surface.Current.BoundingRectangle
    foreach ($rect in @($surfaceBounds, $menu.Current.BoundingRectangle, $close.Current.BoundingRectangle)) {
        if ($rect.Width -le 0 -or $rect.Height -le 0 -or $rect.Left -lt ($windowBounds.Left - 1) -or $rect.Top -lt ($windowBounds.Top - 1) -or $rect.Right -gt ($windowBounds.Right + 1) -or $rect.Bottom -gt ($windowBounds.Bottom + 1)) { throw 'Application menu modal escaped the application viewport.' }
    }
    $scrollCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::ScrollBar)
    foreach ($scrollbar in $surface.FindAll([System.Windows.Automation.TreeScope]::Descendants, $scrollCondition)) {
        $scrollRect = $scrollbar.Current.BoundingRectangle
        $closeRect = $close.Current.BoundingRectangle
        if (-not $scrollbar.Current.IsOffscreen -and $closeRect.Left -lt $scrollRect.Right -and $closeRect.Right -gt $scrollRect.Left -and $closeRect.Top -lt $scrollRect.Bottom -and $closeRect.Bottom -gt $scrollRect.Top) { throw 'Application menu close control intersects its scrollbar hit region.' }
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
    if (-not $documentAfterElement) { throw 'The active document client region did not return after menu dismissal.' }
    $documentAfter = $documentAfterElement.Current.BoundingRectangle
    foreach ($field in @('X', 'Y', 'Width', 'Height')) {
        if ([Math]::Abs($documentBefore.$field - $documentAfter.$field) -gt 1) { throw "Document client changed after menu disclosure ($field)." }
    }
    if ($scrollBefore) {
        $scrollAfterObject = $null
        if (-not $documentAfterElement.TryGetCurrentPattern([System.Windows.Automation.ScrollPattern]::Pattern, [ref]$scrollAfterObject)) { throw 'Document scroll observation disappeared after menu dismissal.' }
        $scrollAfter = @(([System.Windows.Automation.ScrollPattern]$scrollAfterObject).Current.HorizontalScrollPercent, ([System.Windows.Automation.ScrollPattern]$scrollAfterObject).Current.VerticalScrollPercent)
        if ($scrollBefore[0] -ne $scrollAfter[0] -or $scrollBefore[1] -ne $scrollAfter[1]) { throw 'Menu disclosure changed document scroll position.' }
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
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr window);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint flags, uint x, uint y, uint data, UIntPtr extraInfo);
}
'@
$isolatedState = Join-Path ([IO.Path]::GetTempPath()) ("glitchpad-s027-{0}" -f [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $isolatedState -Force | Out-Null
# Extend the licensed governed corpus with an original Unicode recovery case.
# The owner-reported input bytes remain unavailable; this is a synthetic regression.
$markdownGovernedFixturePath = Join-Path $isolatedState 's046-governed.md'
$governedMarkdownSource = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../fixtures/markdown/sources/kitchen-sink.md'))
$governedMarkdown = [IO.File]::ReadAllText($governedMarkdownSource, [Text.Encoding]::UTF8) + @'

# S046 Governed Markdown A4D9

Unicode café 漢字 🦄

[S046_GOVERNED_RAW_SENTINEL]: https://example.invalid/s046
'@
[IO.File]::WriteAllText($markdownGovernedFixturePath, $governedMarkdown, [Text.UTF8Encoding]::new($false))
$governedMarkdownDigest = (Get-FileHash -LiteralPath $markdownGovernedFixturePath -Algorithm SHA256).Hash
$isolatedEnvironment = @{ APPDATA = $isolatedState; LOCALAPPDATA = $isolatedState }
$scenarioClock = [Diagnostics.Stopwatch]::StartNew()
$script:readinessStage = 'launch'
$scenarioSucceeded = $false
$process = Start-Process -FilePath $application -PassThru -WindowStyle Normal -Environment $isolatedEnvironment
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
    Send-MarkdownDelivery $markdownGovernedFixturePath $process 'S046 Governed Markdown A4D9' 'S046_GOVERNED_RAW_SENTINEL'
    Wait-NamedElement $process 'Glitchpad Markdown Fixture' | Out-Null
    Wait-WindowText $process 'Unicode café 漢字 🦄'
    Wait-WindowText $process 'Tables'
    Wait-WindowText $process 'Original fixture footnote.'
    if ((Get-FileHash -LiteralPath $markdownGovernedFixturePath -Algorithm SHA256).Hash -ne $governedMarkdownDigest) { throw 'Governed Markdown delivery modified its source bytes.' }
    Close-Document $process $markdownGovernedFixturePath
    Wait-ElementText $process ("{0} text editor" -f [IO.Path]::GetFileName($textFixturePath)) 'S027 TXT CONTENT 7E5A'
    $scenarioSucceeded = $true
}
finally {
    try { Save-StartupDiagnostic $process 'clean' $scenarioClock $scenarioSucceeded }
    finally {
        if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
        Remove-Item -LiteralPath $isolatedState -Recurse -Force -ErrorAction SilentlyContinue
    }
}


$reverseState = Join-Path ([IO.Path]::GetTempPath()) ("glitchpad-s030-reverse-{0}" -f [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $reverseState -Force | Out-Null
$isolatedEnvironment = @{ APPDATA = $reverseState; LOCALAPPDATA = $reverseState }
$scenarioClock = [Diagnostics.Stopwatch]::StartNew()
$script:readinessStage = 'launch'
$scenarioSucceeded = $false
$reverseProcess = Start-Process -FilePath $application -PassThru -WindowStyle Normal -Environment $isolatedEnvironment
try {
    Wait-NamedElement $reverseProcess 'Open file…' | Out-Null
    Send-MarkdownDelivery $markdownFixtureBPath $reverseProcess 'S030 Markdown Beta 9D4E' 'S030_BETA_RAW_SENTINEL'
    Wait-NamedElement $reverseProcess 's030-beta.md diagram 1' | Out-Null
    if ((Get-TabCount $reverseProcess) -ne 0) { throw 'The first reverse-order document exposed tab chrome.' }
    Send-MarkdownDelivery $markdownFixtureAPath $reverseProcess 'S030 Markdown Alpha 2B7C' 'S030_ALPHA_RAW_SENTINEL'
    Wait-WindowText $reverseProcess 'S030 Alpha Footnote 6A1E'
    if ((Get-TabCount $reverseProcess) -ne 2) { throw 'The reverse-order pair did not expose exactly two tabs.' }
    $scenarioSucceeded = $true
}
finally {
    try { Save-StartupDiagnostic $reverseProcess 'reverse' $scenarioClock $scenarioSucceeded }
    finally {
        if (-not $reverseProcess.HasExited) { Stop-Process -Id $reverseProcess.Id -Force }
        Remove-Item -LiteralPath $reverseState -Recurse -Force -ErrorAction SilentlyContinue
    }
}
$minimalState = Join-Path ([IO.Path]::GetTempPath()) ("glitchpad-s035-minimal-{0}" -f [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $minimalState -Force | Out-Null
$minimalEnvironment = @{ APPDATA = $minimalState; LOCALAPPDATA = $minimalState }
$scenarioClock = [Diagnostics.Stopwatch]::StartNew()
$script:readinessStage = 'launch'
$scenarioSucceeded = $false
$minimalProcess = Start-Process -FilePath $application -ArgumentList ('"{0}"' -f $markdownFixtureMinimalPath) -PassThru -WindowStyle Normal -Environment $minimalEnvironment
try {
    Wait-NamedElement $minimalProcess 'S035 Minimal Markdown 5E8A' | Out-Null
    if ((Get-TabCount $minimalProcess) -ne 0) { throw 'A single minimal Markdown document exposed tab chrome.' }
    $scenarioSucceeded = $true
}
finally {
    try { Save-StartupDiagnostic $minimalProcess 'minimal' $scenarioClock $scenarioSucceeded }
    finally {
        if (-not $minimalProcess.HasExited) { Stop-Process -Id $minimalProcess.Id -Force }
        Remove-Item -LiteralPath $minimalState -Recurse -Force -ErrorAction SilentlyContinue
    }
}
$editableState = Join-Path ([IO.Path]::GetTempPath()) ("glitchpad-s038-editable-{0}" -f [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $editableState -Force | Out-Null
$isolatedEnvironment = @{ APPDATA = $editableState; LOCALAPPDATA = $editableState }
$scenarioClock = [Diagnostics.Stopwatch]::StartNew()
$script:readinessStage = 'launch'
$scenarioSucceeded = $false
$editableProcess = Start-Process -FilePath $application -ArgumentList ('"{0}"' -f $markdownFixtureEditablePath) -PassThru -WindowStyle Normal -Environment $isolatedEnvironment
try {
    Exercise-MarkdownEditSavePreview $editableProcess $markdownFixtureEditablePath
    $scenarioSucceeded = $true
}
finally {
    try { Save-StartupDiagnostic $editableProcess 'editable' $scenarioClock $scenarioSucceeded }
    finally {
        if (-not $editableProcess.HasExited) { Stop-Process -Id $editableProcess.Id -Force }
        Remove-Item -LiteralPath $editableState -Recurse -Force -ErrorAction SilentlyContinue
    }
}
$recoveryState = Join-Path ([IO.Path]::GetTempPath()) ("glitchpad-s038-recovery-{0}" -f [Guid]::NewGuid().ToString('N'))
$recoveryProbe = Join-Path $recoveryState 'probe'
New-Item -ItemType Directory -Path $recoveryProbe -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $recoveryProbe 'enabled.marker'), "enabled`n", [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $recoveryProbe 'markdown-failure-request.marker'), "requested`n", [Text.UTF8Encoding]::new($false))
$recoveryEnvironment = @{ APPDATA = $recoveryState; LOCALAPPDATA = $recoveryState; GLITCHPAD_LIFECYCLE_PROBE_DIR = $recoveryProbe }
$scenarioClock = [Diagnostics.Stopwatch]::StartNew()
$script:readinessStage = 'launch'
$scenarioSucceeded = $false
$recoveryProcess = Start-Process -FilePath $application -ArgumentList ('"{0}"' -f $markdownFixtureRecoveryPath) -PassThru -WindowStyle Normal -Environment $recoveryEnvironment
try {
    Exercise-MarkdownRecovery $recoveryProcess $markdownFixtureRecoveryPath $recoveryProbe
    $scenarioSucceeded = $true
}
finally {
    try { Save-StartupDiagnostic $recoveryProcess 'recovery' $scenarioClock $scenarioSucceeded }
    finally {
        if (-not $recoveryProcess.HasExited) { Stop-Process -Id $recoveryProcess.Id -Force }
        Remove-Item -LiteralPath $recoveryState -Recurse -Force -ErrorAction SilentlyContinue
    }
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
$scenarioClock = [Diagnostics.Stopwatch]::StartNew()
$script:readinessStage = 'launch'
$scenarioSucceeded = $false
$webviewProcess = Start-Process -FilePath $application -ArgumentList ('"{0}"' -f $markdownFixtureMinimalPath) -PassThru -WindowStyle Normal -Environment $webviewEnvironment
try {
    Wait-NamedElement $webviewProcess 'S035 Minimal Markdown 5E8A' | Out-Null
    Wait-DeviceScaleMarker $webviewProbe | Out-Null
    Assert-MenuGeometry $webviewProcess ([IO.Path]::GetFileName($markdownFixtureMinimalPath))
    $scenarioSucceeded = $true
}
finally {
    try { Save-StartupDiagnostic $webviewProcess 'webview' $scenarioClock $scenarioSucceeded }
    finally {
        if (-not $webviewProcess.HasExited) { Stop-Process -Id $webviewProcess.Id -Force }
        Remove-Item -LiteralPath $webviewState -Recurse -Force -ErrorAction SilentlyContinue
    }
}
$associationAfter = Get-AssociationSnapshot | ConvertTo-Json -Compress
if ($associationAfter -cne $associationBefore) { throw 'Portable launch changed governed file associations.' }
foreach ($fixture in $fixtureDigests.GetEnumerator()) {
    if ((Get-FileHash -LiteralPath $fixture.Key -Algorithm SHA256).Hash -ne $fixture.Value) { throw 'Portable lifecycle modified a user document fixture.' }
}
[ordered]@{
    schema_version = 5
    candidate_manifest_sha256 = $manifestDigest
    evidence_authority = [ordered]@{
        kind = 'github_actions_workflow'
        workflow_identity = $manifestWorkflowIdentity
        source_commit = $manifestSourceCommit
    }
    content_free = $true
    clean_launch = 'pass'
    fixture_absence = 'pass'
    text_delivery = 'pass'
    markdown_delivery = 'pass'
    markdown_governed_corpus = 'pass'
    reported_markdown_input = 'unavailable_not_replayed'
    markdown_minimal = 'pass'
    markdown_edit_save_preview = 'pass'
    document_scoped_recovery = 'pass'
    markdown_alpha_beta = 'pass'
    markdown_beta_alpha = 'pass'
    blank_viewport_absence = 'pass'
    pending_source_absence = 'pass'
    active_document_identity = 'pass'
    menu_geometry = 'pass'
    toolbar_reserved_region = 'pass'
    geometry_scale_100 = 'pass'
    geometry_scale_125 = 'pass'
    geometry_scale_150 = 'pass'
    geometry_scale_200 = 'pass'
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
