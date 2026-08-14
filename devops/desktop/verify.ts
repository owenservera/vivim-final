// devops/desktop/verify.ts
// Deep module: verify the actually-installed exe.
//
// Exports pure-ish decision logic that can be unit tested in isolation,
// plus thin PowerShell wrappers for screenshot/window operations.
//
// Core functions (pure, testable):
//   parseNetstat(raw)        – netstat text → port→pid map
//   assessReady(polls, owner, expected) – readyz verdict from poll data
//   checkNonBlank(sizeKB, colors)       – image-stats → pass/fail
//
// Core functions (need PowerShell, testable with mocks):
//   ownerPidForPort(port)    – which PID owns a TCP port
//   scanPortForPid(pid)      – scan ports 9421..9441 for a given PID
//   pollReady(port, opts)    – full readyz poll with owner verification
//   windowInfo(name)         – Get-Process window title/handle
//   focusWindow(name)        – AppActivate
//   captureScreenshot(out)   – CopyFromScreen
//   assertNonBlank(png)      – ImageMagick identify (or size heuristic)

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'

// ── Pure Decision Logic (unit-testable) ────────────────────────────────────

export interface NetstatEntry {
  localAddr: string
  localPort: number
  pid: number
}

/** Parse `netstat -ano -p tcp` output into a port→pid map (LISTENING only). */
export function parseNetstat(raw: string): Map<number, number> {
  const map = new Map<number, number>()
  for (const line of raw.split('\n')) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 5) continue
    const [state, localAddr] = [cols[3], cols[1]]
    if (state !== 'LISTENING') continue
    if (!localAddr) continue
    const colon = localAddr.lastIndexOf(':')
    if (colon === undefined || colon < 0) continue
    const port = Number(localAddr.slice(colon + 1))
    const pid = Number(cols[4])
    if (port > 0 && pid > 0) map.set(port, pid)
  }
  return map
}

export interface ReadyVerdict {
  ok: boolean
  reason: string
  ownerPid: number | null
  stale: boolean
  actualPort: number | null
}

/**
 * Decide readyz outcome from poll history + port ownership info.
 * Pure function — no I/O.
 */
export function assessReady(
  polls: Array<{ status: number | string }>,
  ownerPid: number | null,
  expectedPid: number | null,
): ReadyVerdict {
  const lastOk = polls.some((p) => p.status === 200)
  if (!lastOk) {
    return { ok: false, reason: 'readyz never returned 200', ownerPid: null, stale: false, actualPort: null }
  }
  if (expectedPid !== null && ownerPid !== null && ownerPid !== expectedPid) {
    return {
      ok: false,
      reason: `port owner ${ownerPid} ≠ launched PID ${expectedPid} (stale server)`,
      ownerPid,
      stale: true,
      actualPort: null,
    }
  }
  return { ok: true, reason: 'readyz 200', ownerPid, stale: false, actualPort: null }
}

/**
 * Decide whether an image is "non-blank" (has rendered content).
 * Pure function — given ImageMagick color count + file size in KB.
 */
export function checkNonBlank(sizeKB: number, colors: number | null): boolean {
  if (sizeKB < 10) return false
  if (colors !== null) return colors >= 2
  return sizeKB > 50
}

// ── Port / PID Helpers ─────────────────────────────────────────────────────

/** Which PID owns a given TCP port? Returns null if not found. */
export function ownerPidForPort(port: number): number | null {
  const r = spawnSync('netstat', ['-ano', '-p', 'tcp'], {
    encoding: 'utf8',
    timeout: 10_000,
  })
  if (r.status !== 0) return null
  const map = parseNetstat(r.stdout ?? '')
  return map.get(port) ?? null
}

/** Scan ports 9421..9421+count-1, return the first port owned by pid. */
export function scanPortForPid(pid: number, base = 9421, count = 20): number | null {
  const r = spawnSync('netstat', ['-ano', '-p', 'tcp'], {
    encoding: 'utf8',
    timeout: 10_000,
  })
  if (r.status !== 0) return null
  const map = parseNetstat(r.stdout ?? '')
  for (let i = 0; i < count; i++) {
    const port = base + i
    if (map.get(port) === pid) return port
  }
  return null
}

