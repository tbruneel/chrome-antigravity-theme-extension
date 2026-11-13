<#
.SYNOPSIS
    Packages this Chrome Extension into a Chrome Web Store uploadable .zip archive under dist\.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$repoRoot     = $PSScriptRoot
$repoName     = Split-Path -Leaf $repoRoot
$manifestPath = Join-Path $repoRoot "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "manifest.json not found in '$repoRoot'."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($manifest.version)) {
    throw "manifest.json is missing a 'version' field."
}

$filesToInclude = New-Object System.Collections.Generic.List[string]
$filesToInclude.Add("manifest.json")

# Validate and collect files referenced in manifest.json
if ($manifest.icons) {
    foreach ($prop in $manifest.icons.PSObject.Properties) {
        $rel = ([string]$prop.Value) -replace '\\', '/'
        $full = Join-Path $repoRoot ($rel -replace '/', '\')
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
            throw "Missing icon file referenced by manifest.json: '$rel'"
        }
        if (-not $filesToInclude.Contains($rel)) { $filesToInclude.Add($rel) }
    }
}

if ($manifest.background -and $manifest.background.service_worker) {
    $rel = ([string]$manifest.background.service_worker) -replace '\\', '/'
    $full = Join-Path $repoRoot ($rel -replace '/', '\')
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        throw "Missing service worker referenced by manifest.json: '$rel'"
    }
    if (-not $filesToInclude.Contains($rel)) { $filesToInclude.Add($rel) }
}

if ($manifest.content_scripts) {
    foreach ($cs in $manifest.content_scripts) {
        if ($cs.js) {
            foreach ($jsPath in $cs.js) {
                $rel = ([string]$jsPath) -replace '\\', '/'
                $full = Join-Path $repoRoot ($rel -replace '/', '\')
                if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
                    throw "Missing content script referenced by manifest.json: '$rel'"
                }
                if (-not $filesToInclude.Contains($rel)) { $filesToInclude.Add($rel) }
            }
        }
        if ($cs.css) {
            foreach ($cssPath in $cs.css) {
                $rel = ([string]$cssPath) -replace '\\', '/'
                $full = Join-Path $repoRoot ($rel -replace '/', '\')
                if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
                    throw "Missing content stylesheet referenced by manifest.json: '$rel'"
                }
                if (-not $filesToInclude.Contains($rel)) { $filesToInclude.Add($rel) }
            }
        }
    }
}

# Also include any additional runtime assets inside src\ or icons\
foreach ($subDirName in @("icons", "src")) {
    $subDirPath = Join-Path $repoRoot $subDirName
    if (Test-Path -LiteralPath $subDirPath -PathType Container) {
        Get-ChildItem -LiteralPath $subDirPath -File -Recurse | ForEach-Object {
            $rel = $_.FullName.Substring($repoRoot.Length).TrimStart('\', '/') -replace '\\', '/'
            if (-not $filesToInclude.Contains($rel)) {
                $filesToInclude.Add($rel)
            }
        }
    }
}

$distDir = Join-Path $repoRoot "dist"
if (-not (Test-Path -LiteralPath $distDir -PathType Container)) {
    New-Item -Path $distDir -ItemType Directory -Force | Out-Null
}

$zipName = "$repoName-v$($manifest.version).zip"
$zipPath = Join-Path $distDir $zipName
if (Test-Path -LiteralPath $zipPath -PathType Leaf) {
    Remove-Item -LiteralPath $zipPath -Force
}

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($relEntry in $filesToInclude) {
        $srcFile = Join-Path $repoRoot ($relEntry -replace '/', '\')
        $null = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip,
            $srcFile,
            $relEntry,
            [System.IO.Compression.CompressionLevel]::Optimal
        )
    }
} finally {
    $zip.Dispose()
}

Write-Host "[BUILD] Packaged Chrome Web Store archive: $zipPath ($($filesToInclude.Count) entries)" -ForegroundColor Green
