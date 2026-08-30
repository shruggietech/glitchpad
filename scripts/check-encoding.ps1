[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$strictUtf8 = [System.Text.UTF8Encoding]::new($false, $true)
$textExtensions = @('.css', '.gradle', '.html', '.js', '.json', '.jsonc', '.kt', '.kts', '.lock', '.md', '.mjs', '.properties', '.ps1', '.rs', '.svg', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml')
$textNames = @('.editorconfig', '.gitattributes', '.gitignore', '.node-version', '.prettierignore', 'gradlew')
$excludedDirectories = @('.git', 'node_modules', 'target', 'dist', 'coverage', '.gradle', 'build')
$corruptionMarkers = @(
    "$([char]0x00C3)$([char]0x00A2)",
    "$([char]0x00C3)$([char]0x00A9)",
    "$([char]0x00E2)$([char]0x20AC)",
    "$([char]0x00EF)$([char]0x00BB)$([char]0x00BF)",
    "$([char]0xFFFD)"
)
$failures = [System.Collections.Generic.List[string]]::new()

$files = Get-ChildItem -LiteralPath $repositoryRoot -File -Recurse -Force | Where-Object {
    $relative = [System.IO.Path]::GetRelativePath($repositoryRoot, $_.FullName)
    $parts = $relative -split '[\\/]'
    -not ($parts | Where-Object { $_ -in $excludedDirectories }) -and ($_.Extension -in $textExtensions -or $_.Name -in $textNames)
}

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
