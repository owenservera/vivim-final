# scripts/tauri/build-installer.ps1
# Full installer build pipeline: sidecar + frontend + NSIS
#
# Usage: pwsh scripts/tauri/build-installer.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..' '..')
. (Join-Path $repoRoot 'scripts' '_shared.ps1')
$bunExe = Resolve-Bun

Write-Host "=== Vivim Desktop Installer Build ==="
Write-Host ""

# Step 1: Build sidecar with UPX compression
Write-Host "Step 1: Building sidecar with UPX compression..."
$proc = Start-Process -FilePath $bunExe -ArgumentList @('run', 'scripts/tauri/compile-sidecar.ts') -WorkingDirectory $repoRoot -NoNewWindow -PassThru -Wait
if ($proc.ExitCode -ne 0) { throw "sidecar build failed with exit code $($proc.ExitCode)" }
Write-Host ""

# Step 2: Build frontend
Write-Host "Step 2: Building frontend..."
Set-Location (Join-Path $repoRoot 'frontend')
& $bunExe run build 2>&1
if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }
Set-Location $repoRoot
Write-Host ""

# Step 3: Copy frontend static files to output directory
Write-Host "Step 3: Preparing frontend static files..."
$frontendOut = Join-Path $repoRoot 'frontend' 'out'
$installerDir = Join-Path $repoRoot 'scripts' 'tauri'
$frontendDest = Join-Path $installerDir 'frontend'

if (Test-Path $frontendDest) { Remove-Item $frontendDest -Recurse -Force }
Copy-Item $frontendOut $frontendDest -Recurse
Write-Host "Frontend files copied to: $frontendDest"
Write-Host ""

# Step 4: Build NSIS installer
Write-Host "Step 4: Building NSIS installer..."
$nsisPath = "C:\Program Files (x86)\NSIS\makensis.exe"
$nsiScript = Join-Path $installerDir 'installer.nsi'

if (-not (Test-Path $nsisPath)) {
    Write-Host "WARNING: NSIS not found at $nsisPath"
    Write-Host "Please install NSIS: winget install NSIS.NSIS"
    Write-Host "Skipping installer creation..."
} else {
    $proc = Start-Process -FilePath $nsisPath -ArgumentList $nsiScript -WorkingDirectory $installerDir -NoNewWindow -PassThru -Wait
    if ($proc.ExitCode -ne 0) { throw "NSIS build failed with exit code $($proc.ExitCode)" }
    
    $installer = Join-Path $installerDir 'vivim-desktop-setup.exe'
    if (Test-Path $installer) {
        $sizeMB = [math]::Round((Get-Item $installer).Length / 1MB, 1)
        Write-Host "Installer created: $installer ($sizeMB MB)"
    } else {
        Write-Host "WARNING: Installer not created"
    }
}

# Cleanup
Write-Host ""
Write-Host "Cleaning up..."
if (Test-Path $frontendDest) { Remove-Item $frontendDest -Recurse -Force }

Write-Host ""
Write-Host "=== Build Complete ==="