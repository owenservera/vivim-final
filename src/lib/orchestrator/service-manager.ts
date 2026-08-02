/**
 * VIVIM Orchestrator — Service Manager
 *
 * Manages the lifecycle of all subsystems: ledger client, tunnel client,
 * P2P node, local server. Starts them in the correct order, monitors
 * health, and handles restarts.
 */

import type { CapStoreDb } from '../../storage/db.js'
import { LedgerClient } from '../ledger-client/ledger-client.js'
import { applyManifestEntries } from '../ledger-client/manifest-applier.js'
import { LocalServer } from '../local-server/index.js'
import { P2PNode } from '../p2p-node/index.js'
import { TunnelClient } from '../tunnel-client/index.js'
import { getLogger } from '../tunnel-shared/logger.js'
import type { VivimConfig } from '../tunnel-shared/types.js'
import { HealthMonitor } from './health-monitor.js'

const log = getLogger('service-manager')

export class ServiceManager {
  private config: VivimConfig
  private ledgerClient: LedgerClient | null = null
  private tunnelClient: TunnelClient
  private p2pNode: P2PNode
  private localServer: LocalServer
  private healthMonitor: HealthMonitor
  private db: CapStoreDb | null = null
  private startedAt = 0

  constructor(config: VivimConfig, db?: CapStoreDb) {
    this.config = config
    this.db = db ?? null
    this.tunnelClient = new TunnelClient(config)
    this.p2pNode = new P2PNode(config)
    this.localServer = new LocalServer(config)
    this.healthMonitor = new HealthMonitor(config)

    // Register services with health monitor
    this.healthMonitor.registerService('tunnel-client')
    this.healthMonitor.registerService('p2p-node')
    this.healthMonitor.registerService('local-server')

    // Handle restart requests
    this.healthMonitor.on('restart', async (name: string, attempt: number) => {
      log.info({ name, attempt }, 'Restarting service')
      await this.restartService(name)
    })

    this.healthMonitor.on('fatal', (error: Error) => {
      log.error({ err: error.message }, 'Fatal service error')
    })
  }

  async start(): Promise<void> {
    this.startedAt = Date.now()
    log.info('Starting all services')

    // Phase 1: Ledger sync (must happen before tunnel connect)
    if (this.config.ledger.enabled && this.db) {
      await this.startService('ledger-client', async () => {
        this.ledgerClient = new LedgerClient({
          baseUrl: this.config.ledger.baseUrl,
          userToken: this.config.ledger.userToken,
          subdomain: this.config.ledger.subdomain,
          userId: this.config.ledger.userId,
          publicKeyHex: this.config.ledger.publicKeyHex,
          syncIntervalMs: this.config.ledger.syncIntervalMs,
        })

        // Signup if no token yet
        if (!this.config.ledger.userToken && this.config.ledger.email) {
          const signup = await this.ledgerClient.signup(this.config.ledger.email)
          this.config.ledger.userToken = signup.token
          this.config.ledger.subdomain = signup.subdomain
          this.config.ledger.userId = signup.userId
          log.info({ subdomain: signup.subdomain }, 'Ledger signup complete')
        }

        // Full sync → verify → apply manifests to local DB
        const syncResult = await this.ledgerClient.fullSync()
        if (syncResult && this.db) {
          const applied = await applyManifestEntries(this.db, syncResult.entries)
          log.info(
            { upserted: applied.upserted, errors: applied.errors.length },
            'Manifest entries applied to local DB',
          )
        }

        // Mint tunnel JWT
        if (this.config.ledger.subdomain) {
          const tunnelToken = await this.ledgerClient.mintTunnelToken()
          this.config.tunnel.authToken = tunnelToken.token
          this.config.tunnel.subdomain = tunnelToken.subdomain
          log.info({ subdomain: tunnelToken.subdomain }, 'Tunnel JWT minted from ledger')
        }

        // Start periodic sync (runs in background via LedgerClient.start)
        // Note: start() re-runs sync() internally — duplicates are harmless (upserts)
        await this.ledgerClient.start()
      })
    }

    // Start in order: local server first (so tunnel can forward to it)
    await this.startService('local-server', async () => {
      await this.localServer.start()
    })

    // Then tunnel client (needs local server)
    await this.startService('tunnel-client', async () => {
      await this.tunnelClient.start()
    })

    // Then P2P node (independent)
    await this.startService('p2p-node', async () => {
      await this.p2pNode.start()
    })

    // Start health monitoring
    this.healthMonitor.start()

    log.info('All services started')
  }

