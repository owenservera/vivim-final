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
. (Join-Path $PSScriptRoot '_shared.ps1')

function Log($msg) { Write-Output "  $(Get-Date -Format 'HH:mm:ss.fff') $msg" }
function LogOk($msg) { Write-Output "  $(Get-Date -Format 'HH:mm:ss.fff') [OK] $msg" }
function LogWarn($msg) { Write-Output "  $(Get-Date -Format 'HH:mm:ss.fff') [WARN] $msg" }
function LogFail($msg) { Write-Output "  $(Get-Date -Format 'HH:mm:ss.fff') [FAIL] $msg" }

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
Log "[backend] Resolving port (start: $startPort)"

# Stop any prior backend we own, then try to free the start port.
Stop-ByPidFile $runtimeDir "backend"
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

# Launch backend — NO stdout/stderr redirect (prevents pipe deadlock with bun.exe).
# Output goes to the terminal; log files are unnecessary since we poll the port.
$env:CAP_STORE_PORT = [string]$chosenPort
$proc = Start-Process -FilePath $bunExe -ArgumentList "run", "serve" `
    -WorkingDirectory $projectRoot `
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
