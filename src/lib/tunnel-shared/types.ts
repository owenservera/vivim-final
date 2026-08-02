/**
 * VIVIM Tunnel + P2P — Shared Types
 *
 * All shared type definitions used across the tunnel client, P2P node,
 * local server, and orchestrator.
 */

// ─── Tunnel Protocol Types ───────────────────────────────────────

export type FrameType =
  | "http.request"
  | "http.response"
  | "http.chunk"
  | "http.abort"
  | "ping"
  | "pong"
  | "assigned"
  | "error"
  | "status"
  | "metrics";

export interface TunnelFrame {
  id: string;
  type: FrameType;
  timestamp: number;
  version: string;
}

export interface HttpRequestFrame extends TunnelFrame {
  type: "http.request";
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string | null;
  bodySize: number;
  remoteAddress: string;
  protocol: string;
  host: string;
}

export interface HttpResponseFrame extends TunnelFrame {
  type: "http.response";
  requestId: string;
  status: number;
  headers: Record<string, string>;
  body: string | null;
  bodySize: number;
  chunked: boolean;
  duration: number;
}

export interface HttpChunkFrame extends TunnelFrame {
  type: "http.chunk";
  requestId: string;
  chunkIndex: number;
  data: string;
  lastChunk: boolean;
}

export interface HttpAbortFrame extends TunnelFrame {
  type: "http.abort";
  requestId: string;
  reason: string;
  code: string;
}

export interface PingFrame extends TunnelFrame {
  type: "ping";
  latencyHint?: number;
}

export interface PongFrame extends TunnelFrame {
  type: "pong";
  serverTime: number;
}

export interface AssignedFrame extends TunnelFrame {
  type: "assigned";
  subdomain: string;
  protocolVersion: string;
  relayUrl: string;
  serverTime: number;
}

export interface ErrorFrame extends TunnelFrame {
  type: "error";
  code: string;
  message: string;
  fatal: boolean;
}

export interface StatusFrame extends TunnelFrame {
  type: "status";
  localServer: {
    running: boolean;
    port: number;
    requestCount: number;
  };
  p2pNode: {
    running: boolean;
    peerCount: number;
    relayed: boolean;
  };
  system: {
    cpu: number;
    memory: number;
    uptime: number;
  };
}

// ─── P2P Protocol Types ──────────────────────────────────────────

export interface FileSyncRequest {
  type: "request";
  fileId: string;
  fileName: string;
  fileSize: number;
  sha256: string;
  chunkSize: number;
}

export interface FileSyncAccept {
  type: "accept";
  requestId: string;
  chunkSize: number;
}

export interface FileSyncReject {
  type: "reject";
  requestId: string;
  reason: string;
}

export interface FileComplete {
  type: "complete";
  sha256: string;
}

export interface FileVerify {
  type: "verified";
  sha256: string;
}

export interface CRDTSyncRequest {
  type: "sync-request";
  documentId: string;
  localClock: number;
  localVersion: string;
}

export interface CRDTSyncResponse {
  type: "sync-response";
  documentId: string;
  remoteClock: number;
  remoteVersion: string;
  operations: CRDTOperation[];
}

export interface CRDTSyncAck {
  type: "sync-ack";
  documentId: string;
  receivedClock: number;
}

export interface CRDTOperation {
  id: string;
  type: "insert" | "delete" | "replace";
  position: number;
  value?: string;
  lamportClock: number;
  authorPeerId: string;
}

export interface PresenceUpdate {
  type: "presence";
  status: "online" | "away" | "offline";
  capabilities: string[];
  workspaceId: string;
  timestamp: number;
}

export interface PresenceAck {
  type: "presence-ack";
  status: "online" | "away" | "offline";
  capabilities: string[];
  timestamp: number;
}

// ─── Orchestrator Types ──────────────────────────────────────────

export type ServiceStatus = "stopped" | "starting" | "running" | "stopping" | "error";

