# 05 — Server Integration API Reference

> **Status:** FINAL | **Date:** 2026-08-02 | **Version:** 1.0.0
> **Audience:** Server team implementing the central proxy, relay, and auth service

---

## 1. Overview

This document defines the complete API contract that the server infrastructure must implement for the VIVIM Tunnel + P2P client to function. The client code in `src/` connects to these server endpoints. Every endpoint, protocol, and data format is specified here.

---

## 2. Architecture: Server Components

```
┌─────────────────────────────────────────────────────────────┐
│                     SERVER INFRASTRUCTURE                     │
│                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │  Edge/TLS       │  │  Tunnel Server  │  │  P2P Relay   │ │
│  │  (Caddy/CF)     │  │  (WSS Proxy)    │  │  (go-libp2p) │ │
│  │                 │  │                 │  │              │ │
│  │  • SSL term     │  │  • WS :7000    │  │  • WSS :443  │ │
│  │  • *.vivim.live │  │  • HTTP :80/443│  │  • Circuit   │ │
│  │  • Rate limit   │  │  • Subdomain   │  │  • Bootstrap │ │
│  │  • DDoS protect │  │    routing     │  │  • DHT       │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │                    │                   │        │
│  ┌────────▼────────┐  ┌───────▼────────┐          │        │
│  │  Auth Service   │  │  Redis/Router  │          │        │
│  │                 │  │                │          │        │
│  │  • JWT issue    │  │  • sub→ws map  │          │        │
│  │  • JWT verify   │  │  • heartbeat   │          │        │
│  │  • User mgmt    │  │  • rate limit  │          │        │
│  └─────────────────┘  └────────────────┘          │        │
│                                                   │        │
│  ┌─────────────────────────────────────────────────┘        │
│  │  Offline Page CDN                                         │
│  │  • Static HTML/CSS/JS for 503 page                       │
│  │  • Branded per-user (optional)                           │
│  └───────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Tunnel Server API

### 3.1 WebSocket Endpoint: `/connect`

**URL:** `wss://tunnel.vivim.live/connect`
**Protocol:** WebSocket (WSS)
**Port:** 443 (standard WSS)

**Connection Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <jwt>` — JWT with subdomain claim |
| `X-Subdomain` | Yes | Requested subdomain (e.g., `user1`) |
| `X-Protocol-Version` | Yes | Protocol version (e.g., `1.0`) |

**Server Behavior on Connect:**

1. Validate JWT (signature, expiration, claims)
2. Verify `subdomain` claim matches `X-Subdomain` header
3. Check if subdomain is already claimed by another connection
4. If claimed, close existing connection (new connection wins)
5. Register subdomain → WS mapping in router
6. Send `assigned` frame to client

**Server Behavior on Disconnect:**

1. Remove subdomain → WS mapping from router
2. Cancel all pending requests for this subdomain
3. Send 503 to any in-flight HTTP requests

**Server Frame Handling:**

| Frame Type | Direction | Action |
|------------|-----------|--------|
| `http.request` | Server → Client | Forward incoming HTTP request |
| `http.response` | Client → Server | Forward response to visitor |
| `http.chunk` | Client → Server | Forward chunk to visitor |
| `http.abort` | Client → Server | Send 502 to visitor |
| `ping` | Client → Server | Reply with `pong` |
| `pong` | Server → Client | N/A (server sends ping) |
| `status` | Client → Server | Log for monitoring |
| `error` | Client → Server | Log and possibly close |

### 3.2 HTTP Router

**URL:** `https://{subdomain}.vivim.live/{path}`
**Protocol:** HTTPS
**Port:** 443

**Server Behavior:**

1. Extract subdomain from `Host` header
2. Look up active tunnel in router
3. If tunnel exists:
   a. Generate unique request ID (ULID)
   b. Create `http.request` frame
   c. Send frame to tunnel WebSocket
   d. Wait for `http.response` frame (30s timeout)
   e. Forward response to visitor
4. If no tunnel:
   a. Serve offline page (503 Service Unavailable)
   b. Include `Retry-After` header (300 seconds)

**Offline Page Requirements:**

