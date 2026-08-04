/**
 * VIVIM P2P Node — CRDT Sync Protocol
 *
 * Handles real-time synchronization of CRDT-based workspace state
 * between peers using the /vivim/crdt-sync/1.0.0 protocol.
 */

import { getLogger } from "../../lib/tunnel-shared/logger.js";
import { P2P_PROTOCOLS } from "../../lib/tunnel-shared/constants.js";
import { P2PFileTransferError } from "../../lib/tunnel-shared/errors.js";
import type { Libp2p } from "libp2p";
import type { Connection, Stream } from "@libp2p/interface";
import { peerIdFromString } from "@libp2p/peer-id";
import type {
  CRDTSyncRequest,
  CRDTSyncResponse,
  CRDTSyncAck,
  CRDTOperation,
} from "../../lib/tunnel-shared/types.js";
import type { P2PMetrics } from "./types.js";
import { EventEmitter } from "events";

const log = getLogger("crdt-sync");

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

  registerHandler(): void {
    this.node.handle(P2P_PROTOCOLS.CRDT_SYNC, async (stream: Stream, _connection: Connection) => {
      log.info("Incoming CRDT sync request");

      try {
        // Read sync request
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk.slice()));
        }
        if (chunks.length === 0) throw new P2PFileTransferError("Empty stream");

        const requestStr = new TextDecoder().decode(new Uint8Array(chunks.flatMap(c => [...c])));
        const request: CRDTSyncRequest = JSON.parse(requestStr);

        log.info(
          { documentId: request.documentId, localClock: request.localClock },
          "CRDT sync request received",
        );

        const doc = this.getOrCreateDocument(request.documentId);

        const response: CRDTSyncResponse = {
          type: "sync-response",
          documentId: request.documentId,
          remoteClock: doc.getClock(),
          remoteVersion: doc.getVersion(),
          operations: doc.getOperationsSince(request.localClock),
        };

        stream.send(new TextEncoder().encode(JSON.stringify(response)));

        // Read ACK
        const ackChunks: Uint8Array[] = [];
        for await (const chunk of stream) {
          ackChunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk.slice()));
        }
        if (ackChunks.length > 0) {
          const ackStr = new TextDecoder().decode(new Uint8Array(ackChunks.flatMap(c => [...c])));
          const ack: CRDTSyncAck = JSON.parse(ackStr);
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

  async syncWithPeer(peerId: string, documentId: string): Promise<void> {
    const doc = this.getOrCreateDocument(documentId);

    log.info(
      { peerId, documentId, localClock: doc.getClock() },
      "Starting CRDT sync with peer",
    );

    try {
      const peerIdObj = peerIdFromString(peerId);
      const stream = await this.node.dialProtocol(peerIdObj, P2P_PROTOCOLS.CRDT_SYNC);

      // Send sync request
      const request: CRDTSyncRequest = {
        type: "sync-request",
        documentId,
        localClock: doc.getClock(),
        localVersion: doc.getVersion(),
      };
      stream.send(new TextEncoder().encode(JSON.stringify(request)));

      // Read sync response
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk.slice()));
      }
      if (chunks.length === 0) throw new P2PFileTransferError("No sync response");

      const responseStr = new TextDecoder().decode(new Uint8Array(chunks.flatMap(c => [...c])));
      const response: CRDTSyncResponse = JSON.parse(responseStr);

      log.info(
        { documentId, remoteClock: response.remoteClock, opsCount: response.operations.length },
        "CRDT sync response received",
      );

      for (const op of response.operations) {
        doc.applyOperation(op);
      }

      // Send ACK
      const ack: CRDTSyncAck = {
        type: "sync-ack",
        documentId,
        receivedClock: response.remoteClock,
      };
      stream.send(new TextEncoder().encode(JSON.stringify(ack)));

      this.metrics.crdtSyncsCompleted++;
      this.emit("crdt:synced", { documentId, peerId });
    } catch (err) {
      throw new P2PFileTransferError(
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
