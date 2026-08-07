/**
 * VIVIM Tunnel Client — Public API
 *
 * Main entry point for the tunnel client subsystem.
 * Wraps ConnectionManager and provides a simplified interface.
 */

import { getLogger } from '../../lib/tunnel-shared/logger.js'
import type {
  TunnelConnectionState,
  TunnelMetrics,
  VivimConfig,
} from '../../lib/tunnel-shared/types.js'
import { ConnectionManager } from './connection-manager.js'

const log = getLogger('tunnel-client')

export type { TunnelConnectionState, TunnelMetrics }

export class TunnelClient {
  private connectionManager: ConnectionManager
  private config: VivimConfig

  constructor(config: VivimConfig) {
    this.config = config
    this.connectionManager = new ConnectionManager(config)

    // Forward events
    this.connectionManager.on('connected', (subdomain) => {
      log.info({ subdomain }, 'Tunnel connected')
    })

    this.connectionManager.on('disconnected', (reason, code) => {
      log.info({ reason, code }, 'Tunnel disconnected')
    })

    this.connectionManager.on('stateChanged', (state) => {
      log.debug({ state }, 'Tunnel state changed')
    })

    this.connectionManager.on('error', (error) => {
      log.error({ err: error.message }, 'Tunnel error')
    })
  }

  async start(): Promise<void> {
    if (!this.config.tunnel.enabled) {
      log.info('Tunnel client disabled in config')
      return
    }

    log.info('Starting tunnel client')
    try {
      await this.connectionManager.connect()
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'Initial tunnel connection failed, will retry',
      )
    }
  }

  async stop(): Promise<void> {
    log.info('Stopping tunnel client')
    await this.connectionManager.disconnect()
  }

  getState(): TunnelConnectionState {
    return this.connectionManager.getState()
  }

  getSubdomain(): string | null {
    return this.connectionManager.getSubdomain()
  }

  getMetrics(): TunnelMetrics {
    return this.connectionManager.getMetrics()
  }

  isConnected(): boolean {
    return this.connectionManager.getState() === 'connected'
  }
}