```html
<!-- Served at: {subdomain}.vivim.live when user is offline -->
<!-- HTTP Status: 503 Service Unavailable -->
<!-- Headers: Retry-After: 300 -->
<!DOCTYPE html>
<html>
<head>
  <title>{subdomain} is offline — VIVIM</title>
  <style>
    /* Branded offline page */
    body { font-family: system-ui; display: flex; justify-content: center;
           align-items: center; min-height: 100vh; background: #0f172a; color: #e2e8f0; }
    .container { text-align: center; max-width: 480px; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; }
    .status-dot { width: 12px; height: 12px; border-radius: 50%;
                  background: #ef4444; display: inline-block; margin-right: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <h1><span class="status-dot"></span>{subdomain} is offline</h1>
    <p>This workspace is currently not reachable. The owner needs to have the
       VIVIM desktop app running with an active internet connection.</p>
    <p style="margin-top: 1rem; font-size: 0.75rem; color: #64748b;">
       Auto-retrying in 5 minutes...</p>
  </div>
</body>
</html>
```

### 3.3 Tunnel Health Endpoint

**URL:** `https://tunnel.vivim.live/health`
**Method:** GET
**Auth:** None (public)

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "activeTunnels": 42,
  "uptime": 86400,
  "region": "eu-west-1"
}
```

---

## 4. Auth Service API

### 4.1 Issue Tunnel JWT

**URL:** `https://auth.vivim.live/api/tunnel/token`
**Method:** POST
**Auth:** User session cookie or API key

**Request Body:**
```json
{
  "subdomain": "user1"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIs...",
  "expiresAt": 1722656400,
  "subdomain": "user1.vivim.live"
}
```

**JWT Claims:**
```json
{
  "sub": "user1",
  "subdomain": "user1",
  "iat": 1722570000,
  "exp": 1722656400,
  "jti": "01J5XKQ8M3N4P5R6S7T8U9V0W",
  "aud": "vivim-tunnel",
  "iss": "vivim-auth"
}
```

**Validation Rules:**
- Token MUST be signed with RS256
- `sub` MUST be the authenticated user's ID
- `subdomain` MUST be authorized for this user
- `exp` MUST be within 24 hours of `iat`
- `jti` MUST be unique (server maintains 24h replay cache)

### 4.2 Refresh Tunnel JWT

**URL:** `https://auth.vivim.live/api/tunnel/refresh`
**Method:** POST
**Auth:** Bearer token (current JWT)

**Response:** Same as 4.1

**Rules:**
- Current token MUST be valid (not expired)
- New token has same claims but new `iat`/`exp`/`jti`
- Old token is invalidated

### 4.3 Verify Subdomain Ownership

**URL:** `https://auth.vivim.live/api/subdomain/verify`
**Method:** POST
**Auth:** User session cookie

**Request Body:**
```json
{
  "subdomain": "user1"
}
```

**Response:**
```json
{
  "available": true,
  "reserved": false,
  "authorized": true
}
```

---

## 5. P2P Relay Server API

### 5.1 Relay Endpoint

**URL:** `wss://p2p.vivim.live/relay`
**Protocol:** libp2p Circuit Relay v2
**Implementation:** go-libp2p

**Configuration:**
```go
// go-libp2p relay configuration
relayOpts := []circuit.RelayOpt{
    circuit.WithResources(&circuit.Resources{
        MaxCircuits:          1000,
        MaxCircuitsPerPeer:   10,
        MaxRelayBytes:        1 << 30, // 1GB per relay
        MaxRelayDuration:     2 * time.Hour,
        BufferSize:           4096,
    }),
    circuit.WithACL(&vivimACL{}),
    circuit.WithPeerAddrFilter(peerFilter),
}
```

### 5.2 Bootstrap Node Multiaddrs

The server MUST provide bootstrap nodes for DHT bootstrapping:

```
/dns4/p2p.vivim.live/tcp/443/wss/p2p/QmBootstrap1...
/dns4/p2p.vivim.live/tcp/443/wss/p2p/QmBootstrap2...
/dns4/p2p.vivim.live/tcp/443/wss/p2p/QmBootstrap3...
```

### 5.3 Relay Health Endpoint

**URL:** `https://p2p.vivim.live/health`
**Method:** GET
**Auth:** None (public)

**Response:**
```json
{
  "status": "healthy",
  "activeRelays": 12,
  "activeCircuits": 7,
  "bootstrapPeers": 3,
  "uptime": 86400
}
```

---

## 6. DNS Configuration

### 6.1 Wildcard DNS

```
*.vivim.live   CNAME   proxy.vivim.live
proxy.vivim.live  A   <proxy-ip>
tunnel.vivim.live  A   <tunnel-ip>
p2p.vivim.live     A   <p2p-ip>
auth.vivim.live    A   <auth-ip>
```

### 6.2 SSL/TLS Certificates

