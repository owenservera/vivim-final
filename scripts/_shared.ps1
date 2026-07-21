# scripts/_shared.ps1
# Shared helpers for all service-management scripts.
# Dot-source this file at the top of each script:
#   . (Join-Path $PSScriptRoot '_shared.ps1')

# ── bun resolution ──────────────────────────────────────────────────────
# On this machine `bun` resolves to bun.ps1 (npm wrapper). Start-Process /
# call-operator on a .ps1 spawns a nested pwsh that deadlocks on redirected
# pipes. This function always returns the real bun.exe.

function Resolve-Bun {
    $candidates = @(
        "C:\Users\VIVIM.inc\.bun\bin\bun.exe",
        (Join-Path $env:LOCALAPPDATA "bun\bun.exe"),
        "C:\Program Files\bun\bun.exe"
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c)) { return $c }
    }

    $cmd = Get-Command bun -ErrorAction SilentlyContinue
    if ($cmd) {
        $src = $cmd.Source
        if ($src -like '*.ps1') {
            $basedir = Split-Path -Parent $src
            $realExe = Join-Path $basedir "node_modules\bun\bin\bun.exe"
            if (Test-Path -LiteralPath $realExe) { return $realExe }
            $altExe = Join-Path $env:LOCALAPPDATA "bun\bun.exe"
            if (Test-Path -LiteralPath $altExe) { return $altExe }
            Write-Warning "bun resolved to .ps1 wrapper ($src) but real bun.exe not found; commands may hang."
            return $src
        }
        if (Test-Path -LiteralPath $src) { return $src }
    }

    $onPath = Get-Command bun.exe -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }

    Write-Warning "bun not found on PATH."
    return "bun"
}

# ── port / PID helpers ─────────────────────────────────────────────────
# Uses `netstat -ano` instead of Get-NetTCPConnection which hangs on
# Windows with zombie sockets (PID dead but LISTENING state persists).

function Find-PidOnPort($port) {
    try {
        $line = netstat -ano 2>$null | Select-String ":${port}\s" | Select-String "LISTENING" | Select-Object -First 1
        if ($line) {
            # Last column is PID
            $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
            $pidStr = $parts[-1]
            if ($pidStr -match '^\d+$') { return [int]$pidStr }
        }
    } catch {}
    return $null
}

function Kill-Pid($pidv) {
    if (-not $pidv) { return }
    try {
        $proc = Get-Process -Id $pidv -ErrorAction SilentlyContinue
        if ($proc) { Stop-Process -Id $pidv -Force -ErrorAction SilentlyContinue }
    } catch {}
}

function Kill-Port($port) {
    try {
        $lines = netstat -ano 2>$null | Select-String ":${port}\s" | Select-String "LISTENING"
        foreach ($line in $lines) {
            $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
            $pidStr = $parts[-1]
            if ($pidStr -match '^\d+$') {
                try { Stop-Process -Id ([int]$pidStr) -Force -ErrorAction SilentlyContinue } catch {}
            }
        }
        Start-Sleep -Milliseconds 300
    } catch {}
}

function Stop-ByPidFile($runtimeDir, $name) {
    $pidFile = Join-Path $runtimeDir "$name.pid"
    if (Test-Path $pidFile) {
        $procPid = Get-Content $pidFile -ErrorAction SilentlyContinue
        if ($procPid) { Kill-Pid ([int]$procPid) }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}

function Test-PortFree($port) {
    try {
        $line = netstat -ano 2>$null | Select-String ":${port}\s" | Select-String "LISTENING" | Select-Object -First 1
        return ($null -eq $line)
    } catch {}
    return $true
}
