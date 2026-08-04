# 03 — P2P Protocol Specification: libp2p Integration

> **Status:** FINAL | **Date:** 2026-08-02 | **Version:** 1.0.0

---

## 1. Overview

The P2P layer uses js-libp2p to establish direct peer-to-peer connections between VIVIM desktop clients. It operates alongside the tunnel — the tunnel handles public web access, while P2P handles direct peer communication. The P2P network provides:

- **Peer Discovery:** DHT (KadDHT), mDNS (local network), and bootstrap nodes
- **NAT Traversal:** Hole-punching via AutoNAT + Circuit Relay v2 fallback
- **Custom Protocols:** File sync, CRDT sync, presence signaling
- **Identity:** Cryptographic peer IDs (Ed25519)

---

## 2. libp2p Node Configuration

### 2.1 Transport Stack

```typescript
const transports = [
  webSockets(),           // Primary: WSS for cross-network
  webRTC(),               // Browser-compatible (future)
  tcp(),                  // LAN: direct TCP for local network
];
```

### 2.2 Encryption & Multiplexing

```typescript
const connectionEncryption = [noise()];  // Noise protocol for encryption
const streamMuxers = [yamux()];          // Yamux for stream multiplexing
```

### 2.3 Peer Discovery

```typescript
const peerDiscovery = [
  bootstrap({
    list: [
      '/dns4/p2p.vivim.live/tcp/443/wss/p2p/QmBootstrap1...',
      '/dns4/p2p.vivim.live/tcp/443/wss/p2p/QmBootstrap2...',
    ],
    timeout: 30000,
  }),
  mdns({
    interval: 10000,       // Every 10 seconds
    serviceTag: 'vivim',   // mDNS service name
  }),
  kadDHT({
    clientMode: true,      // Client mode (not a DHT server)
    validators: {},
    selectors: {},
  }),
];
```

### 2.4 Relay Configuration

```typescript
const relay = {
  enabled: true,
  hop: {
    enabled: false,         // Client only — server runs the relays
    timeout: 30000,
  },
  autoRelay: {
    enabled: true,
    maxListeners: 3,        // Max relay listeners
  },
};
```

### 2.5 Full Node Creation

```typescript
import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { webRTC } from '@libp2p/webrtc';
import { tcp } from '@libp2p/tcp';
import { noise } from '@libp2p/noise';
import { yamux } from '@libp2p/yamux';
import { bootstrap } from '@libp2p/bootstrap';
import { mdns } from '@libp2p/mdns';
import { kadDHT } from '@libp2p/kad-dht';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { autoNAT } from '@libp2p/autonat';
import { identify } from '@libp2p/identify';

const node = await createLibp2p({
  transports: [
    circuitRelayTransport({
      discoverRelays: 3,
    }),
    webSockets(),
    webRTC(),
    tcp(),
  ],
  connectionEncryption: [noise()],
  streamMuxers: [yamux()],
  peerDiscovery: [
    bootstrap({ list: BOOTSTRAP_NODES }),
    mdns({ serviceTag: 'vivim' }),
    kadDHT({ clientMode: true }),
  ],
  relay: {
    enabled: true,
    hop: { enabled: false },
    autoRelay: { enabled: true, maxListeners: 3 },
  },
  services: {
    autoNAT: autoNAT(),
    identify: identify(),
    dht: kadDHT({ clientMode: true }),
  },
  addresses: {
    listen: [
      '/p2p-circuit',                    // Listen on relay
      '/dns4/p2p.vivim.live/tcp/443/wss', // WSS
    ],
    announce: [],  // Populated after NAT detection
  },
});
```

---

## 3. Custom Protocols

### 3.1 Protocol Identifier Format

All VIVIM custom protocols use the following format:

```
/vivim/<protocol>/<version>
```

### 3.2 File Sync Protocol (`/vivim/file-sync/1.0.0`)

**Purpose:** Transfer files between peers directly.

