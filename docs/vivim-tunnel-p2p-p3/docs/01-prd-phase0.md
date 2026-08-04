# 01 — Product Requirements Document: Phase 0 — Tunnel + P2P + Local Hosting

> **Status:** FINAL | **Date:** 2026-08-02 | **Version:** 1.0.0

---

## 1. Product Overview

### 1.1 Vision

Enable every VIVIM desktop user to have a public web presence at `{username}.vivim.live` without opening ports, configuring firewalls, or exposing their IP address. Enable direct peer-to-peer connections for file sync, real-time collaboration, and voice/video — all without the bytes touching VIVIM's servers.

### 1.2 Target Users

| Persona | Description | Key Need |
|---------|-------------|----------|
| **Solo Builder** | Developer using VIVIM for AI-assisted coding | Share workspace publicly for portfolio/demo |
| **Team Lead** | Manager using VIVIM across multiple AI providers | Collaborate with team in real-time |
| **Privacy Advocate** | User who chose VIVIM for local-first data sovereignty | Assurance that data never leaves their machine |
| **Remote Worker** | User accessing VIVIM from multiple devices | Access workspace from phone/tablet while away |

### 1.3 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tunnel connection reliability | >99.5% uptime when online | WSS connection state monitoring |
| Public page load latency | <500ms TTFB from proxy | Synthetic monitoring |
| Tunnel reconnection time | <5s after network recovery | Client-side timing |
| P2P connection success rate | >80% for direct, >95% with relay | Connection attempt tracking |
| File sync latency (P2P) | <2s for files <10MB | End-to-end timing |
| Local server overhead | <50MB RAM, <5% CPU | Process monitoring |

---

## 2. Functional Requirements

### FR-001: WebSocket Reverse Tunnel
**Priority:** P0 | **Phase:** 0

The desktop app SHALL maintain a persistent outbound WebSocket connection to `wss://tunnel.vivim.live/connect`. This connection SHALL be used to route public HTTP traffic to the user's local server.

**Acceptance Criteria:**
- Desktop app establishes WSS connection on startup (when online)
- Connection uses JWT authentication with subdomain claim
- Connection survives brief network interruptions (<30s)
- Connection auto-reconnects with exponential backoff
- Heartbeat (ping/pong) every 30 seconds
- Multiple concurrent HTTP requests multiplexed over single WSS connection

### FR-002: Public Subdomain Assignment
**Priority:** P0 | **Phase:** 0

Each user SHALL be assigned a subdomain `{username}.vivim.live` that routes to their desktop through the tunnel.

**Acceptance Criteria:**
- Subdomain is assigned on first tunnel connection
- Subdomain resolves to the central proxy via wildcard DNS
- Proxy routes traffic to the correct tunnel based on Host header
- When user is offline, proxy serves branded 503 page
- Subdomain is persistent across sessions

### FR-003: Local HTTP Server
**Priority:** P0 | **Phase:** 0

The desktop app SHALL run a local HTTP server on `localhost:8080` serving the workspace UI and API.

**Acceptance Criteria:**
- Server starts on app launch
- Serves static files (HTML, CSS, JS) for workspace UI
- Serves API routes for workspace operations
- Supports streaming responses (SSE, chunked transfer)
- Supports request body parsing (JSON, multipart)
- Handles concurrent requests (at least 50 simultaneous)

### FR-004: P2P Network Node
**Priority:** P1 | **Phase:** 0

The desktop app SHALL run a libp2p node for direct peer-to-peer communication.

**Acceptance Criteria:**
- Node starts on app launch
- Discovers peers via DHT, mDNS, and bootstrap nodes
- Establishes direct connections when possible (hole-punching)
- Falls back to circuit relay when direct connection fails
- Supports custom protocols for file sync and CRDT sync
- Peer ID is cryptographic and persistent

### FR-005: Peer Discovery
**Priority:** P1 | **Phase:** 0

Users SHALL be able to discover and connect to other VIVIM users.

**Acceptance Criteria:**
- Local network discovery via mDNS (same WiFi)
- Global discovery via DHT (different networks)
- Bootstrap nodes for initial peer discovery
- Peer list shows online status and capabilities
- Peer ID sharing via out-of-band mechanism (copy/paste)

### FR-006: Direct File Sync (P2P)
**Priority:** P1 | **Phase:** 0

Users SHALL be able to share files directly between peers without the data touching VIVIM servers.

**Acceptance Criteria:**
- File transfer uses direct P2P connection when possible
- Falls back to relay when direct connection fails
- Progress tracking with percentage and speed
- Resume interrupted transfers
- File integrity verification (SHA-256)

### FR-007: CRDT-Based Real-Time Sync
**Priority:** P2 | **Phase:** 0

Users SHALL be able to collaborate in real-time with other peers using CRDTs.

**Acceptance Criteria:**
- CRDT sync protocol over libp2p streams
- Sub-50ms sync latency for direct connections
- Conflict-free merging (no data loss)
- Works with relay (higher latency acceptable)
- Supports workspace state sync (conversations, settings)

