# 08 — Future-Proofing: How Phase 0 Scales to Production

> **Status:** FINAL | **Date:** 2026-08-02

---

## 1. Protocol Versioning

Phase 0 implements protocol version `1.0` using JSON-over-WebSocket frames. The architecture is designed for future protocol upgrades without breaking existing clients.

### 1.1 Version Negotiation

The `X-Protocol-Version` header on the WebSocket upgrade request enables version negotiation. The server can support multiple versions simultaneously:

```typescript
// Server-side version routing
const handlers: Record<string, FrameHandler> = {
  '1.0': handleV1Frame,
  '1.1': handleV1_1Frame,  // Binary frames
  '2.0': handleV2Frame,     // gRPC streaming
};
```

### 1.2 Binary Frame Format (v1.1)

Version 1.1 adds a binary frame format for improved performance:

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ 1 byte   │ 2 bytes  │ 16 bytes│ 4 bytes  │ N bytes  │
│ frame    │ version  │ request │ body     │ body     │
│ type     │          │ ID      │ length   │ data     │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Benefits:**
- No JSON parsing overhead
- No base64 encoding overhead for binary payloads
- ~30% reduction in bandwidth for large responses
- Lower latency for streaming

### 1.3 gRPC Streaming (v2.0)

Version 2.0 replaces WebSocket with gRPC bi-directional streaming:

```protobuf
service TunnelService {
  rpc Connect(stream ClientFrame) returns (stream ServerFrame);
}

message ClientFrame {
  string id = 1;
  oneof payload {
    HttpResponseFrame response = 2;
    HttpChunkFrame chunk = 3;
    PingFrame ping = 4;
  }
}

message ServerFrame {
  string id = 1;
  oneof payload {
    HttpRequestFrame request = 2;
    PongFrame pong = 3;
    AssignedFrame assigned = 4;
  }
}
```

**Benefits:**
- Strong typing via protobuf
- HTTP/2 multiplexing (no head-of-line blocking)
- Better flow control
- Native streaming support

---

## 2. QUIC Tunnel (Phase 3+)

WebSocket is the MVP transport. QUIC provides significant advantages for production:

### 2.1 Why QUIC?

| Feature | WebSocket | QUIC |
|---------|-----------|------|
| Connection migration | ❌ New connection | ✅ Seamlessly migrates |
| Head-of-line blocking | ❌ TCP-level | ✅ No (per-stream) |
| 0-RTT reconnection | ❌ Full TCP+TLS handshake | ✅ 0-RTT resume |
| Multiplexing | Application-level | ✅ Native (streams) |
| Congestion control | TCP (kernel) | ✅ User-space (BBR v2) |

### 2.2 QUIC Tunnel Architecture

```
Desktop Client ──QUIC──► Edge (QUIC listener) ──HTTP/3──► Tunnel Server
```

**Client-side implementation:**
```typescript
// Using the WebTransport API (available in browsers) or quic-go
const transport = new WebTransport('https://tunnel.vivim.live/connect', {
  serverCertificateHashes: [{ algorithm: 'sha-256', value: hash }],
});

// Create bidirectional stream for each request
const stream = await transport.createBidirectionalStream();
```

---

## 3. Multi-Region Deployment

### 3.1 Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  EU Region   │     │  US Region   │     │  AP Region   │
│  (eu-west-1) │     │  (us-east-1) │     │  (ap-south-1)│
│              │     │              │     │              │
│  ┌────────┐  │     │  ┌────────┐  │     │  ┌────────┐  │
│  │Tunnel  │  │     │  │Tunnel  │  │     │  │Tunnel  │  │
│  │Server  │  │     │  │Server  │  │     │  │Server  │  │
│  └────────┘  │     │  └────────┘  │     │  └────────┘  │
│  ┌────────┐  │     │  ┌────────┐  │     │  ┌────────┐  │
│  │P2P     │  │     │  │P2P     │  │     │  │P2P     │  │
│  │Relay   │  │     │  │Relay   │  │     │  │Relay   │  │
│  └────────┘  │     │  └────────┘  │     │  └────────┘  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────────────┴────────────────────┘
                            │
                    ┌───────▼───────┐
                    │  Global Router │
                    │  (Anycast)     │
                    └───────────────┘
