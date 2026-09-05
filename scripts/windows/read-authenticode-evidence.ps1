[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $Artifact
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$artifactPath = (Resolve-Path -LiteralPath $Artifact).Path
$signature = Get-AuthenticodeSignature -LiteralPath $artifactPath
[ordered]@{
    status = [string]$signature.Status
    signer_subject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
    signer_thumbprint = if ($signature.SignerCertificate) { $signature.SignerCertificate.Thumbprint.ToLowerInvariant() } else { $null }
    timestamp_subject = if ($signature.TimeStamperCertificate) { $signature.TimeStamperCertificate.Subject } else { $null }
    timestamp_thumbprint = if ($signature.TimeStamperCertificate) { $signature.TimeStamperCertificate.Thumbprint.ToLowerInvariant() } else { $null }
} | ConvertTo-Json -Compress
