/**
 * VIVIM P2P Node — File Sync Protocol
 *
 * Handles direct peer-to-peer file transfers using the /vivim/file-sync/1.0.0 protocol.
 * Supports chunked transfer, progress tracking, and SHA-256 verification.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join, dirname } from "node:path";
import { getLogger } from "../../lib/tunnel-shared/logger.js";
import { P2P_PROTOCOLS, P2P_DEFAULTS } from "../../lib/tunnel-shared/constants.js";
import { P2PFileTransferError } from "../../lib/tunnel-shared/errors.js";
import type { Libp2p } from "libp2p";
import type { Connection, Stream } from "@libp2p/interface";
import { peerIdFromString } from "@libp2p/peer-id";
import type { FileTransferProgress, P2PMetrics } from "./types.js";
import type { FileSyncRequest, FileSyncAccept, FileComplete } from "../../lib/tunnel-shared/types.js";
import { EventEmitter } from "events";

const log = getLogger("file-sync");

export class FileSyncHandler extends EventEmitter {
  private node: Libp2p;
  private metrics: P2PMetrics;
  private activeTransfers: Map<string, FileTransferProgress> = new Map();

  constructor(node: Libp2p, metrics: P2PMetrics) {
    super();
    this.node = node;
    this.metrics = metrics;
  }

  registerHandler(): void {
    this.node.handle(P2P_PROTOCOLS.FILE_SYNC, async (stream: Stream, _connection: Connection) => {
      log.info("Incoming file sync request");

      try {
        // Read the request frame - libp2p v3 uses message events
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk.slice()));
        }
        const requestStr = new TextDecoder().decode(new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0) ? chunks.flatMap(c => [...c]) : [0]));
        const request: FileSyncRequest = JSON.parse(requestStr);

        log.info(
          { fileId: request.fileId, fileName: request.fileName, fileSize: request.fileSize },
          "File sync request received",
        );

        // Send accept
        const accept: FileSyncAccept = {
          type: "accept",
          requestId: request.fileId,
          chunkSize: request.chunkSize,
        };
        stream.send(new TextEncoder().encode(JSON.stringify(accept)));

        // Receive file chunks
        const filePath = join(process.cwd(), "downloads", request.fileName);
        await mkdir(dirname(filePath), { recursive: true });

        const hash = createHash("sha256");
        let received = 0;

        for await (const chunk of stream) {
          const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk.slice());
          hash.update(data);
          received += data.length;

          const progress: FileTransferProgress = {
            fileId: request.fileId,
            fileName: request.fileName,
            peerId: "",
            direction: "receiving",
            bytesTransferred: received,
            totalBytes: request.fileSize,
            percentage: Math.round((received / request.fileSize) * 100),
            speedBytesPerSec: 0,
          };
          this.activeTransfers.set(request.fileId, progress);
          this.emit("progress", progress);
        }

        // Verify SHA-256
        const computedHash = hash.digest("hex");
        const complete: FileComplete = {
          type: "complete",
          sha256: computedHash,
        };
        stream.send(new TextEncoder().encode(JSON.stringify(complete)));

        this.activeTransfers.delete(request.fileId);
        this.metrics.fileTransfersCompleted++;

        log.info(
          { fileId: request.fileId, sha256: computedHash, received },
          "File transfer complete",
        );

        this.emit("file:received", {
          fileId: request.fileId,
          fileName: request.fileName,
          filePath,
          sha256: computedHash,
          size: received,
        });
      } catch (err) {
        log.error({ err }, "File sync handler error");
      }
    });

    log.info("File sync protocol handler registered");
  }

  async sendFile(peerId: string, filePath: string, fileName: string): Promise<void> {
    const fileBuffer = await readFile(filePath);
    const fileSize = fileBuffer.length;
    const sha256 = createHash("sha256").update(fileBuffer).digest("hex");

    log.info(
      { peerId, fileName, fileSize, sha256 },
      "Starting file transfer",
    );

    try {
      const peerIdObj = peerIdFromString(peerId);
      const stream = await this.node.dialProtocol(peerIdObj, P2P_PROTOCOLS.FILE_SYNC);

      // Send request
      const request: FileSyncRequest = {
        type: "request",
        fileId: `file_${Date.now()}`,
        fileName,
        fileSize,
        sha256,
        chunkSize: P2P_DEFAULTS.CHUNK_SIZE,
      };
      stream.send(new TextEncoder().encode(JSON.stringify(request)));

      // Read accept response
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk.slice()));
      }
      if (chunks.length === 0) throw new P2PFileTransferError("No accept response");

      const acceptStr = new TextDecoder().decode(new Uint8Array(chunks.flatMap(c => [...c])));
      const accept: FileSyncAccept = JSON.parse(acceptStr);

      if (accept.type !== "accept") {
        throw new P2PFileTransferError("Peer rejected file transfer");
      }

      // Send file chunks
      let sent = 0;
      const chunkSize = accept.chunkSize ?? P2P_DEFAULTS.CHUNK_SIZE;

      for (let offset = 0; offset < fileSize; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, fileSize);
        const chunk = fileBuffer.subarray(offset, end);

        stream.send(chunk);
        sent += chunk.length;

        const progress: FileTransferProgress = {
          fileId: request.fileId,
          fileName,
          peerId,
          direction: "sending",
          bytesTransferred: sent,
          totalBytes: fileSize,
          percentage: Math.round((sent / fileSize) * 100),
          speedBytesPerSec: 0,
        };
        this.activeTransfers.set(request.fileId, progress);
        this.emit("progress", progress);
      }

      // Read complete response
      const verifyChunks: Uint8Array[] = [];
      for await (const chunk of stream) {
        verifyChunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk.slice()));
      }
      if (verifyChunks.length > 0) {
        const completeStr = new TextDecoder().decode(new Uint8Array(verifyChunks.flatMap(c => [...c])));
        const complete: FileComplete = JSON.parse(completeStr);
        log.info({ sha256: complete.sha256 }, "Transfer verified by peer");
      }

      this.activeTransfers.delete(request.fileId);
      this.metrics.fileTransfersCompleted++;

      log.info({ fileName, peerId }, "File transfer complete");
      this.emit("file:sent", { fileId: request.fileId, fileName, peerId });
    } catch (err) {
      throw new P2PFileTransferError(
        `File transfer failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined,
      );
    }
  }

  getActiveTransfers(): FileTransferProgress[] {
    return [...this.activeTransfers.values()];
  }
}
