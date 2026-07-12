// src/engines/logger.ts
// Unit 9.1 — Structured logging with pluggable transports.

export interface StructuredLog {
  ts: number
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  msg: string
  engine?: string
  conversationId?: string
  slaveId?: string
  providerId?: string
  traceId?: string
  durationMs?: number
  data?: Record<string, unknown>
  error?: { message: string; stack?: string; name: string }
}

export interface LogTransport {
  name: string
  write(entry: StructuredLog): Promise<void>
  flush?(): Promise<void>
}

export interface LoggingPolicy {
  minLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  transports: TransportConfig[]
  redactPaths: string[]
}

interface TransportConfig {
  name: string
  enabled: boolean
  level?: string
  config: Record<string, unknown>
}

export const DEFAULT_LOGGING_POLICY: LoggingPolicy = {
  minLevel: 'info',
  transports: [{ name: 'console', enabled: true, config: {} }],
  redactPaths: [],
}

const LEVEL_RANK: Record<string, number> = {
  trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5,
}

export class StructuredLogger {
  private transports: LogTransport[] = []
  private minRank: number
  private redactPaths: Set<string>

  constructor(policy: LoggingPolicy) {
    this.minRank = LEVEL_RANK[policy.minLevel] ?? 2
    this.redactPaths = new Set(policy.redactPaths)
    for (const tc of policy.transports) {
      if (!tc.enabled) continue
      if (tc.name === 'console') {
        this.transports.push(new ConsoleTransport(tc.level))
      }
    }
  }

  addTransport(transport: LogTransport): void {
    this.transports.push(transport)
  }

  trace(msg: string, data?: Record<string, unknown>): void { this.write('trace', msg, data) }
  debug(msg: string, data?: Record<string, unknown>): void { this.write('debug', msg, data) }
  info(msg: string, data?: Record<string, unknown>): void { this.write('info', msg, data) }
  warn(msg: string, data?: Record<string, unknown>): void { this.write('warn', msg, data) }
  error(msg: string, data?: Record<string, unknown>): void { this.write('error', msg, data) }
  fatal(msg: string, data?: Record<string, unknown>): void { this.write('fatal', msg, data) }

  child(bindings: Partial<Pick<StructuredLog, 'engine' | 'conversationId' | 'slaveId' | 'providerId'>>): StructuredLogger {
    const child = new StructuredLogger({ minLevel: 'trace' as any, transports: [], redactPaths: [] })
    child.transports = this.transports
    child.minRank = this.minRank
    child.redactPaths = this.redactPaths
    child.bindings = bindings
    return child
  }

  private bindings?: Partial<Pick<StructuredLog, 'engine' | 'conversationId' | 'slaveId' | 'providerId'>>

  private write(level: string, msg: string, data?: Record<string, unknown>): void {
    if ((LEVEL_RANK[level] ?? 0) < this.minRank) return

    let redacted = data
    if (data && this.redactPaths.size > 0) {
      redacted = { ...data }
      for (const path of this.redactPaths) {
        const parts = path.split('.')
        let obj: any = redacted
        for (let i = 0; i < parts.length - 1; i++) {
          const key = parts[i]
          if (key) obj = obj?.[key]
        }
        const lastKey = parts[parts.length - 1]
        if (obj && typeof obj === 'object' && lastKey) {
          obj[lastKey] = '[REDACTED]'
        }
      }
    }

    const entry: StructuredLog = {
      ts: Date.now(),
      level: level as any,
      msg,
      ...this.bindings,
      data: redacted,
    }

    for (const t of this.transports) {
      void t.write(entry).catch(() => {})
    }
  }
}

class ConsoleTransport implements LogTransport {
  name = 'console'
  private minRank: number

  constructor(level?: string) {
    this.minRank = LEVEL_RANK[level ?? 'info'] ?? 2
  }

  async write(entry: StructuredLog): Promise<void> {
    if ((LEVEL_RANK[entry.level] ?? 0) < this.minRank) return
    const prefix = `[${entry.level.toUpperCase()}]${entry.engine ? ` [${entry.engine}]` : ''}`
    const msg = `${prefix} ${entry.msg}`
    switch (entry.level) {
      case 'error': case 'fatal': console.error(msg, entry.data ?? ''); break
      case 'warn': console.warn(msg, entry.data ?? ''); break
      default: console.log(msg, entry.data ?? '')
    }
  }
}
