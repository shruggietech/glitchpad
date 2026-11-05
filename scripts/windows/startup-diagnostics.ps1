function New-PortableStartupDiagnostic {
    param(
        [Parameter(Mandatory)][System.Collections.IDictionary] $Observation,
        [Parameter(Mandatory)][ValidateSet('clean', 'reverse', 'minimal', 'editable', 'recovery', 'webview')][string] $Scenario,
        [Parameter(Mandatory)][ValidateSet('launch', 'named_element_wait', 'named_element_ready', 'content_wait', 'content_ready', 'scenario_checks')][string] $Stage,
        [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string] $SourceCommit,
        [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string] $ManifestDigest,
        [Parameter(Mandatory)][bool] $Succeeded,
        [Parameter(Mandatory)][long] $ElapsedMilliseconds,
        [ValidateSet('none', 'named_element')][string] $WaitKind = 'none',
        [ValidateRange(0, 100000)][int] $WaitCallerLine = 0
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
    if (-not $Succeeded -and $WaitKind -eq 'named_element' -and $WaitCallerLine -gt 0) {
        $record['readiness_wait'] = [ordered]@{
            function = 'Wait-NamedElement'
            caller_line = $WaitCallerLine
        }
    }
    return $record
}
