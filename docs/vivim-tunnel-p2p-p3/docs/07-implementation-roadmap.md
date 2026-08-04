# 07 — Implementation Roadmap

> **Status:** FINAL | **Date:** 2026-08-02

---

## Phase 0: Tunnel MVP (Weeks 1-2)

**Goal:** Desktop app can be publicly accessed at `{username}.vivim.live`

### Week 1: Core Infrastructure

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Tunnel Client — Connection Manager | WSS connection with JWT auth |
| 2-3 | Tunnel Client — Frame Protocol | Request/response frame encode/decode |
| 3-4 | Local Server — Basic HTTP Server | Bun.serve() on localhost:8080 |
| 4-5 | Orchestrator — Service Manager | Start/stop all subsystems |

### Week 2: Integration & Polish

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Tunnel Client — Heartbeat + Reconnection | Ping/pong + exponential backoff |
| 2-3 | Tunnel Client — Request Handler | Forward proxy frames to local server |
| 3-4 | Local Server — Streaming Support | SSE + chunked responses |
| 4-5 | Integration Testing | End-to-end: visitor → proxy → tunnel → local server |

### Phase 0 Exit Criteria

- [ ] Desktop app connects to tunnel server via WSS
- [ ] Public subdomain serves workspace UI
- [ ] Offline page shown when tunnel is down
- [ ] Auto-reconnect within 5 seconds
- [ ] Local server handles 50+ concurrent requests
- [ ] Streaming responses work (SSE, large files)

---

## Phase 1: P2P Integration (Weeks 3-4)

**Goal:** Direct peer-to-peer connections for file sync and presence

### Week 3: P2P Foundation

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | P2P Node — Node Manager | libp2p node lifecycle |
| 2-3 | P2P Node — Discovery | DHT + mDNS + bootstrap |
| 3-4 | P2P Node — File Sync Protocol | Direct file transfer between peers |
| 4-5 | P2P Node — Presence Protocol | Online status broadcasting |

### Week 4: P2P Integration

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | P2P Node — CRDT Sync Protocol | Real-time workspace state sync |
| 2-3 | Orchestrator — P2P Integration | Connect P2P events to EventBus |
| 3-4 | Health Monitor — P2P Monitoring | Peer count, connection type, latency |
| 4-5 | Integration Testing | P2P: peer discovery, file transfer, CRDT sync |

### Phase 1 Exit Criteria

- [ ] P2P node discovers peers via DHT and mDNS
- [ ] Direct file transfer between peers (with progress tracking)
- [ ] CRDT sync works for workspace state
- [ ] Circuit relay fallback works when direct connection fails
- [ ] Presence protocol shows online status

---

## Phase 2: Custom Domain & Polish (Weeks 5-6)

**Goal:** BYO domain support, connection health dashboard, metrics

### Week 5: Custom Domains

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | CNAME Verification Flow | Verify domain ownership via TXT record |
| 2-3 | Dynamic SSL Provisioning | Let's Encrypt HTTP-01 challenge |
| 3-4 | Proxy — Multi-host Routing | Route by Host header (vivim.live + custom) |
| 4-5 | Integration Testing | Custom domain end-to-end |

### Week 6: Polish & Metrics

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Connection Health Dashboard | Tunnel status, P2P peers, bandwidth |
| 3-4 | Auto-reconnect Logic | Improved reconnection with state preservation |
| 4-5 | Bandwidth/Usage Metrics | Request count, bandwidth, latency tracking |

### Phase 2 Exit Criteria

- [ ] BYO domain works with CNAME verification
- [ ] Dynamic SSL provisioning for custom domains
- [ ] Connection health dashboard in UI
- [ ] Bandwidth and usage metrics displayed
- [ ] Improved reconnection with state preservation

---

## Phase 3: Scale (Weeks 7+)

**Goal:** Multi-region, high availability, performance

### Tasks

| Task | Description |
|------|-------------|
| Multi-region proxy | Deploy tunnel servers in multiple regions |
| Anycast routing | Route visitors to nearest proxy |
| P2P relay federation | Multiple relay nodes across regions |
| QUIC-based tunnel | Replace WebSocket with QUIC for lower latency |
| gRPC streaming | Replace JSON frames with gRPC bi-directional streaming |
| Load testing | Verify 1000+ concurrent tunnels |
| CDN integration | Static assets served from CDN |
| Monitoring | Prometheus metrics + Grafana dashboards |

---

## Dependency on vivim-final Upgrade Phases

| Phase | Dependency | Impact |
|-------|-----------|--------|
| Phase 15 (Sovereign Intelligence) | None | P2P can store peer interactions in MemoryEngine |
| Phase 16 (Invisible Router) | None | Tunnel can route through muxed providers |
| Phase 18 (Composable Interface) | Workspace UI | Local server serves the composable workspace |
| Phase 20 (Sovereign Data) | SyncEngine | P2P enables direct multi-device sync |
