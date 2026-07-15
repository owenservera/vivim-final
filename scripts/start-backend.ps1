# scripts/start-backend.ps1
# Start the vivim backend server, fully detached (exits immediately, no hangs).
#
# PORT ROBUSTNESS (dev-loop anti-hangup):
# Windows leaves zombie LISTENING sockets whose PID is already dead. `Stop-Process`
# silently fails on them, so the default :9420 can be unbindable. This script:
#   1. Tries to free the requested port (kill by PID + PID file).
#   2. If still held by a zombie, walks UP to the next free port.
#   3. Records the chosen port in .runtime/backend.port so every client finds it.
#   4. Passes CAP_STORE_PORT so `serve` binds exactly that port.
# Usage: pwsh scripts/start-backend.ps1 [-Port 9420]

param(
    [int]$Port = 0
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

function Find-PidOnPort($port) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conns) { return $conns | Select-Object -First 1 -ExpandProperty OwningProcess }
    } catch {}
    return $null
}

function Kill-Pid($pidv) {
    if (-not $pidv) { return }
    try {
        $proc = Get-Process -Id $pidv -ErrorAction SilentlyContinue
        if ($proc) { Stop-Process -Id $pidv -Force -ErrorAction SilentlyContinue }
    } catch {}
}

function Stop-ByPidFile($name) {
    $pidFile = Join-Path $runtimeDir "$name.pid"
    if (Test-Path $pidFile) {
        $procPid = Get-Content $pidFile -ErrorAction SilentlyContinue
        if ($procPid) { Kill-Pid ([int]$procPid) }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}

# A port is "safe to bind" if nothing LISTENING is on it, OR the listener is a
# zombie (PID dead) which we can't kill but Windows will eventually reclaim —
# in that case we must skip to another port.
function Test-PortUsable($port) {
    $pidv = Find-PidOnPort $port
    if ($null -eq $pidv) { return $true }
    $proc = Get-Process -Id $pidv -ErrorAction SilentlyContinue
    if (-not $proc) {
        # Zombie socket: PID dead but still LISTENING. Unbindable.
        return $false
    }
    return $false  # occupied by a live process — kill then retry
}

function Free-Port($port) {
    $pidv = Find-PidOnPort $port
    if ($null -ne $pidv) { Kill-Pid $pidv }
    Start-Sleep -Milliseconds 400
    return (Find-PidOnPort $port) -eq $null
}

# Resolve starting port: explicit -Port > CAP_STORE_PORT env > 9420
$startPort = if ($Port -gt 0) { $Port } elseif ($env:CAP_STORE_PORT -and $env:CAP_STORE_PORT -match '^\d+$') { [int]$env:CAP_STORE_PORT } else { 9420 }

$bunExe = Resolve-Bun
Write-Host "[backend] Resolving port (start: $startPort)" -ForegroundColor Cyan

# Stop any prior backend we own, then try to free the start port.
Stop-ByPidFile "backend"
$freed = Free-Port $startPort

$chosenPort = $startPort
if (-not $freed) {
    # Start port unusable — walk upward to the first truly free port.
    LogWarn ":$startPort not free (zombie or live). Scanning for free port..."
    $candidate = $startPort + 1
    while ($candidate -lt ($startPort + 50)) {
        if (Test-PortUsable $candidate) { $chosenPort = $candidate; break }
        $candidate++
    }
    LogWarn "Falling back to :$chosenPort"
}

# Record the chosen port so all clients resolve it identically.
$chosenPort | Set-Content (Join-Path $runtimeDir "backend.port") -Force

$env:CAP_STORE_PORT = [string]$chosenPort
$proc = Start-Process -FilePath $bunExe -ArgumentList "run", "serve" `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput (Join-Path $runtimeDir "backend-out.log") `
    -RedirectStandardError (Join-Path $runtimeDir "backend-err.log") `
    -WindowStyle Hidden -PassThru -ErrorAction SilentlyContinue

if ($proc) {
    $proc.Id | Set-Content (Join-Path $runtimeDir "backend.pid") -Force
    LogOk "Launched PID: $($proc.Id) on :$chosenPort"

    $deadline = [DateTime]::Now.AddSeconds(30)
    while ([DateTime]::Now -lt $deadline) {
        $portPid = Find-PidOnPort $chosenPort
        if ($portPid) {
            $portPid | Set-Content (Join-Path $runtimeDir "backend.pid") -Force
            LogOk "Listening on :$chosenPort (PID $portPid)"
            exit 0
        }
        $alive = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
        if (-not $alive) { LogFail "Process died before binding"; exit 1 }
        Start-Sleep -Milliseconds 500
    }
    LogWarn "Started but :$chosenPort not yet bound (will retry in client)"
    exit 0
} else {
    LogFail "Failed to start"
    exit 1
}
