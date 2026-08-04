// devops/desktop/spawn.ts
// Streaming output capture, process management, and NSIS installer helpers.
// Fixes from PRD-2026-08-04: StringDecoder + residual-line buffer for chunk
// splitting; kill both desktop+server; NSIS silent install/uninstall.

import { spawn, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { installedExePath } from '../../scripts/tauri/version.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface StreamResult {
  ok: boolean
  output: string
  logPath: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function sleepSync(ms: number): void {
  const res = spawnSync('powershell', [
    '-NoProfile', '-Command', `Start-Sleep -Milliseconds ${ms}`,
  ], { stdio: 'ignore', timeout: ms + 5000 })
  // Fallback if PowerShell unavailable
  if (res.status !== 0) {
    const end = Date.now() + ms
    while (Date.now() < end) { /* busy wait fallback */ }
  }
}

// ── Streaming Output (FIXED: StringDecoder + residual-line buffer) ─────────

/**
 * Spawn a command, stream stdout/stderr to console AND to a log file in
 * real-time. Uses StringDecoder for correct multi-byte UTF-8 handling and
 * a residual-line buffer to avoid chunk-boundary line splits.
 */
export function spawnStreaming(
  cmd: string,
  args: string[],
  logPath: string,
  opts: { cwd?: string; timeoutMs?: number; label?: string; heartbeatMs?: number } = {},
): Promise<StreamResult> {
  return new Promise((resolve) => {
    const cwd = opts.cwd ?? process.cwd()
    const timeout = opts.timeoutMs ?? 600_000
    const label = opts.label ?? cmd
    const heartbeatMs = opts.heartbeatMs ?? 30_000
    mkdirSync(join(logPath, '..'), { recursive: true })
    writeFileSync(logPath, '', 'utf8')

    const proc = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    })

    const chunks: string[] = []
    const logBuf: string[] = []
    const FLUSH_INTERVAL = 50
    let killed = false
    let lastOutputAt = Date.now()
    const startedAt = Date.now()
    const timer = setTimeout(() => {
      killed = true
      proc.kill('SIGTERM')
    }, timeout)

    const heartbeat = setInterval(() => {
      const silent = Date.now() - lastOutputAt
      if (silent > heartbeatMs) {
        const secs = Math.round(silent / 1000)
        const total = Math.round((Date.now() - startedAt) / 1000)
        process.stdout.write(`  [${label}] still running... (${total}s elapsed, ${secs}s since last output)\n`)
      }
      if (logBuf.length > 0) {
        appendFileSync(logPath, logBuf.join(''), 'utf8')
        logBuf.length = 0
      }
    }, heartbeatMs)

    // Residual-line buffers for each stream
    let outPending = ''
    let errPending = ''
    const outDecoder = new StringDecoder('utf8')
    const errDecoder = new StringDecoder('utf8')

    function flushLog() {
      if (logBuf.length > 0) {
        appendFileSync(logPath, logBuf.join(''), 'utf8')
        logBuf.length = 0
      }
    }

    function emitLine(raw: string) {
      if (!raw) return
      const line = `[${label}] ${raw}`
      lastOutputAt = Date.now()
      chunks.push(line)
      logBuf.push(line + '\n')
      if (logBuf.length >= FLUSH_INTERVAL) {
        appendFileSync(logPath, logBuf.join(''), 'utf8')
        logBuf.length = 0
      }
    }

    function drainPending(decoder: StringDecoder, pending: string, data: Buffer, writeFn: (msg: string) => void): string {
      let text = pending + decoder.write(data)
      let nl: number
      while ((nl = text.indexOf('\n')) >= 0) {
        const raw = text.slice(0, nl)
        text = text.slice(nl + 1)
        emitLine(raw)
        writeFn(`[${label}] ${raw}\n`)
      }
      return text
    }

    proc.stdout?.on('data', (data: Buffer) => {
      outPending = drainPending(outDecoder, outPending, data, (msg) => process.stdout.write(msg))
    })

    proc.stderr?.on('data', (data: Buffer) => {
      errPending = drainPending(errDecoder, errPending, data, (msg) => process.stderr.write(msg))
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      clearInterval(heartbeat)
      // Drain any remaining partial lines
      const outRemain = outDecoder.end()
      if (outRemain) { emitLine(outPending + outRemain); process.stdout.write(`[${label}] ${outPending + outRemain}\n`) }
      const errRemain = errDecoder.end()
      if (errRemain) { emitLine(errPending + errRemain); process.stderr.write(`[${label}] ${errPending + errRemain}\n`) }
      flushLog()
      resolve({
        ok: code === 0 && !killed,
        output: chunks.join('\n'),
        logPath,
      })
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      clearInterval(heartbeat)
      outDecoder.end()
      errDecoder.end()
      flushLog()
      resolve({
        ok: false,
        output: `spawn error: ${err.message}`,
        logPath,
      })
    })
  })
}

// ── Process Management ─────────────────────────────────────────────────────

/**
 * Kill any running vivim desktop processes (both desktop and server).
 * Returns list of actually killed process names.
 */
