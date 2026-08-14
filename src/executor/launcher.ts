// src/executor/launcher.ts
// Chrome/Edge launcher with profile isolation, channel selection, and
// SingletonLock cleanup. Config-driven via ChromeInstanceProfile.
// Matches the proven pattern from vivim-app-og cap-store.

import { rmSync } from 'node:fs'
import { catchDebug } from '../lib/catch-logger.js'
import { getLogger } from '../lib/logger.js'
import {
  buildChromeArgs,
  type ChromeChannel,
  type ChromeInstanceProfile,
  type ChromeMode,
  makeProfile,
  resolveChromeBinary,
} from './chrome-instance-profile.js'

const log = getLogger('executor:launcher')

export interface LaunchResult {
  process: ReturnType<typeof Bun.spawn>
  binary: string
  debugPort: number
  pid: number
  profileDir: string
}

/** Legacy options shape — retained for callers that don't use a profile yet. */
export interface ChromeLaunchOptions {
  visible?: boolean
  profileDir?: string
  debugPort?: number
  extraArgs?: string[]
  userDataDir?: string
  disableGpu?: boolean
  windowSize?: { width: number; height: number }
  url?: string
}

const IS_WIN = process.platform === 'win32'

/**
 * Remove stale Chrome singleton locks so a previously-crashed slave does not
 * fail to launch with "profile already in use" (FR-11). Best-effort: a locked
 * profile that is genuinely in use by a live process is not our concern here
 * because the fleet frees the port/process before re-launching.
 */
export function clearSingletonLock(userDataDir: string): void {
  if (!userDataDir) return
  for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    try {
      rmSync(`${userDataDir}/${name}`, { force: true })
    } catch (e) {
      catchDebug(e, 'launcher: cleanup userDataDir profile')
    }
  }
}

/**
 * Remove session/tab restore files so Chrome starts with a clean slate
 * instead of restoring dozens of stale tabs from the previous session.
 */
export function clearSessionRestore(userDataDir: string): void {
  if (!userDataDir) return
  const defaultDir = `${userDataDir}/Default`
  const files = [
    'Preferences',
    'Secure Preferences',
    'Current Session',
    'Current Tabs',
    'Last Session',
    'Last Tabs',
    'History',
    'History-journal',
  ]
  for (const name of files) {
    try {
      rmSync(`${defaultDir}/${name}`, { force: true })
    } catch (e) {
      catchDebug(e, 'launcher: cleanup defaultDir profile')
    }
  }
  // Also clear the Sessions directory
  try {
    rmSync(`${defaultDir}/Sessions`, { recursive: true, force: true })
  } catch (e) {
    catchDebug(e, 'launcher: cleanup Sessions dir')
  }
}

async function isPortInUse(port: number): Promise<boolean> {
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1000),
    })
    return resp.ok
  } catch (e) {
    catchDebug(e, 'launcher: health check failed')
    return false
  }
}

async function freePort(start: number, span = 100): Promise<number> {
  for (let p = start; p < start + span; p++) {
    if (!(await isPortInUse(p))) return p
  }
  return start
}

/**
 * Launch Chrome from a config-driven profile. Resolves the binary for the
 * requested channel, clears any stale SingletonLock, then waits (bounded by
 * `launchTimeoutMs`) for the debug port to respond (FR-14/NFR-3).
 */