**Protocol Flow:**
```
Initiator                          Responder
    │                                  │
    │  New stream: /vivim/file-sync/1.0.0
    │─────────────────────────────────►│
    │                                  │
    │  FileSyncRequest (JSON)          │
    │  {                               │
    │    type: "request",              │
    │    fileId: "ulid...",            │
    │    fileName: "report.pdf",       │
    │    fileSize: 1048576,            │
    │    sha256: "abc123...",          │
    │    chunkSize: 65536              │
    │  }                               │
    │─────────────────────────────────►│
    │                                  │
    │  FileSyncAccept (JSON)           │
    │  {                               │
    │    type: "accept",               │
    │    requestId: "ulid...",         │
    │    chunkSize: 65536              │
    │  }                               │
    │◄─────────────────────────────────│
    │                                  │
    │  FileChunk (binary)              │
    │  [4 bytes: chunkIndex]           │
    │  [4 bytes: chunkLength]          │
    │  [N bytes: chunk data]           │
    │─────────────────────────────────►│
    │  ... (repeat until all chunks)   │
    │                                  │
    │  FileComplete (JSON)             │
    │  {                               │
    │    type: "complete",             │
    │    sha256: "abc123..."           │
    │  }                               │
    │─────────────────────────────────►│
    │                                  │
    │  FileVerify (JSON)               │
    │  {                               │
    │    type: "verified",             │
    │    sha256: "abc123..."           │
    │  }                               │
    │◄─────────────────────────────────│
    │                                  │
    │  Close stream                    │
    │─────────────────────────────────►│
```

### 3.3 CRDT Sync Protocol (`/vivim/crdt-sync/1.0.0`)

**Purpose:** Synchronize CRDT-based workspace state between peers.

**Protocol Flow:**
```
Initiator                          Responder
    │                                  │
    │  New stream: /vivim/crdt-sync/1.0.0
    │─────────────────────────────────►│
    │                                  │
    │  SyncRequest (JSON)              │
    │  {                               │
    │    type: "sync-request",         │
    │    documentId: "workspace-1",    │
    │    localClock: 42,               │
    │    localVersion: "abc123"        │
    │  }                               │
    │─────────────────────────────────►│
    │                                  │
    │  SyncResponse (JSON)             │
    │  {                               │
    │    type: "sync-response",        │
    │    documentId: "workspace-1",    │
    │    remoteClock: 45,              │
    │    remoteVersion: "def456",      │
    │    operations: [                 │
    │      {                           │
    │        id: "op_1",              │
    │        type: "insert",           │
    │        position: 12,             │
    │        value: "Hello",           │
    │        lamportClock: 43,         │
    │        authorPeerId: "QmPeer1"   │
    │      }                           │
    │    ]                             │
    │  }                               │
    │◄─────────────────────────────────│
    │                                  │
    │  SyncAck (JSON)                  │
    │  {                               │
    │    type: "sync-ack",             │
    │    documentId: "workspace-1",    │
    │    receivedClock: 45             │
    │  }                               │
    │─────────────────────────────────►│
    │                                  │
    │  Continuous sync (bidirectional) │
    │  ──────────────────────────────  │
```

### 3.4 Presence Protocol (`/vivim/presence/1.0.0`)

**Purpose:** Broadcast user online status and capabilities.

**Protocol Flow:**
```
Peer A                            Peer B
    │                                  │
    │  New stream: /vivim/presence/1.0.0
    │─────────────────────────────────►│
    │                                  │
    │  PresenceUpdate (JSON)           │
    │  {                               │
    │    type: "presence",             │
    │    status: "online",             │
    │    capabilities: ["file-sync",   │
    │      "crdt-sync", "voice"],      │
    │    workspaceId: "ws_1",          │
    │    timestamp: 1722570000000      │
    │  }                               │
    │─────────────────────────────────►│
    │                                  │
    │  PresenceAck (JSON)              │
    │  {                               │
    │    type: "presence-ack",         │
    │    status: "online",             │
    │    capabilities: ["file-sync"],  │
    │    timestamp: 1722570000000      │
    │  }                               │
    │◄─────────────────────────────────│
    │                                  │
```

---

## 4. Peer ID Management

### 4.1 Identity Persistence

