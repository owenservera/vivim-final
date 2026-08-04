// src/lib/logger.ts
// Structured logging for vivim-final engines. Wraps pino with a project-default
// config (level from LOG_LEVEL env, pretty-print in dev). Engines import
// `getLogger(name)` instead of `console.*` so logs are machine-parseable and
// can be forwarded to an OTel sink (src/engines/otel-sink.ts).
//
// File logging (VIVIM_LOG_FILE): in the compiled desktop sidecar the console is
// hidden, so logs must go to a file to be diagnosable after install. We use
// pino's `destination` (a plain fd stream) instead of `transport` because
// `transport` spawns a worker thread that imports pino-pretty/pino/file as a
// separate module — which fails in `bun build --compile` binaries. `destination`
// has no worker and works in compiled Bun.

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import pino from 'pino'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

const LEVEL = (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info'

/**
 * Resolve the file log path. Defaults to %LOCALAPPDATA%/vivim/vivim-server.log
 * on Windows (matches the sidecar's data dir conventions); falls back to a
 * cwd-relative path elsewhere. Returns null when file logging is disabled.
 */
function resolveLogFile(): string | null {
  const explicit = process.env.VIVIM_LOG_FILE
  if (explicit) return explicit
  if (process.env.NODE_ENV !== 'production') return null
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA ?? process.env.APPDATA ?? '.'
    return `${base}/vivim/vivim-server.log`
  }
  const base = process.env.HOME ?? '.'
  return `${base}/.local/share/vivim/vivim-server.log`
}

const LOG_FILE = resolveLogFile()

function buildLogger(): pino.Logger {
  if (LOG_FILE) {
    try {
      mkdirSync(dirname(LOG_FILE), { recursive: true })
      // `destination` writes via a plain fd — no worker thread, safe in
      // compiled Bun binaries. JSON lines, append-mode by default.
      return pino({ level: LEVEL }, pino.destination(LOG_FILE))
    } catch {
      // fall through to console logger — never crash the sidecar over logging
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    return pino({
      level: LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname,engine' },
      },
    })
  }
  return pino({ level: LEVEL })
}

const base = buildLogger()

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
