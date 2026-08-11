# scripts/tauri/build-sidecar.ps1
# Packages the Vivim Bun backend as a Tauri sidecar.
#
# PACKAGING MODEL (see ADR-016, validated 2026-07-19):
#   Compile the backend to a single standalone exe via `bun build --compile`.
#   Verified end-to-end: the compiled exe boots the full 13-engine stack and
#   passes the desktop smoke test in ~8s. Two gotchas are already handled in
#   src/desktop/sidecar-entry.ts:
#     1. DATABASE_URL is forced to an absolute app-data path (relative paths
#        cause Prisma "Error code 14" inside the standalone runtime).
#     2. NODE_ENV=production disables pino-pretty's worker thread.
#
# BINARY SIZE OPTIMIZATION:
#   The Bun runtime baseline is ~94 MB on Windows (irreducible).
#   Our app code adds ~3 MB on top. UPX compression reduces the final binary
#   to ~45 MB (47% reduction) with level 3 and --no-lzma for speed.
#
# PowerShell-compatible. Run from repo root:
#   pwsh scripts/tauri/build-sidecar.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..' '..')
. (Join-Path $repoRoot 'scripts' '_shared.ps1')
$bunExe = Resolve-Bun

Write-Host "Compiling sidecar with UPX compression..."
Write-Host "  Entry: src/desktop/sidecar-entry.ts"
Write-Host "  Strategy: Bundle → Compile → UPX compress (level 3)"
Write-Host ""

$proc = Start-Process -FilePath $bunExe -ArgumentList @('run', 'scripts/tauri/compile-sidecar.ts') -WorkingDirectory $repoRoot -NoNewWindow -PassThru -Wait
if ($proc.ExitCode -ne 0) { throw "sidecar compile failed with exit code $($proc.ExitCode)" }

$triple = (& rustc --print host-tuple).Trim()
$outExe = Join-Path $repoRoot 'src-tauri' 'binaries' "vivim-server-$triple.exe"
if (-not (Test-Path $outExe)) { throw "sidecar compile failed: $outExe not produced" }

$sizeMB = [math]::Round((Get-Item $outExe).Length / 1MB, 1)
Write-Host ""
Write-Host "Sidecar built: $outExe ($sizeMB MB)"
Write-Host "Next: pwsh scripts/tauri/build.ps1  (builds frontend + NSIS installer)"
