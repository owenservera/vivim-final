# Fast registry-based uninstall — cleans BOTH HKLM and HKCU (elevated)
$found = $false

# Check HKLM (needs admin)
$apps = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -eq 'vivim' }
if ($apps) {
  foreach ($app in $apps) {
    $code = $app.PSChildName
    Write-Host "Found vivim in HKLM ($code), uninstalling..."
    Start-Process msiexec.exe -ArgumentList "/x $code /qn /norestart" -Verb RunAs -Wait
    Write-Host "Uninstalled from HKLM."
    $found = $true
  }
}

# Check HKCU
$apps = Get-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -eq 'vivim' -or $_.DisplayName -eq 'Vivim Desktop' }
if ($apps) {
  foreach ($app in $apps) {
    $code = $app.PSChildName
    Write-Host "Found $($app.DisplayName) in HKCU ($code), uninstalling..."
    if ($app.UninstallString -like 'MsiExec*') {
      Start-Process msiexec.exe -ArgumentList "/x $code /qn /norestart" -Verb RunAs -Wait
    } else {
      # NSIS uninstaller
      $uninst = $app.UninstallString -replace '"', ''
      Start-Process $uninst -ArgumentList '/S' -Wait -NoNewWindow
    }
    Write-Host "Uninstalled from HKCU."
    $found = $true
  }
}

if (-not $found) {
  Write-Host "No existing vivim install found."
}
