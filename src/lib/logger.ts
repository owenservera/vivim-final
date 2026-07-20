// src/lib/logger.ts
// Structured logging for vivim-final engines. Wraps pino with a project-default
// config (level from LOG_LEVEL env, pretty-print in dev). Engines import
// `getLogger(name)` instead of `console.*` so logs are machine-parseable and
// can be forwarded to an OTel sink (src/engines/otel-sink.ts).

import pino from 'pino'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

const LEVEL = (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info'
const PRETTY = process.env.NODE_ENV !== 'production'

const base = pino({
  level: LEVEL,
  ...(PRETTY
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname,engine' },
        },
      }
    : {}),
})

/**
 * Returns a child logger scoped to `name` (typically an engine or module).
 * The `engine` field is set to `name` so structured logs carry the source
 * (FR-008/SC-004: top-level `engine`, `level`, `msg`). All engines should call
 * this instead of console.log/error.
 */
export function getLogger(name: string): pino.Logger {
  return base.child({ engine: name })
}

export default base
