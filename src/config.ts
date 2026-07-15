// src/config.ts
// Centralized configuration — reads from environment variables.
// All engines read config through this module; no scattered process.env reads.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Platform detection ──────────────────────────────────────────────────────

const isWin = process.platform === 'win32'

// ── Runtime port handshake ───────────────────────────────────────────────────
//
// The dev loop keeps one server alive across many agent turns. When the default
// port (9420) is held by a Windows zombie socket (a dead PID still LISTENING),
// the launcher falls back to the next free port and records it in
// `.runtime/backend.port`. Every client must resolve the port the same way so
// the loop never hard-binds to a dead port. Precedence: CAP_STORE_PORT env →
// `.runtime/backend.port` → 9420.

export function getServerPort(): number {
  const env = process.env.CAP_STORE_PORT
  if (env && /^\d+$/.test(env.trim())) return Number.parseInt(env.trim(), 10)
  try {
    const p = join(process.cwd(), '.runtime', 'backend.port')
    if (existsSync(p)) {
      const v = readFileSync(p, 'utf8').trim()
      if (/^\d+$/.test(v)) return Number.parseInt(v, 10)
    }
  } catch {
    // ignore — fall through to default
  }
  return 9420
}

export function writeServerPortFile(port: number): void {
  try {
    const dir = join(process.cwd(), '.runtime')
    if (!existsSync(dir)) return
    writeFileSync(join(dir, 'backend.port'), String(port), 'utf8')
  } catch {
    // non-fatal — clients fall back to env/default
  }
}

function defaultDataDir(): string {
  if (isWin) {
    const local = process.env.LOCALAPPDATA ?? process.env.APPDATA ?? ''
    return local ? `${local}\\vivim\\cap-store` : '.'
  }
  const home = process.env.HOME ?? process.env.XDG_DATA_HOME ?? ''
  if (home.includes('.local')) return `${home}/share/vivim/cap-store`
  return home ? `${home}/.local/share/vivim/cap-store` : '.'
}

// ── Config values ───────────────────────────────────────────────────────────

export const config = {
  // Server
  host: process.env.CAP_STORE_HOST ?? '127.0.0.1',
  port: Number.parseInt(process.env.CAP_STORE_PORT ?? '9420', 10),

  // Data
  dataDir: process.env.CAP_STORE_DATA_DIR ?? defaultDataDir(),
  dbPath: process.env.CAP_STORE_DB_PATH ?? `${defaultDataDir()}/cap-store.sqlite`,

  // Auth
  authToken: process.env.CAP_STORE_AUTH_TOKEN ?? null,

  // CORS
  corsOrigin: (process.env.CAP_STORE_CORS_ORIGIN ?? 'http://localhost:5175').split(','),

  // Logging
  logLevel: (process.env.CAP_STORE_LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',

  // Fleet
  autoStartFleet: process.env.CAP_STORE_AUTO_START_FLEET === 'true',
  chromePath: process.env.CAP_STORE_CHROME_PATH ?? null,
  // Chrome profile root — single source of truth for where slave profiles live.
  // Frontend will later write this via config_entry; env overrides for now.
  // Defaults to <dataDir>/chrome-profiles so profiles survive across runs and
  // are not lost in a Unix-only /tmp path.
  profileBaseDir:
    process.env.CAP_STORE_PROFILE_DIR ??
    (isWin ? `${defaultDataDir()}\\chrome-profiles` : `${defaultDataDir()}/chrome-profiles`),
  fleetPortRangeStart: Number.parseInt(process.env.CAP_STORE_FLEET_PORT_START ?? '9222', 10),
  fleetPortRangeEnd: Number.parseInt(process.env.CAP_STORE_FLEET_PORT_END ?? '9250', 10),

  // Health
  healthProbeIntervalMs: Number.parseInt(process.env.CAP_STORE_HEALTH_PROBE_MS ?? '30000', 10),

  // Circuit breaker
  circuitBreakerThreshold: Number.parseInt(process.env.CAP_STORE_CIRCUIT_THRESHOLD ?? '5', 10),
  circuitBreakerResetMs: Number.parseInt(process.env.CAP_STORE_CIRCUIT_RESET_MS ?? '30000', 10),

  // HPE retention
  hpeRetentionDays: Number.parseInt(process.env.CAP_STORE_HPE_RETENTION_DAYS ?? '30', 10),

  // Storage hardening (Unit 36.1)
  storage: {
    encryptDb: process.env.CAP_STORE_ENCRYPT_DB === 'true',
  },
} as const

export function isAuthenticated(): boolean {
  return config.authToken !== null
}

export function checkAuth(req: Request): boolean {
  if (!config.authToken) return true
  const header = req.headers.get('authorization')
  if (!header) return false
  const [scheme, token] = header.split(' ')
  return scheme === 'Bearer' && token === config.authToken
}
