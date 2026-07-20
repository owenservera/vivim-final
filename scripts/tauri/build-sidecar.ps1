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
# PowerShell-compatible. Run from repo root:
#   pwsh scripts/tauri/build-sidecar.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..' '..')
$triple = (& rustc --print host-tuple).Trim()
$binDir = Join-Path $repoRoot 'src-tauri' 'binaries'
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$entry = Join-Path $repoRoot 'src' 'desktop' 'sidecar-entry.ts'
$outExe = Join-Path $binDir "vivim-server-$triple.exe"

Write-Host "Compiling sidecar: $entry -> $outExe"
& bun build --compile $entry --outfile $outExe 2>&1 | ForEach-Object { Write-Host $_ }
if (-not (Test-Path $outExe)) { throw "sidecar compile failed: $outExe not produced" }

Write-Host "Sidecar built: $outExe"
Write-Host "Next: pwsh scripts/tauri/build.ps1  (runs tauri build -> MSI/NSIS/updater)"
Write-Host "NOTE: install step must `bunx prisma db push` the app-data DB (migrate deploy is broken: P3009)."
