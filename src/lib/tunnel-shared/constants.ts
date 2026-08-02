/**
 * VIVIM Tunnel + P2P — Shared Constants
 */

// ─── Protocol Version ────────────────────────────────────────────

export const PROTOCOL_VERSION = "1.0" as const;

// ─── Tunnel Defaults ─────────────────────────────────────────────

export const TUNNEL_DEFAULTS = {
  SERVER_URL: "wss://tunnel.vivim.live/connect",
  HEARTBEAT_INTERVAL_MS: 30_000,
  HEARTBEAT_TIMEOUT_MS: 10_000,
  RECONNECT_INITIAL_DELAY_MS: 1_000,
  RECONNECT_MAX_DELAY_MS: 60_000,
  RECONNECT_JITTER_FACTOR: 0.25,
  MAX_CONCURRENT_REQUESTS: 50,
  REQUEST_TIMEOUT_MS: 30_000,
  CHUNK_TIMEOUT_MS: 60_000,
} as const;

// ─── P2P Protocol Identifiers ────────────────────────────────────

export const P2P_PROTOCOLS = {
  FILE_SYNC: "/vivim/file-sync/1.0.0",
  CRDT_SYNC: "/vivim/crdt-sync/1.0.0",
  PRESENCE: "/vivim/presence/1.0.0",
} as const;

// ─── P2P Defaults ────────────────────────────────────────────────

export const P2P_DEFAULTS = {
  BOOTSTRAP_NODES: [
    "/dns4/p2p.vivim.live/tcp/443/wss/p2p/QmBootstrap1",
    "/dns4/p2p.vivim.live/tcp/443/wss/p2p/QmBootstrap2",
    "/dns4/p2p.vivim.live/tcp/443/wss/p2p/QmBootstrap3",
  ],
  MDNS_INTERVAL: 10_000,
  MDNS_SERVICE_TAG: "vivim",
  MAX_PEERS: 50,
  MAX_CONCURRENT_TRANSFERS: 5,
  MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
  CHUNK_SIZE: 65_536, // 64KB
  CONNECTION_TIMEOUT: 30_000,
  STREAM_TIMEOUT: 60_000,
  DHT_QUERY_TIMEOUT: 30_000,
} as const;

// ─── Local Server Defaults ───────────────────────────────────────

export const LOCAL_SERVER_DEFAULTS = {
  HOST: "127.0.0.1",
  PORT: 8080,
  CORS_ORIGINS: ["http://localhost:8080"],
  RATE_LIMIT_PER_MINUTE: 100,
  MAX_REQUEST_BODY_BYTES: 10 * 1024 * 1024, // 10MB
} as const;

// ─── Orchestrator Defaults ───────────────────────────────────────

export const ORCHESTRATOR_DEFAULTS = {
  HEALTH_CHECK_INTERVAL_MS: 5_000,
  RESTART_DELAY_MS: 2_000,
  MAX_RESTART_ATTEMPTS: 5,
  STATUS_REPORT_INTERVAL_MS: 60_000,
} as const;

// ─── WebSocket Close Codes ───────────────────────────────────────

export const TUNNEL_CLOSE_CODES = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  ABNORMAL: 1006,
  INVALID_JWT: 4001,
  SUBDOMAIN_CONFLICT: 4002,
  SUBDOMAIN_UNAUTHORIZED: 4003,
  PROTOCOL_MISMATCH: 4004,
  RATE_LIMITED: 4005,
  SERVER_SHUTDOWN: 4010,
  SERVER_MAINTENANCE: 4011,
} as const;

// ─── Reserved Subdomains ─────────────────────────────────────────

export const RESERVED_SUBDOMAINS = new Set([
  "www", "api", "tunnel", "p2p", "auth", "admin",
  "status", "docs", "app", "staging", "test", "demo",
  "blog", "mail", "cdn",
]);

// ─── Event Bus Event Types ───────────────────────────────────────

export const TUNNEL_EVENTS = {
  CONNECTED: "tunnel:connected",
  DISCONNECTED: "tunnel:disconnected",
  RECONNECTING: "tunnel:reconnecting",
  REQUEST_RECEIVED: "tunnel:request:received",
  RESPONSE_SENT: "tunnel:response:sent",
  ERROR: "tunnel:error",
} as const;

export const P2P_EVENTS = {
  PEER_DISCOVERED: "p2p:peer:discovered",
  PEER_CONNECTED: "p2p:peer:connected",
  PEER_DISCONNECTED: "p2p:peer:disconnected",
  FILE_RECEIVED: "p2p:file:received",
  FILE_SENT: "p2p:file:sent",
  CRDT_SYNCED: "p2p:crdt:synced",
  PRESENCE_UPDATE: "p2p:presence:update",
  ERROR: "p2p:error",
} as const;
