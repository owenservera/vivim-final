#!/usr/bin/env pwsh
# scripts/health-check.ps1
# Continuous health check for Vivim backend + frontend
# Usage: .\scripts\health-check.ps1 [-Interval 30] [-MaxFailures 3]

param(
    [int]$Interval = 30,
    [int]$MaxFailures = 3
)

# Resolve backend port from .runtime/backend.port (zombie-safe).
$BackendPort = 9420
$runtimeDir = Join-Path $PSScriptRoot ".." ".runtime"
$portFile = Join-Path $runtimeDir "backend.port"
if (Test-Path $portFile) {
    $read = Get-Content $portFile -ErrorAction SilentlyContinue
    if ($read -match '^\d+$') { $BackendPort = [int]$read }
}

$BackendUrl = "http://127.0.0.1:$BackendPort"
$FrontendUrl = "http://127.0.0.1:5173"

$failures = 0
$totalChecks = 0
$startTime = Get-Date

Write-Host "Vivim Health Check" -ForegroundColor Cyan
Write-Host "Backend:  $BackendUrl" -ForegroundColor Gray
Write-Host "Frontend: $FrontendUrl" -ForegroundColor Gray
Write-Host "Interval: ${Interval}s | Max failures: $MaxFailures" -ForegroundColor Gray
Write-Host ""

function Test-BackendHealth {
    try {
        $res = Invoke-WebRequest -Uri "$BackendUrl/health" -TimeoutSec 5 -UseBasicParsing
        return $res.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Test-FrontendHealth {
    try {
        $res = Invoke-WebRequest -Uri $FrontendUrl -TimeoutSec 5 -UseBasicParsing
        return $res.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Test-WebSocket {
    try {
        # WebSocket upgrade endpoint: 426 Upgrade Required (or 200) means the
        # server is listening and alive. Any connection failure means it's down.
        $res = Invoke-WebRequest -Uri "$BackendUrl/ws" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        return $true
    } catch {
        # 426 Upgrade Required is the expected healthy response for a WS endpoint.
        $statusCode = $null
        if ($_.Exception.Response) { $statusCode = $_.Exception.Response.StatusCode.value__ }
        if ($statusCode -eq 426) { return $true }
        # Connection refused / timeout / DNS — server is NOT reachable.
        return $false
    }
}

function Show-Status {
    param(
        [string]$Component,
        [bool]$Healthy
    )
    $icon = if ($Healthy) { "[OK]" } else { "[FAIL]" }
    $color = if ($Healthy) { "Green" } else { "Red" }
    Write-Host "  $icon $Component" -ForegroundColor $color
}

while ($true) {
    $totalChecks++
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] Check #$totalChecks" -ForegroundColor Yellow

    $backendHealthy = Test-BackendHealth
    $frontendHealthy = Test-FrontendHealth
    $wsHealthy = Test-WebSocket

    Show-Status "Backend" $backendHealthy
    Show-Status "Frontend" $frontendHealthy
    Show-Status "WebSocket" $wsHealthy

    if (-not $backendHealthy -or -not $frontendHealthy) {
        $failures++
        Write-Host "  WARNING: Failure $failures/$MaxFailures" -ForegroundColor Yellow

        if ($failures -ge $MaxFailures) {
            Write-Host ""
            Write-Host "Max failures reached. Exiting." -ForegroundColor Red
            exit 1
        }
    } else {
        $failures = 0
    }

    $uptime = (Get-Date) - $startTime
    Write-Host "  Uptime: $($uptime.Hours)h $($uptime.Minutes)m $($uptime.Seconds)s" -ForegroundColor Gray
    Write-Host ""

    Start-Sleep -Seconds $Interval
}
