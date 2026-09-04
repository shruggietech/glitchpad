[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Command,

    [ValidateSet('current', 'root')]
    [string]$User = 'current'
)

$ErrorActionPreference = 'Stop'

$wslExecutable = Join-Path $env:SystemRoot 'System32\wsl.exe'
if (-not (Test-Path -LiteralPath $wslExecutable -PathType Leaf)) {
    throw 'WSL2 is required for hidden repository command execution, but wsl.exe was not found.'
}

$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $wslExecutable
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
if ($User -eq 'root') {
    $startInfo.ArgumentList.Add('--user')
    $startInfo.ArgumentList.Add('root')
}
$startInfo.ArgumentList.Add('--exec')
$startInfo.ArgumentList.Add('bash')
$startInfo.ArgumentList.Add('-lc')
$wrappedCommand = 'export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"; ' + $Command
$startInfo.ArgumentList.Add($wrappedCommand)

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $startInfo
try {
    if (-not $process.Start()) {
        throw 'The hidden WSL2 process did not start.'
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
