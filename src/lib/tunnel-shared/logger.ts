/**
 * VIVIM Tunnel + P2P — Logger Factory
 *
 * Uses pino for structured logging, consistent with vivim-final.
 */

import pino from 'pino'
import type { LoggingConfig } from './types.js'

const LOGGING_DEFAULTS: LoggingConfig = {
  level: 'info',
  pretty: false,
  logDir: null,
}

let rootLogger: pino.Logger | null = null

export function initLogger(config?: Partial<LoggingConfig>): pino.Logger {
  const merged = { ...LOGGING_DEFAULTS, ...config }

  const transport: pino.TransportTargetOptions[] = []

  // Console transport (always)
  transport.push({
    target: merged.pretty ? 'pino-pretty' : 'pino/file',
    options: merged.pretty ? { colorize: true, translateTime: 'SYS:standard' } : { destination: 1 },
  })

  // File transport (if configured)
  if (merged.logDir) {
    transport.push({
      target: 'pino/file',
      options: { destination: `${merged.logDir}/vivim-tunnel.log`, mkdir: true },
    })
  }

  rootLogger = pino({ level: merged.level }, pino.transport({ targets: transport }))

  return rootLogger
}

export function getLogger(module: string): pino.Logger {
  if (!rootLogger) {
    initLogger()
  }
  if (!rootLogger) {
    throw new Error('tunnel-shared: logger not initialized')
  }
  return rootLogger.child({ module })
}
