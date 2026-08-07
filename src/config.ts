// src/config.ts
// Centralized configuration — reads from environment variables.
// All engines read config through this module; no scattered process.env reads.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { catchDebug } from './lib/catch-logger.js'
import { safeJsonParse } from './lib/safe-json.js'

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
  } catch (e) {
    catchDebug(e, 'config: port file read failed, using default')
  }
  return 9420
}

export function writeServerPortFile(port: number): void {
  try {
    const dir = join(process.cwd(), '.runtime')
    if (!existsSync(dir)) return
    writeFileSync(join(dir, 'backend.port'), String(port), 'utf8')
  } catch (e) {
    catchDebug(e, 'config: port file write failed (non-fatal)')
  }
}

function defaultDataDir(): string {
  let dir: string
  if (isWin) {
    const local = process.env.LOCALAPPDATA ?? process.env.APPDATA ?? ''
    dir = local ? `${local}\\vivim\\cap-store` : '.'
  } else {
    const home = process.env.HOME ?? process.env.XDG_DATA_HOME ?? ''
    if (home.includes('.local')) dir = `${home}/share/vivim/cap-store`
    else dir = home ? `${home}/.local/share/vivim/cap-store` : '.'
  }
  // Ensure the data directory exists (safe on repeated calls).
  try {
    if (dir !== '.') mkdirSync(dir, { recursive: true })
  } catch (e) {
    catchDebug(e, 'config: runtime dir creation failed')
  }
  return dir
}

// ── Runtime tunables registry (devops-toolkit configurable layer) ──────────
//
// `tunables` is the runtime-reconfigurable layer: any value here can be
// overridden at runtime via `bun run devops toolkit config set <key> <value>`
// and persisted to `.runtime/config.tunables.json`, then hot-read by the
// running server. This is the "configurability" axis of the devops toolkit.

export interface TunableMeta {
  key: string
  type: 'string' | 'number' | 'boolean' | 'string[]'
  default: unknown
  description: string
}

// Tunable defaults reference the static config values below via lazy getters.
// We use a placeholder approach: defaults are resolved at first access after
// config is constructed, not at schema definition time.
const _TUNABLE_DEFAULTS: Record<string, unknown> = {}

