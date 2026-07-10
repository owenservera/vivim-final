// src/executor/launcher.ts
// Cross-platform Chrome/Chromium binary discovery and process spawning.

import { ChromeNotFoundError } from '@/errors.ts'

export interface LaunchResult {
  process: ReturnType<typeof Bun.spawn>
  debugPort: number
  pid: number
  profileDir: string
}

export interface ChromeLaunchOptions {
  visible?: boolean
  profileDir?: string
  debugPort?: number
  extraArgs?: string[]
  userDataDir?: string
  disableGpu?: boolean
  windowSize?: { width: number; height: number }
}

const PLATFORM_PATHS = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
  linux: ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'],
} as const

export function getDefaultChromePaths(): readonly string[] {
  const platform = process.platform as keyof typeof PLATFORM_PATHS
  return PLATFORM_PATHS[platform] ?? PLATFORM_PATHS.linux
}

export async function findChromeBinary(): Promise<string> {
  const envPath = process.env.CHROME_PATH
  if (envPath) {
    const file = Bun.file(envPath)
    if (await file.exists()) return envPath
  }

  const paths = getDefaultChromePaths()
  for (const p of paths) {
    const file = Bun.file(p)
    if (await file.exists()) return p
  }

  // Try which/where as last resort
  try {
    const result = Bun.spawnSync(
      process.platform === 'win32' ? ['where', 'chrome'] : ['which', 'google-chrome'],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    if (result.exitCode === 0 && result.stdout.toString().trim()) {
      const first = result.stdout.toString().trim().split('\n')[0]
      if (first) return first
    }
  } catch {
    // ignore
  }

  throw new ChromeNotFoundError()
}

export function buildChromeArgs(opts: ChromeLaunchOptions): string[] {
  const args: string[] = []

  if (opts.visible === false || opts.visible === undefined) {
    args.push('--headless=new')
  }

  if (opts.debugPort) {
    args.push(`--remote-debugging-port=${opts.debugPort}`)
  }

  if (opts.userDataDir || opts.profileDir) {
    args.push(`--user-data-dir=${opts.userDataDir ?? opts.profileDir}`)
  }

  args.push('--no-first-run')
  args.push('--disable-extensions')
  args.push('--disable-background-networking')
  args.push('--disable-sync')
  args.push('--disable-translate')
  args.push('--metrics-recording-only')

  if (opts.disableGpu) {
    args.push('--disable-gpu')
  }

  // Hidden mode on Windows (off-screen positioning)
  if (opts.visible === false && process.platform === 'win32') {
    args.push('--window-position=-32000,-32000')
  }

  if (opts.windowSize) {
    args.push(`--window-size=${opts.windowSize.width},${opts.windowSize.height}`)
  }

  if (opts.extraArgs) {
    args.push(...opts.extraArgs)
  }

  return args
}

export async function launchChrome(opts?: ChromeLaunchOptions): Promise<LaunchResult> {
  const binary = await findChromeBinary()
  const debugPort = opts?.debugPort ?? 0
  const profileDir = opts?.profileDir ?? `/tmp/chrome-profile-${Date.now()}`

  const args = buildChromeArgs({ ...opts, debugPort, profileDir })

  const proc = Bun.spawn([binary, ...args], {
    stdout: 'ignore',
    stderr: 'ignore',
    env: { ...process.env },
  })

  const pid = proc.pid

  // Wait for Chrome to start and open the debug port
  const startTime = Date.now()
  const timeout = 15_000
  let actualPort = debugPort

  if (debugPort === 0) {
    // Parse port from stderr output or wait for it
    // For headless mode, Chrome prints the port to stderr
    await Bun.sleep(500)
    // Fallback: try default port 9222
    actualPort = 9222
  }

  while (Date.now() - startTime < timeout) {
    try {
      const resp = await fetch(`http://127.0.0.1:${actualPort}/json/version`)
      if (resp.ok) break
    } catch {
      // Chrome not ready yet
    }
    await Bun.sleep(100)
  }

  return { process: proc, debugPort: actualPort, pid, profileDir }
}

export async function killChrome(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // process may already be dead
    return
  }

  // Wait up to 5s for graceful shutdown
  const start = Date.now()
  while (Date.now() - start < 5000) {
    if (!(await isChromeRunning(pid))) return
    await Bun.sleep(100)
  }

  // Force kill
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    // already dead
  }
}

export async function isChromeRunning(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
