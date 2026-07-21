#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Sync project skills from .opencode/skill/ to .kilo/skills/

.DESCRIPTION
    Keeps kilocode skill copies in sync with the canonical opencode source.
    Run after any skill edit to prevent drift.

.EXAMPLE
    pwsh scripts/sync-skills.ps1
    pwsh scripts/sync-skills.ps1 -DryRun
    pwsh scripts/sync-skills.ps1 -Skill devops
#>
param(
    [switch]$DryRun,
    [string]$Skill
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $projectRoot ".opencode\skill"
$target = Join-Path $projectRoot ".kilo\skills"

if (-not (Test-Path $source)) {
    Write-Error "Source not found: $source"
    exit 1
}

New-Item -ItemType Directory -Path $target -Force | Out-Null

$synced = 0
$skipped = 0
$failed = 0

Get-ChildItem -Path $source -Directory | ForEach-Object {
    $skillName = $_.Name

    # If specific skill requested, skip others
    if ($Skill -and $skillName -ne $Skill) {
        return
    }

    $srcFile = Join-Path $_.FullName "SKILL.md"
    $dstDir = Join-Path $target $skillName
    $dstFile = Join-Path $dstDir "SKILL.md"

    if (-not (Test-Path $srcFile)) {
        Write-Host "  SKIP: $skillName (no SKILL.md)" -ForegroundColor Yellow
        $skipped++
        return
    }

    # Check if already in sync
    if (Test-Path $dstFile) {
        $srcHash = (Get-FileHash $srcFile -Algorithm MD5).Hash
        $dstHash = (Get-FileHash $dstFile -Algorithm MD5).Hash
        if ($srcHash -eq $dstHash) {
            Write-Host "  OK: $skillName (already in sync)" -ForegroundColor DarkGray
            $skipped++
            return
        }
    }

    if ($DryRun) {
        Write-Host "  DRY-RUN: $skillName" -ForegroundColor Cyan
        $synced++
        return
    }

    try {
        New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
        Copy-Item $srcFile $dstFile -Force
        # Sync bundled asset subdirectories (references/, templates/, prompts/)
        # so skills with non-SKILL.md assets stay in sync with the kilocode copy.
        foreach ($assetDir in @('references', 'templates', 'prompts')) {
            $srcAsset = Join-Path $_.FullName $assetDir
            if (Test-Path $srcAsset) {
                $dstAsset = Join-Path $dstDir $assetDir
                Copy-Item $srcAsset $dstAsset -Recurse -Force
            }
        }

        # Sync companion markdown files so skills with cross-references stay coherent.
        Get-ChildItem -Path $_.FullName -Filter "*.md" | ForEach-Object {
            $dstMd = Join-Path $dstDir $_.Name
            Copy-Item $_.FullName $dstMd -Force
        }
        $synced++
        Write-Host "  SYNCED: $skillName" -ForegroundColor Green
    } catch {
        $failed++
        Write-Host "  FAILED: $skillName - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Result: synced=$synced skipped=$skipped failed=$failed" -ForegroundColor Cyan

if ($failed -gt 0) {
    exit 1
}
