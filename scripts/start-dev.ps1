Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
Set-Location $root

Write-Output "[dev] Starting vivim-final dev stack..."
& "C:\Users\VIVIM.inc\.bun\bin\bun.exe" run dev