The libp2p peer ID is derived from an Ed25519 key pair. The key pair MUST be persisted to disk so the peer ID remains stable across sessions.

```typescript
// Key storage location
const KEY_PATH = path.join(appDataDir, 'vivim', 'p2p-identity.json');

// Key format
interface P2PIdentity {
  version: 1;
  peerId: string;        // e.g., "QmABC123..."
  publicKey: string;     // Base64-encoded Ed25519 public key
  privateKey: string;    // Base64-encoded Ed25519 private key (encrypted at rest)
  createdAt: number;     // Epoch ms
}
```

### 4.2 Peer ID Sharing

Users share peer IDs out-of-band (copy/paste, QR code, etc.). The peer ID format:

```
vivim://peer/QmABC123...DEF456
```

This can be opened as a deep link or pasted into the "Add Peer" dialog.

---

## 5. NAT Traversal Strategy

### 5.1 Detection (AutoNAT)

The AutoNAT service determines whether the node is behind NAT:

1. Node sends AutoNAT request to a bootstrap node
2. Bootstrap node attempts to dial back
3. If dial succeeds → public IP, direct connections possible
4. If dial fails → behind NAT, use relay or hole-punching

### 5.2 Hole-Punching (Direct Connection)

When both peers are behind NAT:

1. Peer A discovers Peer B via DHT
2. Both peers exchange their observed addresses via identify protocol
3. Both peers simultaneously attempt to connect to each other
4. If both NATs allow the simultaneous open, connection succeeds
5. If hole-punching fails, fall back to circuit relay

### 5.3 Circuit Relay (Fallback)

When direct connection fails:

1. Client connects to relay at `p2p.vivim.live`
2. Client requests relay reservation
3. Other peer connects to the same relay
4. Data flows through relay: A → Relay → B
5. Relay is a dumb forwarder — it cannot read encrypted content

---

## 6. DHT Usage

### 6.1 Key Schema

| Key Pattern | Value | TTL |
|-------------|-------|-----|
| `/vivim/peer/{peerId}` | JSON: { username, status, capabilities } | 1 hour |
| `/vivim/workspace/{workspaceId}` | JSON: { name, ownerPeerId, access } | 1 hour |
| `/vivim/file/{fileId}` | JSON: { name, size, sha256, ownerPeerId } | 1 hour |

### 6.2 Content Routing

When a peer wants to find another peer:

1. Query DHT for `/vivim/peer/{targetPeerId}`
2. Get the peer's multiaddrs from the DHT value
3. Attempt direct connection (hole-punching if needed)
4. Fall back to circuit relay if direct fails

---

## 7. Connection Limits

| Parameter | Default | Description |
|-----------|---------|-------------|
| Max peers | 50 | Maximum simultaneous peer connections |
| Max connections per peer | 3 | Maximum streams per peer |
| Max concurrent file transfers | 5 | Maximum simultaneous file transfers |
| Max file size | 500MB | Maximum single file transfer size |
| Connection timeout | 30s | Timeout for establishing new connection |
| Stream timeout | 60s | Timeout for idle streams |
| DHT query timeout | 30s | Timeout for DHT lookups |

---

## 8. Integration with vivim-final Engine Architecture

The P2P node integrates with the existing engine architecture as follows:

```
CapabilityEventBus
    │
    ├── p2p:peer:discovered    → New peer discovered
    ├── p2p:peer:connected     → Peer connected
    ├── p2p:peer:disconnected  → Peer disconnected
    ├── p2p:file:received      → File received from peer
    ├── p2p:file:sent          → File sent to peer
    ├── p2p:crdt:synced        → CRDT state synchronized
    ├── p2p:presence:update    → Peer presence changed
    └── p2p:error              → P2P error
```

These events are consumed by:
- **MemoryEngine** (Phase 15): Store peer interaction history
- **SyncEngine** (Phase 20): Use P2P for multi-device sync
- **ContextAssemblyEngine** (Phase 17): Include peer context
- **AdaptiveWorkspaceEngine** (Phase 18): Show peer presence in UI