| Domain | Certificate Type | Provider |
|--------|-----------------|----------|
| `*.vivim.live` | Wildcard | Let's Encrypt or Cloudflare |
| `tunnel.vivim.live` | Standard | Let's Encrypt |
| `p2p.vivim.live` | Standard | Let's Encrypt |
| `auth.vivim.live` | Standard | Let's Encrypt |

**Recommended:** Use Caddy for automatic HTTPS with Let's Encrypt, or Cloudflare for managed SSL.

---

## 7. Server Deployment Reference

### 7.1 Minimum Requirements

| Component | CPU | RAM | Disk | Network |
|-----------|-----|-----|------|---------|
| Tunnel Server | 2 vCPU | 4 GB | 20 GB SSD | 100 Mbps |
| P2P Relay | 2 vCPU | 2 GB | 10 GB SSD | 100 Mbps |
| Auth Service | 1 vCPU | 1 GB | 10 GB SSD | 10 Mbps |
| Redis (router) | 1 vCPU | 2 GB | 10 GB SSD | 10 Mbps |

### 7.2 Recommended Stack

| Component | Option A (Fastest) | Option B (Scalable) |
|-----------|-------------------|---------------------|
| Tunnel Server | Node.js + `ws` | Go + `gorilla/websocket` |
| Router | Redis | Consul/etcd |
| P2P Relay | go-libp2p | go-libp2p |
| Edge | Caddy | Cloudflare |
| Auth | Node.js + Express | Go + custom |
| Offline Page | Static CDN | Static CDN |

### 7.3 Docker Compose (Reference)

```yaml
version: '3.8'
services:
  tunnel:
    image: vivim/tunnel-server:1.0
    ports:
      - "7000:7000"    # WebSocket tunnel
      - "80:80"        # HTTP routing
      - "443:443"      # HTTPS routing
    environment:
      - REDIS_URL=redis://redis:6379
      - JWT_PUBLIC_KEY=/keys/public.pem
      - OFFLINE_PAGE_PATH=/app/offline.html
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  p2p-relay:
    image: vivim/p2p-relay:1.0
    ports:
      - "443:443"      # WSS relay
    environment:
      - RELAY_MAX_CIRCUITS=1000
      - BOOTSTRAP_PEERS=3

  auth:
    image: vivim/auth-service:1.0
    ports:
      - "3000:3000"
    environment:
      - JWT_PRIVATE_KEY=/keys/private.pem
      - DATABASE_URL=file:/data/auth.db
```

---

## 8. Server-Side Metrics

The server SHOULD expose the following metrics for monitoring:

### 8.1 Tunnel Server Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `tunnel_connections_total` | Counter | Total tunnel connections |
| `tunnel_connections_active` | Gauge | Currently active tunnels |
| `tunnel_requests_total` | Counter | Total HTTP requests routed |
| `tunnel_requests_in_flight` | Gauge | Currently in-flight requests |
| `tunnel_request_duration_seconds` | Histogram | Request latency distribution |
| `tunnel_errors_total` | Counter | Total errors (by type) |
| `tunnel_bandwidth_bytes` | Counter | Total bytes routed |

### 8.2 P2P Relay Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `relay_circuits_active` | Gauge | Active relay circuits |
| `relay_circuits_total` | Counter | Total circuits created |
| `relay_bytes_relayed` | Counter | Total bytes relayed |
| `relay_errors_total` | Counter | Total relay errors |

---

## 9. Client Compatibility Requirements

The server MUST be compatible with the following client behaviors:

| Client Behavior | Server Requirement |
|----------------|-------------------|
| Client sends `ping` every 30s | Server must respond with `pong` within 10s |
| Client reconnects with exponential backoff | Server must handle rapid reconnection |
| Client sends `http.response` with `chunked: true` | Server must forward chunks to visitor |
| Client sends `status` frame | Server should log but not require |
| Client closes with code 1000 | Server should not attempt reconnect |
| Client closes with code 1006 | Server should clean up and allow reconnect |
| Client JWT expires | Server should close with code 4001 |
| Client requests reserved subdomain | Server should close with code 4003 |

---

## 10. API Versioning

### 10.1 Protocol Version

The protocol version is communicated via the `X-Protocol-Version` header during WebSocket connection. The current version is `1.0`.

### 10.2 Version Negotiation

If the client requests a version the server does not support:

1. Server closes the WebSocket with code `4004`
2. Server includes a `X-Supported-Versions` header in the close frame
3. Client can retry with a supported version

### 10.3 Backward Compatibility

- Version 1.0 clients MUST be supported by all future server versions
- New frame types can be added without breaking existing clients
- Clients MUST ignore unknown frame types
