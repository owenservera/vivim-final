# scripts/start-all.ps1
# Start both backend (:9420) and frontend (:5173).
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

function Log($msg) { Write-Host "  $(Get-Date -Format 'HH:mm:ss.fff') $msg" -ForegroundColor DarkGray }
function LogOk($msg) { Write-Host "  $(Get-Date -Format 'HH:mm:ss.fff') [OK] $msg" -ForegroundColor Green }
function LogWarn($msg) { Write-Host "  $(Get-Date -Format 'HH:mm:ss.fff') [WARN] $msg" -ForegroundColor Yellow }
function LogFail($msg) { Write-Host "  $(Get-Date -Format 'HH:mm:ss.fff') [FAIL] $msg" -ForegroundColor Red }

function Resolve-Bun {
    $candidates = @(
        "C:\Users\VIVIM.inc\.bun\bin\bun.exe",
        (Join-Path $env:LOCALAPPDATA "bun\bun.exe"),
        "C:\Program Files\bun\bun.exe"
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { return $c }
    }
    $cmd = Get-Command bun -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return "bun"
}

function Kill-Port($port) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        foreach ($conn in $conns) {
            try { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
        }
        Start-Sleep -Milliseconds 300
    } catch {}
}

function Stop-ByPidFile($name) {
    $pidFile = Join-Path $runtimeDir "$name.pid"
    if (Test-Path $pidFile) {
        $procPid = Get-Content $pidFile -ErrorAction SilentlyContinue
        if ($procPid) {
            try { Stop-Process -Id ([int]$procPid) -Force -ErrorAction SilentlyContinue } catch {}
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}

function Find-PidOnPort($port) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conns) { return $conns | Select-Object -First 1 -ExpandProperty OwningProcess }
    } catch {}
    return $null
}

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

    # Clear old logs
    $backendLog = Join-Path $runtimeDir "backend-out.log"
    $backendErr = Join-Path $runtimeDir "backend-err.log"
    if (Test-Path $backendLog) { Clear-Content $backendLog -ErrorAction SilentlyContinue }
    if (Test-Path $backendErr) { Clear-Content $backendErr -ErrorAction SilentlyContinue }

    # ── Resolve backend port (zombie-safe) ──
    $backendPort = 9420
    $portPid = Find-PidOnPort $backendPort
    if ($portPid) {
        $proc = Get-Process -Id $portPid -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $portPid -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 400
        }
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
        -RedirectStandardOutput $backendLog `
        -RedirectStandardError $backendErr `
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
    Stop-ByPidFile "frontend"
    Kill-Port 5173

    $frontendDir = Join-Path $projectRoot "web\ui"
    if (-not (Test-Path $frontendDir)) {
        LogWarn "Frontend dir missing: $frontendDir"
    } else {
        if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
            Log "Installing frontend deps..."
            Push-Location $frontendDir
            & $bunExe install
            Pop-Location
        }

        Log "Phase 3: Launch frontend on :5173"
        $proc = Start-Process -FilePath $bunExe -ArgumentList "run", "vite", "dev", "--port", "5173", "--strictPort" `
            -WorkingDirectory $frontendDir `
            -RedirectStandardOutput (Join-Path $runtimeDir "frontend-out.log") `
            -RedirectStandardError (Join-Path $runtimeDir "frontend-err.log") `
            -WindowStyle Hidden `
            -PassThru `
            -ErrorAction SilentlyContinue

        if ($proc) {
            $proc.Id | Set-Content (Join-Path $runtimeDir "frontend.pid") -Force
            LogOk "Frontend PID: $($proc.Id)"

            $deadline = [DateTime]::Now.AddSeconds(25)
            while ([DateTime]::Now -lt $deadline) {
                $portPid = Find-PidOnPort 5173
                if ($portPid) {
                    $portPid | Set-Content (Join-Path $runtimeDir "frontend.pid") -Force
                    LogOk "Frontend listening on :5173 (PID $portPid)"
                    $frontendOk = $true
                    break
                }
                $alive = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
                if (-not $alive) { LogFail "Frontend process died"; break }
                Start-Sleep -Milliseconds 500
            }
            if (-not $frontendOk -and $proc) {
                $stillAlive = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
                if ($stillAlive) { LogWarn "Frontend started but :5173 not yet bound" }
            }
        } else {
            LogFail "Failed to start frontend"
        }
    }
}

# ── Summary ────────────────────────────────────────────────────────
$backendPort = 9420
$portFile = Join-Path $runtimeDir "backend.port"
if (Test-Path $portFile) { $backendPort = [int](Get-Content $portFile -ErrorAction SilentlyContinue) }

Write-Host ""
Write-Host "========================================" -ForegroundColor White
if ($backendOk) { Write-Host "  Backend:  http://localhost:$backendPort" -ForegroundColor Cyan } else { Write-Host "  Backend:  FAILED" -ForegroundColor Red }
if ($frontendOk) { Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan } elseif (-not $BackendOnly) { Write-Host "  Frontend: FAILED" -ForegroundColor Red }
Write-Host "  Health:   http://localhost:$backendPort/health" -ForegroundColor Gray
Write-Host "  Logs:     .runtime/*.log" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor White
Write-Host ""
Write-Host "Stop: pwsh scripts/stop-all.ps1" -ForegroundColor Yellow

if ((-not $FrontendOnly -and -not $backendOk) -or (-not $BackendOnly -and -not $frontendOk -and (Test-Path (Join-Path $projectRoot "web\ui")))) {
    exit 1
}
exit 0
