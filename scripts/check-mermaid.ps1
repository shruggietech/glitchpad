[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$temporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$workDirectory = Join-Path $temporaryRoot "glitchpad-mermaid-$([guid]::NewGuid().ToString('N'))"
$workDirectory = [System.IO.Path]::GetFullPath($workDirectory)

if (-not $workDirectory.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Mermaid validation directory did not resolve under the operating-system temporary directory.'
}

New-Item -ItemType Directory -Path $workDirectory | Out-Null
$diagramCount = 0

try {
    $markdownFiles = Get-ChildItem -LiteralPath $repositoryRoot -Filter '*.md' -File -Recurse | Where-Object {
        $_.FullName -notmatch '[\\/](node_modules|target|gen)[\\/]'
    }

    foreach ($file in $markdownFiles) {
        $content = Get-Content -Raw -LiteralPath $file.FullName
        $blocks = [regex]::Matches($content, '(?ms)^```mermaid\s*\r?\n(?<diagram>.*?)^```\s*$')
        foreach ($block in $blocks) {
            $diagramCount++
            $inputPath = Join-Path $workDirectory "$diagramCount.mmd"
            $outputPath = Join-Path $workDirectory "$diagramCount.svg"
            [System.IO.File]::WriteAllText($inputPath, $block.Groups['diagram'].Value, [System.Text.UTF8Encoding]::new($false))
            & pnpm exec mmdc --input $inputPath --output $outputPath --backgroundColor transparent --quiet
            if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $outputPath -PathType Leaf)) {
                $relative = [System.IO.Path]::GetRelativePath($repositoryRoot, $file.FullName)
                throw "Mermaid rendering failed for diagram $diagramCount in $relative."
            }
        }
    }
}
finally {
    if (Test-Path -LiteralPath $workDirectory) {
        $resolvedWorkDirectory = [System.IO.Path]::GetFullPath($workDirectory)
        if ($resolvedWorkDirectory.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $resolvedWorkDirectory -Recurse -Force
        }
    }
}

Write-Host "Parsed and rendered $diagramCount Mermaid diagrams."
