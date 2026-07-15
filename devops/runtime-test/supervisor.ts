// devops/runtime-test/supervisor.ts
// Detached Supervisor for runtime-OS loop.
//
// AGENT-SAFE DESIGN:
// - Every method has a hard timeout (default 15s start, 5s stop)
// - Never blocks on interactive I/O
// - Structured JSON output for agent consumption
// - If backend already running on port, short-circuit (no hang)
// - Tracks PIDs for clean kill on hot-restart
// - Windows-compatible: uses taskkill instead of SIGTERM, captures stderr

import { type ChildProcess, execSync, spawn } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { resolveBackendPort } from './port.js'

const START_TIMEOUT_MS = 15_000
const STOP_TIMEOUT_MS = 5_000
const FRONTEND_PORT = 5173
const RUNTIME_DIR = '.runtime'

interface ProcessInfo {
  pid?: number
  process?: ChildProcess
  startedAt: number
  url: string
  stderr: string[]
}

export class Supervisor {
  private backend: ProcessInfo = { startedAt: 0, url: '', stderr: [] }
  private frontend: ProcessInfo = { startedAt: 0, url: '', stderr: [] }
  private readonly bunPath = process.env.BUN_PATH ?? 'bun'
  private readonly isWin = process.platform === 'win32'

  async start(opts?: { backendOnly?: boolean; frontendOnly?: boolean }): Promise<void> {
    const backendPort = resolveBackendPort()
    if (!opts?.frontendOnly) {
      if (await this.isPortOpen(backendPort)) {
        this.backend = {
          pid: 0,
          startedAt: Date.now(),
          url: `http://localhost:${backendPort}`,
          stderr: [],
        }
      } else {
        await this.startBackend(backendPort)
      }
    }
    if (!opts?.backendOnly) {
      if (await this.isPortOpen(FRONTEND_PORT)) {
        this.frontend = {
          pid: 0,
          startedAt: Date.now(),
          url: `http://localhost:${FRONTEND_PORT}`,
          stderr: [],
        }
      } else {
        await this.startFrontend()
      }
    }
  }

