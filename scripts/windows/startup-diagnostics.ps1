function New-PortableStartupDiagnostic {
    param(
        [Parameter(Mandatory)][System.Collections.IDictionary] $Observation,
        [Parameter(Mandatory)][ValidateSet('clean', 'reverse', 'minimal', 'editable', 'recovery', 'webview')][string] $Scenario,
        [Parameter(Mandatory)][ValidateSet('launch', 'named_element_wait', 'named_element_ready', 'named_button_wait', 'named_button_ready', 'content_wait', 'content_ready', 'foreground_wait', 'foreground_ready', 'scenario_checks')][string] $Stage,
        [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string] $SourceCommit,
        [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string] $ManifestDigest,
        [Parameter(Mandatory)][bool] $Succeeded,
        [Parameter(Mandatory)][long] $ElapsedMilliseconds,
        [ValidateSet('none', 'named_element', 'named_button', 'foreground')][string] $WaitKind = 'none',
        [ValidateRange(0, 100000)][int] $WaitCallerLine = 0,
        [System.Collections.IDictionary] $DocumentAction = $null,
        [System.Collections.IDictionary] $RecoveryObservation = $null
    )
    $record = [ordered]@{
        schema_version = 1
        scenario = $Scenario
        stage = $Stage
        elapsed_ms = [Math]::Max(0, $ElapsedMilliseconds)
        source_commit = $SourceCommit
        candidate_manifest_sha256 = $ManifestDigest
        succeeded = $Succeeded
        exited = [bool]$Observation['exited']
        exit_code = if ($Observation['exited'] -and $null -ne $Observation['exit_code']) { [int]$Observation['exit_code'] } else { $null }
        main_window_present = [bool]$Observation['main_window_present']
        main_window_visible = if ($null -eq $Observation['main_window_visible']) { $null } else { [bool]$Observation['main_window_visible'] }
        automation_descendant_present = if ($null -eq $Observation['automation_descendant_present']) { $null } else { [bool]$Observation['automation_descendant_present'] }
        process_state_available = [bool]$Observation['process_state_available']
        content_free = $true
    }
    if (-not $Succeeded -and $WaitKind -in @('named_element', 'named_button', 'foreground') -and $WaitCallerLine -gt 0) {
        $record['readiness_wait'] = [ordered]@{
            function = switch ($WaitKind) { 'named_button' { 'Wait-NamedButton' }; 'foreground' { 'Wait-ApplicationForeground' }; default { 'Wait-NamedElement' } }
            caller_line = $WaitCallerLine
        }
    }
    if (-not $Succeeded -and $null -ne $DocumentAction) {
        $phase = [string]$DocumentAction['phase']
        if ($phase -notin @('menu_wait', 'action_wait', 'action_ready', 'click_dispatched', 'save_wait')) { throw 'Document action observation phase is invalid.' }
        $action = [ordered]@{ phase = $phase }
        foreach ($field in @('foreground_before_menu', 'foreground_at_click', 'menu_available', 'candidate_available', 'menu_owned', 'enabled', 'visible', 'scroll_requested', 'click_dispatched', 'resolver_error', 'resolver_method_missing', 'feedback_saved', 'feedback_pending', 'feedback_cancelled', 'feedback_unavailable', 'feedback_default_failure')) {
            $action[$field] = if ($null -eq $DocumentAction[$field]) { $null } else { [bool]$DocumentAction[$field] }
        }
        $record['document_action'] = $action
    }
    if (-not $Succeeded -and $null -ne $RecoveryObservation) {
        $phase = [string]$RecoveryObservation['phase']
        if ($phase -notin @('view_source', 'paused_content', 'source_editor', 'source_content', 'retry_preview')) { throw 'Recovery observation phase is invalid.' }
        $recovery = [ordered]@{ phase = $phase }
        foreach ($field in @('view_source_invoked', 'capture_available', 'paused_text_present', 'source_editor_present', 'source_marker_present', 'retry_present', 'view_source_present', 'contained_failure_present', 'probe_consumed')) {
            $recovery[$field] = if ($null -eq $RecoveryObservation[$field]) { $null } else { [bool]$RecoveryObservation[$field] }
        }
        $record['recovery_observation'] = $recovery
    }
    return $record
}