```

### 3.2 Router Synchronization

The global router must synchronize subdomain → tunnel mappings across regions:

```typescript
// Redis-based cross-region sync
interface TunnelMapping {
  subdomain: string;
  region: string;
  tunnelServerId: string;
  connectedAt: number;
  lastHeartbeat: number;
}

// Publish to Redis channel for cross-region sync
redis.publish('tunnel:mappings', JSON.stringify(mapping));
```

### 3.3 Visitor Routing

1. Visitor resolves `user1.vivim.live` via DNS
2. Anycast routes to nearest region
3. Region checks if tunnel is local
4. If not, proxy forwards to the correct region via internal network
5. This adds one hop but keeps latency low

---

## 4. P2P Relay Federation

### 4.1 Federation Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Relay EU   │────►│  Relay US   │────►│  Relay AP   │
│             │     │             │     │             │
│  Known peers│     │  Known peers│     │  Known peers│
│  EU relay   │     │  US relay   │     │  AP relay   │
│  US relay   │     │  EU relay   │     │  US relay   │
│  AP relay   │     │  AP relay   │     │  EU relay   │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 4.2 Client-Side Relay Selection

The client selects the nearest relay based on latency:

```typescript
async function selectBestRelay(relays: string[]): Promise<string> {
  const results = await Promise.all(
    relays.map(async (relay) => {
      const start = Date.now();
      await fetch(`${relay}/health`, { signal: AbortSignal.timeout(3000) });
      return { relay, latency: Date.now() - start };
    })
  );
  results.sort((a, b) => a.latency - b.latency);
  return results[0].relay;
}
```

---

## 5. Integration with vivim-final Upgrade Phases

### 5.1 Phase 20: SyncEngine

The P2P layer enables direct multi-device sync (Phase 20's SyncEngine):

```typescript
// Phase 20 SyncEngine uses P2P for direct sync
class SyncEngine {
  constructor(private p2p: P2PNode) {}

  async syncToDevice(devicePeerId: string, entries: SyncEntry[]): Promise<void> {
    // Use P2P file sync protocol instead of relay
    const stream = await this.p2p.openStream(devicePeerId, '/vivim/file-sync/1.0.0');
    // ... send entries directly
  }
}
```

### 5.2 Phase 18: Composable Interface

The local server serves the composable workspace UI:

```typescript
// Phase 18 workspace modes are accessible via tunnel
// Chat mode → user1.vivim.live/
// Expert mode → user1.vivim.live/expert
// Agent mode → user1.vivim.live/agent
```

### 5.3 Phase 17: Context-Aware Agent

The tunnel enables remote monitoring of autonomous agents:

```typescript
// Phase 17 context can be shared across devices
// SituationDetector events can be synced via CRDT
// ContextAssemblyEngine can pull context from remote workspace
```

### 5.4 Phase 19: Autonomous Execution

The tunnel enables remote monitoring and HITL gates:

```typescript
// Phase 19 HITL gates can be approved remotely
// Autonomous task status visible at user1.vivim.live/agent
// Push notifications via tunnel for gate approvals
```

---

## 6. Performance Targets (Production)

| Metric | Phase 0 (MVP) | Production |
|--------|---------------|------------|
| Concurrent tunnels | 100 | 10,000+ |
| Request latency (TTFB) | <500ms | <200ms |
| P2P connection success | 80% | 95%+ |
| File transfer speed | 10 MB/s | 100 MB/s |
| Uptime | 99% | 99.9% |
| Failover time | 5s | <1s |
| Protocol | WebSocket | QUIC/gRPC |
