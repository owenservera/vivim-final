/**
 * VIVIM P2P Node — Public API
 *
 * Main entry point for the P2P node subsystem.
 * Wraps NodeManager, FileSyncHandler, and CRDTSyncHandler.
 */

import { NodeManager } from "./node-manager.js";
import { FileSyncHandler } from "./file-sync.js";
import { CRDTSyncHandler } from "./crdt-sync.js";
import { getLogger } from "../../lib/tunnel-shared/logger.js";
import type { VivimConfig } from "../../lib/tunnel-shared/types.js";
import type { P2PNodeState, P2PPeerInfo, FileTransferProgress, P2PMetrics } from "./types.js";

const log = getLogger("p2p-node");

export type { P2PNodeState, P2PPeerInfo, FileTransferProgress, P2PMetrics };

export class P2PNode {
  private nodeManager: NodeManager;
  private fileSync: FileSyncHandler | null = null;
  private crdtSync: CRDTSyncHandler | null = null;
  private config: VivimConfig;

  constructor(config: VivimConfig) {
    this.config = config;
    this.nodeManager = new NodeManager(config);

    this.nodeManager.on("peer:discovered", (peerId: string) => {
      log.debug({ peerId }, "Peer discovered");
    });

    this.nodeManager.on("peer:connected", (peerId: string) => {
      log.info({ peerId }, "Peer connected");
    });

    this.nodeManager.on("peer:disconnected", (peerId: string) => {
      log.info({ peerId }, "Peer disconnected");
    });
  }

  async start(): Promise<void> {
    if (!this.config.p2p.enabled) {
      log.info("P2P node disabled in config");
      return;
    }

    log.info("Starting P2P node");

    await this.nodeManager.start();

    const node = this.nodeManager.getNode();
    if (node) {
      const metrics = this.nodeManager.getMetrics();
      this.fileSync = new FileSyncHandler(node, metrics);
      this.fileSync.registerHandler();

      this.crdtSync = new CRDTSyncHandler(node, metrics);
      this.crdtSync.registerHandler();
    }
  }

  async stop(): Promise<void> {
    log.info("Stopping P2P node");
    await this.nodeManager.stop();
    this.fileSync = null;
    this.crdtSync = null;
  }

  getState(): P2PNodeState {
    return this.nodeManager.getState();
  }

  getPeerId(): string | null {
    return this.nodeManager.getPeerId();
  }

  getPeers(): P2PPeerInfo[] {
    return this.nodeManager.getPeers();
  }

  getMetrics(): P2PMetrics {
    return this.nodeManager.getMetrics();
  }

  getFileSync(): FileSyncHandler | null {
    return this.fileSync;
  }

  getCRDTSync(): CRDTSyncHandler | null {
    return this.crdtSync;
  }

  isRunning(): boolean {
    return this.nodeManager.getState() === "running";
  }
}
