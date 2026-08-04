# 02 — Tunnel Protocol Specification: WebSocket Reverse Proxy

> **Status:** FINAL | **Date:** 2026-08-02 | **Version:** 1.0.0
> **Protocol Version:** 1.0

---

## 1. Overview

The tunnel protocol is a JSON-over-WebSocket protocol that enables a central proxy to route HTTP requests to a desktop client through a persistent outbound WebSocket connection. The desktop client never opens a public port; instead, it maintains a single outbound WSS connection to the proxy, and the proxy sends HTTP requests as framed messages over this connection.

---

## 2. Connection Lifecycle

### 2.1 Connection Establishment

```
Desktop Client                                     Central Proxy
    │                                                  │
    │  WSS CONNECT to wss://tunnel.vivim.live/connect  │
    │─────────────────────────────────────────────────►│
    │  Headers:                                        │
    │    Authorization: Bearer <jwt>                    │
    │    X-Subdomain: user1                            │
    │    X-Protocol-Version: 1.0                       │
    │                                                  │
    │  WS OPEN                                         │
    │◄─────────────────────────────────────────────────│
    │                                                  │
    │  { type: "assigned",                             │
    │    subdomain: "user1.vivim.live",                │
    │    protocolVersion: "1.0",                       │
    │    relayUrl: "wss://p2p.vivim.live/relay",       │
    │    serverTime: 1722570000000 }                   │
    │◄─────────────────────────────────────────────────│
    │                                                  │
    │  Heartbeat: ping every 30s                       │
    │  ──────────────────────────────────────────────  │
    │  Normal operation: proxy forwards HTTP requests  │
    │  ──────────────────────────────────────────────  │
```

### 2.2 JWT Authentication

The JWT token MUST contain the following claims:

```json
{
  "sub": "user1",
  "subdomain": "user1",
  "iat": 1722570000,
  "exp": 1722656400,
  "jti": "unique-token-id",
  "aud": "vivim-tunnel",
  "iss": "vivim-auth"
}
```

| Claim | Required | Description |
|-------|----------|-------------|
| `sub` | Yes | User identifier |
| `subdomain` | Yes | Requested subdomain (must match `sub` or be admin-assigned) |
| `iat` | Yes | Issued at (epoch seconds) |
| `exp` | Yes | Expiration (epoch seconds) |
| `jti` | Yes | Unique token ID (prevents replay) |
| `aud` | Yes | Must be `vivim-tunnel` |
| `iss` | Yes | Must be `vivim-auth` |

### 2.3 Connection Rejection

If authentication fails, the proxy MUST close the WebSocket with a close code:

| Code | Reason |
|------|--------|
| 4001 | Invalid JWT (malformed, expired, invalid signature) |
| 4002 | Subdomain already claimed by another active connection |
| 4003 | Subdomain not authorized for this user |
| 4004 | Protocol version not supported |
| 4005 | Rate limit exceeded |

---

## 3. Frame Format

All frames are JSON-encoded text messages on the WebSocket connection.

### 3.1 Common Frame Structure

```typescript
interface TunnelFrame {
  id: string;           // Unique request ID (ULID)
  type: FrameType;      // Frame type
  timestamp: number;    // Epoch milliseconds
  version: string;      // Protocol version "1.0"
}

type FrameType =
  | "http.request"      // Proxy → Desktop: incoming HTTP request
  | "http.response"     // Desktop → Proxy: HTTP response
  | "http.chunk"        // Desktop → Proxy: streaming chunk
  | "http.abort"        // Desktop → Proxy: request aborted
  | "ping"              // Bidirectional: keepalive
  | "pong"              // Bidirectional: keepalive response
  | "assigned"          // Proxy → Desktop: subdomain assigned
  | "error"             // Bidirectional: protocol error
  | "status"            // Desktop → Proxy: status update
  | "metrics"           // Desktop → Proxy: usage metrics
```

### 3.2 HTTP Request Frame (Proxy → Desktop)

```typescript
interface HttpRequestFrame extends TunnelFrame {
  type: "http.request";
  method: string;       // GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD
  path: string;         // /dashboard, /api/conversations, etc.
  query: Record<string, string>;  // Parsed query parameters
  headers: Record<string, string>; // Request headers
  body: string | null;  // Base64-encoded body (null for GET/HEAD)
  bodySize: number;     // Original body size in bytes
  remoteAddress: string; // Visitor's IP (X-Forwarded-For)
  protocol: string;     // "http" or "https"
  host: string;         // Original Host header from visitor
}
```

**Example:**
```json
{
  "id": "01J5XKQ8M3N4P5R6S7T8U9V0W",
  "type": "http.request",
  "timestamp": 1722570000000,
  "version": "1.0",
  "method": "GET",
  "path": "/dashboard",
  "query": {},
  "headers": {
    "accept": "text/html,application/xhtml+xml",
    "accept-language": "en-US,en;q=0.9",
    "cookie": "session=abc123",
    "user-agent": "Mozilla/5.0 ...",
    "x-forwarded-for": "203.0.113.42"
  },
  "body": null,
  "bodySize": 0,
  "remoteAddress": "203.0.113.42",
  "protocol": "https",
  "host": "user1.vivim.live"
}
```

### 3.3 HTTP Response Frame (Desktop → Proxy)

