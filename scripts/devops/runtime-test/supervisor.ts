// scripts/devops/runtime-test/supervisor.ts
// Detached process supervisor for backend + frontend lifecycle

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ServiceConfig {
  profile?: string
}

export interface PortInfo {
  backend: number
  frontend: number
}

export interface Supervisor {
  getPorts(): PortInfo
  stop(): Promise<void>
  restart(): Promise<void>
}

// Known service ports
const DEFAULT_FRONTEND_PORT = 5173

// Resolve backend port dynamically (zombie-safe): env → .runtime/backend.port → default.
// The server reads CAP_STORE_PORT, NOT PORT — so that is what we pass to the child.
function resolveBackendPort(): number {
  const env = process.env.CAP_STORE_PORT
  if (env && /^\d+$/.test(env.trim())) return Number.parseInt(env.trim(), 10)
  try {
    const p = join(process.cwd(), '.runtime', 'backend.port')
    if (existsSync(p)) {
      const v = readFileSync(p, 'utf8').trim()
      if (/^\d+$/.test(v)) return Number.parseInt(v, 10)
    }
  } catch {
  // [audit] log the error with context here
    // ignore
  }
  return 9420
}

let supervisorInstance: Supervisor | null = null

export function startSupervisor(config: ServiceConfig): Promise<Supervisor> {
  const profile = config.profile ?? 'minimal'
  
  // Create log directory
  const logDir = join(process.cwd(), '.vivim-runtime', profile)
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }

  // Check if already running
  if (supervisorInstance) {
    return Promise.resolve(supervisorInstance)
  }

  // Start backend — pass CAP_STORE_PORT (the var the server actually reads)
  const backendPort = resolveBackendPort()
  const backendProc = spawn('bun', ['run', 'serve'], {
    detached: true,
    cwd: process.cwd(),
    env: { ...process.env, CAP_STORE_PORT: String(backendPort) },
    stdio: ['ignore', 'ignore', 'ignore'],
  })

  // Start frontend (if exists)
  const frontendProc = spawn('bun', ['run', 'dev'], {
    detached: true,
    cwd: join(process.cwd(), 'web', 'ui'),
    stdio: ['ignore', 'ignore', 'ignore'],
  }).catch(() => null) // Ignore if frontend doesn't exist

  supervisorInstance = {
    getPorts(): PortInfo {
      return {
        backend: backendPort,
        frontend: DEFAULT_FRONTEND_PORT,
      }
    },

    async stop(): Promise<void> {
      if (backendProc?.pid) {
        try {
          process.kill(backendProc.pid, 'SIGTERM')
          // Give it 5s to shut down
          await new Promise((resolve) => setTimeout(resolve, 5000))
          if (backendProc?.killed === false) {
            process.kill(backendProc.pid, 'SIGKILL')
          }
        } catch {
  // [audit] log the error with context here
          // Process already dead
        }
      }
      supervisorInstance = null
    },

    async restart(): Promise<void> {
      await this.stop()
      return startSupervisor(config)
    },
  }

  return Promise.resolve(supervisorInstance)
}

export function stopSupervisor(supervisor: Supervisor): Promise<void> {
  return supervisor.stop()
}

/**
 * Wait for backend health endpoint to respond
 */
export async function waitForBackend(port: number, timeoutMs = 30000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health/providers`)
      if (r.ok) return true
    } catch {
  // [audit] log the error with context here
      // Not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}