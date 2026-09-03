[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('git', 'gh')]
    [string]$Tool,

    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [string[]]$ToolArguments = @()
)

$ErrorActionPreference = 'Stop'

$command = Get-Command "$Tool.exe" -CommandType Application -ErrorAction Stop | Select-Object -First 1
$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $command.Source
$startInfo.WorkingDirectory = (Get-Location).Path
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$startInfo.Environment['GIT_TERMINAL_PROMPT'] = '0'
$startInfo.Environment['GCM_INTERACTIVE'] = 'Never'
$startInfo.Environment['GH_PROMPT_DISABLED'] = '1'
foreach ($argument in $ToolArguments) {
    $startInfo.ArgumentList.Add($argument)
}

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $startInfo
try {
    if (-not $process.Start()) {
        throw "The hidden $Tool process did not start."
    }

    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    if ($stdout.Length -gt 0) {
        $stdout | Write-Output
    }
    if ($stderr.Length -gt 0) {
        [Console]::Error.Write($stderr)
    }
    exit $process.ExitCode
}
finally {
    $process.Dispose()
}
