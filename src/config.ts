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
  corsOrigin: (
    process.env.CAP_STORE_CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:5175'
  ).split(','),

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

  // OpenTelemetry (centralized so engines don't read process.env directly — B5)
  otel: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? null,
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'vivim-final',
  },

  // Protocol source (dev/ prod)
  providerProtocolSource: process.env.PROVIDER_PROTOCOL_SOURCE ?? 'prod',

  // OpenCode server
  opencodeServeEnabled: process.env.OPENCODE_SERVE_ENABLED === '1',
  opencodeServePort: Number.parseInt(process.env.OPENCODE_SERVE_PORT ?? '0', 10) || undefined,
  opencodeServerPassword: process.env.OPENCODE_SERVER_PASSWORD ?? '',
  opencodeServerUsername: process.env.OPENCODE_SERVER_USERNAME ?? 'opencode',

  // MCP
  mcpPort: Number.parseInt(process.env.MCP_PORT ?? '0', 10) || undefined,

  // CLI / moments
  vivimApiUrl: process.env.VIVIM_API_URL ?? null,
  vivimWorkspace: process.env.VIVIM_WORKSPACE ?? null,

  // Debug
  debug: process.env.DEBUG === 'true',
} as const

/**
 * Resolve OTEL sink configuration through the centralized config layer.
 * Returns null endpoint when OTEL_EXPORTER_OTLP_ENDPOINT is unset (no-op mode).
 */
export function getOtelConfig(): { endpoint: string | null; serviceName: string } {
  return { endpoint: config.otel.endpoint, serviceName: config.otel.serviceName }
}

// ── Runtime tunables registry (devops-toolkit configurable layer) ──────────
//
// Engines read static `config` from env above. `tunables` is the runtime-
// reconfigurable layer: any value here can be overridden at runtime via
// `bun run devops toolkit config set <key> <value>` and persisted to
// `.runtime/config.tunables.json`, then hot-read by the running server.
// This is the "configurability" axis of the devops toolkit — additive, does
// not change existing engine reads of `config`.

export interface TunableMeta {
  key: string
  type: 'string' | 'number' | 'boolean' | 'string[]'
  default: unknown
  description: string
}

export const TUNABLE_SCHEMA: TunableMeta[] = [
  {
    key: 'server.port',
    type: 'number',
    default: config.port,
    description: 'HTTP port for the cap-store server',
  },
  {
    key: 'server.host',
    type: 'string',
    default: config.host,
    description: 'Bind host for the cap-store server',
  },
  {
    key: 'server.corsOrigin',
    type: 'string[]',
    default: config.corsOrigin,
    description: 'Allowed CORS origins (comma-separated)',
  },
  {
    key: 'log.level',
    type: 'string',
    default: config.logLevel,
    description: 'Logging verbosity (debug|info|warn|error)',
  },
  {
    key: 'fleet.autoStart',
    type: 'boolean',
    default: config.autoStartFleet,
    description: 'Auto-launch Chrome slave fleet on boot',
  },
  {
    key: 'fleet.portStart',
    type: 'number',
    default: config.fleetPortRangeStart,
    description: 'First port in CDP fleet range',
  },
  {
    key: 'fleet.portEnd',
    type: 'number',
    default: config.fleetPortRangeEnd,
    description: 'Last port in CDP fleet range',
  },
  {
    key: 'health.probeIntervalMs',
    type: 'number',
    default: config.healthProbeIntervalMs,
    description: 'Health probe cadence',
  },
  {
    key: 'surfaces.cliAliases',
    type: 'boolean',
    default: true,
    description: 'Auto-derive CLI aliases from slug',
  },
  {
    key: 'surfaces.enforceParity',
    type: 'boolean',
    default: true,
    description: 'Fail boot if a capability is out of cross-surface parity',
  },
]

const TUNABLE_FILE = join(process.cwd(), '.runtime', 'config.tunables.json')

function loadTunables(): Record<string, unknown> {
  try {
    if (existsSync(TUNABLE_FILE)) {
      const raw = JSON.parse(readFileSync(TUNABLE_FILE, 'utf-8')) as Record<string, unknown>
      return raw ?? {}
    }
  } catch {
    // ignore corrupt file — fall back to defaults
  }
  return {}
}

const tunableOverrides = loadTunables()

function coerce(meta: TunableMeta, value: unknown): unknown {
  switch (meta.type) {
    case 'number':
      return typeof value === 'number' ? value : Number(value)
    case 'boolean':
      return value === true || value === 'true'
    case 'string[]':
      return Array.isArray(value) ? value : String(value).split(',')
    default:
      return String(value)
  }
}

/** Resolve a tunable's effective value (override > default). */
export function getTunable(key: string): unknown {
  const meta = TUNABLE_SCHEMA.find((t) => t.key === key)
  if (!meta) throw new Error(`Unknown tunable: ${key}`)
  if (key in tunableOverrides) return coerce(meta, tunableOverrides[key])
  return meta.default
}

/** Set + persist a tunable to .runtime/config.tunables.json. */
export function setTunable(key: string, value: unknown): void {
  const meta = TUNABLE_SCHEMA.find((t) => t.key === key)
  if (!meta) throw new Error(`Unknown tunable: ${key}`)
  const next = { ...tunableOverrides, [key]: value }
  try {
    if (!existsSync(join(process.cwd(), '.runtime'))) {
      // best-effort; callers ensure .runtime exists
    }
    writeFileSync(TUNABLE_FILE, JSON.stringify(next, null, 2), 'utf-8')
  } catch {
    throw new Error(`Failed to persist tunable ${key} (cannot write ${TUNABLE_FILE})`)
  }
  tunableOverrides[key] = value
}

/** Snapshot all tunable effective values (for `devops toolkit config list`). */
export function listTunables(): { key: string; value: unknown; source: 'override' | 'default' }[] {
  return TUNABLE_SCHEMA.map((t) => ({
    key: t.key,
    value: t.key in tunableOverrides ? coerce(t, tunableOverrides[t.key]) : t.default,
    source: t.key in tunableOverrides ? 'override' : 'default',
  }))
}

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
