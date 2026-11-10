<#
.SYNOPSIS
    Build a portable CrimeScope handoff folder from the frozen runtime artifacts.

.DESCRIPTION
    Copies the exact frozen files a clean clone lacks (they are gitignored) into a NEW
    folder that mirrors the repository layout, writes a sha256 checksum inventory, and
    prints local-demo start instructions.

    It resolves WHICH artifacts to copy from the two active pointers:
      data/serving/current.json           -> active SQLite release
      analysis/output/runs/current.json   -> active analysis run

    What it copies:
      data/serving/current.json
      data/serving/releases/<release_id>/crimescope.sqlite
      data/serving/releases/<release_id>/release_manifest.json
      analysis/output/runs/current.json
      analysis/output/runs/<run_id>/**                (the whole active run directory)
      config/**
      data/verification/<selected evidence sets>/**   (screenshots + summary.json)

    What it excludes (never copied): Chrome profile caches (chrome-profile*),
    node_modules, __pycache__/*.pyc, .env* and temporary dumps.

    It NEVER deletes or modifies the originals; it only reads them. It refuses to
    overwrite an existing destination folder.

.PARAMETER Destination
    New folder to create. Defaults to a timestamped folder NEXT TO the repository
    (sibling of the repo root), so nothing large is produced inside the repo.

.PARAMETER DryRun
    Print the exact copy plan (source -> destination, sizes, totals) without writing
    anything. Equivalent to -WhatIf for the file copies.

.EXAMPLE
    powershell -File scripts/package_handoff.ps1 -DryRun
    powershell -File scripts/package_handoff.ps1 -Destination D:\crimescope-handoff
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Destination,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# --- Locate the repo root (this script lives in <repo>\scripts). ------------------
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root 'data/serving/current.json'))) {
    throw "Could not find the CrimeScope repo root from '$PSScriptRoot'."
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if ([string]::IsNullOrWhiteSpace($Destination)) {
    $Destination = Join-Path (Split-Path -Parent $Root) "crimescope-handoff-$stamp"
}
$DestRoot = [System.IO.Path]::GetFullPath($Destination)

if (Test-Path -LiteralPath $DestRoot) {
    throw "Refusing to overwrite existing destination: $DestRoot"
}

# --- Resolve the active release + run from the pointers. --------------------------
$releasePointer = Get-Content -Raw -LiteralPath (Join-Path $Root 'data/serving/current.json') | ConvertFrom-Json
$releaseDirRel  = $releasePointer.release_path          # e.g. data/serving/releases/<id>
$releaseId      = $releasePointer.release_id

$runPointer   = Get-Content -Raw -LiteralPath (Join-Path $Root 'analysis/output/runs/current.json') | ConvertFrom-Json
$runId        = $runPointer.run_id
$runDirRel    = Split-Path -Parent $runPointer.manifest  # e.g. analysis/output/runs/<id>
$runDirAbs    = Join-Path $Root $runDirRel

# The retained demo evidence is a compact walkthrough of all nine routes.
$evidenceSets = @(
    'data/verification/demo_walkthrough_1794162325606'
)

# --- Exclusion + collection helpers. ----------------------------------------------
function Test-Excluded([string]$rel) {
    $p = $rel -replace '\\', '/'
    if ($p -match '(?i)(^|/)chrome-profile') { return $true }
    if ($p -match '(?i)(^|/)node_modules(/|$)') { return $true }
    if ($p -match '(?i)(^|/)__pycache__(/|$)') { return $true }
    if ($p -match '(?i)\.pyc$') { return $true }
    if ($p -match '(?i)(^|/)\.env($|\.)') { return $true }
    return $false
}

$plan = New-Object System.Collections.Generic.List[object]

function Add-Tree([string]$relDir) {
    $absDir = Join-Path $Root $relDir
    if (-not (Test-Path -LiteralPath $absDir)) { throw "Missing expected path: $relDir" }
    Get-ChildItem -LiteralPath $absDir -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($Root.Length + 1)
        if (Test-Excluded $rel) { return }
        $plan.Add([pscustomobject]@{
            Source = $_.FullName
            Rel    = ($rel -replace '\\', '/')
            Bytes  = $_.Length
        })
    }
}

function Add-File([string]$relFile) {
    $abs = Join-Path $Root $relFile
    if (-not (Test-Path -LiteralPath $abs)) { throw "Missing expected file: $relFile" }
    $item = Get-Item -LiteralPath $abs
    $plan.Add([pscustomobject]@{
        Source = $item.FullName
        Rel    = ($relFile -replace '\\', '/')
        Bytes  = $item.Length
    })
}

# --- Build the copy plan (exact frozen files). ------------------------------------
Add-File 'data/serving/current.json'
Add-File "$releaseDirRel/crimescope.sqlite"
Add-File "$releaseDirRel/release_manifest.json"
Add-File 'analysis/output/runs/current.json'
Add-Tree $runDirRel
Add-Tree 'config'
# Primary dashboard routes also read these small release metadata files.
Add-File 'data/interim/rebuilt_national_2021_2024_v3/staging_release_manifest.json'
Add-File 'data/interim/rebuilt_national_2021_2024_v3/quality_report.json'
foreach ($set in $evidenceSets) { Add-Tree $set }

$totalBytes = ($plan | Measure-Object -Property Bytes -Sum).Sum
$totalMB = [math]::Round($totalBytes / 1MB, 1)

Write-Host ""
Write-Host "CrimeScope handoff"
Write-Host "  repo root      : $Root"
Write-Host "  active release : $releaseId"
Write-Host "  active run     : $runId"
Write-Host "  destination    : $DestRoot"
Write-Host "  files          : $($plan.Count)  ($totalMB MB)"
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN - copy plan (nothing will be written):"
    foreach ($entry in ($plan | Sort-Object Rel)) {
        Write-Host ("  {0,10:N0}  {1}" -f $entry.Bytes, $entry.Rel)
    }
    Write-Host ""
    Write-Host "DRY RUN complete: $($plan.Count) files, $totalMB MB. No folder was created."
    return
}

# --- Create the destination and copy. ---------------------------------------------
New-Item -ItemType Directory -Path $DestRoot | Out-Null
$inventory = New-Object System.Collections.Generic.List[string]

foreach ($entry in ($plan | Sort-Object Rel)) {
    $dest = Join-Path $DestRoot ($entry.Rel -replace '/', '\')
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    if ($PSCmdlet.ShouldProcess($entry.Rel, 'Copy')) {
        Copy-Item -LiteralPath $entry.Source -Destination $dest -Force
        $hash = (Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLower()
        $inventory.Add("$hash  $($entry.Rel)")
    }
}

# --- Checksum inventory. ----------------------------------------------------------
$inventoryPath = Join-Path $DestRoot 'SHA256SUMS.txt'
$header = @(
    "CrimeScope handoff checksum inventory (sha256)",
    "generated : $(Get-Date -Format o)",
    "release   : $releaseId",
    "run       : $runId",
    ""
)
($header + $inventory) -join "`r`n" | Set-Content -LiteralPath $inventoryPath -Encoding UTF8

# --- Start instructions. ----------------------------------------------------------
$startText = @"
CrimeScope handoff folder - local demo
======================================

This folder holds the frozen runtime artifacts a fresh source checkout does NOT
contain (they are gitignored). It mirrors the repository layout.

How to run the local demo
-------------------------
1. Check out the CrimeScope source (frontend/, backend/, packages/, scripts/, config/,
   package.json, ...).
2. Merge this folder into the checkout root, e.g. copy its contents over the repo root.
   Nothing here overwrites source code; it only fills in the missing runtime files.
3. Install dependencies:      npm install
4. Start the backend:         npm --workspace backend run dev
5. Start the frontend:        npm --workspace frontend run dev
6. Open:                      http://localhost:5173

Active selection
----------------
  release : $releaseId
  run     : $runId

Verify integrity
----------------
  The file SHA256SUMS.txt lists the sha256 of every file copied here.
  On Windows PowerShell:
    Get-Content SHA256SUMS.txt
    (Get-FileHash -Algorithm SHA256 .\data\serving\releases\$releaseId\crimescope.sqlite).Hash

See docs/handoff.md for details.
"@
$startText | Set-Content -LiteralPath (Join-Path $DestRoot 'START_HERE.txt') -Encoding UTF8

Write-Host "Done. Handoff folder: $DestRoot"
Write-Host "  inventory: $inventoryPath"
Write-Host ""
Write-Host $startText
