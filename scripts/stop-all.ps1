# scripts/stop-all.ps1
# Stop all vivim services (backend + frontend).
# Infallible: tries PID files, falls back to port scan, always exits cleanly.
# Usage: pwsh scripts/stop-all.ps1

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $projectRoot) { $projectRoot = $PWD.Path }
$runtimeDir = Join-Path $projectRoot ".runtime"
. (Join-Path $PSScriptRoot '_shared.ps1')

function Log($msg) { Write-Host "  $(Get-Date -Format 'HH:mm:ss.fff') $msg" -ForegroundColor DarkGray }
function LogOk($msg) { Write-Host "  $(Get-Date -Format 'HH:mm:ss.fff') [OK] $msg" -ForegroundColor Green }
function LogWarn($msg) { Write-Host "  $(Get-Date -Format 'HH:mm:ss.fff') [WARN] $msg" -ForegroundColor Yellow }
function LogStep($msg) { Write-Host "`n$(Get-Date -Format 'HH:mm:ss.fff') >>> $msg" -ForegroundColor Cyan }

function Kill-Tree($procId) {
    if (-not $procId) { return }
    Log "  taskkill /PID $procId /T /F"
    try { taskkill.exe /PID $procId /T /F 2>$null } catch {}
}

function Stop-Service($name, $port) {
    LogStep "Stopping $name"
    $stopped = $false

    # PID file
    $pidFile = Join-Path $runtimeDir "$name.pid"
    if (Test-Path $pidFile) {
        $procPid = Get-Content $pidFile -ErrorAction SilentlyContinue
        if ($procPid) {
            Log "  PID file: $pidFile (PID $procPid)"
            Kill-Tree ([int]$procPid)
            $stopped = $true
        } else {
            Log "  PID file empty: $pidFile"
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    } else {
        Log "  No PID file at $pidFile"
    }

    # Port fallback
    Kill-Port $port

    # Orphan sweep — only kill bun/node processes whose command line contains the project root
    Log "  Scanning for orphaned project-scoped bun/node processes..."
    $orphans = @()
    $projectRootLower = $projectRoot.ToLower()
    foreach ($p in Get-Process -Name "bun","node" -ErrorAction SilentlyContinue) {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine -and $cmdLine.ToLower().Contains($projectRootLower)) {
                $orphans += "$($p.Id) ($($p.ProcessName))"
                Kill-Tree $p.Id
                $stopped = $true
            }
        } catch {
            # If we can't query the process, skip it (safe default: don't kill unknown processes)
        }
    }
    if ($orphans.Count -gt 0) { Log "  Killed project orphans: $($orphans -join ', ')" }
    else { Log "  No orphaned project bun/node processes found" }

    # Verify port free
    Start-Sleep -Milliseconds 300
    $stillOpen = $false
    $tcp = $null
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $port)
        $stillOpen = $true
    } catch {} finally {
        if ($tcp) { $tcp.Dispose() }
    }

    if ($stillOpen) { LogWarn "$name may still be on :$port" }
    else { LogOk "$name stopped (port $port free)" }
}

Write-Host "[stop-all] Stopping vivim services..." -ForegroundColor Yellow
Log "Runtime dir: $runtimeDir"

# Read the actual backend port (zombie-safe: launcher may have fallen back from 9420)
$backendPort = 9420
$portFile = Join-Path $runtimeDir "backend.port"
if (Test-Path $portFile) {
    $readPort = Get-Content $portFile -ErrorAction SilentlyContinue
    if ($readPort -match '^\d+$') { $backendPort = [int]$readPort }
}

Stop-Service "backend" $backendPort
Stop-Service "frontend" 3000

Write-Host ""
LogOk "All services stopped"
exit 0
