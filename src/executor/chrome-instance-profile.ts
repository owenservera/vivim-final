// src/executor/chrome-instance-profile.ts
// Config-driven Chrome instance profiles — lets the fleet launch different
// *types* of Chrome (system / chrome / chromium / edge) in different *modes*
// (headless-new / headless / headed) per provider+account. (User requirement +
// FR-12/13/NFR-8.) Resolves the binary per channel and builds launch args.

import { existsSync } from 'node:fs'
import { ChromeNotFoundError } from '@/errors.ts'
import { catchDebug } from '../lib/catch-logger.js'

// ── Config types ─────────────────────────────────────────────────────────────

export type ChromeChannel = 'system' | 'chrome' | 'chromium' | 'edge'
export type ChromeMode = 'headless-new' | 'headless' | 'headed'

export interface ChromeInstanceProfile {
  /** Which Chrome family to launch. `system` = first available on host. */
  channel: ChromeChannel
  /** Launch mode. `headless-new` uses the modern headless implementation. */
  mode: ChromeMode
  /** Derived from `mode`; true unless `headed`. */
  headless: boolean
  /** Persistent user-data-dir (profile directory). */
  userDataDir: string
  /** Optional fixed debug port; otherwise the fleet allocates one. */
  debugPort?: number
  windowSize?: { width: number; height: number }
  disableGpu?: boolean
  /** Bounded launch timeout — every launch MUST have a timeout (NFR-3). */
  launchTimeoutMs: number
  /** Extra Chrome flags appended verbatim. */
  extraArgs: string[]
}

// ── Channel path tables ─────────────────────────────────────────────────────

const WIN_PATHS: Record<Exclude<ChromeChannel, 'system'>, string[]> = {
  chrome: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
  chromium: [
    'C:\\Program Files\\Chromium\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Chromium\\Application\\chrome.exe`,
  ],
  edge: [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
}

const POSIX_PATHS: Record<Exclude<ChromeChannel, 'system'>, string[]> = {
  chrome: ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'],
  chromium: ['chromium', 'chromium-browser'],
  edge: ['microsoft-edge', 'microsoft-edge-stable'],
}

const cachedByChannel: Partial<Record<ChromeChannel, string | null>> = {}

/** Resolve an executable path for the requested channel. Throws if none found. */
export async function resolveChromeBinary(channel: ChromeChannel = 'system'): Promise<string> {
  if (channel !== 'system' && cachedByChannel[channel] !== undefined) {
    const cached = cachedByChannel[channel]
    if (cached) return cached
    if (cached === null) throw new ChromeNotFoundError()
  }

  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    cachedByChannel[channel] = process.env.CHROME_PATH
    return process.env.CHROME_PATH
  }

  const explicit = channel !== 'system' ? channel : 'chrome'
  const table =
    process.platform === 'win32'
      ? (WIN_PATHS[explicit as Exclude<ChromeChannel, 'system'>] ?? WIN_PATHS.chrome)
      : (POSIX_PATHS[explicit as Exclude<ChromeChannel, 'system'>] ?? POSIX_PATHS.chrome)

  for (const p of table) {
    if (p.includes('/') || p.includes('\\')) {
      if (existsSync(p)) {
        cachedByChannel[channel] = p
        return p
      }
    } else {
      // bare command name — probe PATH via which/where
      const found = await probePath(p)
      if (found) {
        cachedByChannel[channel] = found
        return found
      }
    }
  }

  // channel `system` falls back to scanning every known family
  if (channel === 'system') {
    for (const fam of ['chrome', 'chromium', 'edge'] as const) {
      try {
        return await resolveChromeBinary(fam)
      } catch (err) {
        catchDebug(err, 'executor:chrome-instance-profile:100')
        /* try next */
      }
    }
  }

  cachedByChannel[channel] = null
  throw new ChromeNotFoundError()
}

async function probePath(cmd: string): Promise<string | null> {
  try {
    const result = Bun.spawnSync(process.platform === 'win32' ? ['where', cmd] : ['which', cmd], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (result.exitCode === 0) {
      const out = result.stdout.toString().trim().split('\n')[0]?.trim()
      if (out) return out
    }
  } catch (err) {
    catchDebug(err, 'executor:chrome-instance-profile:120')
    /* ignore */
  }
  return null
}

/**
 * Build the Chrome launch argument list from a profile.
 *
 * Minimalist flag set — only essential flags that don't leak automation signals.
 * Removed: --no-startup-window (headless-only signal), --disable-gpu (triggers
 * SwiftShader), --window-position=-32000,-32000 (off-screen anomaly),
 * --disable-features=VizDisplayCompositor (real users don't set this),
 * --user-agent="..." (hardcoded version drifts; --headless=new uses real UA),
 * and 6 background-timer flags (no detection value for single-tab automation).
 */
export function buildChromeArgs(profile: ChromeInstanceProfile): string[] {
  const args: string[] = []

  if (profile.debugPort) args.push(`--remote-debugging-port=${profile.debugPort}`)

  // User data directory — sanitize for filesystem safety
  if (profile.userDataDir) {
    const safeDir = profile.userDataDir.replace(/[^a-zA-Z0-9.\-_:\\/ ]/g, '_')
    args.push(`--user-data-dir=${safeDir}`)
  }

  switch (profile.mode) {
    case 'headless-new':
      args.push('--headless=new')
      break
    case 'headless':
      args.push('--headless')
      break
    case 'headed':
      break
  }

  // Realistic window dimensions — replaces the anomalous -32000,-32000 position
  if (profile.windowSize) {
    args.push(`--window-size=${profile.windowSize.width},${profile.windowSize.height}`)
  } else {
    args.push('--window-size=1920,1080')
  }

  // Essential flags only — no detection signals
  args.push('--no-first-run')
  args.push('--disable-blink-features=AutomationControlled')

  if (profile.extraArgs?.length) args.push(...profile.extraArgs)
  return args
}

/** Construct a profile with sane defaults (config-driven convenience). */
export function makeProfile(
  partial: Partial<ChromeInstanceProfile> & {
    userDataDir: string
    channel?: ChromeChannel
    mode?: ChromeMode
  },
): ChromeInstanceProfile {
  const mode = partial.mode ?? 'headless-new'
  return {
    channel: partial.channel ?? 'system',
    mode,
    headless: mode !== 'headed',
    userDataDir: partial.userDataDir,
    debugPort: partial.debugPort,
    windowSize: partial.windowSize,
    disableGpu: partial.disableGpu,
    launchTimeoutMs: partial.launchTimeoutMs ?? 15_000,
    extraArgs: partial.extraArgs ?? [],
  }
}
