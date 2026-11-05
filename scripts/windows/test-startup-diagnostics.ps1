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

$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario clean -Stage named_element_wait -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $false -ElapsedMilliseconds 20000 -WaitKind named_element -WaitCallerLine 500
if ($receipt.readiness_wait.function -cne 'Wait-NamedElement' -or $receipt.readiness_wait.caller_line -ne 500) { throw 'Failed named readiness caller site was not retained.' }
$json = $receipt | ConvertTo-Json -Depth 4 -Compress
if ($json -match 'private-title|private-arguments|document.pdf|/private|\\') { throw 'Caller-site observation exposed private text or a path.' }
$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario clean -Stage named_element_ready -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $true -ElapsedMilliseconds 1 -WaitKind named_element -WaitCallerLine 500
if ($receipt.Contains('readiness_wait')) { throw 'Successful readiness must omit failure-only caller diagnostics.' }
foreach ($arguments in @(@{ WaitKind = 'private-control' }, @{ WaitCallerLine = -1 }, @{ WaitCallerLine = 100001 })) {
    $refused = $false
    try { New-PortableStartupDiagnostic -Observation $observation -Scenario clean -Stage named_element_wait -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $false -ElapsedMilliseconds 20000 @arguments | Out-Null } catch { $refused = $true }
    if (-not $refused) { throw 'Non-allowlisted readiness site was admitted.' }
}
Write-Output 'Failure-only named readiness caller-site tests passed.'

$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario clean -Stage named_button_wait -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $false -ElapsedMilliseconds 10000 -WaitKind named_button -WaitCallerLine 405
if ($receipt.readiness_wait.function -cne 'Wait-NamedButton' -or $receipt.readiness_wait.caller_line -ne 405) { throw 'Failed button caller site was not retained.' }
$json = $receipt | ConvertTo-Json -Depth 4 -Compress
if ($json -match 'private-title|private-arguments|document.pdf|/private|\\') { throw 'Button caller-site observation exposed private input.' }
$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario clean -Stage named_button_ready -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $true -ElapsedMilliseconds 1 -WaitKind named_button -WaitCallerLine 405
if ($receipt.Contains('readiness_wait')) { throw 'Successful button readiness must omit failure-only caller diagnostics.' }
Write-Output 'Failure-only button readiness caller-site tests passed.'

$action = @{ phase = 'save_wait'; menu_available = $false; candidate_available = $true; menu_owned = $true; enabled = $true; visible = $true; scroll_requested = $true; click_dispatched = $true; feedback_pending = $false; control_name = 'private-control'; document_text = 'private-document'; path = '/private/file.md' }
$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario editable -Stage named_button_ready -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $false -ElapsedMilliseconds 10000 -DocumentAction $action
if ($receipt.document_action.phase -cne 'save_wait' -or -not $receipt.document_action.menu_owned -or -not $receipt.document_action.click_dispatched -or $receipt.document_action.menu_available -or $receipt.document_action.feedback_pending) { throw 'Document action boolean/phase classification is incorrect.' }
if ($null -ne $receipt.document_action.feedback_saved) { throw 'Unobserved action outcome must remain unknown.' }
$json = $receipt | ConvertTo-Json -Depth 4 -Compress
if ($json -match 'private-control|private-document|/private|file.md|control_name|document_text') { throw 'Document action observation exposed non-allowlisted input.' }
$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario editable -Stage named_button_ready -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $true -ElapsedMilliseconds 1 -DocumentAction $action
if ($receipt.Contains('document_action')) { throw 'Successful scenario must omit failure-only action diagnostics.' }
$action.phase = 'private-phase'
$refused = $false
try { New-PortableStartupDiagnostic -Observation $observation -Scenario editable -Stage named_button_ready -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $false -ElapsedMilliseconds 1 -DocumentAction $action | Out-Null } catch { $refused = $true }
if (-not $refused) { throw 'Arbitrary document action phase was admitted.' }
Write-Output 'Failure-only document action allowlist tests passed.'

$action = @{ phase = 'action_wait'; resolver_error = $true; resolver_method_missing = $true; exception_message = 'private-error-content'; error_id = 'private-error-id' }
$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario editable -Stage named_button_ready -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $false -ElapsedMilliseconds 10000 -DocumentAction $action
if (-not $receipt.document_action.resolver_error -or -not $receipt.document_action.resolver_method_missing) { throw 'Fixed UIA error classification is missing.' }
$json = $receipt | ConvertTo-Json -Depth 4 -Compress
if ($json -match 'private-error|exception_message|error_id') { throw 'Raw UIA error was included in failure observations.' }
Write-Output 'Failure-only UIA error classification redaction tests passed.'

$recovery = @{ phase = 'paused_content'; view_source_invoked = $true; capture_available = $true; paused_text_present = $true; source_editor_present = $true; retry_present = $true; view_source_present = $false; document_text = 'private-document'; control_name = 'private-control' }
$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario recovery -Stage content_wait -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $false -ElapsedMilliseconds 20000 -RecoveryObservation $recovery
if ($receipt.recovery_observation.phase -cne 'paused_content' -or -not $receipt.recovery_observation.paused_text_present -or -not $receipt.recovery_observation.source_editor_present -or $receipt.recovery_observation.view_source_present -or $null -ne $receipt.recovery_observation.probe_consumed) { throw 'Recovery phase/boolean/unknown classification is incorrect.' }
$json = $receipt | ConvertTo-Json -Depth 4 -Compress
if ($json -match 'private-document|private-control|document_text|control_name') { throw 'Recovery observation exposed non-allowlisted input.' }
$receipt = New-PortableStartupDiagnostic -Observation $observation -Scenario recovery -Stage content_ready -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $true -ElapsedMilliseconds 1 -RecoveryObservation $recovery
if ($receipt.Contains('recovery_observation')) { throw 'Successful recovery must omit failure-only observations.' }
$recovery.phase='private-phase'; $refused=$false
try { New-PortableStartupDiagnostic -Observation $observation -Scenario recovery -Stage content_wait -SourceCommit ('a' * 40) -ManifestDigest ('b' * 64) -Succeeded $false -ElapsedMilliseconds 20000 -RecoveryObservation $recovery | Out-Null } catch { $refused=$true }
if (-not $refused) { throw 'Arbitrary recovery phase was admitted.' }
Write-Output 'Failure-only recovery observation allowlist tests passed.'