export async function launchProfile(profile: ChromeInstanceProfile): Promise<LaunchResult> {
  const binary = await resolveChromeBinary(profile.channel)

  let debugPort = profile.debugPort ?? 9222
  if (await isPortInUse(debugPort)) {
    debugPort = await freePort(debugPort + 1)
  }

  // FR-11 — clear stale singleton lock before spawning
  clearSingletonLock(profile.userDataDir)

  // Clear session restore files so Chrome doesn't open dozens of stale tabs
  clearSessionRestore(profile.userDataDir)

  const args = buildChromeArgs({ ...profile, debugPort })

  log.info(`[launcher] Spawning (${profile.channel}/${profile.mode}): ${binary} ${args.join(' ')}`)

  const proc = Bun.spawn([binary, ...args], {
    stdout: 'ignore',
    stderr: 'ignore',
    env: { ...process.env },
    detached: true,
  })

  // Ensure Chrome survives after the parent Bun process exits
  proc.unref()

  const pid = proc.pid
  const ready = await waitForPort(debugPort, profile.launchTimeoutMs)
  if (!ready) {
    try {
      proc.kill('SIGKILL')
    } catch (e) {
      catchDebug(e, 'launcher: kill timed-out process')
    }
    throw new ChromeLaunchTimeoutError(debugPort, profile.launchTimeoutMs, binary)
  }

  return { process: proc, binary, debugPort, pid, profileDir: profile.userDataDir }
}

/** Legacy entry point — wraps options into a profile and delegates. */
export async function launchChrome(opts?: ChromeLaunchOptions): Promise<LaunchResult> {
  const extraArgs = [...(opts?.extraArgs ?? [])]
  if (opts?.url) {
    // Pass URL as last positional arg so Chrome navigates to it on launch.
    extraArgs.push(opts.url)
  }
  const profile = makeProfile({
    userDataDir:
      opts?.userDataDir ??
      opts?.profileDir ??
      (IS_WIN
        ? `${process.env.LOCALAPPDATA}\\Temp\\chrome-profile-${Date.now()}`
        : `/tmp/chrome-profile-${Date.now()}`),
    channel: 'system',
    mode: opts?.visible ? 'headed' : 'headless-new',
    debugPort: opts?.debugPort,
    windowSize: opts?.windowSize,
    disableGpu: opts?.disableGpu,
    extraArgs,
    launchTimeoutMs: 15_000,
  })
  return launchProfile(profile)
}

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isPortInUse(port)) return true
    await Bun.sleep(200)
  }
  return false
}

/** Detailed launch failure carrying the port + binary for diagnostics. */
export class ChromeLaunchTimeoutError extends Error {
  constructor(
    public readonly port: number,
    public readonly timeoutMs: number,
    public readonly binary: string,
  ) {
    super(`Chrome did not open debug port ${port} within ${timeoutMs}ms (${binary})`)
    this.name = 'ChromeLaunchTimeoutError'
  }
}

export async function killChrome(pid: number): Promise<void> {
  if (!pid) return
  if (IS_WIN) {
    // Await the taskkill so callers (e.g. the MCP server's browser_quit / exit)
    // can rely on Chrome being dead before the parent process exits.
    const proc = Bun.spawn({
      cmd: ['taskkill', '/PID', String(pid), '/F', '/T'],
      stdout: 'ignore',
      stderr: 'ignore',
    })
    await proc.exited.catch(() => {})
    // [audit] log the error with context here
    return
  }
  try {
    process.kill(pid, 'SIGTERM')
  } catch (e) {
    catchDebug(e, 'launcher: process already dead (SIGTERM)')
    return
  }
  const start = Date.now()
  while (Date.now() - start < 5_000) {
    if (!(await isChromeRunning(pid))) return
    await Bun.sleep(100)
  }
  try {
    process.kill(pid, 'SIGKILL')
  } catch (e) {
    catchDebug(e, 'launcher: process already dead (SIGKILL)')
  }
}

export async function isChromeRunning(pid: number): Promise<boolean> {
  if (!pid) return false
  try {
    if (IS_WIN) {
      const proc = Bun.spawn({
        cmd: ['tasklist', '/FI', `PID eq ${pid}`, '/NH'],
        stdout: 'pipe',
        stderr: 'ignore',
      })
      const text = await new Response(proc.stdout).text()
      return !text.includes('INFO: No tasks') && text.includes(String(pid))
    }
    process.kill(pid, 0)
    return true
  } catch (e) {
    catchDebug(e, 'launcher: isProcessAlive check failed')
    return false
  }
}

export type { ChromeChannel, ChromeInstanceProfile, ChromeMode }
export { buildChromeArgs, makeProfile, resolveChromeBinary }
