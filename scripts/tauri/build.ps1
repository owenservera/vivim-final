# scripts/tauri/build.ps1
# Full Tauri desktop build: compile sidecar, then invoke `cargo tauri build`.
# PowerShell-compatible. Run from repo root:
#   pwsh scripts/tauri/build.ps1
#
# Prerequisites (one-time):
#   rustup target add x86_64-pc-windows-msvc
#   cargo install tauri-cli --version "^2"   (or: bunx @tauri-apps/cli)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..' '..')

# 1) Compile the Bun backend sidecar.
& pwsh (Join-Path $repoRoot 'scripts' 'tauri' 'build-sidecar.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 2) Build the web/ui frontend for production (frontendDist = web/ui/dist).
Write-Host "Building web/ui frontend..."
$proc = Start-Process -FilePath 'bun' -ArgumentList @('run', 'web:build') -WorkingDirectory $repoRoot -NoNewWindow -PassThru -Wait
if ($proc.ExitCode -ne 0) { exit $proc.ExitCode }

# 3) Invoke the Tauri CLI to bundle the MSI/NSIS/updater artifacts.
Write-Host "Running cargo tauri build..."
$proc = Start-Process -FilePath 'cargo' -ArgumentList @('tauri', 'build') -WorkingDirectory (Join-Path $repoRoot 'src-tauri') -NoNewWindow -PassThru -Wait
exit $proc.ExitCode
