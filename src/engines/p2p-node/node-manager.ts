/**
 * VIVIM P2P Node — Node Manager
 *
 * Manages the libp2p node lifecycle: create, start, stop.
 * Handles peer discovery, connection management, and protocol registration.
 */

import { EventEmitter } from 'node:events'
import { autoNAT } from '@libp2p/autonat'
import { bootstrap } from '@libp2p/bootstrap'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { kadDHT } from '@libp2p/kad-dht'
import { noise } from '@libp2p/noise'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { yamux } from '@libp2p/yamux'
import { type Libp2p, createLibp2p } from 'libp2p'
import { P2PConnectionError } from '../../lib/tunnel-shared/errors.js'
import { getLogger } from '../../lib/tunnel-shared/logger.js'
import type { VivimConfig } from '../../lib/tunnel-shared/types.js'
import type { P2PMetrics, P2PNodeState, P2PPeerInfo } from './types.js'

const log = getLogger('node-manager')

export class NodeManager extends EventEmitter {
  private config: VivimConfig['p2p']
  private node: Libp2p | null = null
  private state: P2PNodeState = 'stopped'
  private metrics: P2PMetrics
  private startedAt = 0

  constructor(config: VivimConfig) {
    super()
    this.config = config.p2p
    this.metrics = {
      peerCount: 0,
      relayedConnections: 0,
      directConnections: 0,
      totalBytesIn: 0,
      totalBytesOut: 0,
      fileTransfersCompleted: 0,
      crdtSyncsCompleted: 0,
      uptimeSeconds: 0,
    }
  }

  async start(): Promise<void> {
    if (this.state === 'running' || this.state === 'starting') {
      log.warn({ state: this.state }, 'Node already running or starting')
      return
    }

    this.setState('starting')

    try {
      log.info('Creating libp2p node')

      this.node = await createLibp2p({
        transports: [circuitRelayTransport(), webSockets(), tcp()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        peerDiscovery:
          this.config.bootstrapNodes.length > 0
            ? [bootstrap({ list: this.config.bootstrapNodes, timeout: 30_000 })]
            : [],
        services: {
          autoNAT: autoNAT(),
          identify: identify(),
          dht: kadDHT({ clientMode: true }) as never,
        },
        addresses: {
          listen: ['/p2p-circuit'],
          announce: [],
        },
      })

      this.node.addEventListener('peer:discovery', (event) => {
        const peerId = event.detail.id.toString()
        log.debug({ peerId }, 'Peer discovered')
        this.metrics.peerCount = this.node?.getPeers().length ?? 0
        this.emit('peer:discovered', peerId)
      })

      this.node.addEventListener('peer:connect', (event) => {
        const peerId = event.detail.toString()
        log.info({ peerId }, 'Peer connected')
        this.metrics.peerCount = this.node?.getPeers().length ?? 0
        this.emit('peer:connected', peerId)
      })

      this.node.addEventListener('peer:disconnect', (event) => {
        const peerId = event.detail.toString()
        log.info({ peerId }, 'Peer disconnected')
        this.metrics.peerCount = this.node?.getPeers().length ?? 0
        this.emit('peer:disconnected', peerId)
      })

      this.startedAt = Date.now()
      this.setState('running')

      log.info({ peerId: this.node.peerId.toString() }, 'libp2p node started')
    } catch (err) {
      this.setState('error')
      throw new P2PConnectionError(
        `Failed to start libp2p node: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined,
      )
    }
  }

  async stop(): Promise<void> {
    if (this.state === 'stopped') return

    this.setState('stopping')

    try {
      if (this.node) {
        await this.node.stop()
        this.node = null
      }
      this.setState('stopped')
      log.info('libp2p node stopped')
    } catch (err) {
      this.setState('error')
      log.error({ err }, 'Error stopping libp2p node')
    }
  }

  private setState(state: P2PNodeState): void {
    this.state = state
    this.emit('stateChanged', state)
  }

  getNode(): Libp2p | null {
    return this.node
  }

  getState(): P2PNodeState {
    return this.state
  }

  getPeerId(): string | null {
    return this.node?.peerId.toString() ?? null
  }

  getPeers(): P2PPeerInfo[] {
    if (!this.node) return []

    const peers: P2PPeerInfo[] = []
    for (const connection of this.node.getConnections()) {
      const peerId = connection.remotePeer.toString()
      const multiaddrs = connection.remoteAddr.toString()
      const isRelayed = multiaddrs.includes('p2p-circuit')

      peers.push({
        peerId,
        multiaddrs: [multiaddrs],
        connectedAt: Date.now(),
        protocols: [],
        isRelayed,
        latencyMs: null,
      })
    }

    return peers
  }

  getMetrics(): P2PMetrics {
    return {
      ...this.metrics,
      uptimeSeconds: this.startedAt > 0 ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
    }
  }
}
