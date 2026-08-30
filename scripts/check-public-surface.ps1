[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()
$readmePath = Join-Path $repositoryRoot 'README.md'
$readme = Get-Content -Raw -LiteralPath $readmePath

$requiredReadmeText = @(
    'Glitchpad',
    'actions/workflows/ci.yml/badge.svg',
    'version-0.0.0',
    'license-Apache--2.0',
    '## Status',
    '## Planned capabilities',
    '## Supported platforms',
    '## Development',
    '## Architecture',
    '## Security and privacy',
    '## Contributing',
    '## License'
)

foreach ($required in $requiredReadmeText) {
    if (-not $readme.Contains($required, [System.StringComparison]::Ordinal)) {
        $failures.Add("README is missing required text: $required")
    }
}

$publicDocuments = @(
    'README.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'SUPPORT.md',
    'docs/glitchpad-technical-specification.md'
)

foreach ($relativePath in $publicDocuments) {
    $path = Join-Path $repositoryRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        $failures.Add("Required public document is absent: $relativePath")
        continue
    }

    $content = Get-Content -Raw -LiteralPath $path
    if ($content -match '(?i)\b(TODO|TBD|FIXME)\b|<placeholder>') {
        $failures.Add("Unresolved placeholder language found: $relativePath")
    }

    if ($content -match '(?i)shruggie-md|old glitchpad|previous glitchpad') {
        $failures.Add("Historical project language found: $relativePath")
    }
}

$markdownFiles = Get-ChildItem -LiteralPath $repositoryRoot -Filter '*.md' -File -Recurse | Where-Object {
    $_.FullName -notmatch '[\\/](fixtures|node_modules|target|gen)[\\/]'
}

foreach ($file in $markdownFiles) {
    $content = Get-Content -Raw -LiteralPath $file.FullName
    $blocks = [regex]::Matches($content, '(?ms)^```mermaid\s*\r?\n(?<diagram>.*?)^```\s*$')
    foreach ($block in $blocks) {
        $diagram = $block.Groups['diagram'].Value
        if ($diagram -match '(?im)^\s*(flowchart|graph)\s+(LR|RL)\b') {
            $relative = [System.IO.Path]::GetRelativePath($repositoryRoot, $file.FullName)
            $failures.Add("Horizontal Mermaid direction found: $relative")
        }
        if ($diagram -match '(?im)^\s*(flowchart|graph)\s+(?!TB\b|TD\b)') {
            $relative = [System.IO.Path]::GetRelativePath($repositoryRoot, $file.FullName)
            $failures.Add("Mermaid flowchart must declare TB or TD: $relative")
        }
    }
}

$requiredRepositoryFiles = @(
    '.gitattributes',
    '.gitignore',
    '.github/CODEOWNERS',
    '.github/dependabot.yml',
    '.github/pull_request_template.md',
    '.github/workflows/ci.yml',
    '.github/workflows/codeql.yml',
    '.github/workflows/release.yml',
    'CODE_OF_CONDUCT.md',
    'LICENSE',
    'NOTICE'
)

foreach ($relativePath in $requiredRepositoryFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot $relativePath) -PathType Leaf)) {
        $failures.Add("Required repository file is absent: $relativePath")
    }
}

$ciPath = Join-Path $repositoryRoot '.github/workflows/ci.yml'
if (Test-Path -LiteralPath $ciPath) {
    $ci = Get-Content -Raw -LiteralPath $ciPath
    foreach ($requiredJob in @('docs:', 'shared:', 'platform:', 'android:', 'dependency-review:', 'security:', 'ci-ok:')) {
        if (-not $ci.Contains($requiredJob, [System.StringComparison]::Ordinal)) {
            $failures.Add("CI workflow is missing job: $requiredJob")
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host 'Public documentation, Mermaid direction, and repository metadata checks passed.'
