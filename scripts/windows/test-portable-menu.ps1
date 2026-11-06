[CmdletBinding()]
param([switch] $ApiPreflightOnly)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($IsWindows) {
    Add-Type -AssemblyName UIAutomationClient
    $compare = [System.Windows.Automation.Automation].GetMethod('Compare', [Type[]]@([System.Windows.Automation.AutomationElement], [System.Windows.Automation.AutomationElement]))
    if ($null -eq $compare -or -not $compare.IsStatic -or $compare.ReturnType -ne [bool] -or $compare.DeclaringType -ne [System.Windows.Automation.Automation]) { throw 'actual_windows_uia_compare_api_unavailable' }
    Write-Output 'Actual Windows UIA Compare API preflight passed (real UIAutomationClient, no app launch).'
} elseif ($ApiPreflightOnly) {
    throw 'actual_windows_uia_preflight_requires_windows'
}
if ($ApiPreflightOnly) { return }
# Execute the actual coordinator with only the Windows UIA/native input boundary substituted.
$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile("$PSScriptRoot/test-portable-lifecycle.ps1", [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'Lifecycle source does not parse.' }
Add-Type -TypeDefinition @'
namespace PortableMenuTest {
 public class ScrollState { public double HorizontalScrollPercent; public double VerticalScrollPercent; }
 public class ScrollPattern { public static object Pattern = new object(); public ScrollState Current = new ScrollState(); }
 public class AutomationElement { public static object FocusedElement; public static object ControlTypeProperty = new object(); public static object NameProperty = new object(); }
 public class Automation { public static System.Func<object, object, bool> Same; public static bool Compare(object a, object b) { return Same(a,b); } }
 public class PropertyCondition { public PropertyCondition(object property, object value) {} }
 public class ControlType { public static object ScrollBar = new object(); public static object Menu = new object(); }
 public class AndCondition { public AndCondition(object a, object b) {} }
 public class Condition { public static object TrueCondition = new object(); }
 public class TextRange { public string Text; public string GetText(int count) { return Text; } }
 public class TextPattern { public static object Pattern = new object(); public TextRange DocumentRange = new TextRange(); }
 public class ValuePattern { public static object Pattern = new object(); }
 public class InvokePattern { public static object Pattern = new object(); }
 public class ScrollItemPattern { public static object Pattern = new object(); public System.Action Scroll; public void ScrollIntoView() { Scroll(); } }
 public class TreeWalker { public static TreeWalker ControlViewWalker = new TreeWalker(); public System.Func<object,object> Parent; public object GetParent(object element) { return Parent(element); } }
 public class TreeScope { public static object Descendants = new object(); }
 public class NativeInput { public static System.IntPtr Foreground; public static int Activations; public static bool CanActivate = true; public static System.IntPtr GetForegroundWindow() { return Foreground; } public static bool SetForegroundWindow(System.IntPtr value) { Activations++; if (CanActivate) Foreground = value; return CanActivate; } }
 public class SendKeys { public static bool Escaped; public static void SendWait(string value) { if(value != "{ESC}") throw new System.Exception("Unexpected key"); Escaped = true; } }
}
'@
foreach ($name in @('Assert-MenuGeometry', 'Wait-ApplicationForeground', 'Invoke-DocumentCommand')) {
    $function = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    if (-not $function) { continue }
    $source = $function.Extent.Text.Replace('System.Windows.Automation.', 'PortableMenuTest.').Replace('[GlitchpadNativeInput]', '[PortableMenuTest.NativeInput]').Replace('[System.Windows.Forms.SendKeys]', '[PortableMenuTest.SendKeys]')
    Invoke-Expression $source
}
function Rect([double]$x, [double]$y, [double]$width, [double]$height) { [pscustomobject]@{ X=$x; Y=$y; Width=$width; Height=$height; Left=$x; Top=$y; Right=$x+$width; Bottom=$y+$height } }
function Element($name, $bounds) {
    $element = [pscustomobject]@{ Current=[pscustomobject]@{ Name=$name; BoundingRectangle=$bounds; IsOffscreen=$false; IsEnabled=$true } }
    $element | Add-Member ScriptMethod TryGetCurrentPattern { param($pattern, [ref]$result) $result.Value = $script:scroll; return $true }
    $element | Add-Member ScriptMethod FindAll { param($scope, $condition) return @() }
    return $element
}
function Reset-Case {
    [PortableMenuTest.NativeInput]::Foreground = [IntPtr]::Zero
    [PortableMenuTest.NativeInput]::Activations = 0
    [PortableMenuTest.NativeInput]::CanActivate = $true
    $script:open = $false
    $script:route = ''
    $script:clickCount = 0
    $script:trigger = Element 'Menu' (Rect 0 0 48 48)
    $script:afterTrigger = $script:trigger
    $script:document = Element 'document.md' (Rect 0 48 800 552)
    $script:afterDocument = $script:document
    $script:modal = Element 'Application menu' (Rect 200 120 400 360)
    $script:menu = Element 'Glitchpad menu' (Rect 220 180 360 280)
    $script:close = Element 'Close Application menu' (Rect 540 130 48 48)
    $script:window = Element 'Glitchpad' (Rect 0 0 800 600)
    $script:scroll = [PortableMenuTest.ScrollPattern]::new()
    $script:scroll.Current.VerticalScrollPercent = 40
    $script:afterScroll = 40
    $script:focusName = 'Menu'
    [PortableMenuTest.SendKeys]::Escaped = $false
}
function Get-WindowRoot($Process) {
    if ([PortableMenuTest.SendKeys]::Escaped) {
        $script:open = $false
        $script:scroll.Current.VerticalScrollPercent = $script:afterScroll
        [PortableMenuTest.AutomationElement]::FocusedElement = Element $script:focusName (Rect 0 0 48 48)
    }
    return $script:window
}
function Wait-NamedButton($Process, $Name) {
    if ($Name -eq 'Menu') {
        if ($script:open) { throw 'Background Menu is correctly absent while modal.' }
        if ([PortableMenuTest.SendKeys]::Escaped) { return $script:afterTrigger }
        return $script:trigger
    }
    if ($Name -eq 'Close Application menu' -and $script:open) { return $script:close }
    throw 'Unexpected button route.'
}
function Find-LargestNamedElement($Window, $Name) {
    if ($Name -eq 'Application menu' -and $script:open) { return $script:modal }
    if ($Name -ne 'document.md') { throw 'Unexpected document.' }
    if ($script:open) { throw 'Background document is correctly absent while modal.' }
    if ([PortableMenuTest.SendKeys]::Escaped) { return $script:afterDocument }
    return $script:document
}
function Wait-NamedElement($Process, $Name) {
    if ($script:open -and $Name -eq 'Glitchpad menu') { return $script:menu }
    if ($script:open -and $Name -eq 'Application menu') { return $script:modal }
    throw 'Unexpected modal state.'
}
function Find-NamedElement($Window, $Name) {
    if ($script:open -and $Name -eq 'Glitchpad menu') { return $script:menu }
    return $null
}
function Invoke-NamedButton($Process, $Name) {
    if ($Name -eq 'Document tools' -and [PortableMenuTest.NativeInput]::GetForegroundWindow() -ne $Process.MainWindowHandle) { throw 'Document menu opened before native foreground ownership.' }
    $script:open = $true; $script:route = $Name
}
function Wait-ActionableNamedElement($Process, $Name, $Shortcut) {
    if ($script:route -ne 'Document tools') { throw 'Document action used the application destinations menu.' }
    return Element $Name (Rect 220 180 100 48)
}
function Click-AutomationElement($Process, $Element, $Name) { $script:open = $false; $script:clicked = $Name; $script:clickCount++ }
function Must-Fail($configure, $expectedMessage) {
    Reset-Case; & $configure
    $failed = $false
    try { Assert-MenuGeometry $script:testProcess 'document.md' } catch {
        if ($_.Exception.Message -cne $expectedMessage) { throw }
        $failed = $true
    }
    if (-not $failed) { throw "Expected geometry rejection: $expectedMessage" }
}
$script:testProcess = [Diagnostics.Process]::GetCurrentProcess()
$script:testProcess | Add-Member NoteProperty MainWindowHandle ([IntPtr]1) -Force
Reset-Case
Assert-MenuGeometry $script:testProcess 'document.md'
if ($script:open -or -not [PortableMenuTest.SendKeys]::Escaped) { throw 'Modal did not close through real Escape boundary.' }
Must-Fail { $script:modal.Current.BoundingRectangle = Rect 200 -2 400 360 } 'Application menu modal escaped the application viewport.'
Must-Fail { $script:afterTrigger = Element 'Menu' (Rect 2 0 48 48) } 'Menu trigger moved after disclosure (X).'
Must-Fail { $script:afterDocument = Element 'document.md' (Rect 0 50 800 550) } 'Document client changed after menu disclosure (Y).'
Must-Fail { $script:afterScroll = 41 } 'Menu disclosure changed document scroll position.'
Must-Fail { $script:focusName = 'Document tools' } 'Escape did not restore focus to the application menu trigger.'
Must-Fail { $script:close.Current.IsOffscreen = $true } 'Application menu close control is unavailable.'
foreach ($name in @('Edit', 'Save', 'Read')) {
    Reset-Case
    Invoke-DocumentCommand $script:testProcess $name
    if ($script:clicked -cne $name -or $script:open -or $script:clickCount -ne 1) { throw 'Document command did not complete.' }
}
Reset-Case
[PortableMenuTest.NativeInput]::Foreground = $script:testProcess.MainWindowHandle
Wait-ApplicationForeground $script:testProcess
if ([PortableMenuTest.NativeInput]::Activations -ne 0) { throw 'A foreground window was activated again.' }
Reset-Case
[PortableMenuTest.NativeInput]::CanActivate = $false
$foregroundRejected = $false
try { Wait-ApplicationForeground $script:testProcess -Seconds 0 } catch {
    if ($_.Exception.Message -cne 'portable_foreground_window_timeout') { throw }
    $foregroundRejected = $true
}
if (-not $foregroundRejected -or $script:clickCount -ne 0 -or $script:open) { throw 'Missing native foreground ownership dispatched product input.' }
Write-Output 'Portable modal coordinator and document route fixtures passed (simulated UIA boundary).'
Write-Output 'Portable foreground ownership fixtures passed (simulated native input boundary).'

# Active-menu resolution must never accept the duplicate background primary Save.
foreach ($name in @('Find-DocumentToolsMenu', 'Wait-ActionableNamedElement')) {
    $function = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    if (-not $function) { continue }
    $source = $function.Extent.Text.Replace('System.Windows.Automation.', 'PortableMenuTest.').Replace('List[PortableMenuTest.AutomationElement]', 'List[object]').Replace('[PortableMenuTest.AutomationElement] $Window', '[object] $Window')
    Invoke-Expression $source
}
[PortableMenuTest.Automation]::Same = [Func[object,object,bool]] { param($a,$b) [object]::ReferenceEquals($a,$b) }
[PortableMenuTest.TreeWalker]::ControlViewWalker.Parent = [Func[object,object]] { param($element) $element.Parent }
function Action-Element($name, $bounds, $parent) {
    $element = Element $name $bounds
    $element | Add-Member NoteProperty Parent $parent
    $element | Add-Member NoteProperty HasInvoke $true
    $element | Add-Member NoteProperty ScrollItem $null
    $element | Add-Member ScriptMethod TryGetCurrentPattern {
        param($pattern,[ref]$result)
        if ([object]::ReferenceEquals($pattern,[PortableMenuTest.InvokePattern]::Pattern)) { $result.Value=$null; return $this.HasInvoke }
        if ([object]::ReferenceEquals($pattern,[PortableMenuTest.ScrollItemPattern]::Pattern) -and $null -ne $this.ScrollItem) { $result.Value=$this.ScrollItem; return $true }
        return $false
    } -Force
    return $element
}
function Reset-ActionCase {
    Reset-Case
    $script:menuReads=0
    $script:menuAfter=1
    $script:menuPresent=$true
    $script:documentActionObservation=@{}
    $script:background=Action-Element 'Save' (Rect 48 0 48 48) $script:window
    $script:ownedMenu=Element 'Document tools' (Rect 200 100 400 480)
    $script:action=Action-Element 'Save' (Rect 220 180 100 48) $script:ownedMenu
    $script:ownedMenu | Add-Member ScriptMethod FindAll { param($scope,$condition) return @($script:action) } -Force
    $script:window | Add-Member ScriptMethod FindFirst { param($scope,$condition) $script:menuReads++; if ($script:menuPresent -and $script:menuReads -ge $script:menuAfter) { return $script:ownedMenu }; return $null }
    $script:window | Add-Member ScriptMethod FindAll { param($scope,$condition) return @($script:background,$script:action) } -Force
}
function Find-NamedElement($Window,$Name) {
    if ([object]::ReferenceEquals($Window,$script:ownedMenu)) { return $script:action }
    if ([object]::ReferenceEquals($Window,$script:window)) { return $script:background }
    return $null
}
function Reject-Action($configure) {
    Reset-ActionCase; & $configure
    $rejected=$false
    try { Wait-ActionableNamedElement $script:testProcess 'Save' -Seconds 0 | Out-Null } catch {
        if ($_.Exception.Message -cne "Portable UI did not expose actionable element 'Save'.") { throw }
        $rejected=$true
    }
    if (-not $rejected) { throw 'Unavailable or unowned document action was accepted.' }
}
Reset-ActionCase
$script:menuAfter=2
$resolved=Wait-ActionableNamedElement $script:testProcess 'Save'
if (-not [object]::ReferenceEquals($resolved,$script:action) -or $script:menuReads -lt 2) { throw 'Background primary Save satisfied the document-menu action.' }
Reject-Action { $script:menuPresent=$false }
Reject-Action { $script:action.Current.IsEnabled=$false }
Reject-Action { $script:action.Current.IsOffscreen=$true }
Reject-Action { $script:action.Parent=$script:window }
Reject-Action { $script:action.Current.BoundingRectangle=Rect 790 180 100 48 }
Reject-Action { $script:ownedMenu.Current.IsEnabled=$false }
Reject-Action { $script:ownedMenu.Current.IsOffscreen=$true }
Reset-ActionCase
$script:action.Current.IsOffscreen=$true
$script:scrollItem=[PortableMenuTest.ScrollItemPattern]::new()
$script:scrollItem.Scroll=[Action] { $script:action.Current.IsOffscreen=$false }
$script:action.ScrollItem=$script:scrollItem
$resolved=Wait-ActionableNamedElement $script:testProcess 'Save'
if (-not [object]::ReferenceEquals($resolved,$script:action) -or -not $script:documentActionObservation.scroll_requested) { throw 'Owned offscreen menu action was not brought into view through UIA.' }
Write-Output 'Portable document action scope fixtures passed (simulated UIA boundary).'

Reset-ActionCase
Invoke-DocumentCommand $script:testProcess 'Save' 'Ctrl+S'
if ($script:clicked -cne 'Save' -or $script:clickCount -ne 1 -or -not $script:documentActionObservation.click_dispatched -or -not $script:documentActionObservation.menu_owned) { throw 'Scoped document command must dispatch exactly one owned click.' }

# A wrong SDK method must remain a failure and expose only a fixed classification.
$function = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Wait-ActionableNamedElement' }, $true)
$source = $function.Extent.Text.Replace('System.Windows.Automation.', 'PortableMenuTest.').Replace('List[PortableMenuTest.AutomationElement]', 'List[object]').Replace('[PortableMenuTest.Automation]::Compare', '[PortableMenuTest.AutomationElement]::Compare')
Invoke-Expression $source
Reset-ActionCase
$rejected=$false
try { Wait-ActionableNamedElement $script:testProcess 'Save' -Seconds 0 | Out-Null } catch {
    if ($_.Exception.Message -cne "Portable UI did not expose actionable element 'Save'.") { throw }
    $rejected=$true
}
if (-not $rejected -or -not $script:documentActionObservation.resolver_error -or -not $script:documentActionObservation.resolver_method_missing) { throw 'Missing UIA method was accepted or not classified.' }
Write-Output 'Portable missing-method classification fixture passed (simulated UIA boundary).'

# A paragraph may expose text ranges without an exact full accessible Name.
foreach ($name in @('Test-WindowContainsText', 'Wait-WindowText', 'Exercise-MarkdownRecovery')) {
    $function = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    $source = $function.Extent.Text.Replace('System.Windows.Automation.', 'PortableMenuTest.').Replace('[PortableMenuTest.AutomationElement] $Window', '[object] $Window')
    Invoke-Expression $source
}
$script:pausedText='Rendered preview is paused after a contained failure. Source remains available.'
$script:recoverySourceOpened=$false
$script:recoveryRetried=$false
$script:recoveryParagraph=Element '' (Rect 0 48 800 48)
$script:recoveryText=[PortableMenuTest.TextPattern]::new()
$script:recoveryText.DocumentRange.Text=$script:pausedText + [Environment]::NewLine + 'S038 Recovery Markdown 6D2E'
$script:recoveryParagraph | Add-Member ScriptMethod TryGetCurrentPattern {
    param($pattern,[ref]$result)
    if ([object]::ReferenceEquals($pattern,[PortableMenuTest.TextPattern]::Pattern)) { $result.Value=$script:recoveryText; return $true }
    return $false
} -Force
$script:recoveryWindow=Element 'Glitchpad' (Rect 0 0 800 600)
$script:recoveryWindow | Add-Member ScriptMethod FindAll { param($scope,$condition) return @($script:recoveryParagraph) } -Force
function Get-WindowRoot($Process) { return $script:recoveryWindow }
function Find-NamedElement($Window,$Name) {
    if ($Name -eq 'fixture.md text editor' -and $script:recoverySourceOpened) { return $script:recoveryParagraph }
    return $null
}
function Wait-NamedButton($Process,$Name) { return Element $Name (Rect 0 0 48 48) }
function Invoke-NamedButton($Process,$Name) {
    if ($Name -eq 'View source') { $script:recoverySourceOpened=$true; return }
    if ($Name -eq 'Retry preview') { $script:recoveryRetried=$true; return }
    throw 'Unexpected recovery control.'
}
function Wait-NamedElement($Process,$Name) {
    if ($Name -ceq $script:pausedText) { throw 'Unlabeled recovery paragraph has no whole accessible Name.' }
    if ($Name -eq 'fixture.md text editor' -and $script:recoverySourceOpened) { return $script:recoveryParagraph }
    throw 'Recovery source editor is unavailable.'
}
function Wait-SafeMarkdownOutcome($Process,$ExpectedHeading,$RawSentinel) {
    if (-not $script:recoveryRetried -or $ExpectedHeading -cne 'S038 Recovery Markdown 6D2E') { throw 'Recovery Retry did not retain the exact controlled source.' }
}
$probeDirectory=Join-Path ([IO.Path]::GetTempPath()) ('portable-recovery-fixture-' + [Guid]::NewGuid().ToString('N'))
$probeMarker=Join-Path $probeDirectory 'markdown-failure-consumed.marker'
[IO.Directory]::CreateDirectory($probeDirectory) | Out-Null
[IO.File]::WriteAllText($probeMarker,('consumed'+[Environment]::NewLine),[Text.UTF8Encoding]::new($false))
try {
    if (Find-NamedElement $script:recoveryWindow $script:pausedText) { throw 'Fixture unexpectedly exposes a whole paragraph Name.' }
    if (-not (Test-WindowContainsText $script:recoveryWindow $script:pausedText)) { throw 'Actual TextPattern reader did not expose the exact paragraph content.' }
    Exercise-MarkdownRecovery $script:testProcess 'fixture.md' $probeDirectory
    if (-not $script:recoverySourceOpened -or -not $script:recoveryRetried) { throw 'Recovery transition or Retry was skipped.' }
    $script:recoveryText.DocumentRange.Text='Different prose'
    if (Test-WindowContainsText $script:recoveryWindow $script:pausedText) { throw 'Incorrect recovery prose was accepted.' }
} finally {
    [IO.File]::Delete($probeMarker)
    [IO.Directory]::Delete($probeDirectory)
}
Write-Output 'Portable recovery prose/TextPattern fixture passed (simulated UIA boundary).'
