/**
 * VIVIM P2P Node — CRDT Sync Protocol
 *
 * Handles real-time synchronization of CRDT-based workspace state
 * between peers using the /vivim/crdt-sync/1.0.0 protocol.
 */

import { EventEmitter } from 'node:events'
import type { Libp2p } from '@libp2p/interface'
import { P2P_PROTOCOLS } from '../tunnel-shared/constants.js'
import { P2PCRTDSyncError } from '../tunnel-shared/errors.js'
import { getLogger } from '../tunnel-shared/logger.js'
import type {
  CRDTOperation,
  CRDTSyncAck,
  CRDTSyncRequest,
  CRDTSyncResponse,
} from '../tunnel-shared/types.js'
import type { P2PMetrics } from './types.js'

const log = getLogger('crdt-sync')

/** Legacy stream shape with source/sink (pre-MessageStream libp2p versions). */
interface LegacyStream {
  source?: AsyncIterable<Uint8Array>
  sink?: (source: AsyncIterable<Uint8Array>) => Promise<void>
}

/**
 * Simple CRDT document store using Lamport clocks.
 * In production, this would use a proper CRDT library like Yjs or Automerge.
 */
export class CRDTDocument {
  private clock = 0
  private operations: CRDTOperation[] = []
  private documentId: string

  constructor(documentId: string) {
    this.documentId = documentId
  }

  getClock(): number {
    return this.clock
  }

  getVersion(): string {
    return `v${this.operations.length}:${this.clock}`
  }

  applyOperation(op: CRDTOperation): void {
    this.operations.push(op)
    this.clock = Math.max(this.clock, op.lamportClock) + 1
  }

  getOperationsSince(clock: number): CRDTOperation[] {
    return this.operations.filter((op) => op.lamportClock > clock)
  }
}

export class CRDTSyncHandler extends EventEmitter {
  private node: Libp2p
  private metrics: P2PMetrics
  private documents: Map<string, CRDTDocument> = new Map()

  constructor(node: Libp2p, metrics: P2PMetrics) {
    super()
    this.node = node
    this.metrics = metrics
  }

  registerHandler(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- libp2p handler signature varies across versions
    ;(this.node as any).handle(P2P_PROTOCOLS.CRDT_SYNC, async (data: any) => {
      log.info('Incoming CRDT sync request')
      const stream = data.stream ?? data

      try {
        const source = (stream as unknown as LegacyStream).source ?? stream
        const reader = source[Symbol.asyncIterator]()

        const { value: requestChunk } = await reader.next()
        if (!requestChunk) throw new P2PCRTDSyncError('Empty stream')

        const request: CRDTSyncRequest = JSON.parse(new TextDecoder().decode(requestChunk))

        log.info(
          { documentId: request.documentId, localClock: request.localClock },
          'CRDT sync request received',
        )

        const doc = this.getOrCreateDocument(request.documentId)

        const response: CRDTSyncResponse = {
          type: 'sync-response',
          documentId: request.documentId,
          remoteClock: doc.getClock(),
          remoteVersion: doc.getVersion(),
          operations: doc.getOperationsSince(request.localClock),
        }

        const sink = (stream as unknown as LegacyStream).sink
        if (typeof sink === 'function') {
          await sink([new TextEncoder().encode(JSON.stringify(response))])
        }

        const { value: ackChunk } = await reader.next()
        if (ackChunk) {
          const ack: CRDTSyncAck = JSON.parse(new TextDecoder().decode(ackChunk))
          log.debug(
            { documentId: ack.documentId, receivedClock: ack.receivedClock },
            'CRDT sync acknowledged',
          )
        }

        this.metrics.crdtSyncsCompleted++
        this.emit('crdt:synced', { documentId: request.documentId })
      } catch (err) {
        log.error({ err }, 'CRDT sync handler error')
      }
    })

    log.info('CRDT sync protocol handler registered')
  }

  async syncWithPeer(peerId: string, documentId: string): Promise<void> {
    const doc = this.getOrCreateDocument(documentId)

    log.info({ peerId, documentId, localClock: doc.getClock() }, 'Starting CRDT sync with peer')

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- libp2p dialProtocol signature varies across versions
      const stream = await (this.node as any).dialProtocol(peerId, P2P_PROTOCOLS.CRDT_SYNC)

      const request: CRDTSyncRequest = {
        type: 'sync-request',
        documentId,
        localClock: doc.getClock(),
        localVersion: doc.getVersion(),
      }

      const sink = (stream as any).sink
      if (typeof sink === 'function') {
        await sink([new TextEncoder().encode(JSON.stringify(request))])
      }

      const source = (stream as any).source ?? stream
      const reader = source[Symbol.asyncIterator]()
      const { value: responseChunk } = await reader.next()
      if (!responseChunk) throw new P2PCRTDSyncError('No sync response')

      const response: CRDTSyncResponse = JSON.parse(new TextDecoder().decode(responseChunk))

      log.info(
        { documentId, remoteClock: response.remoteClock, opsCount: response.operations.length },
        'CRDT sync response received',
      )

      for (const op of response.operations) {
        doc.applyOperation(op)
      }

      const ack: CRDTSyncAck = {
        type: 'sync-ack',
        documentId,
        receivedClock: response.remoteClock,
      }
      if (typeof sink === 'function') {
        await sink([new TextEncoder().encode(JSON.stringify(ack))])
      }

      this.metrics.crdtSyncsCompleted++
      this.emit('crdt:synced', { documentId, peerId })
    } catch (err) {
      throw new P2PCRTDSyncError(
        `CRDT sync failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined,
      )
    }
  }

  private getOrCreateDocument(documentId: string): CRDTDocument {
    let doc = this.documents.get(documentId)
    if (!doc) {
      doc = new CRDTDocument(documentId)
      this.documents.set(documentId, doc)
    }
    return doc
  }
}
