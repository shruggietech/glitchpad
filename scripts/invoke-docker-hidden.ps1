[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0, ValueFromRemainingArguments = $true)]
    [ValidateNotNullOrEmpty()]
    [string[]]$DockerArguments
)

$ErrorActionPreference = 'Stop'

$dockerExecutable = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
if (-not (Test-Path -LiteralPath $dockerExecutable -PathType Leaf)) {
    throw 'Docker Desktop is required for hidden container execution, but docker.exe was not found.'
}

$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $dockerExecutable
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
foreach ($argument in $DockerArguments) {
    $startInfo.ArgumentList.Add($argument)
}

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $startInfo
try {
    if (-not $process.Start()) {
        throw 'The hidden Docker process did not start.'
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