/**
 * Return the PIDs of every process LISTENING on ports base..base+count-1,
 * in ascending port order (duplicates collapsed). Pure — parse a raw
 * netstat snapshot so the decision logic stays unit-testable.
 */
export function pidsForPortRange(netstatRaw: string, base = 9421, count = 20): number[] {
  const map = parseNetstat(netstatRaw)
  const seen = new Set<number>()
  const pids: number[] = []
  for (let i = 0; i < count; i++) {
    const pid = map.get(base + i)
    if (pid && !seen.has(pid)) {
      seen.add(pid)
      pids.push(pid)
    }
  }
  return pids
}

/** Is a process alive? (kill -0 trick) */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Executable name (without .exe) for a PID, or null if not found. */
export function processNameForPid(pid: number): string | null {
  const r = spawnSync('powershell', [
    '-NoProfile', '-Command',
    `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName`,
  ], { encoding: 'utf8', timeout: 10_000 })
  const name = (r.stdout ?? '').trim()
  return name || null
}

/**
 * Walk the process tree from a PID upward (parent → grandparent → …) and
 * return the process names in order (owner first). Max `depth` hops to bound
 * runaway chains. Returns [ownerName, parentName, ...] with the owner itself
 * first so name checks see the nearest process too.
 */
export function ancestorNamesForPid(pid: number, depth = 12): string[] {
  const ps = `
$names = @()
$id = ${pid}
for ($i = 0; $i -lt ${depth}; $i++) {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId = $id" -ErrorAction SilentlyContinue
  if (-not $p) { break }
  $names += $p.Name
  $id = $p.ParentProcessId
  if ($id -le 0) { break }
}
Write-Output ($names -join '|')
`
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], {
    encoding: 'utf8',
    timeout: 10_000,
  })
  const names = ((r.stdout ?? '').trim() || '').split('|').filter((n) => n.length > 0)
  return names
}

/** Pure: is a process-name string a vivim image (case-insensitive, .exe tolerant)? */
export function isVivimImageName(name: string | null): boolean {
  if (name === null) return false
  const n = name.toLowerCase().replace(/\.exe$/, '')
  return n === 'vivim-desktop' || n === 'vivim-server'
}

/**
 * Pure: decide whether a port owner is a legitimate vivim process.
 * Accepts when the owner PID is the expected launched PID, OR the owner's
 * name is a vivim image, OR any ancestor of the owner is a vivim image
 * (the compiled sidecar `vivim-server.exe` re-spawns the real worker via
 * `bun run src/cli/index.ts serve`, so the port owner is often a `bun`
 * process whose parent chain leads back to a vivim exe).
 */
export function isVivimOwner(
  ownerName: string | null,
  ownerPid: number | null,
  expectedPid: number | null,
  ancestorNames: string[] = [],
): boolean {
  if (ownerPid === null) return false
  if (expectedPid !== null && ownerPid === expectedPid) return true
  if (isVivimImageName(ownerName)) return true
  return ancestorNames.some((name) => isVivimImageName(name))
}

// ── Ready Polling ──────────────────────────────────────────────────────────

export interface PollResult {
  ok: boolean
  ms: number
  polls: Array<{ t: string; status: number | string }>
  ownerPid: number | null
  stale: boolean
  actualPort: number | null
}

/**
 * Poll /readyz until 200 or timeout. After first 200, verify port owner.
 * If owner ≠ expected PID, scan for self-heal port.
 */