export const TUNABLE_SCHEMA: TunableMeta[] = [
  {
    key: 'server.port',
    type: 'number',
    default: 9420,
    description: 'HTTP port for the cap-store server',
  },
  {
    key: 'server.host',
    type: 'string',
    default: '127.0.0.1',
    description: 'Bind host for the cap-store server',
  },
  {
    key: 'server.corsOrigin',
    type: 'string[]',
    default: ['http://localhost:3000', 'http://localhost:5175'],
    description: 'Allowed CORS origins (comma-separated)',
  },
  {
    key: 'log.level',
    type: 'string',
    default: 'info',
    description: 'Logging verbosity (debug|info|warn|error)',
  },
  {
    key: 'fleet.autoStart',
    type: 'boolean',
    default: false,
    description: 'Auto-launch Chrome slave fleet on boot',
  },
  {
    key: 'fleet.portStart',
    type: 'number',
    default: 9222,
    description: 'First port in CDP fleet range',
  },
  {
    key: 'fleet.portEnd',
    type: 'number',
    default: 9250,
    description: 'Last port in CDP fleet range',
  },
  {
    key: 'health.probeIntervalMs',
    type: 'number',
    default: 30000,
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
  // ── Storage tunables (runtime-mutable via setStoragePaths) ───────────────
  {
    key: 'storage.dataDir',
    type: 'string',
    default: defaultDataDir(),
    description: 'Data directory for DB, profiles, cache, and logs',
  },
  {
    key: 'storage.dbPath',
    type: 'string',
    default: `${defaultDataDir()}/cap-store.sqlite`,
    description: 'Absolute path to the SQLite database file',
  },
  {
    key: 'storage.retainOldDays',
    type: 'number',
    default: 7,
    description: 'Days to keep archived old location after relocation',
  },
]

const TUNABLE_FILE = join(process.cwd(), '.runtime', 'config.tunables.json')

function loadTunables(): Record<string, unknown> {
  try {
    if (existsSync(TUNABLE_FILE)) {
      const raw =
        safeJsonParse<Record<string, unknown>>(readFileSync(TUNABLE_FILE, 'utf-8'), {}) ?? {}
      return raw
    }
  } catch (e) {
    catchDebug(e, 'config: tunable file parse failed, using defaults')
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
  } catch (e) {
    catchDebug(e, 'config: tunable persist failed')
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

// ── Runtime-mutable storage paths ───────────────────────────────────────────
//
// These resolve from tunable overrides first, then env, then the platform
// default. The migration engine calls setStoragePaths() to update them
// atomically during Phase 4 (SWITCH).

function resolveDataDir(): string {
  const tunableKey = 'storage.dataDir'
  if (tunableKey in tunableOverrides) {
    return String(tunableOverrides[tunableKey])
  }
  return process.env.CAP_STORE_DATA_DIR ?? defaultDataDir()
}

function resolveDbPath(): string {
  const tunableKey = 'storage.dbPath'
  if (tunableKey in tunableOverrides) {
    return String(tunableOverrides[tunableKey])
  }
  return process.env.CAP_STORE_DB_PATH ?? `${resolveDataDir()}/cap-store.sqlite`
}

// ── Config values ───────────────────────────────────────────────────────────

export const config = {
  // Server
  host: process.env.CAP_STORE_HOST ?? '127.0.0.1',
  port: Number.parseInt(process.env.CAP_STORE_PORT ?? '9420', 10),

  // Data — runtime-mutable via setStoragePaths()
  dataDir: resolveDataDir(),
  dbPath: resolveDbPath(),

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
  // Defaults to <dataDir>/chrome-profiles so profiles survive across runs.
  profileBaseDir:
    process.env.CAP_STORE_PROFILE_DIR ??
    (isWin ? `${resolveDataDir()}\\chrome-profiles` : `${resolveDataDir()}/chrome-profiles`),
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

  // Tunnel + P2P
  tunnel: {
    enabled: process.env.VIVIM_TUNNEL_ENABLED !== 'false',
    serverUrl: process.env.VIVIM_TUNNEL_URL ?? 'wss://tunnel.vivim.live/connect',
    subdomain: process.env.VIVIM_SUBDOMAIN ?? '',
    authToken: process.env.VIVIM_TUNNEL_TOKEN ?? null,
    heartbeatIntervalMs: Number.parseInt(process.env.VIVIM_TUNNEL_HEARTBEAT_MS ?? '30000', 10),
    heartbeatTimeoutMs: Number.parseInt(
      process.env.VIVIM_TUNNEL_HEARTBEAT_TIMEOUT_MS ?? '10000',
      10,
    ),
    reconnectInitialDelayMs: Number.parseInt(
      process.env.VIVIM_TUNNEL_RECONNECT_INITIAL_MS ?? '1000',
      10,
    ),
    reconnectMaxDelayMs: Number.parseInt(process.env.VIVIM_TUNNEL_RECONNECT_MAX_MS ?? '30000', 10),
    reconnectJitterFactor: Number.parseFloat(process.env.VIVIM_TUNNEL_RECONNECT_JITTER ?? '0.3'),
    maxConcurrentRequests: Number.parseInt(process.env.VIVIM_TUNNEL_MAX_REQUESTS ?? '50', 10),
    requestTimeoutMs: Number.parseInt(process.env.VIVIM_TUNNEL_REQUEST_TIMEOUT_MS ?? '60000', 10),
  },
  p2p: {
    enabled: process.env.VIVIM_P2P_ENABLED !== 'false',
    bootstrapNodes: (process.env.VIVIM_P2P_BOOTSTRAP ?? '').split(',').filter(Boolean),
    mdnsEnabled: process.env.VIVIM_P2P_MDNS !== 'false',
    mdnsInterval: Number.parseInt(process.env.VIVIM_P2P_MDNS_INTERVAL_MS ?? '300000', 10),
    dhtEnabled: process.env.VIVIM_P2P_DHT !== 'false',
    relayEnabled: process.env.VIVIM_P2P_RELAY !== 'false',
    maxPeers: Number.parseInt(process.env.VIVIM_P2P_MAX_PEERS ?? '50', 10),
    maxConcurrentTransfers: Number.parseInt(process.env.VIVIM_P2P_MAX_TRANSFERS ?? '5', 10),
    maxFileSize: Number.parseInt(process.env.VIVIM_P2P_MAX_FILE_SIZE ?? '104857600', 10),
    identityPath: process.env.VIVIM_P2P_IDENTITY_PATH ?? '',
  },
  localServer: {
    enabled: process.env.VIVIM_LOCAL_SERVER_ENABLED !== 'false',
    host: process.env.VIVIM_LOCAL_SERVER_HOST ?? '127.0.0.1',
    port: Number.parseInt(process.env.VIVIM_LOCAL_SERVER_PORT ?? '8080', 10),
    corsEnabled: process.env.VIVIM_LOCAL_SERVER_CORS !== 'false',
    corsOrigins: (process.env.VIVIM_LOCAL_SERVER_CORS_ORIGINS ?? 'http://localhost:3000').split(
      ',',
    ),
    rateLimitPerMinute: Number.parseInt(process.env.VIVIM_LOCAL_SERVER_RATE_LIMIT ?? '60', 10),
    maxRequestBodyBytes: Number.parseInt(process.env.VIVIM_LOCAL_SERVER_MAX_BODY ?? '10485760', 10),
    staticDir: process.env.VIVIM_LOCAL_SERVER_STATIC_DIR ?? './workspace-ui',
  },
  orchestrator: {
    healthCheckIntervalMs: Number.parseInt(process.env.VIVIM_ORCHESTRATOR_HEALTH_MS ?? '30000', 10),
    restartDelayMs: Number.parseInt(process.env.VIVIM_ORCHESTRATOR_RESTART_DELAY_MS ?? '5000', 10),
    maxRestartAttempts: Number.parseInt(process.env.VIVIM_ORCHESTRATOR_MAX_RESTARTS ?? '3', 10),
    statusReportIntervalMs: Number.parseInt(
      process.env.VIVIM_ORCHESTRATOR_STATUS_MS ?? '60000',
      10,
    ),
  },

  // CLI / moments
  vivimApiUrl: process.env.VIVIM_API_URL ?? null,
  vivimWorkspace: process.env.VIVIM_WORKSPACE ?? null,

  // Debug
  debug: process.env.DEBUG === 'true',
} as const

// ── Ensure data directories exist on startup ──────────────────────────────
// Safely creates dataDir and profileBaseDir so engines don't crash on first
// boot in the Tauri sidecar or fresh install.
try {
  mkdirSync(config.dataDir, { recursive: true })
  mkdirSync(config.profileBaseDir, { recursive: true })
} catch (e) {
  catchDebug(e, 'config: profileBaseDir creation failed')
}

/**
 * Resolve OTEL sink configuration through the centralized config layer.
 * Returns null endpoint when OTEL_EXPORTER_OTLP_ENDPOINT is unset (no-op mode).
 */
export function getOtelConfig(): { endpoint: string | null; serviceName: string } {
  return { endpoint: config.otel.endpoint, serviceName: config.otel.serviceName }
}

/**
 * HMAC secret for NLCL confirmation tokens.
 * Dev fallback is intentionally insecure — production deployments MUST set the env var.
 * Engines must read this through the config authority, never `process.env` directly (B5).
 */
export function getConfirmationSecret(): string {
  return process.env.VIVIM_CONFIRMATION_SECRET ?? 'dev-insecure-do-not-use-in-prod'
}

/**
 * Effective user home directory (engines must read it here, never `process.env`
 * directly so B5 config-authority stays satisfied).
 */
export function getHomeDir(): string {
  return homedir() || process.env.USERPROFILE || process.env.HOME || '.'
}

// ── Storage path mutation (used by migration engine Phase 4) ────────────────
//
// Updates config.dataDir + config.dbPath in-memory AND persists to tunables.
// Also writes to config_entry DB row via the caller (migration engine).
// The PrismaClient must be closed and reconnected by the caller after this.

/** Internal mutable reference — config.dataDir/dbPath are const, so we shadow via getter. */
let _mutableDataDir: string | null = null
let _mutableDbPath: string | null = null

/** Get the current effective dataDir (may differ from config.dataDir after setStoragePaths). */
export function getDataDir(): string {
  return _mutableDataDir ?? config.dataDir
}

/** Get the current effective dbPath (may differ from config.dbPath after setStoragePaths). */
export function getDbPath(): string {
  return _mutableDbPath ?? config.dbPath
}

/**
 * Atomically update the in-memory storage paths and persist to tunables.
 * Does NOT reconnect Prisma — the caller (migration engine) must call
 * closePrisma() before this and let getPrisma() create a fresh client after.
 */
export function setStoragePaths(dataDir: string, dbPath: string): void {
  _mutableDataDir = dataDir
  _mutableDbPath = dbPath
  setTunable('storage.dataDir', dataDir)
  setTunable('storage.dbPath', dbPath)
}

/**
 * Override the effective Prisma DATABASE_URL (used by the storage relocation
 * engine to repoint Prisma at a moved database). Centralized here so engines
 * never touch process.env directly (invariant B5).
 */
export function setDatabaseUrl(url: string): void {
  process.env.DATABASE_URL = url
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
