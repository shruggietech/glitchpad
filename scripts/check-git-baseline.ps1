[CmdletBinding()]
param(
    [switch] $RequireCommit
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()
$gitDirectory = Join-Path $repositoryRoot '.git'

$prohibitedNames = @('local.properties', 'keystore.properties', '.env', 'id_rsa', 'id_ed25519')
$prohibitedExtensions = @('.aab', '.apk', '.jks', '.keystore', '.p12', '.pfx')
$textExtensions = @('.css', '.gradle', '.html', '.js', '.json', '.jsonc', '.kt', '.kts', '.md', '.mjs', '.properties', '.ps1', '.rs', '.svg', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml')
$secretPatterns = @(
    '-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----',
    '\bgh[pousr]_[A-Za-z0-9]{30,}\b',
    '\bAKIA[0-9A-Z]{16}\b',
    '\bxox[baprs]-[A-Za-z0-9-]{20,}\b'
)
$candidates = Get-ChildItem -LiteralPath $repositoryRoot -File -Recurse -Force | Where-Object {
    $_.FullName -notmatch '[\\/](\.git|node_modules|target|dist|coverage|\.gradle|build)[\\/]'
}

foreach ($file in $candidates) {
    if ($file.Name -in $prohibitedNames -or $file.Extension -in $prohibitedExtensions) {
        $relative = [System.IO.Path]::GetRelativePath($repositoryRoot, $file.FullName)
        $failures.Add("Prohibited file in initial snapshot: $relative")
    }

    if ($file.Extension -in $textExtensions) {
        $content = Get-Content -Raw -LiteralPath $file.FullName
        foreach ($pattern in $secretPatterns) {
            if ($content -match $pattern) {
                $relative = [System.IO.Path]::GetRelativePath($repositoryRoot, $file.FullName)
                $failures.Add("Possible secret pattern in initial snapshot: $relative")
            }
        }
    }
}

$activePointer = Join-Path $repositoryRoot '.specify/memory/active-feature.md'
if (Test-Path -LiteralPath $activePointer -PathType Leaf) {
    $ignoreResult = & git -C $repositoryRoot check-ignore --quiet -- '.specify/memory/active-feature.md' 2>$null
    if ($LASTEXITCODE -ne 0 -and (Test-Path -LiteralPath $gitDirectory)) {
        $failures.Add('Spec Kit active-feature pointer is not ignored.')
    }
}

if (Test-Path -LiteralPath $gitDirectory) {
    $remotes = @(& git -C $repositoryRoot remote)
    if ($remotes.Count -gt 0) {
        $failures.Add("Git remotes are not permitted before public repository creation: $($remotes -join ', ')")
    }

    $trackedProhibited = @(& git -C $repositoryRoot ls-files | Where-Object {
        $name = [System.IO.Path]::GetFileName($_)
        $extension = [System.IO.Path]::GetExtension($_)
        $name -in $prohibitedNames -or $extension -in $prohibitedExtensions
    })
    if ($trackedProhibited.Count -gt 0) {
        $failures.Add("Prohibited tracked files: $($trackedProhibited -join ', ')")
    }

    if ($RequireCommit) {
        $branch = (& git -C $repositoryRoot branch --show-current).Trim()
        if ($branch -ne 'main') {
            $failures.Add("Initial branch is '$branch'; expected 'main'.")
        }

        $commitCount = [int](& git -C $repositoryRoot rev-list --count HEAD)
        if ($commitCount -ne 1) {
            $failures.Add("Expected one initial commit; found $commitCount.")
        }

        $status = @(& git -C $repositoryRoot status --short)
        if ($status.Count -gt 0) {
            $failures.Add('Git worktree is not clean.')
        }
    }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host "Git baseline check passed for $($candidates.Count) candidate files."