export function killVivimProcesses(): string[] {
  const killed: string[] = []
  for (const im of ['vivim-desktop.exe', 'vivim-server.exe']) {
    const r = spawnSync('taskkill', ['/F', '/IM', im], { encoding: 'utf8' })
    if (r.status === 0) killed.push(im)
  }
  if (killed.length) {
    process.stdout.write(`  killed stale: ${killed.join(', ')}\n`)
    sleepSync(500)
  }
  return killed
}

/** Start the installed desktop exe. Returns the PID or null. */
export function launchInstalled(exePath: string): number | null {
  if (!existsSync(exePath)) return null
  const proc = spawn(exePath, [], { detached: false, stdio: 'ignore' })
  proc.unref()
  return proc.pid ?? null
}

// ── NSIS Installer Helpers ─────────────────────────────────────────────────────

/** Run a PowerShell command and return stdout (trimmed). */
function psCommand(command: string, timeoutMs = 30_000): string {
  const r = spawnSync('powershell', ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    timeout: timeoutMs,
  })
  return (r.stdout ?? '').trim()
}

/** Find the NSIS uninstaller registry entry for vivim. */
export function getUninstallRegistryKey(): string | null {
  // NSIS per-machine installs write to HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\vivim
  // per-user installs write to HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\vivim
  const ps = `
$keys = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\vivim',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\vivim'
)
foreach ($k in $keys) {
  if ((Get-Item -Path $k -ErrorAction SilentlyContinue) -ne $null) {
    $disp = (Get-ItemProperty -Path $k -Name DisplayName -ErrorAction SilentlyContinue).DisplayName
    $quiet = (Get-ItemProperty -Path $k -Name QuietUninstallString -ErrorAction SilentlyContinue).QuietUninstallString
    if ($disp -and $quiet) {
      Write-Output "KEY=$k"
      Write-Output "QUIET=$quiet"
    }
  }
}
`
  const out = psCommand(ps, 10_000)
  const keyMatch = /KEY=(.+)/.exec(out)
  if (!keyMatch) return null
  return keyMatch[1].trim()
}

/**
 * Install via NSIS: first silently uninstall any existing vivim instance,
 * then run the NSIS installer silently (/S).
 */
export function installNsis(installer: string): { exit: number | null; ok: boolean; detail: string } {
  // If an existing vivim install is found, uninstall it first (silent).
  const regKey = getUninstallRegistryKey()
  if (regKey) {
    const quietMatch = /QUIET=(.+)/.exec(psCommand(`
$quiet = (Get-ItemProperty -Path '${regKey}' -Name QuietUninstallString -ErrorAction SilentlyContinue).QuietUninstallString
if ($quiet) { Write-Output $quiet }
`, 10_000))
    const quiet = quietMatch ? quietMatch[1].trim() : null
    if (quiet) {
      spawnSync('cmd.exe', ['/c', quiet], { stdio: 'ignore', timeout: 120_000 })
      sleepSync(500)
    }
  }

  // Run the NSIS installer silently via PowerShell Start-Process -Wait -PassThru.
  // /S = NSIS silent mode. PowerShell handles elevation prompts for per-machine installs.
  const ps = `
$p = Start-Process -FilePath '${installer.replace(/'/g, "''")}' -ArgumentList '/S' -Wait -PassThru
Write-Output "EXIT=$($p.ExitCode)"
`
  const out = psCommand(ps, 300_000)
  const exitMatch = /EXIT=(-?\d+)/.exec(out)
  const exit = exitMatch ? Number(exitMatch[1]) : null

  // Verify via installed exe existence
  const exeOk = existsSync(installedExePath())
  const ok = exit === 0 && exeOk
  const detail = ok
    ? 'installed'
    : `install failed (exit=${exit}, exe=${exeOk})`
  return { exit, ok, detail }
}

/**
 * Uninstall vivim via NSIS QuietUninstallString.
 */
export function uninstallNsis(): { exit: number | null; ok: boolean } {
  const regKey = getUninstallRegistryKey()
  if (!regKey) return { exit: 0, ok: true }

  const quietMatch = /QUIET=(.+)/.exec(psCommand(`
$quiet = (Get-ItemProperty -Path '${regKey}' -Name QuietUninstallString -ErrorAction SilentlyContinue).QuietUninstallString
if ($quiet) { Write-Output $quiet }
`, 10_000))
  const quiet = quietMatch ? quietMatch[1].trim() : null
  if (!quiet) return { exit: 0, ok: true }

  const r = spawnSync('cmd.exe', ['/c', quiet], {
    stdio: 'ignore',
    timeout: 120_000,
  })
  const exit = r.status ?? null
  return { exit, ok: exit === 0 }
}

/** Parse installer log tail for final status line. Kept for API compatibility but
 * always returns 'unknown' since NSIS doesn't produce MSI-style logs. */
export function verifyInstallLog(_logPath: string): 'ok' | 'fail' | 'unknown' {
  return 'unknown'
}
