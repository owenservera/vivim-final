// frontend/src/lib/logger.ts
// Structured JSON logger for API routes and server-side logic.
// Writes one JSON object per line to stdout/stderr — parseable by log aggregators.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL]
}

function format(level: LogLevel, msg: string, ctx?: LogContext): string {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...ctx,
  }
  return JSON.stringify(entry)
}

export function createLogger(scope: string) {
  return {
    debug(msg: string, ctx?: LogContext) {
    },
    info(msg: string, ctx?: LogContext) {
    },
    warn(msg: string, ctx?: LogContext) {
    },
    error(msg: string, ctx?: LogContext) {
    },
  }
}
