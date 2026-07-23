# scripts/start-frontend.ps1
# Start the vivim frontend dev server on :3000 (Next.js)
# FULLY DETACHED — exits immediately. No hangs.
# Usage: pwsh scripts/start-frontend.ps1 [-Port 3000]

param(
    [int]$Port = 3000
)

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $projectRoot) { $projectRoot = $PWD.Path }
$frontendDir = Join-Path $projectRoot "frontend"
$runtimeDir = Join-Path $projectRoot ".runtime"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
. (Join-Path $PSScriptRoot '_shared.ps1')

function Log($msg) { Write-Output "  $(Get-Date -Format 'HH:mm:ss.fff') $msg" }
function LogOk($msg) { Write-Output "  $(Get-Date -Format 'HH:mm:ss.fff') [OK] $msg" }
function LogWarn($msg) { Write-Output "  $(Get-Date -Format 'HH:mm:ss.fff') [WARN] $msg" }
function LogFail($msg) { Write-Output "  $(Get-Date -Format 'HH:mm:ss.fff') [FAIL] $msg" }

$bunExe = Resolve-Bun

if (-not (Test-Path $frontendDir)) {
    LogFail "Frontend dir not found: $frontendDir"
    exit 1
}

Write-Output "[frontend] Resolving port (start: $Port)"

Stop-ByPidFile $runtimeDir "frontend"
Kill-Port $Port

# Mirror backend: if the start port is still held by a foreign process, walk
# UP to the first free port instead of hard-failing on --strictPort.
$chosenPort = $Port
if (-not (Test-PortFree $chosenPort)) {
    LogWarn ":$Port not free (zombie or live). Scanning for free port..."
    $candidate = $Port + 1
    while ($candidate -lt ($Port + 50)) {
        if (Test-PortFree $candidate) { $chosenPort = $candidate; break }
        $candidate++
    }
    LogWarn "Falling back to :$chosenPort"
}

# Record the chosen port so all clients resolve it identically.
$chosenPort | Set-Content (Join-Path $runtimeDir "frontend.port") -Force

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Log "Installing deps..."
    Push-Location $frontendDir
    & $bunExe install
    Pop-Location
}

$proc = Start-Process -FilePath $bunExe -ArgumentList "run", "dev" `
    -WorkingDirectory $frontendDir `
    -WindowStyle Hidden -PassThru -ErrorAction SilentlyContinue

if ($proc) {
    $proc.Id | Set-Content (Join-Path $runtimeDir "frontend.pid") -Force
    LogOk "PID: $($proc.Id)"

    $deadline = [DateTime]::Now.AddSeconds(25)
    while ([DateTime]::Now -lt $deadline) {
        $portPid = Find-PidOnPort $chosenPort
        if ($portPid) {
            $portPid | Set-Content (Join-Path $runtimeDir "frontend.pid") -Force
            LogOk "Listening on :$chosenPort (PID $portPid)"
            exit 0
        }
        $alive = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
        if (-not $alive) { LogFail "Process died"; exit 1 }
        Start-Sleep -Milliseconds 500
    }
    LogWarn "Started but :$chosenPort not yet bound"
    exit 0
} else {
    LogFail "Failed to start"
    exit 1
}
