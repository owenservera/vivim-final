// src/observability/logger.ts
// Structured logging with Pino-style JSON output.
// Phase 1: Replace ad-hoc console.* with structured logging.
// Redacts sensitive fields (cookies, auth tokens) in production.

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
}

const REDACTED_METHODS = new Set([
  'Network.setCookie',
  'Network.deleteCookies',
  'Storage.setCookies',
  'Network.getCookies',
  'Network.getAllCookies',
])

const REDACTED_FIELDS = new Set([
  'cookie',
  'token',
  'password',
  'secret',
  'authorization',
  'setCookie',
  'paramsJson',
])

export interface LogEntry {
  level: LogLevel
  time: string
  msg: string
  [key: string]: unknown
}

/**
 * Redact sensitive fields from log data.
 */
function redactSensitive(
  method: string | undefined,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_FIELDS.has(key)) {
      result[key] = '[REDACTED]'
    } else if (method && REDACTED_METHODS.has(method) && key === 'params') {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = redactSensitive(method, value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Structured logger with JSON output in production, pretty in dev.
 */
export class StructuredLogger {
  private minLevel: number
  private isDev: boolean

  constructor(
    private context: string,
    level: LogLevel = 'info',
  ) {
    this.minLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info
    this.isDev = process.env.NODE_ENV !== 'production'
  }

  private log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < this.minLevel) return

    const entry: LogEntry = {
      level,
      time: new Date().toISOString(),
      msg: `[${this.context}] ${msg}`,
      ...data,
    }

    if (this.isDev) {
      // Pretty print in dev
      const { level: _, time: __, ...rest } = entry
      console.log(`[${level.toUpperCase()}] ${entry.msg}`, rest)
    } else {
      // JSON in production
      console.log(JSON.stringify(entry))
    }
  }

  trace(msg: string, data?: Record<string, unknown>): void {
    this.log('trace', msg, data)
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.log('debug', msg, data)
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.log('info', msg, data)
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.log('warn', msg, data)
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.log('error', msg, data)
  }

  fatal(msg: string, data?: Record<string, unknown>): void {
    this.log('fatal', msg, data)
  }

  /**
   * Log a CDP command with automatic redaction of sensitive params.
   */
  cdpCommand(slaveId: string, method: string, params?: Record<string, unknown>): void {
    const redactedParams = params ? redactSensitive(method, params) : undefined
    this.debug('CDP command', {
      slaveId,
      method,
      ...(redactedParams ? { params: redactedParams } : {}),
    })
  }

  /**
   * Log a CDP response with automatic redaction.
   */
  cdpResponse(slaveId: string, method: string, durationMs: number, success: boolean): void {
    this.debug('CDP response', {
      slaveId,
      method,
      durationMs,
      success,
    })
  }

  /**
   * Create a child logger with additional context.
   */
  child(context: string): StructuredLogger {
    return new StructuredLogger(`${this.context}:${context}`, this.getLevel())
  }

  private getLevel(): LogLevel {
    for (const [level, num] of Object.entries(LOG_LEVELS)) {
      if (num === this.minLevel) return level as LogLevel
    }
    return 'info'
  }
}

// Singleton loggers
const loggers = new Map<string, StructuredLogger>()

export function getLogger(context: string): StructuredLogger {
  if (!loggers.has(context)) {
    const level = (process.env.CAP_STORE_LOG_LEVEL ?? 'info') as LogLevel
    loggers.set(context, new StructuredLogger(context, level))
  }
  return loggers.get(context) ?? new StructuredLogger(context, level)
}