  async stop(): Promise<void> {
    await this.stopProcess(this.frontend, 'frontend')
    await this.stopProcess(this.backend, 'backend')
    this.frontend = { startedAt: 0, url: '', stderr: [] }
    this.backend = { startedAt: 0, url: '', stderr: [] }
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  status(): { backend: boolean; frontend: boolean; backendPid?: number; frontendPid?: number } {
    return {
      backend: this.isProcessAlive(this.backend),
      frontend: this.isProcessAlive(this.frontend),
      backendPid: this.backend.pid,
      frontendPid: this.frontend.pid,
    }
  }

  /** Return last N lines of stderr from a process (for diagnostics). */
  getStderr(label: 'backend' | 'frontend'): string[] {
    return (label === 'backend' ? this.backend : this.frontend).stderr.slice(-20)
  }

  private isProcessAlive(info: ProcessInfo): boolean {
    if (info.pid === 0) return true // attached to existing
    if (!info.process) return false
    return !info.process.killed
  }

  private async isPortOpen(port: number): Promise<boolean> {
    try {
      const res = await fetch(`http://localhost:${port}/health`, {
        signal: AbortSignal.timeout(2_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  private captureStderr(info: ProcessInfo, proc: ChildProcess): void {
    proc.stderr?.on('data', (d: Buffer) => {
      const lines = d.toString().split('\n').filter(Boolean)
      info.stderr.push(...lines)
      // Keep only last 50 lines to avoid memory growth
      if (info.stderr.length > 50) info.stderr = info.stderr.slice(-50)
    })
  }

  private async startBackend(port: number): Promise<void> {
    let settled = false

    return new Promise<void>((resolve) => {
      const proc = spawn(this.bunPath, ['run', 'serve'], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CAP_STORE_PORT: String(port), FORCE_COLOR: '0' },
      })
      proc.unref()
      this.backend = {
        pid: proc.pid,
        process: proc,
        startedAt: Date.now(),
        url: `http://localhost:${port}`,
        stderr: [],
      }
      this.captureStderr(this.backend, proc)
      writePidFile('backend', proc.pid)

      proc.stdout?.on('data', (d: Buffer) => {
        if (!settled && d.toString().includes('listening')) {
          settled = true
          resolve()
        }
      })

      // Hard timeout — never hang the agent. BUT also verify the port actually
      // bound: a zombie-held port makes `bun run serve` fail silently, and the
      // 15s timeout must NOT mask that (otherwise the loop proceeds blind).
      sleep(START_TIMEOUT_MS).then(async () => {
        if (!settled) {
          settled = true
          const actuallyUp = await this.isPortOpen(port)
          if (!actuallyUp) {
            // Capture the stderr so the caller can surface the real failure.
            const err = this.backend.stderr.slice(-10).join('; ')
            this.backend.stderr = [`[startBackend] timed out and port ${port} not bound${err ? ` | ${err}` : ''}`]
          }
          resolve()
        }
      })

      proc.on('error', () => {
        if (!settled) {
          settled = true
          resolve()
        }
      })

      proc.on('exit', (code) => {
        if (!settled) {
          settled = true
          if (code !== 0) {
            const err = this.backend.stderr.slice(-10).join('; ')
            this.backend.stderr = [`[startBackend] process exited ${code}${err ? ` | ${err}` : ''}`]
          }
          resolve()
        }
      })
    })
  }

  private async startFrontend(): Promise<void> {
    let settled = false

    return new Promise<void>((resolve) => {
      const proc = spawn(
        this.bunPath,
        ['run', '--cwd', 'web/ui', 'vite', 'dev', '--port', String(FRONTEND_PORT), '--strictPort'],
        {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, FORCE_COLOR: '0' },
        },
      )
      proc.unref()
      this.frontend = {
        pid: proc.pid,
        process: proc,
        startedAt: Date.now(),
        url: `http://localhost:${FRONTEND_PORT}`,
        stderr: [],
      }
      this.captureStderr(this.frontend, proc)
      writePidFile('frontend', proc.pid)

      proc.stdout?.on('data', (d: Buffer) => {
        const msg = d.toString()
        if (
          !settled &&
          (msg.includes('ready') || msg.includes('Local:') || msg.includes('localhost'))
        ) {
          settled = true
          resolve()
        }
      })

      sleep(START_TIMEOUT_MS).then(() => {
        if (!settled) {
          settled = true
          resolve()
        }
      })

      proc.on('error', () => {
        if (!settled) {
          settled = true
          resolve()
        }
      })

      proc.on('exit', () => {
        if (!settled) {
          settled = true
          resolve()
        }
      })
    })
  }

  private async stopProcess(info: ProcessInfo, _label: string): Promise<void> {
    if (!info.process) return
    const pid = info.pid
    if (!pid) return

    removePidFile(_label)

    // Windows: use taskkill to terminate process tree (SIGTERM doesn't work)
    // Unix: try SIGTERM first, then SIGKILL
    if (this.isWin) {
      try {
        execSync(`taskkill /PID ${pid} /T /F 2>nul`, { timeout: STOP_TIMEOUT_MS })
      } catch {
        // already dead or no such process
      }
    } else {
      // Try graceful kill first
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        // already dead
      }
      await sleep(STOP_TIMEOUT_MS)
      // Force kill if still alive
      try {
        if (info.process && !info.process.killed) {
          process.kill(pid, 'SIGKILL')
        }
      } catch {
        // ok
      }
    }
  }
}

function writePidFile(name: string, pid: number | undefined): void {
  if (!pid) return
  try {
    writeFileSync(`${RUNTIME_DIR}/${name}.pid`, String(pid), 'utf8')
  } catch {
    // best-effort
  }
}

function removePidFile(name: string): void {
  try {
    rmSync(`${RUNTIME_DIR}/${name}.pid`, { force: true })
  } catch {
    // best-effort
  }
}

export const supervisor = new Supervisor()
