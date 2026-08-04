# 00 — Architecture Overview: Tailscale Funnel meets Vercel meets P2P

> **Status:** FINAL | **Date:** 2026-08-02 | **Phase:** 0 (Foundation)

---

## 1. Problem Statement

VIVIM is a local-first AI conversation platform. Users run it on their desktop with all data stored locally in SQLite. Currently, workspaces are only accessible from `localhost`. There is no way for a user to share their workspace publicly, collaborate with peers in real-time, or access their workspace from another device without manual port forwarding or VPN setup.

The core problem: **a local-first application needs a public presence without sacrificing local sovereignty.**

---

## 2. Architecture Vision

The solution is a hybrid architecture combining three capabilities:

1. **Tunnel (Tailscale Funnel-like):** Outbound-only WebSocket from the desktop to a central proxy. The proxy routes public HTTP traffic back through the tunnel. The desktop never opens a public port.

2. **Local HTTP Server (Vercel-like):** A lightweight HTTP server on the desktop serving the workspace UI and API on `localhost:8080`. This is the same server that the tunnel forwards to, so the user experience is identical locally and remotely.

3. **P2P Network (libp2p):** Direct peer-to-peer connections for file sync, real-time collaboration (CRDTs), voice/video, and discovery. Bypasses the central proxy entirely for peer-to-peer data.

---

## 3. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PUBLIC INTERNET                                │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │  DNS (Wildcard) │    │  Edge SSL/TLS   │    │  Visitor Browser        │  │
│  │  *.vivim.live   │◄───┤  Termination    │◄───┤  user1.vivim.live      │  │
│  └────────┬────────┘    └────────┬────────┘    └─────────────────────────┘  │
│           │                      │                                           │
│           └──────────────────────┘                                           │
│                                  │                                           │
│                         ┌────────▼────────┐                                  │
│                         │  CENTRAL PROXY  │                                  │
│                         │  (Server Infra) │                                  │
│                         │                 │                                  │
│                         │ ┌─────────────┐ │                                  │
│                         │ │ Subdomain   │ │◄─── WebSocket Tunnel (WSS)     │
│                         │ │ Router      │ │      (persistent, outbound)      │
│                         │ │ user1 ──►   │ │                                  │
│                         │ │ user2 ──►   │ │                                  │
│                         │ └─────────────┘ │                                  │
│                         │ ┌─────────────┐ │                                  │
│                         │ │ P2P Relay   │ │◄─── libp2p Circuit Relay        │
│                         │ │ (Bootstrap) │ │      (NAT traversal helper)      │
│                         │ └─────────────┘ │                                  │
│                         │ ┌─────────────┐ │                                  │
│                         │ │ Offline     │ │                                  │
│                         │ │ Page Cache  │ │                                  │
│                         │ └─────────────┘ │                                  │
│                         └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                              ┌────────┴────────┐
                              │   USER DESKTOP  │
                              │   (Local Node)  │
                              │                 │
                              │ ┌─────────────┐ │
                              │ │ Local HTTP  │ │◄─── Workspace UI, API, etc
                              │ │ Server      │ │     (localhost:8080)
                              │ └──────┬──────┘ │
                              │ ┌──────▼──────┐ │
                              │ │ Tunnel      │ │────► WSS to Central Proxy
                              │ │ Client      │ │      (outbound only)
                              │ └─────────────┘ │
                              │ ┌─────────────┐ │
                              │ │ P2P Node    │ │────► DHT, Hole Punch, Direct
                              │ │ (libp2p)    │ │      connections to peers
                              │ └─────────────┘ │
                              └─────────────────┘
```

---

## 4. Client-Side Component Map

The client implementation consists of four subsystems managed by a single orchestrator:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestrator (ServiceManager)                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  HealthMonitor — watches all subsystems, restarts on crash  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ TunnelClient │  │  P2PNode     │  │ LocalServer  │           │
│  │              │  │              │  │              │           │
│  │ • WSS conn   │  │ • libp2p     │  │ • HTTP :8080│           │
│  │ • Frame proto│  │ • DHT disc   │  │ • Streaming  │           │
│  │ • Heartbeat  │  │ • File sync  │  │ • Middleware │           │
│  │ • Reconnect  │  │ • CRDT sync  │  │ • API routes │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│         │                  │                  │                   │
│         └──────────────────┴──────────────────┘                   │
│                            │                                      │
│                   ┌────────▼────────┐                             │
│                   │  Shared Layer   │                             │
│                   │  Types, Logger  │                             │
│                   │  Constants, Err │                             │
│                   └─────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Data Flow

### 5.1 Public Web Access (Tunnel Path)

```
Visitor Browser                    Central Proxy                    Desktop
    │                                  │                              │
    │ GET user1.vivim.live/dashboard   │                              │
    │─────────────────────────────────►│                              │
    │                                  │  { type: "http.request",     │
    │                                  │    id: "req_abc",            │
    │                                  │    method: "GET",            │
    │                                  │    path: "/dashboard" }      │
    │                                  │─────────────────────────────►│
    │                                  │                              │
    │                                  │              Local Server processes
    │                                  │              → fetches :8080/dashboard
    │                                  │                              │
    │                                  │  { type: "http.response",    │
    │                                  │    id: "req_abc",            │
    │                                  │    status: 200,              │
    │                                  │    body: "base64..." }       │
    │                                  │◄─────────────────────────────│
    │                                  │                              │
    │  200 OK + HTML body              │                              │
    │◄─────────────────────────────────│                              │
    │                                  │                              │
