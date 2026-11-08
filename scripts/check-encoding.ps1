[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$strictUtf8 = [System.Text.UTF8Encoding]::new($false, $true)
$textExtensions = @('.css', '.gradle', '.html', '.js', '.json', '.jsonc', '.kt', '.kts', '.lock', '.md', '.mjs', '.patch', '.properties', '.ps1', '.rs', '.svg', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml')
$textNames = @('.editorconfig', '.gitattributes', '.gitignore', '.node-version', '.prettierignore', 'gradlew')
$excludedDirectories = @('.git', '.codex-tmp', '.codex-attachments', '.pnpm-store', '.tmp', 'node_modules', 'target', 'dist', 'coverage', '.gradle', 'build', '.next', '.source', 'out', 'playwright-report', 'test-results')
$corruptionMarkers = @(
    "$([char]0x00C3)$([char]0x00A2)",
    "$([char]0x00C3)$([char]0x00A9)",
    "$([char]0x00E2)$([char]0x20AC)",
    "$([char]0x00EF)$([char]0x00BB)$([char]0x00BF)",
    "$([char]0xFFFD)"
)
$failures = [System.Collections.Generic.List[string]]::new()

function Get-SourceTextFiles {
    param([Parameter(Mandatory = $true)][string]$Directory)

    foreach ($entry in Get-ChildItem -LiteralPath $Directory -Force) {
        if ($entry.PSIsContainer) {
            if ($entry.Name -notin $excludedDirectories -and -not ($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
                Get-SourceTextFiles -Directory $entry.FullName
            }
        }
        elseif ($entry.Extension -in $textExtensions -or $entry.Name -in $textNames) {
            $entry
        }
    }
}

$files = @(Get-SourceTextFiles -Directory $repositoryRoot)

foreach ($file in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $relative = [System.IO.Path]::GetRelativePath($repositoryRoot, $file.FullName)

    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $failures.Add("UTF-8 BOM found: $relative")
        continue
    }

    try {
        $content = $strictUtf8.GetString($bytes)
    }
    catch {
        $failures.Add("Invalid UTF-8: $relative")
        continue
    }

    foreach ($marker in $corruptionMarkers) {
        if ($content.Contains($marker, [System.StringComparison]::Ordinal)) {
            $failures.Add("Possible mojibake marker '$marker' found: $relative")
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host "Validated $($files.Count) text files as UTF-8 without BOM or common mojibake markers."