export interface ServiceState {
  name: string;
  status: ServiceStatus;
  startedAt: number | null;
  errorCount: number;
  lastError: string | null;
}

export interface OrchestratorStatus {
  services: Record<string, ServiceState>;
  uptime: number;
  tunnel: {
    connected: boolean;
    subdomain: string | null;
    reconnectCount: number;
  };
  p2p: {
    running: boolean;
    peerCount: number;
    relayed: boolean;
  };
  localServer: {
    running: boolean;
    port: number;
    requestCount: number;
  };
}

// ─── Local Server Types ──────────────────────────────────────────

export interface LocalServerRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string | null;
  remoteAddress: string;
}

export interface LocalServerResponse {
  status: number;
  headers: Record<string, string>;
  body: string | null;
  chunked: boolean;
  bodySize?: number;
}

export interface RouteDefinition {
  method: string;
  path: string;
  handler: (req: LocalServerRequest) => Promise<LocalServerResponse>;
}

// ─── Config Types ────────────────────────────────────────────────

export interface VivimConfig {
  tunnel: TunnelConfig;
  p2p: P2PConfig;
  localServer: LocalServerConfig;
  orchestrator: OrchestratorConfig;
  logging: LoggingConfig;
  ledger: LedgerConfig;
}

export interface TunnelConfig {
  enabled: boolean;
  serverUrl: string;
  subdomain: string;
  protocolVersion: string;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  reconnectInitialDelayMs: number;
  reconnectMaxDelayMs: number;
  reconnectJitterFactor: number;
  maxConcurrentRequests: number;
  requestTimeoutMs: number;
  authToken: string | null;
}

export interface P2PConfig {
  enabled: boolean;
  bootstrapNodes: string[];
  mdnsEnabled: boolean;
  mdnsInterval: number;
  dhtEnabled: boolean;
  relayEnabled: boolean;
  maxPeers: number;
  maxConcurrentTransfers: number;
  maxFileSize: number;
  identityPath: string;
}

export interface LocalServerConfig {
  enabled: boolean;
  host: string;
  port: number;
  corsEnabled: boolean;
  corsOrigins: string[];
  rateLimitPerMinute: number;
  maxRequestBodyBytes: number;
  staticDir: string;
}

export interface OrchestratorConfig {
  healthCheckIntervalMs: number;
  restartDelayMs: number;
  maxRestartAttempts: number;
  statusReportIntervalMs: number;
}

export interface LoggingConfig {
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  pretty: boolean;
  logDir: string | null;
}

export interface LedgerConfig {
  enabled: boolean;
  baseUrl: string;
  syncIntervalMs: number;
  publicKeyHex: string;
  userToken: string | null;
  subdomain: string | null;
  userId: string | null;
  email: string | null;
}

// ─── Tunnel Client Types ────────────────────────────────────────

export type TunnelConnectionState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "claiming"
  | "connected"
  | "reconnecting"
  | "error";

export interface TunnelMetrics {
  connected: boolean;
  subdomain: string | null;
  reconnectCount: number;
  requestsHandled: number;
  bytesIn: number;
  bytesOut: number;
  latencyMs: number | null;
  uptimeSeconds: number;
}

// ─── P2P Node Types ─────────────────────────────────────────────

export type P2PNodeState = "stopped" | "starting" | "running" | "stopping" | "error";

export interface P2PPeerInfo {
  peerId: string;
  multiaddrs: string[];
  connectedAt: number | null;
  protocols: string[];
  isRelayed: boolean;
  latencyMs: number | null;
}

export interface FileTransferProgress {
  fileId: string;
  fileName: string;
  peerId: string;
  direction: "sending" | "receiving";
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speedBytesPerSec: number;
}

export interface P2PMetrics {
  peerCount: number;
  relayedConnections: number;
  directConnections: number;
  totalBytesIn: number;
  totalBytesOut: number;
  fileTransfersCompleted: number;
  crdtSyncsCompleted: number;
  uptimeSeconds: number;
}