export async function pollReady(
  port: number,
  opts: {
    timeoutMs?: number
    pollMs?: number
    expectOwnerPid?: number | null
  } = {},
): Promise<PollResult> {
  const timeoutMs = opts.timeoutMs ?? 60_000
  const pollMs = opts.pollMs ?? 1_000
  const expectedPid = opts.expectOwnerPid ?? null
  const polls: Array<{ t: string; status: number | string }> = []
  const t0 = Date.now()

  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/readyz`, {
        signal: AbortSignal.timeout(2_000),
      })
      const entry = { t: new Date().toISOString(), status: res.status }
      polls.push(entry)
      process.stdout.write(`    readyz=${res.status} `)
      if (res.ok) {
        process.stdout.write('OK\n')
        const elapsed = Date.now() - t0
        // Verify port owner
        const owner = ownerPidForPort(port)
        if (expectedPid !== null && owner !== null && owner !== expectedPid) {
          // Stale server — scan for the launched PID
          const actualPort = scanPortForPid(expectedPid)
          return { ok: true, ms: elapsed, polls, ownerPid: owner, stale: true, actualPort }
        }
        return { ok: true, ms: elapsed, polls, ownerPid: owner, stale: false, actualPort: null }
      }
    } catch {
      polls.push({ t: new Date().toISOString(), status: 'err' })
      process.stdout.write('.')
    }
    await new Promise((r) => setTimeout(r, pollMs))
  }

  process.stdout.write('timeout\n')
  return { ok: false, ms: Date.now() - t0, polls, ownerPid: null, stale: false, actualPort: null }
}

// ── Screenshot / Window ────────────────────────────────────────────────────

/** Capture full-screen screenshot via PowerShell CopyFromScreen. */
export function captureScreenshot(outPath: string): boolean {
  const ps = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bmp.Save('${outPath.replace(/'/g, "''")}')
$g.Dispose(); $bmp.Dispose()
`
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], {
    encoding: 'utf8',
    timeout: 20_000,
  })
  return r.status === 0 && existsSync(outPath)
}

export interface ImageStats {
  sizeKB: number
  colors: number | null
}

/** Get image stats via ImageMagick identify (or fallback to size heuristic). */
export function getImageStats(pngPath: string): ImageStats {
  if (!existsSync(pngPath)) return { sizeKB: 0, colors: null }
  const sizeKB = Math.round(statSync(pngPath).size / 1024)
  if (sizeKB < 10) return { sizeKB, colors: null }
  const magick = spawnSync('magick', ['identify', '-format', '%k', pngPath], {
    encoding: 'utf8',
    timeout: 15_000,
  })
  if (magick.status === 0) {
    return { sizeKB, colors: Number(magick.stdout.trim()) || null }
  }
  return { sizeKB, colors: null }
}

/** Assert a screenshot is non-blank (has rendered content). */
export function assertNonBlank(pngPath: string): boolean {
  const { sizeKB, colors } = getImageStats(pngPath)
  return checkNonBlank(sizeKB, colors)
}

export interface WindowInfo {
  title: string
  handle: number
  responding: boolean
  exists: boolean
}

/** Get window title/handle/responding for a process by name. */
export function windowInfo(exeName: string): WindowInfo {
  const name = exeName.replace(/\.exe$/i, '')
  const ps = `
$p = Get-Process -Name '${name}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($p) { Write-Output "TITLE=$($p.MainWindowTitle)|HANDLE=$($p.MainWindowHandle)|RESP=$($p.Responding)" }
else { Write-Output "NONE" }
`
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], {
    encoding: 'utf8',
    timeout: 10_000,
  })
  const out = (r.stdout ?? '').trim()
  if (out === 'NONE' || !out) {
    return { title: '', handle: 0, responding: false, exists: false }
  }
  const titleMatch = /TITLE=(.*?)\|HANDLE=(\d+)\|RESP=(\w+)/.exec(out)
  if (!titleMatch) return { title: '', handle: 0, responding: false, exists: false }
  return {
    title: titleMatch[1] ?? '',
    handle: Number(titleMatch[2]),
    responding: titleMatch[3] === 'True',
    exists: true,
  }
}

/** Bring window to foreground by process name (AppActivate). */
export function focusWindow(exeName: string): boolean {
  const name = exeName.replace(/\.exe$/i, '')
  const ps = `
$p = Get-Process -Name '${name}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -First 1
if ($p) { $w = New-Object -ComObject WScript.Shell; $ok = $w.AppActivate($p.MainWindowTitle); Write-Output "FOCUS=$ok" }
else { Write-Output "FOCUS=false" }
`
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], {
    encoding: 'utf8',
    timeout: 10_000,
  })
  return (r.stdout ?? '').includes('FOCUS=true')
}