```

### 5.2 Peer-to-Peer File Sync

```
User A Desktop                    P2P Relay                     User B Desktop
    │                                │                              │
    │  Discover peer via DHT         │                              │
    │────────────────────────────────►│                              │
    │                                │  Relay peer info              │
    │                                │─────────────────────────────►│
    │                                │                              │
    │  Hole punch (if both behind NAT)                              │
    │═══════════════════════════════════════════════════════════════│
    │                                │                              │
    │  Direct P2P file transfer      │                              │
    │═══════════════════════════════════════════════════════════════│
    │  (bytes never touch your server)                              │
    │                                │                              │
```

### 5.3 Offline Graceful Degradation

```
User goes offline:
    1. Tunnel client detects WSS disconnect
    2. Reconnection manager starts exponential backoff
    3. Local server continues serving on localhost:8080 (unaffected)
    4. P2P node continues local network discovery (mDNS)
    5. Central proxy serves branded 503/offline page
    6. When tunnel reconnects, proxy resumes routing
```

---

## 6. Core Design Principles

| Principle | Implementation | Rationale |
|-----------|---------------|-----------|
| **Outbound-only** | Desktop app never listens publicly. One WSS connection to proxy. | Works behind any NAT/firewall/corporate proxy. |
| **Local sovereignty** | All workspace data lives on user's machine. Server only routes bytes. | Privacy by architecture. No data stored on your infra. |
| **P2P for data, Tunnel for web** | Public HTTP goes through proxy. Direct peer transfers bypass you entirely. | Cost efficiency. You don't pay for peer-to-peer bandwidth. |
| **Graceful offline** | When tunnel drops, subdomain shows branded offline page. Local server unaffected. | No broken links. Visitors know the user is offline. |
| **Additive extension** | Phase 0 code is a new layer alongside existing engines. No breaking changes. | Compatible with vivim-final v1.0.0 upgrade path. |
| **Store contract pattern** | All new engines use store contract interfaces, never Prisma directly. | Consistent with existing architecture. |
| **TypeScript strict** | No `any`. All new code follows existing conventions. | Type safety. |

---

## 7. Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | Bun | Consistent with vivim-final. Fast startup, native TS. |
| Language | TypeScript (strict, ESM) | Consistent with vivim-final. |
| Tunnel Transport | WebSocket (WSS) | Universally supported, works through corporate firewalls on port 443. |
| P2P | js-libp2p | Browser + Node.js. DHT, relay, hole-punching built-in. |
| Local Server | Bun.serve() | Native HTTP server with streaming support. |
| Encryption | Noise protocol (libp2p) + AES-256-GCM (at-rest) | Consistent with Phase 20 sovereign data. |
| Config | TOML | Human-readable, well-typed, easy to parse. |
| Logging | pino | Consistent with vivim-final. |

---

## 8. Relationship to vivim-final Upgrade Phases

This Phase 0 (Tunnel + P2P) is a **new foundational layer** that sits alongside the existing upgrade phases:

```
Phase 0 (NEW)  ─── Tunnel + P2P + Local Hosting
  │
  ├─ Enables Phase 20 (Sovereign Data) SyncEngine to use P2P for direct sync
  ├─ Enables Phase 18 (Composable Interface) workspace to be publicly accessible
  ├─ Enables Phase 19 (Autonomous Execution) agents to be remotely monitored
  └─ Enables Phase 17 (Context-Aware Agent) context to be shared across devices

Phase 14 (Wire Stubs) ─── depends on: Phase 11-13 (existing) ✅
Phase 15 (Sovereign Intelligence) ─── depends on: Phase 14 ✅
Phase 16 (Invisible Router) ─── depends on: Phase 14
Phase 17 (Context-Aware Agent) ─── depends on: Phase 15
Phase 18 (Composable Interface) ─── depends on: Phase 14
Phase 19 (Autonomous Execution) ─── depends on: Phase 14, 18
Phase 20 (Sovereign Data) ─── depends on: Phase 14
```

---

## 9. File Map

```
src/
├── tunnel-client/
│   ├── index.ts              # Public API: start(), stop(), getStatus()
│   ├── connection-manager.ts # WSS connection lifecycle
│   ├── frame-protocol.ts     # Frame encode/decode (JSON + binary)
│   ├── request-handler.ts    # Proxy → local-server request forwarding
│   ├── heartbeat.ts          # Ping/pong keepalive
│   ├── reconnection.ts       # Exponential backoff reconnection
│   └── types.ts              # Tunnel-specific types
├── p2p-node/
│   ├── index.ts              # Public API: start(), stop(), getPeers()
│   ├── node-manager.ts       # libp2p node lifecycle
│   ├── discovery.ts          # DHT + mDNS + bootstrap discovery
│   ├── file-sync.ts          # Direct peer file transfer protocol
│   ├── crdt-sync.ts          # CRDT-based real-time sync protocol
│   └── types.ts              # P2P-specific types
├── local-server/
│   ├── index.ts              # Public API: start(), stop(), getPort()
│   ├── router.ts             # Route definitions for workspace API
│   ├── middleware.ts          # Auth, CORS, rate limiting, request ID
│   ├── streaming.ts          # SSE + chunked response support
│   └── types.ts              # Server-specific types
├── orchestrator/
│   ├── index.ts              # Main entry point, CLI
│   ├── service-manager.ts    # Lifecycle management for all subsystems
│   ├── health-monitor.ts     # Health checks, crash recovery, restart
│   └── config.ts             # Config loading + validation
└── shared/
    ├── types.ts              # Shared types (TunnelFrame, P2PMessage, etc.)
    ├── constants.ts          # Protocol version, defaults, timeouts
    ├── errors.ts             # Typed error hierarchy
    └── logger.ts             # pino logger factory
```
