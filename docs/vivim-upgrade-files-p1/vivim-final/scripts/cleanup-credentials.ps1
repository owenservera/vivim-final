# cleanup-credentials.ps1
# One consistent strategy: strip saved passwords + session cookies from every
# Chrome --user-data-dir profile under the listed roots, WITHOUT deleting the
# profile directories themselves (the system resolves profiles by path).
#
# Usage (from repo root):
#   pwsh scripts/cleanup-credentials.ps1            # execute
#   pwsh scripts/cleanup-credentials.ps1 -DryRun    # preview only, no deletes
#
# After running, every profile is logged out and its saved gmail password is
# forgotten. You re-login fresh from scratch.

param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# Repo root via $PSScriptRoot so paths never collapse.
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

# Canonical profile base — must match config.profileBaseDir / getProfileBaseDir().
# This is where NEW profiles are saved after the redesign; it is the primary
# target so the "one consistent strategy" stays valid going forward.
$canonicalBase = $env:CAP_STORE_PROFILE_DIR
if (-not $canonicalBase) {
  if ($IsWindows -or $env:OS -like '*Windows*') {
    $local = $env:LOCALAPPDATA
    $canonicalBase = Join-Path $local 'vivim\cap-store\chrome-profiles'
  } else {
    $home = $env:HOME
    $canonicalBase = if ($home -like '*.local*') {
      Join-Path $home 'share/vivim/cap-store/chrome-profiles'
    } else {
      Join-Path $home '.local/share/vivim/cap-store/chrome-profiles'
    }
  }
}

# All Chrome profile roots to sweep. The canonical base is primary (absolute,
# used as-is); the six legacy top-level dirs + data/chrome-profiles are joined to
# the repo root and swept for backward safety (old inconsistent locations).
$legacyRoots = @(
  'chatgpt'
  'claude'
  'gemini'
  'prov_claude'
  'chrome-profiles'
  'data/chrome-profiles'
) | ForEach-Object { Join-Path $repoRoot $_ }

$roots = @($canonicalBase) + $legacyRoots

# Credential / session artifacts to remove (by exact name, recursive).
$targetNames = @(
  'Login Data'          # saved passwords (SQLite)
  'Login Data-journal'
  'Cookies'             # legacy root-level cookies (SQLite)
  'Cookies-journal'
  'Network/Cookies'     # current Chrome cookie store
  'Network/Cookies-journal'
)

$singletonLock = 'SingletonLock'

function Stop-ChromeIfRunning {
  $procs = Get-Process -Name 'chrome' -ErrorAction SilentlyContinue
  if ($procs) {
    Write-Host "  [warn] chrome.exe is running ($($procs.Count) proc(s)); credential files may be locked." -ForegroundColor Yellow
    Write-Host "         stop the browser first (scripts/stop-all.ps1) for a clean wipe." -ForegroundColor Yellow
  }
}

$totalDeleted = 0
$totalBytes = 0

foreach ($root in $roots) {
  if (-not (Test-Path -LiteralPath $root)) {
    Write-Host "[skip] missing: $root" -ForegroundColor DarkGray
    continue
  }
  Write-Host "[root] $root" -ForegroundColor Cyan

  # Resolve every file matching a target name anywhere under the root.
  $matches = @()
  Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    foreach ($t in $targetNames) {
      if ($_.FullName.Replace('\', '/') -like "*/$t" -or $_.Name -eq $t) {
        $matches += $_
        break
      }
    }
  }
  # Also drop SingletonLock so a stale lock can't block a fresh launch.
  Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq $singletonLock } | ForEach-Object { $matches += $_ }

  if (-not $matches) {
    Write-Host '  (nothing to clean)' -ForegroundColor DarkGray
    continue
  }

  foreach ($f in $matches) {
    $size = if ($f.Length) { $f.Length } else { 0 }
    if ($DryRun) {
      Write-Host "  [dry] would delete: $($f.FullName)  ($size bytes)" -ForegroundColor Magenta
    } else {
      try {
        Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop
        Write-Host "  [del] $($f.FullName)  ($size bytes)" -ForegroundColor Green
        $totalDeleted++
        $totalBytes += $size
      } catch {
        Write-Host "  [fail] $($f.FullName) -> $_" -ForegroundColor Red
      }
    }
  }
  Stop-ChromeIfRunning
}

if ($DryRun) {
  Write-Host "`nDryRun complete. Re-run without -DryRun to actually delete." -ForegroundColor Magenta
} else {
  Write-Host "`nDone. Deleted $totalDeleted file(s), $totalBytes byte(s)." -ForegroundColor Green
  Write-Host 'All profiles are now logged out with saved passwords cleared.' -ForegroundColor Green
  Write-Host 'Next: launch the system and perform a fresh login from scratch.' -ForegroundColor Green
}
