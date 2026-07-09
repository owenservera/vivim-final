// src/config.ts
// Centralized configuration — reads from environment variables.
// All engines read config through this module; no scattered process.env reads.

// ── Platform detection ──────────────────────────────────────────────────────

const isWin = process.platform === 'win32'

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
  fleetPortRangeStart: Number.parseInt(process.env.CAP_STORE_FLEET_PORT_START ?? '9222', 10),
  fleetPortRangeEnd: Number.parseInt(process.env.CAP_STORE_FLEET_PORT_END ?? '9250', 10),

  // Health
  healthProbeIntervalMs: Number.parseInt(process.env.CAP_STORE_HEALTH_PROBE_MS ?? '30000', 10),

  // Circuit breaker
  circuitBreakerThreshold: Number.parseInt(process.env.CAP_STORE_CIRCUIT_THRESHOLD ?? '5', 10),
  circuitBreakerResetMs: Number.parseInt(process.env.CAP_STORE_CIRCUIT_RESET_MS ?? '30000', 10),

  // HPE retention
  hpeRetentionDays: Number.parseInt(process.env.CAP_STORE_HPE_RETENTION_DAYS ?? '30', 10),
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
