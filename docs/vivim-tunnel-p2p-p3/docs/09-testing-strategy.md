# 09 — Testing Strategy

> **Status:** FINAL | **Date:** 2026-08-02

---

## 1. Testing Pyramid

```
        ┌─────────────┐
        │   E2E Tests  │  5% — Full system integration
        │   (Playwright)│
        ├─────────────┤
        │  Integration │  25% — Cross-subsystem tests
        │  Tests       │
        ├─────────────┤
        │  Unit Tests  │  70% — Per-module tests
        │              │
        └─────────────┘
```

---

## 2. Unit Tests

### 2.1 Tunnel Client Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Connection with valid JWT | Connect with valid auth | Receives `assigned` frame |
| Connection with invalid JWT | Connect with expired/invalid JWT | WebSocket closed with 4001 |
| Connection with reserved subdomain | Connect with subdomain "api" | WebSocket closed with 4003 |
| Frame encoding | Encode an HTTP request frame | Produces valid JSON |
| Frame decoding | Decode an HTTP response frame | Correctly parsed |
| Heartbeat ping | Send ping after 30s | Receives pong |
| Heartbeat timeout | No pong after 10s | Triggers reconnection |
| Request forwarding | Forward proxy request to local server | Correct HTTP request sent |
| Response encoding | Encode HTTP response with large body | Base64 encoding correct |
| Chunked response | Encode chunked response | Correct chunk sequence |
| Reconnection backoff | Reconnect after disconnect | Exponential backoff: 1s, 2s, 4s, 8s... |
| Reconnection jitter | Multiple reconnect attempts | Random jitter ±25% |
| Concurrent requests | 50 simultaneous requests | All responses received |

### 2.2 P2P Node Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Node creation | Create libp2p node | Node starts with peer ID |
| Peer discovery (mDNS) | Discover local peer | Peer found within 10s |
| Peer discovery (DHT) | Discover remote peer via DHT | Peer found within 30s |
| File sync protocol | Transfer file between two local nodes | File integrity verified (SHA-256) |
| File sync resume | Resume interrupted transfer | Resumes from correct offset |
| CRDT sync protocol | Sync workspace state | No data loss, conflict-free |
| Presence protocol | Broadcast online status | Status received by peer |
| Relay connection | Connect via circuit relay | Connection established |
| Key persistence | Save and load peer ID | Same peer ID after restart |
| Connection limits | Max 50 peers | 51st connection refused |

### 2.3 Local Server Tests

| Test | Description | Assertion |
|------|-------------|-----------|
| Static file serving | Serve index.html | 200 OK with correct content-type |
| API route | GET /api/status | 200 OK with JSON response |
| Request body parsing | POST with JSON body | Body correctly parsed |
| Streaming response | SSE endpoint | Chunks received in order |
| CORS headers | Cross-origin request | CORS headers present |
| Rate limiting | 101 requests in 1 minute | 101st returns 429 |
| Localhost binding | Request from 0.0.0.0 | Connection refused |
| Concurrent requests | 50 simultaneous requests | All responses received |

---

## 3. Integration Tests

### 3.1 Tunnel + Local Server Integration

| Test | Description | Assertion |
|------|-------------|-----------|
| End-to-end request | Tunnel frame → local server → response | Response forwarded to tunnel |
| Streaming through tunnel | SSE through tunnel | Chunks forwarded correctly |
| Large file through tunnel | 10MB file through tunnel | Complete transfer |
| Concurrent requests through tunnel | 20 simultaneous requests | All responses received |
| Offline/online cycle | Disconnect and reconnect | Graceful degradation + recovery |

### 3.2 P2P + Tunnel Integration

| Test | Description | Assertion |
|------|-------------|-----------|
| P2P discovery via tunnel | Discover peer through tunnel relay | Peer found |
| File sync while tunnel active | Transfer file while serving public traffic | Both work simultaneously |
| Tunnel reconnect with P2P | P2P continues during tunnel reconnect | P2P unaffected |

### 3.3 Orchestrator Integration

| Test | Description | Assertion |
|------|-------------|-----------|
| Full startup | Start all subsystems | All healthy within 10s |
| Subsystem crash recovery | Kill local server | Restarted within 5s |
| Graceful shutdown | Stop orchestrator | All subsystems stopped cleanly |
| Config reload | Change config | Subsystems reconfigured |

---

## 4. E2E Tests

### 4.1 Full Stack E2E

| Test | Description | Assertion |
|------|-------------|-----------|
| Public access | Visit user1.vivim.live | Workspace UI loads |
| Offline page | Visit offline user | 503 page shown |
| File download | Download file from public workspace | File downloaded correctly |
| P2P file transfer | Transfer file between two clients | File integrity verified |
| Reconnection | Disconnect network, reconnect | Public access resumes |

---

## 5. Chaos Testing

### 5.1 Network Chaos

| Test | Description | Tool |
|------|-------------|------|
| Packet loss | 10% packet loss on tunnel | `tc netem` |
| High latency | 500ms latency on tunnel | `tc netem` |
| Connection drops | Drop WSS every 60s | Custom script |
| DNS failure | DNS resolution failure | `iptables` |
| Bandwidth limit | 1 Mbps bandwidth | `tc netem` |

### 5.2 Process Chaos

| Test | Description |
|------|-------------|
| Kill local server | Orchestrator restarts it |
| Kill tunnel client | Orchestrator restarts it |
| Kill P2P node | Orchestrator restarts it |
| OOM kill | System recovers gracefully |
| Disk full | System reports error, continues |

---

## 6. Performance Testing

### 6.1 Load Testing

| Scenario | Target | Tool |
|----------|--------|------|
| 100 concurrent visitors | <500ms TTFB | k6 |
| 50 concurrent requests | All responses <1s | k6 |
| 10MB file download | <30s | k6 |
| SSE stream (1000 events) | All events received | Custom script |

### 6.2 P2P Performance

| Scenario | Target | Tool |
|----------|--------|------|
| 10MB file transfer (direct) | <5s | Custom script |
| 10MB file transfer (relay) | <15s | Custom script |
| CRDT sync (1000 ops) | <500ms | Custom script |
| 50 concurrent peer connections | Stable | Custom script |

---

## 7. Test Infrastructure

### 7.1 Test Helpers

```typescript
// tests/helpers/mock-tunnel-server.ts
class MockTunnelServer {
  // Simulates the central proxy for integration testing
  // - Accepts WSS connections
  // - Sends http.request frames
  // - Receives http.response frames
  // - Simulates disconnects
}

// tests/helpers/mock-p2p-peer.ts
class MockP2PPeer {
  // Simulates a remote P2P peer
  // - Creates a libp2p node
  // - Responds to file sync requests
  // - Responds to CRDT sync requests
}

// tests/helpers/mock-local-server.ts
class MockLocalServer {
  // Simulates the local HTTP server
  // - Serves static files
  // - Responds to API requests
  // - Supports streaming
}
```

### 7.2 CI Pipeline

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test tests/tunnel-client.test.ts
      - run: bun test tests/p2p-node.test.ts
      - run: bun test tests/local-server.test.ts

  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test tests/integration.test.ts

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun test tests/e2e/
```
