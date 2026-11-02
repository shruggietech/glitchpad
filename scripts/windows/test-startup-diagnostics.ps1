. "$PSScriptRoot/startup-diagnostics.ps1"
$observation = @{ exited = $true; exit_code = 7; main_window_present = $false; process_state_available = $true; title = 'private-title'; path = '/private/user/document.pdf'; arguments = 'private-arguments' }
$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario clean -Stage named_element_wait -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $false -ElapsedMilliseconds 20000
$json = $receipt | ConvertTo-Json -Compress
if ($json -match 'private-title|private-arguments|document.pdf|/private') { throw 'Diagnostic exposed non-allowlisted input.' }
if ($receipt.exit_code -ne 7 -or $receipt.main_window_present -or $receipt.succeeded) { throw 'Exited process classification is incorrect.' }
$observation.exited = $false
$observation.main_window_present = $true
$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario webview -Stage scenario_checks -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $true -ElapsedMilliseconds 1
if ($null -ne $receipt.exit_code -or -not $receipt.main_window_present) { throw 'Running process classification is incorrect.' }
$refused = $false
try { New-PortableStartupDiagnostic -Observation $observation -Scenario 'private-path' -Stage launch -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $false -ElapsedMilliseconds 0 | Out-Null } catch { $refused = $true }
if (-not $refused) { throw 'Arbitrary scenario was admitted.' }
$observation.main_window_visible = $false
$observation.automation_descendant_present = $true
$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario clean -Stage named_element_wait -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $false -ElapsedMilliseconds 20000
if ($null -eq $receipt.main_window_visible -or $receipt.main_window_visible -or -not $receipt.automation_descendant_present) { throw 'Visibility and accessibility diagnostics are missing or incorrect.' }
$observation.main_window_visible = $null
$observation.automation_descendant_present = $null
$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario clean -Stage launch -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $false -ElapsedMilliseconds 0
if ($null -ne $receipt.main_window_visible -or $null -ne $receipt.automation_descendant_present) { throw 'Unavailable visibility diagnostics must remain unknown.' }
Write-Output 'Content-free portable startup diagnostic tests passed.'
