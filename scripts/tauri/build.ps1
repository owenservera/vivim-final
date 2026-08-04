# scripts/tauri/build.ps1
# Full Tauri V2 desktop build pipeline (NSIS only, no WIX).
#
# Build flow:
#   1. Compile Bun backend sidecar → src-tauri/binaries/vivim-server-x86_64-pc-windows-msvc.exe
#   2. Build Next.js as static export → frontend/out/ (via prepare-frontend.ts)
#   3. Run cargo tauri build → produces NSIS installer
#
# Prerequisites (one-time, Windows):
#   rustup target add x86_64-pc-windows-msvc
#   cargo install tauri-cli --version "^2"
#   winget install NSIS.NSIS
#   winget install UPX.UPX  (optional, for sidecar compression)
#
# Run from repo root:
#   pwsh scripts/tauri/build.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..' '..')
. (Join-Path $repoRoot 'scripts' '_shared.ps1')
$bunExe = Resolve-Bun

Write-Host '=== vivim Desktop Build (Tauri V2 + NSIS) ==='
Write-Host ''

# ── Step 1: Compile the Bun backend sidecar ─────────────────────────────────
Write-Host 'Step 1/2: Compiling sidecar...'
& pwsh (Join-Path $repoRoot 'scripts' 'tauri' 'build-sidecar.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host ''

# ── Step 2: Invoke Tauri CLI to build the NSIS installer ─────────────────────
# cargo tauri build automatically runs beforeBuildCommand (prepare-frontend.ts)
# so we don't need to build frontend separately - avoids double build
# Use --config to enable incremental Rust compilation for faster rebuilds
Write-Host 'Step 2/2: Running cargo tauri build (NSIS)...'
$env:CARGO_INCREMENTAL = '1'
$proc = Start-Process -FilePath 'cargo' -ArgumentList @('tauri', 'build', '--bundles', 'nsis') -WorkingDirectory (Join-Path $repoRoot 'src-tauri') -NoNewWindow -PassThru -Wait
if ($proc.ExitCode -ne 0) {
  Write-Error "cargo tauri build failed with exit code $($proc.ExitCode)"
  exit $proc.ExitCode
}

Write-Host ''
Write-Host '=== Build Complete ==='
Write-Host ''
Write-Host 'Output artifacts:'
$nsisGlob = Join-Path $repoRoot 'src-tauri' 'target' 'release' 'bundle' 'nsis' '*.exe'
foreach ($f in (Get-Item $nsisGlob -ErrorAction SilentlyContinue)) {
  $sizeMB = [math]::Round(($f.Length / 1MB), 1)
  Write-Host "  NSIS Installer: $($f.FullName) ($sizeMB MB)"
}
