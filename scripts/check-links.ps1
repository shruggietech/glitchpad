[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$configuration = Join-Path $repositoryRoot '.markdown-link-check.json'
$failures = [System.Collections.Generic.List[string]]::new()
$markdownFiles = Get-ChildItem -LiteralPath $repositoryRoot -Filter '*.md' -File -Recurse | Where-Object {
    $_.FullName -notmatch '[\\/](\.agents|\.specify|node_modules|target|gen)[\\/]'
}

foreach ($file in $markdownFiles) {
    & pnpm exec markdown-link-check --quiet --config $configuration $file.FullName
    if ($LASTEXITCODE -ne 0) {
        $relative = [System.IO.Path]::GetRelativePath($repositoryRoot, $file.FullName)
        $failures.Add($relative)
    }
}

if ($failures.Count -gt 0) {
    throw "Link validation failed: $($failures -join ', ')"
}

Write-Host "Validated links in $($markdownFiles.Count) Markdown files."
