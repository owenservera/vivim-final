/**
 * VIVIM P2P Node — CRDT Sync Protocol
 *
 * Handles real-time synchronization of CRDT-based workspace state
 * between peers using the /vivim/crdt-sync/1.0.0 protocol.
 */

import { getLogger } from "../shared/logger.js";
import { P2P_PROTOCOLS } from "../shared/constants.js";
import { P2PCRTDSyncError } from "../shared/errors.js";
import type { Libp2p } from "libp2p";
import type {
  CRDTSyncRequest,
  CRDTSyncResponse,
  CRDTSyncAck,
  CRDTOperation,
} from "../shared/types.js";
import type { P2PMetrics } from "./types.js";
import { EventEmitter } from "events";

const log = getLogger("crdt-sync");

/**
 * Simple CRDT document store using Lamport clocks.
 * In production, this would use a proper CRDT library like Yjs or Automerge.
 */
export class CRDTDocument {
  private clock: number = 0;
  private operations: CRDTOperation[] = [];
  private documentId: string;

  constructor(documentId: string) {
    this.documentId = documentId;
  }

  getClock(): number {
    return this.clock;
  }

  getVersion(): string {
    // Simple version hash based on operation count and clock
    return `v${this.operations.length}:${this.clock}`;
  }

  applyOperation(op: CRDTOperation): void {
    this.operations.push(op);
    this.clock = Math.max(this.clock, op.lamportClock) + 1;
  }

  getOperationsSince(clock: number): CRDTOperation[] {
    return this.operations.filter((op) => op.lamportClock > clock);
  }
}

export class CRDTSyncHandler extends EventEmitter {
  private node: Libp2p;
  private metrics: P2PMetrics;
  private documents: Map<string, CRDTDocument> = new Map();

  constructor(node: Libp2p, metrics: P2PMetrics) {
    super();
    this.node = node;
    this.metrics = metrics;
  }

  /**
   * Register the CRDT sync protocol handler.
   */
  registerHandler(): void {
    this.node.handle(P2P_PROTOCOLS.CRTD_SYNC, async ({ stream }) => {
      log.info("Incoming CRDT sync request");

      try {
        const reader = stream.source[Symbol.asyncIterator]();

        // Read sync request
        const { value: requestChunk } = await reader.next();
        if (!requestChunk) throw new P2PCRTDSyncError("Empty stream");

        const request: CRDTSyncRequest = JSON.parse(
          new TextDecoder().decode(requestChunk),
        );

        log.info(
          { documentId: request.documentId, localClock: request.localClock },
          "CRDT sync request received",
        );

        // Get document
        const doc = this.getOrCreateDocument(request.documentId);

        // Build response with operations since the requester's clock
        const response: CRDTSyncResponse = {
          type: "sync-response",
          documentId: request.documentId,
          remoteClock: doc.getClock(),
          remoteVersion: doc.getVersion(),
          operations: doc.getOperationsSince(request.localClock),
        };

        await stream.sink([
          new TextEncoder().encode(JSON.stringify(response)),
        ]);

        // Read ACK
        const { value: ackChunk } = await reader.next();
        if (ackChunk) {
          const ack: CRDTSyncAck = JSON.parse(
            new TextDecoder().decode(ackChunk),
          );
          log.debug(
            { documentId: ack.documentId, receivedClock: ack.receivedClock },
            "CRDT sync acknowledged",
          );
        }

        this.metrics.crdtSyncsCompleted++;
        this.emit("crdt:synced", { documentId: request.documentId });
      } catch (err) {
        log.error({ err }, "CRDT sync handler error");
      }
    });

    log.info("CRDT sync protocol handler registered");
  }

  /**
   * Sync a document with a remote peer.
   */
  async syncWithPeer(peerId: string, documentId: string): Promise<void> {
    const doc = this.getOrCreateDocument(documentId);

    log.info(
      { peerId, documentId, localClock: doc.getClock() },
      "Starting CRDT sync with peer",
    );

    try {
      const stream = await this.node.dialProtocol(peerId, P2P_PROTOCOLS.CRTD_SYNC);

      // Send sync request
      const request: CRDTSyncRequest = {
        type: "sync-request",
        documentId,
        localClock: doc.getClock(),
        localVersion: doc.getVersion(),
      };
      await stream.sink([
        new TextEncoder().encode(JSON.stringify(request)),
      ]);

      // Read sync response
      const reader = stream.source[Symbol.asyncIterator]();
      const { value: responseChunk } = await reader.next();
      if (!responseChunk) throw new P2PCRTDSyncError("No sync response");

      const response: CRDTSyncResponse = JSON.parse(
        new TextDecoder().decode(responseChunk),
      );

      log.info(
        { documentId, remoteClock: response.remoteClock, opsCount: response.operations.length },
        "CRDT sync response received",
      );

      // Apply remote operations
      for (const op of response.operations) {
        doc.applyOperation(op);
      }

      // Send ACK
      const ack: CRDTSyncAck = {
        type: "sync-ack",
        documentId,
        receivedClock: response.remoteClock,
      };
      await stream.sink([
        new TextEncoder().encode(JSON.stringify(ack)),
      ]);

      this.metrics.crdtSyncsCompleted++;
      this.emit("crdt:synced", { documentId, peerId });
    } catch (err) {
      throw new P2PCRTDSyncError(
        `CRDT sync failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined,
      );
    }
  }

  private getOrCreateDocument(documentId: string): CRDTDocument {
    let doc = this.documents.get(documentId);
    if (!doc) {
      doc = new CRDTDocument(documentId);
      this.documents.set(documentId, doc);
    }
    return doc;
  }
}
