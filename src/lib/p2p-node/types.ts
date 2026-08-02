/**
 * VIVIM P2P Node — Types
 */

import type {
  CRDTOperation,
  CRDTSyncAck,
  CRDTSyncRequest,
  CRDTSyncResponse,
  FileComplete,
  FileSyncAccept,
  FileSyncReject,
  FileSyncRequest,
  FileVerify,
  P2PConfig,
  PresenceAck,
  PresenceUpdate,
} from '../tunnel-shared/types.js'

export type {
  FileSyncRequest,
  FileSyncAccept,
  FileSyncReject,
  FileComplete,
  FileVerify,
  CRDTSyncRequest,
  CRDTSyncResponse,
  CRDTSyncAck,
  CRDTOperation,
  PresenceUpdate,
  PresenceAck,
  P2PConfig,
}

export type P2PNodeState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

export interface P2PPeerInfo {
  peerId: string
  multiaddrs: string[]
  connectedAt: number | null
  protocols: string[]
  isRelayed: boolean
  latencyMs: number | null
}

export interface FileTransferProgress {
  fileId: string
  fileName: string
  peerId: string
  direction: 'sending' | 'receiving'
  bytesTransferred: number
  totalBytes: number
  percentage: number
  speedBytesPerSec: number
}

export interface P2PMetrics {
  peerCount: number
  relayedConnections: number
  directConnections: number
  totalBytesIn: number
  totalBytesOut: number
  fileTransfersCompleted: number
  crdtSyncsCompleted: number
  uptimeSeconds: number
}
