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
