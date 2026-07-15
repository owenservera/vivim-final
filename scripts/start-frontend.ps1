# scripts/start-frontend.ps1
# Start the vivim frontend dev server on :5173
# FULLY DETACHED — exits immediately. No hangs.
# Usage: pwsh scripts/start-frontend.ps1 [-Port 5173]

param(
    [int]$Port = 5173
)

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $projectRoot) { $projectRoot = $PWD.Path }
$frontendDir = Join-Path $projectRoot "web\ui"
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
        if ($procPid) { try { Stop-Process -Id ([int]$procPid) -Force -ErrorAction SilentlyContinue } catch {} }
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

$bunExe = Resolve-Bun

if (-not (Test-Path $frontendDir)) {
    LogFail "Frontend dir not found: $frontendDir"
    exit 1
}

Write-Host "[frontend] Starting on :$Port" -ForegroundColor Cyan

Stop-ByPidFile "frontend"
Kill-Port $Port

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Log "Installing deps..."
    Push-Location $frontendDir
    & $bunExe install
    Pop-Location
}

$proc = Start-Process -FilePath $bunExe -ArgumentList "run", "vite", "dev", "--port", $Port, "--strictPort" `
    -WorkingDirectory $frontendDir `
    -WindowStyle Hidden -PassThru -ErrorAction SilentlyContinue

if ($proc) {
    $proc.Id | Set-Content (Join-Path $runtimeDir "frontend.pid") -Force
    LogOk "PID: $($proc.Id)"

    $deadline = [DateTime]::Now.AddSeconds(25)
    while ([DateTime]::Now -lt $deadline) {
        $portPid = Find-PidOnPort $Port
        if ($portPid) {
            $portPid | Set-Content (Join-Path $runtimeDir "frontend.pid") -Force
            LogOk "Listening on :$Port (PID $portPid)"
            exit 0
        }
        $alive = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
        if (-not $alive) { LogFail "Process died"; exit 1 }
        Start-Sleep -Milliseconds 500
    }
    LogWarn "Started but :$Port not yet bound"
    exit 0
} else {
    LogFail "Failed to start"
    exit 1
}