### FR-008: Graceful Offline Handling
**Priority:** P0 | **Phase:** 0

When the user goes offline, the system SHALL degrade gracefully.

**Acceptance Criteria:**
- Local server continues serving on localhost (unaffected)
- Tunnel client detects disconnect and starts reconnection
- P2P node continues local network discovery (mDNS)
- Central proxy serves branded 503/offline page for the user's subdomain
- When tunnel reconnects, public access resumes within 5 seconds
- No data loss during offline/online transitions

### FR-009: Connection Health Dashboard
**Priority:** P2 | **Phase:** 0

The desktop app SHALL display connection health information.

**Acceptance Criteria:**
- Shows tunnel connection status (connected/reconnecting/offline)
- Shows P2P peer count and connection types
- Shows local server status and request count
- Shows bandwidth usage (tunnel + P2P)
- Historical uptime graph

---

## 3. Non-Functional Requirements

### NFR-001: Security
- All tunnel traffic encrypted via WSS (TLS 1.3)
- JWT authentication on tunnel connection
- P2P identity via libp2p peer IDs (cryptographic)
- No data stored on VIVIM servers (only routed)
- Subdomain hijacking prevention via JWT claims

### NFR-002: Performance
- Local server: <10ms response time for static assets
- Tunnel: <500ms TTFB for public access (including proxy hop)
- P2P: <50ms latency for direct connections
- Memory: <50MB total for all subsystems
- CPU: <5% idle, <15% under load

### NFR-003: Reliability
- Auto-reconnect within 5 seconds of network recovery
- Graceful degradation (offline mode)
- No data loss during network transitions
- Crash recovery (subsystem restart)

### NFR-004: Compatibility
- Works behind corporate firewalls (WSS on port 443)
- Works behind NAT (outbound-only connections)
- Works on Windows, macOS, Linux (Tauri target platforms)
- Compatible with vivim-final v1.0.0 engine architecture

### NFR-005: Scalability (Future-Proofing)
- Protocol versioning for backward compatibility
- Frame format supports binary payloads (future: gRPC/QUIC)
- P2P protocol supports new custom protocols
- Config-driven (no hardcoded endpoints)

---

## 4. Out of Scope (Phase 0)

The following are explicitly deferred to later phases:

| Feature | Phase | Rationale |
|---------|-------|-----------|
| BYO domain support | Phase 1 | Requires CNAME verification flow |
| Voice/video calls | Phase 2 | Requires WebRTC integration |
| Multi-device sync | Phase 1 | Builds on SyncEngine (Phase 20) |
| Bandwidth/usage metrics | Phase 1 | Requires telemetry infrastructure |
| QUIC-based tunnel | Phase 2 | Requires custom transport |
| Multi-region proxy | Phase 2 | Requires infrastructure scaling |
| Access control (public/private) | Phase 1 | Requires auth middleware |

---

## 5. Dependencies

### Client-Side
| Dependency | Version | Purpose |
|------------|---------|---------|
| `@libp2p/tcp` | ^1.x | TCP transport for P2P |
| `@libp2p/websockets` | ^8.x | WebSocket transport for P2P |
| `@libp2p/webrtc` | ^4.x | WebRTC transport for P2P |
| `@libp2p/noise` | ^15.x | Encryption for P2P |
| `@libp2p/yamux` | ^8.x | Stream multiplexing |
| `@libp2p/kad-dht` | ^11.x | DHT for peer discovery |
| `@libp2p/mdns` | ^8.x | Local network discovery |
| `@libp2p/bootstrap` | ^8.x | Bootstrap peer discovery |
| `@libp2p/circuit-relay-v2` | ^2.x | NAT traversal relay |
| `@libp2p/autonat` | ^2.x | Auto NAT detection |
| `@libp2p/identify` | ^2.x | Peer identification |
| `libp2p` | ^1.x | Core P2P library |
| `pino` | ^10.x | Logging (consistent with vivim-final) |
| `zod` | ^3.x | Schema validation |
| `ulid` | ^2.x | ID generation (consistent with vivim-final) |

### Server-Side (Integration Docs Only)
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Tunnel Server | Node.js + `ws` or Go + `gorilla/websocket` | WSS proxy |
| Subdomain Router | Redis or in-memory Map | Subdomain → WS mapping |
| P2P Relay | go-libp2p | Circuit relay + bootstrap |
| Edge | Caddy or Cloudflare | SSL termination + routing |
| DNS | Wildcard CNAME | `*.vivim.live` → proxy |

---

## 6. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WSS connection drops frequently | Medium | High | Exponential backoff + heartbeat + local-first fallback |
| P2P hole-punching fails | Medium | Medium | Circuit relay fallback; mDNS for local network |
| Large file transfer over tunnel | Low | Medium | Stream chunking + progress tracking; P2P for large files |
| Subdomain hijacking | Low | High | JWT claims + proxy verification |
| Corporate firewall blocks WSS | Low | High | Fallback to port 8443; long-polling fallback |
| Memory leak in long-running WSS | Medium | Medium | Health monitor + periodic restart |
