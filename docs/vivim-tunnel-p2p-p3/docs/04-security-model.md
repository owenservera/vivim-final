# 04 — Security Model

> **Status:** FINAL | **Date:** 2026-08-02

---

## 1. Threat Model

| # | Threat | Severity | Likelihood | Mitigation |
|---|--------|----------|------------|------------|
| T1 | Subdomain hijacking — unauthorized user claims another user's subdomain | Critical | Low | JWT claims + proxy verification + subdomain ownership binding |
| T2 | Request spoofing — attacker injects fake HTTP requests into the tunnel | Critical | Low | WSS + TLS 1.3 + frame ID validation |
| T3 | Man-in-the-middle — attacker intercepts WSS connection | High | Low | TLS certificate pinning + HSTS |
| T4 | P2P identity impersonation — attacker spoofs peer ID | High | Low | Ed25519 cryptographic peer IDs |
| T5 | Data exfiltration — attacker reads user data through the tunnel | Critical | Low | Server never stores content; TLS in transit; encryption at rest (Phase 20) |
| T6 | DDoS on central proxy — attacker floods proxy with requests | High | Medium | Rate limiting per subdomain + connection quotas + Cloudflare edge |
| T7 | Unauthorized P2P access — attacker connects to user's P2P node | Medium | Medium | Peer ID verification + explicit peer acceptance |
| T8 | Replay attack — attacker replays JWT or tunnel frames | High | Low | JWT `jti` + short TTL + frame ID nonce |
| T9 | DNS hijacking — attacker redirects `*.vivim.live` | Critical | Very Low | DNSSEC + Cloudflare DNS |
| T10 | Local server exposure — attacker accesses localhost:8080 | Medium | Low | Localhost binding only + CORS restrictions |

---

## 2. Authentication

### 2.1 Tunnel Authentication

The tunnel connection is authenticated via JWT in the `Authorization` header of the WebSocket upgrade request.

**JWT Structure:**
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
1. JWT MUST be signed with RS256 (asymmetric) — the server has the public key, the auth service has the private key
2. `exp` MUST be within 24 hours of `iat`
3. `subdomain` MUST match `sub` unless the user has admin privileges
4. `jti` MUST be unique — server maintains a 24-hour replay cache
5. `aud` MUST be `vivim-tunnel`
6. `iss` MUST be `vivim-auth`

### 2.2 P2P Authentication

P2P authentication is handled by the libp2p Noise protocol:

1. Each peer has an Ed25519 key pair
2. The public key is the peer ID
3. All connections are encrypted with Noise XX handshake
4. No additional authentication needed — peer ID IS the identity

### 2.3 Local Server Authentication

The local server on `localhost:8080` is protected by:

1. **Network binding:** Only listens on `127.0.0.1` (not `0.0.0.0`)
2. **CORS:** Only allows requests from the same origin
3. **Auth token:** API routes require a bearer token (generated on startup)
4. **Rate limiting:** 100 requests/minute per route

---

## 3. Authorization

### 3.1 Subdomain Authorization

The proxy MUST verify that the authenticated user is authorized to claim the requested subdomain:

```
User "user1" can claim subdomain "user1" ✅
User "user1" can claim subdomain "user2" ❌ (unless admin)
User "user1" can claim subdomain "api"   ❌ (reserved subdomains)
```

**Reserved subdomains:** `www`, `api`, `tunnel`, `p2p`, `admin`, `status`, `docs`, `app`

### 3.2 P2P Access Control

P2P connections are **opt-in** — users must explicitly accept a peer connection:

1. Peer A sends connection request
2. Peer B sees request in UI (peer ID + username if available)
3. Peer B accepts or rejects
4. If accepted, the connection is established
5. If rejected, the connection is refused

### 3.3 Request Routing Authorization

The proxy MUST verify that each incoming HTTP request is routed to the correct tunnel:

1. Parse the `Host` header from the incoming request
2. Extract the subdomain from the `Host` header
3. Look up the active tunnel for that subdomain
4. If no active tunnel, serve 503 offline page
5. If tunnel exists, forward the request

---

## 4. Encryption

### 4.1 In Transit

| Channel | Encryption | Details |
|---------|-----------|---------|
| Tunnel (WSS) | TLS 1.3 | Terminated at edge (Cloudflare or Caddy) |
| P2P | Noise XX | Built into libp2p |
| Local (localhost) | None | Not needed — localhost only |

### 4.2 At Rest

Phase 0 does NOT implement encryption at rest. This is deferred to Phase 20 (Sovereign Data). The Phase 0 code is designed to be compatible with Phase 20's EncryptionEngine.

### 4.3 Key Management

| Key | Type | Storage | Rotation |
|-----|------|---------|----------|
| JWT signing key | RS256 | Server-side HSM or KMS | 90 days |
| P2P identity key | Ed25519 | Local filesystem | Never (persistent identity) |
| Tunnel auth token | JWT | In-memory (desktop) | 24 hours (renewed by auth service) |

---

## 5. Data Privacy

### 5.1 Zero Data Storage

The central proxy is a **smart router** — it routes bytes and forgets them. Specifically:

- HTTP request bodies are NOT logged
- HTTP response bodies are NOT logged
- WebSocket frames are NOT logged
- Only metadata is stored: request count, latency, error count

### 5.2 P2P Data Privacy

P2P data flows directly between peers. The relay (if used) is a dumb forwarder:

- The relay cannot read content (Noise encryption)
- The relay only sees source/destination peer IDs
- The relay does not store any data

### 5.3 Local Data Privacy

All workspace data lives on the user's machine:

- SQLite database (vivim-final)
- Chrome profiles (vivim-final)
- P2P identity keys
- Configuration files

---

## 6. Rate Limiting

### 6.1 Tunnel Rate Limits

| Resource | Limit | Window | Action on Exceed |
|----------|-------|--------|-------------------|
| Connections per subdomain | 1 | — | Close existing connection (new wins) |
| HTTP requests per subdomain | 100 | 1 minute | 429 Too Many Requests |
| Bandwidth per subdomain | 100 MB | 1 minute | 503 Service Unavailable |
| Concurrent in-flight requests | 50 | — | 503 Service Unavailable |
| Connection attempts | 5 | 1 minute | 4005 rate limit close code |

### 6.2 P2P Rate Limits

| Resource | Limit | Window |
|----------|-------|--------|
| Incoming connections | 10 | 1 minute |
| File transfer requests | 5 | 1 minute |
| DHT queries | 30 | 1 minute |

---

## 7. Audit Logging

### 7.1 Client-Side Audit

The client logs all security-relevant events to the local pino logger:

- Tunnel connection established/lost
- JWT token refresh
- P2P peer connected/disconnected
- File transfer initiated/completed
- Local server request received
- Configuration changes

### 7.2 Server-Side Audit (Integration Docs)

The server SHOULD log:
- Tunnel connection/disconnection events
- Subdomain assignment changes
- Authentication failures
- Rate limit violations
- Error responses sent to visitors

### 7.3 Telemetry Audit Compatibility

Phase 0 logging is compatible with the Phase 20 TelemetryAudit engine. All network calls are recorded via the existing `TelemetryAudit.recordCall()` interface, enabling the zero-cloud proof system.