```typescript
interface HttpResponseFrame extends TunnelFrame {
  type: "http.response";
  requestId: string;    // Matches the request frame ID
  status: number;       // HTTP status code
  headers: Record<string, string>; // Response headers
  body: string | null;  // Base64-encoded body
  bodySize: number;     // Original body size in bytes
  chunked: boolean;     // If true, more chunks will follow
  duration: number;     // Processing time in ms
}
```

**Example:**
```json
{
  "id": "01J5XKQ8M3N4P5R6S7T8U9V0X",
  "type": "http.response",
  "timestamp": 1722570000123,
  "version": "1.0",
  "requestId": "01J5XKQ8M3N4P5R6S7T8U9V0W",
  "status": 200,
  "headers": {
    "content-type": "text/html; charset=utf-8",
    "set-cookie": "session=abc123; Path=/; HttpOnly"
  },
  "body": "PCFET1BUWVBOPGh0bWw+...",
  "bodySize": 15234,
  "chunked": false,
  "duration": 23
}
```

### 3.4 HTTP Chunk Frame (Desktop → Proxy)

For streaming responses (SSE, large files, chunked transfer):

```typescript
interface HttpChunkFrame extends TunnelFrame {
  type: "http.chunk";
  requestId: string;    // Matches the request frame ID
  chunkIndex: number;   // Sequential chunk index (0-based)
  data: string;         // Base64-encoded chunk data
  lastChunk: boolean;   // If true, this is the final chunk
}
```

### 3.5 HTTP Abort Frame (Desktop → Proxy)

When the local server fails to process a request:

```typescript
interface HttpAbortFrame extends TunnelFrame {
  type: "http.abort";
  requestId: string;    // Matches the request frame ID
  reason: string;       // Human-readable error description
  code: string;         // Machine-readable error code
}
```

### 3.6 Ping/Pong Frames

```typescript
interface PingFrame extends TunnelFrame {
  type: "ping";
  latencyHint?: number; // Desktop's last measured latency to proxy
}

interface PongFrame extends TunnelFrame {
  type: "pong";
  serverTime: number;   // Proxy's current epoch ms
}
```

### 3.7 Error Frame

```typescript
interface ErrorFrame extends TunnelFrame {
  type: "error";
  code: string;         // Machine-readable error code
  message: string;      // Human-readable error description
  fatal: boolean;       // If true, connection will be closed
}
```

### 3.8 Status Frame (Desktop → Proxy)

Periodic status update from the desktop client:

```typescript
interface StatusFrame extends TunnelFrame {
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
    cpu: number;        // Percentage
    memory: number;     // MB used
    uptime: number;     // Seconds since orchestrator start
  };
}
```

---

## 4. Request Multiplexing

Multiple HTTP requests can be in-flight simultaneously over a single WebSocket connection. Each request is identified by its unique `id` field (ULID). The proxy MUST:

1. Assign a unique ID to each incoming HTTP request
2. Send the request frame to the desktop client
3. Wait for the response frame with matching `requestId`
4. If no response within 30 seconds, send 504 Gateway Timeout
5. Support at least 50 concurrent in-flight requests

---

## 5. Streaming Support

For responses that exceed 1MB or are streamed (SSE, chunked transfer), the client MUST use chunked encoding:

1. First, send an `http.response` frame with `chunked: true` and `body: null`
2. Then, send one or more `http.chunk` frames with sequential `chunkIndex`
3. Finally, send an `http.chunk` frame with `lastChunk: true`

The proxy MUST:
1. Forward the initial response headers to the visitor immediately
2. Forward each chunk as it arrives
3. Close the response when `lastChunk: true` is received

---

## 6. Binary Frame Support (Future)

Protocol version 1.0 uses JSON text frames. Version 1.1 will add support for binary frames using a custom binary encoding for improved performance:

```
[1 byte: frame type] [2 bytes: version] [16 bytes: request ID] [4 bytes: body length] [N bytes: body]
```

The client and server negotiate the frame format during connection establishment via the `X-Protocol-Version` header.

---

## 7. Timeout Specifications

| Timeout | Duration | Action |
|---------|----------|--------|
| WSS connect | 10s | Abort connection attempt |
| WSS ping/pong | 30s interval, 10s response | Reconnect on missed pong |
| HTTP request | 30s | 504 Gateway Timeout |
| HTTP chunk | 60s between chunks | Abort request, 504 |
| Reconnect initial | 1s | First reconnect attempt |
| Reconnect max | 60s | Maximum backoff interval |
| Reconnect jitter | ±25% | Random jitter to prevent thundering herd |

---

## 8. Close Codes

| Code | Reason | Reconnect? |
|------|--------|------------|
| 1000 | Normal shutdown | No |
| 1001 | Going away (app quit) | No |
| 1006 | Abnormal close (network) | Yes |
| 4001 | Invalid JWT | No (fix auth) |
| 4002 | Subdomain conflict | Yes (retry after delay) |
| 4003 | Subdomain not authorized | No (fix auth) |
| 4004 | Protocol version mismatch | No (upgrade client) |
| 4005 | Rate limit | Yes (after cooldown) |
| 4010 | Server shutdown | Yes (reconnect to different node) |
| 4011 | Server maintenance | Yes (after maintenance window) |
