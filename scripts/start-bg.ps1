# scripts/start-bg.ps1
# Launch start-all.ps1 in a truly detached process — returns immediately.
# Usage: pwsh scripts/start-bg.ps1

$projectRoot = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $projectRoot "scripts\start-all.ps1"

Write-Host "[start-bg] Launching $scriptPath in background..."

$proc = Start-Process -FilePath pwsh -WindowStyle Hidden -PassThru `
  -ArgumentList "-NoProfile", "-File", $scriptPath `
  -WorkingDirectory $projectRoot

Write-Host "[start-bg] Started PID $($proc.Id) — detached, no wait."
Write-Host "[start-bg] Check health later: http://localhost:9420/health"
