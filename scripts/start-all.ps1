# scripts/start-all.ps1
# Start both backend (:9420) and frontend (:3000).
# FULLY DETACHED — exits immediately. No hangs, no waits.
# Usage: pwsh scripts/start-all.ps1 [-BackendOnly] [-FrontendOnly]

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $projectRoot) { $projectRoot = $PWD.Path }
$runtimeDir = Join-Path $projectRoot ".runtime"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
. (Join-Path $PSScriptRoot '_shared.ps1')

function Log($msg) { Write-Output "  $(Get-Date -Format 'HH:mm:ss.fff') $msg" }
function LogOk($msg) { Write-Output "  $(Get-Date -Format 'HH:mm:ss.fff') [OK] $msg" }
function LogWarn($msg) { Write-Output "  $(Get-Date -Format 'HH:mm:ss.fff') [WARN] $msg" }
function LogFail($msg) { Write-Output "  $(Get-Date -Format 'HH:mm:ss.fff') [FAIL] $msg" }

# ── Main ────────────────────────────────────────────────────────────

$bunExe = Resolve-Bun

Write-Host "========================================" -ForegroundColor White
Write-Host "  vivim-final — Starting Services" -ForegroundColor White
Write-Host "========================================" -ForegroundColor White
Log "Bun: $bunExe"
Log "Project: $projectRoot"

$backendOk = $false
$frontendOk = $false

# ── Backend ────────────────────────────────────────────────────────
if (-not $FrontendOnly) {
    Log "Phase 1: Cleanup + Chrome debug port scan"

    # Chrome debug port scan (adopt an existing browser instead of spawning)
    $existingChromePort = $null
    try {
        $chromeConns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -ge 9222 -and $_.LocalPort -le 9332 }
        foreach ($c in $chromeConns) {
            $existingChromePort = $c.LocalPort
            LogOk "Found Chrome on :$existingChromePort"
            break
        }
    } catch {}

    # ── Resolve backend port (zombie-safe) ──
    $backendPort = 9420
    $portPid = Find-PidOnPort $backendPort
    if ($portPid) {
        Kill-Pid $portPid
        Start-Sleep -Milliseconds 400
    }
    # Re-check after kill attempt — zombie sockets can't be killed
    $portPid = Find-PidOnPort $backendPort
    if ($portPid) {
        LogWarn ":$backendPort zombie-held. Scanning for free port..."
        $candidate = $backendPort + 1
        while ($candidate -lt ($backendPort + 50)) {
            $cpid = Find-PidOnPort $candidate
            if (-not $cpid) { $backendPort = $candidate; break }
            $candidate++
        }
        LogWarn "Using :$backendPort"
    }
    $backendPort | Set-Content (Join-Path $runtimeDir "backend.port") -Force

    # ── Launch backend directly (no nested pwsh — eliminates pipe-inheritance hang) ──
    Log "Phase 2: Launch backend on :$backendPort"
    $env:CAP_STORE_PORT = [string]$backendPort
    if ($existingChromePort) { $env:VIVIM_ADOPT_PORT = [string]$existingChromePort } else { Remove-Item Env:VIVIM_ADOPT_PORT -ErrorAction SilentlyContinue }
    $proc = Start-Process -FilePath $bunExe -ArgumentList "run", "serve" `
        -WorkingDirectory $projectRoot `
        -WindowStyle Hidden `
        -PassThru `
        -ErrorAction SilentlyContinue

    if ($proc) {
        $proc.Id | Set-Content (Join-Path $runtimeDir "backend.pid") -Force
        LogOk "Backend PID: $($proc.Id)"

        $deadline = [DateTime]::Now.AddSeconds(30)
        while ([DateTime]::Now -lt $deadline) {
            $portPid = Find-PidOnPort $backendPort
            if ($portPid) {
                $portPid | Set-Content (Join-Path $runtimeDir "backend.pid") -Force
                LogOk "Backend listening on :$backendPort (PID $portPid)"
                $backendOk = $true
                break
            }
            $alive = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
            if (-not $alive) { LogFail "Backend process died"; break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $backendOk) { LogWarn "Backend started but :$backendPort not yet bound" }
    } else {
        LogFail "Failed to start backend"
    }
}

