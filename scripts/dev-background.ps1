# scripts/dev-background.ps1
# Launch vivim backend (+optional frontend) as DETACHED background processes.
# Returns IMMEDIATELY — never blocks the caller. Readiness is checked in the
# background by a detached poller that writes .runtime/backend-ready.txt.
#
# ⚠ CRITICAL GUARDRAIL — never kill by process NAME. `opencode` and `bun` are the
#   names of the AGENT HARNESS itself (this session runs inside `opencode`).
#   Killing by name (Get-Process -Name "opencode" | Stop-Process) kills the
#   harness we are running under. ONLY ever kill exact PIDs written to
#   .runtime/<name>.pid by this script. Readiness/health are read-only probes.
#
# Usage:
#   pwsh scripts/dev-background.ps1                 # backend only (default)
#   pwsh scripts/dev-background.ps1 -Frontend       # backend + frontend
#   pwsh scripts/dev-background.ps1 -FrontendOnly   # frontend only
#
# State in .runtime/:
#   backend.pid / backend.log / backend.err / backend-ready.txt (when ready)
#   frontend.pid / frontend.log / frontend.err

param(
  [switch]$Frontend,
  [switch]$FrontendOnly
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Runtime = Join-Path $Root '.runtime'
New-Item -ItemType Directory -Force -Path $Runtime | Out-Null

function Kill-Tree([int]$targetPid) {
  # PID-targeted only. NEVER kill by process name here (see guardrail above).
  # NOTE: param must not be named `$pid` — PowerShell's `$PID` is read-only.
  if (-not $targetPid) { return }
  taskkill /PID $targetPid /F /T 2>$null | Out-Null
}

function Start-Detached([string]$name, [string]$cmd, [string[]]$cmdArgs) {
  $pidFile = Join-Path $Runtime "$name.pid"
  $oldPid = if (Test-Path $pidFile) { Get-Content $pidFile -ErrorAction SilentlyContinue } else { $null }
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    Write-Host "killing stale $name (PID $oldPid)"
    Kill-Tree $oldPid
  }
  $outLog = Join-Path $Runtime "$name.log"
  $errLog = Join-Path $Runtime "$name.err"
  Remove-Item $outLog, $errLog -ErrorAction SilentlyContinue
  # NOTE: param must not be named `$args` — PowerShell's automatic `$args` wins,
  # silently dropping the arguments (bun then prints help and exits).
  $p = Start-Process -FilePath $cmd -ArgumentList $cmdArgs -WorkingDirectory $Root `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru -WindowStyle Hidden
  $p.Id | Set-Content $pidFile
  Write-Host "started $name (PID $($p.Id)) -> $outLog"
}

if (-not $FrontendOnly) {
  Start-Detached 'backend' 'bun' @('run', 'dev:backend')
}
if ($Frontend -or $FrontendOnly) {
  Start-Detached 'frontend' 'bun' @('run', 'dev:frontend')
}

# Detached background poller — writes .runtime/backend-status.txt on EVERY probe
# (elapsed, last HTTP result, opencode serve listener scan) so the state is
# ALWAYS observable: you can tell "booting" from "stuck" at any moment, not just
# after the 180s deadline. Writes .runtime/backend-ready.txt once /api/health 200.
# The caller NEVER waits.
Remove-Item (Join-Path $Runtime 'backend-ready.txt') -ErrorAction SilentlyContinue
$pollerBody = @'
$deadline = (Get-Date).AddSeconds(180)
$lastProbe = 'pending'
$started = Get-Date
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 3
  $elapsed = [Math]::Round(((Get-Date) - $started).TotalSeconds)
  $serveScan = ''
  try {
    $procs = Get-CimInstance Win32_Process -Filter "Name='opencode.exe'" -ErrorAction SilentlyContinue
    $serve = $procs | Where-Object { $_.CommandLine -match 'serve' }
    if ($serve) { $serveScan = $serve | ForEach-Object { "$($_.ProcessId):$($_.CommandLine -replace '.*serve', 'serve')" } | Select-Object -First 3 }
  } catch { $serveScan = 'scan-failed' }
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:9420/api/health' -TimeoutSec 3 -UseBasicParsing
    $lastProbe = "health=$($r.StatusCode)"
    if ($r.StatusCode -eq 200) {
      $state = [PSCustomObject]@{
        state = 'ready'; readyAt = (Get-Date).ToString('o'); port = 9420; elapsedSec = $elapsed
        lastProbe = $lastProbe; serve = $serveScan
      }
      $state | ConvertTo-Json | Set-Content "$env:RUNTIME\backend-ready.txt"
      $state | ConvertTo-Json | Set-Content "$env:RUNTIME\backend-status.txt"
      exit 0
    }
  } catch {
    $lastProbe = "health-error: $($_.Exception.Message)"
  }
  # Progressive status — proves we are still polling (booting) vs dead (stuck).
  [PSCustomObject]@{
    state = 'booting'; elapsedSec = $elapsed; lastProbe = $lastProbe; serve = $serveScan
    note = 'still polling; ready at health 200. stuck iff this stops advancing or hits READY_TIMEOUT.'
  } | ConvertTo-Json | Set-Content "$env:RUNTIME\backend-status.txt"
}
"READY_TIMEOUT" | Set-Content "$env:RUNTIME\backend-ready.txt"
[PSCustomObject]@{ state = 'timeout'; elapsedSec = [Math]::Round(((Get-Date) - $started).TotalSeconds); lastProbe = $lastProbe }
  | ConvertTo-Json | Set-Content "$env:RUNTIME\backend-status.txt"
exit 1
'@
$env:RUNTIME = $Runtime
$pollerPath = Join-Path $Runtime 'backend-poller.ps1'
Set-Content -Path $pollerPath -Value $pollerBody -Encoding utf8
# The poller must redirect its own stdout/stderr to files. Otherwise it inherits
# the caller's pipe and a tool/terminal invoking this script blocks until the
# poller exits (up to 180s) — that is the "locks you up" symptom.
Start-Process -FilePath 'pwsh' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',$pollerPath `
  -RedirectStandardOutput (Join-Path $Runtime 'backend-poller.log') `
  -RedirectStandardError (Join-Path $Runtime 'backend-poller.err') `
  -WindowStyle Hidden | Out-Null
Write-Host 'launched detached — poller writing .runtime/backend-status.txt + backend-ready.txt in background'