  async stop(): Promise<void> {
    log.info('Stopping all services')

    this.healthMonitor.stop()

    // Stop ledger client first (stop periodic sync)
    await this.stopService('ledger-client', async () => {
      await this.ledgerClient?.stop()
      this.ledgerClient = null
    })

    // Stop in reverse order
    await this.stopService('p2p-node', async () => {
      await this.p2pNode.stop()
    })

    await this.stopService('tunnel-client', async () => {
      await this.tunnelClient.stop()
    })

    await this.stopService('local-server', async () => {
      await this.localServer.stop()
    })

    log.info('All services stopped')
  }

  private async startService(name: string, startFn: () => Promise<void>): Promise<void> {
    this.healthMonitor.updateServiceStatus(name, 'starting')
    try {
      await startFn()
      this.healthMonitor.updateServiceStatus(name, 'running')
      log.info({ service: name }, 'Service started')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this.healthMonitor.updateServiceStatus(name, 'error', errMsg)
      log.error({ service: name, err: errMsg }, 'Service failed to start')
    }
  }

  private async stopService(name: string, stopFn: () => Promise<void>): Promise<void> {
    this.healthMonitor.updateServiceStatus(name, 'stopping')
    try {
      await stopFn()
      this.healthMonitor.updateServiceStatus(name, 'stopped')
      log.info({ service: name }, 'Service stopped')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      log.error({ service: name, err: errMsg }, 'Service failed to stop')
    }
  }

  private async restartService(name: string): Promise<void> {
    this.healthMonitor.updateServiceStatus(name, 'stopping')

    try {
      switch (name) {
        case 'tunnel-client':
          await this.tunnelClient.stop()
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.orchestrator.restartDelayMs),
          )
          await this.tunnelClient.start()
          break
        case 'p2p-node':
          await this.p2pNode.stop()
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.orchestrator.restartDelayMs),
          )
          await this.p2pNode.start()
          break
        case 'local-server':
          await this.localServer.stop()
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.orchestrator.restartDelayMs),
          )
          await this.localServer.start()
          break
      }

      this.healthMonitor.updateServiceStatus(name, 'running')
      log.info({ service: name }, 'Service restarted')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this.healthMonitor.updateServiceStatus(name, 'error', errMsg)
      log.error({ service: name, err: errMsg }, 'Service failed to restart')
    }
  }

  // ─── Public API ────────────────────────────────────────────────

  getTunnelClient(): TunnelClient {
    return this.tunnelClient
  }

  getP2PNode(): P2PNode {
    return this.p2pNode
  }

  getLocalServer(): LocalServer {
    return this.localServer
  }

  getHealthMonitor(): HealthMonitor {
    return this.healthMonitor
  }

  getStatus() {
    return {
      ...this.healthMonitor.getStatus(),
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      tunnel: {
        connected: this.tunnelClient.isConnected(),
        subdomain: this.tunnelClient.getSubdomain(),
        reconnectCount: this.tunnelClient.getMetrics().reconnectCount,
      },
      p2p: {
        running: this.p2pNode.isRunning(),
        peerCount: this.p2pNode.getMetrics().peerCount,
        relayed: this.p2pNode.getMetrics().relayedConnections > 0,
      },
      localServer: {
        running: this.localServer.isRunning(),
        port: this.localServer.getPort(),
        requestCount: this.localServer.getRequestCount(),
      },
    }
  }
}