# ── Frontend ───────────────────────────────────────────────────────
if (-not $BackendOnly) {
    Stop-ByPidFile $runtimeDir "frontend"

    $frontendDir = Join-Path $projectRoot "frontend"
    if (-not (Test-Path $frontendDir)) {
        LogWarn "Frontend dir missing: $frontendDir"
    } else {
        if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
            Log "Installing frontend deps..."
            Push-Location $frontendDir
            & $bunExe install
            Pop-Location
        }

        # Port scan for frontend (walk UP from 3000 if zombie-held)
        $frontendPort = 3000
        Kill-Port $frontendPort
        if (-not (Test-PortFree $frontendPort)) {
            LogWarn ":$frontendPort zombie-held. Scanning for free port..."
            $candidate = $frontendPort + 1
            while ($candidate -lt ($frontendPort + 50)) {
                if (Test-PortFree $candidate) { $frontendPort = $candidate; break }
                $candidate++
            }
            LogWarn "Using :$frontendPort"
        }
        $frontendPort | Set-Content (Join-Path $runtimeDir "frontend.port") -Force

        Log "Phase 3: Launch frontend on :$frontendPort"
        $proc = Start-Process -FilePath $bunExe -ArgumentList "run", "dev", "--", "-p", $frontendPort `
            -WorkingDirectory $frontendDir `
            -WindowStyle Hidden `
            -PassThru `
            -ErrorAction SilentlyContinue

        if ($proc) {
            $proc.Id | Set-Content (Join-Path $runtimeDir "frontend.pid") -Force
            LogOk "Frontend PID: $($proc.Id)"

            $deadline = [DateTime]::Now.AddSeconds(25)
            while ([DateTime]::Now -lt $deadline) {
                $portPid = Find-PidOnPort $frontendPort
                if ($portPid) {
                    $portPid | Set-Content (Join-Path $runtimeDir "frontend.pid") -Force
                    LogOk "Frontend listening on :$frontendPort (PID $portPid)"
                    $frontendOk = $true
                    break
                }
                $alive = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
                if (-not $alive) { LogFail "Frontend process died"; break }
                Start-Sleep -Milliseconds 500
            }
            if (-not $frontendOk -and $proc) {
                $stillAlive = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
                if ($stillAlive) { LogWarn "Frontend started but :$frontendPort not yet bound" }
            }
        } else {
            LogFail "Failed to start frontend"
        }
    }
}

# ── Summary ────────────────────────────────────────────────────────
# Re-read the chosen ports from .runtime/*.port (the launcher may have
# fallen back from defaults to free ports due to zombie sockets).
$backendPort = 9420
$portFile = Join-Path $runtimeDir "backend.port"
if (Test-Path $portFile) { $backendPort = [int](Get-Content $portFile -ErrorAction SilentlyContinue) }

$frontendPort = 3000
$fePortFile = Join-Path $runtimeDir "frontend.port"
if (Test-Path $fePortFile) { $frontendPort = [int](Get-Content $fePortFile -ErrorAction SilentlyContinue) }

Write-Host ""
Write-Host "========================================" -ForegroundColor White
if ($backendOk) { Write-Host "  Backend:  http://localhost:$backendPort" -ForegroundColor Cyan } else { Write-Host "  Backend:  FAILED" -ForegroundColor Red }
if ($frontendOk) { Write-Host "  Frontend: http://localhost:$frontendPort" -ForegroundColor Cyan } elseif (-not $BackendOnly) { Write-Host "  Frontend: FAILED" -ForegroundColor Red }
Write-Host "  Health:   http://localhost:$backendPort/health" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor White
Write-Host ""
Write-Host "Stop: pwsh scripts/stop-all.ps1" -ForegroundColor Yellow

if ((-not $FrontendOnly -and -not $backendOk) -or (-not $BackendOnly -and -not $frontendOk -and (Test-Path (Join-Path $projectRoot "frontend")))) {
    exit 1
}
exit 0
