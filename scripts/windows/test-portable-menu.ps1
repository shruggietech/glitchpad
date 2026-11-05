$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
# Execute the actual coordinator with only the Windows UIA/native input boundary substituted.
$tokens = $null; $parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile("$PSScriptRoot/test-portable-lifecycle.ps1", [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'Lifecycle source does not parse.' }
Add-Type -TypeDefinition @'
namespace PortableMenuTest {
 public class ScrollState { public double HorizontalScrollPercent; public double VerticalScrollPercent; }
 public class ScrollPattern { public static object Pattern = new object(); public ScrollState Current = new ScrollState(); }
 public class AutomationElement { public static object FocusedElement; public static object ControlTypeProperty = new object(); }
 public class PropertyCondition { public PropertyCondition(object property, object value) {} }
 public class ControlType { public static object ScrollBar = new object(); }
 public class TreeScope { public static object Descendants = new object(); }
 public class NativeInput { public static bool SetForegroundWindow(System.IntPtr value) { return true; } }
 public class SendKeys { public static bool Escaped; public static void SendWait(string value) { if(value != "{ESC}") throw new System.Exception("Unexpected key"); Escaped = true; } }
}
'@
foreach ($name in @('Assert-MenuGeometry', 'Invoke-DocumentCommand')) {
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
    $script:open = $false
    $script:route = ''
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
function Invoke-NamedButton($Process, $Name) { $script:open = $true; $script:route = $Name }
function Wait-ActionableNamedElement($Process, $Name, $Shortcut) {
    if ($script:route -ne 'Document tools') { throw 'Document action used the application destinations menu.' }
    return Element $Name (Rect 220 180 100 48)
}
function Click-AutomationElement($Process, $Element, $Name) { $script:open = $false; $script:clicked = $Name }
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
    if ($script:clicked -cne $name -or $script:open) { throw 'Document command did not complete.' }
}
Write-Output 'Portable modal coordinator and document route fixtures passed (simulated UIA boundary).'
