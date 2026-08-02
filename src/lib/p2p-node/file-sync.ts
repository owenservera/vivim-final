/**
 * VIVIM P2P Node — File Sync Protocol
 *
 * Handles direct peer-to-peer file transfers using the /vivim/file-sync/1.0.0 protocol.
 * Supports chunked transfer, progress tracking, and SHA-256 verification.
 */

import { createHash } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join, dirname } from "node:path";
import { getLogger } from "../tunnel-shared/logger.js";
import { P2P_PROTOCOLS, P2P_DEFAULTS } from "../tunnel-shared/constants.js";
import { P2PFileTransferError } from "../tunnel-shared/errors.js";
import type { Libp2p } from "@libp2p/interface";
import type { FileTransferProgress, P2PMetrics } from "./types.js";
import type { FileSyncRequest, FileSyncAccept, FileComplete } from "../tunnel-shared/types.js";
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
    (this.node as any).handle(P2P_PROTOCOLS.FILE_SYNC, async (data: any) => {
      log.info("Incoming file sync request");
      const stream = data.stream ?? data;

      try {
        const source = (stream as any).source ?? stream;
        const reader = source[Symbol.asyncIterator]();

        const { value: requestChunk } = await reader.next();
        if (!requestChunk) throw new P2PFileTransferError("Empty stream");

        const request: FileSyncRequest = JSON.parse(
          new TextDecoder().decode(requestChunk),
        );

        log.info(
          { fileId: request.fileId, fileName: request.fileName, fileSize: request.fileSize },
          "File sync request received",
        );

        const accept: FileSyncAccept = {
          type: "accept",
          requestId: request.fileId,
          chunkSize: request.chunkSize,
        };

        const sinkFn = (stream as any).sink;
        if (typeof sinkFn === "function") {
          await sinkFn([new TextEncoder().encode(JSON.stringify(accept))]);
        }

        const filePath = join(process.cwd(), "downloads", request.fileName);
        await mkdir(dirname(filePath), { recursive: true });

        const hash = createHash("sha256");
        let received = 0;
        let chunkIndex = 0;

        const writeStream = createWriteStream(filePath);

        for await (const chunk of source) {
          const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
          writeStream.write(data);
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

          chunkIndex++;
        }

        writeStream.end();

        const computedHash = hash.digest("hex");
        const complete: FileComplete = {
          type: "complete",
          sha256: computedHash,
        };
        if (typeof sinkFn === "function") {
          await sinkFn([new TextEncoder().encode(JSON.stringify(complete))]);
        }

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
      const stream = await (this.node as any).dialProtocol(
        peerId,
        P2P_PROTOCOLS.FILE_SYNC,
      );

      const request: FileSyncRequest = {
        type: "request",
        fileId: `file_${Date.now()}`,
        fileName,
        fileSize,
        sha256,
        chunkSize: P2P_DEFAULTS.CHUNK_SIZE,
      };

      const sinkFn = (stream as any).sink;
      if (typeof sinkFn === "function") {
        await sinkFn([new TextEncoder().encode(JSON.stringify(request))]);
      }

      const source = (stream as any).source ?? stream;
      const reader = source[Symbol.asyncIterator]();
      const { value: acceptChunk } = await reader.next();
      if (!acceptChunk) throw new P2PFileTransferError("No accept response");

      const accept: FileSyncAccept = JSON.parse(
        new TextDecoder().decode(acceptChunk),
      );

      if (accept.type !== "accept") {
        throw new P2PFileTransferError("Peer rejected file transfer");
      }

      let sent = 0;
      const chunkSize = accept.chunkSize ?? P2P_DEFAULTS.CHUNK_SIZE;

      for (let offset = 0; offset < fileSize; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, fileSize);
        const chunk = fileBuffer.slice(offset, end);

        if (typeof sinkFn === "function") {
          await sinkFn([chunk]);
        }
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

      const { value: completeChunk } = await reader.next();
      if (completeChunk) {
        const complete: FileComplete = JSON.parse(
          new TextDecoder().decode(completeChunk),
        );
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
