# Integration Design: vivim-page (Cloud) ↔ vivim-final (Desktop)

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        vivim-page (Cloud)                           │
│                                                                     │
│  ┌─────────────────────┐          ┌──────────────────────────────┐  │
│  │   ledger-service     │          │   tunnel-gateway              │  │
│  │   (Next.js/Vercel)   │          │   (Express/Fly.io)           │  │
│  │                      │          │                              │  │
│  │  POST /beta/signup   │          │  WSS /connect                │  │
│  │  GET  /ledger/sync   │◄──JWT────│  HTTP *.vivim.live           │  │
│  │  POST /tunnel/token  │──────────│  JWT verify (shared secret)  │  │
│  │  GET  /health        │          │  subdomain → tunnel routing  │  │
│  │                      │          │                              │  │
│  │  Ed25519 hash chain  │          │  Heartbeat sweep             │  │
│  │  UserEntitlement     │          │  Rate limiting               │  │
│  │  ProviderManifest    │          │  Offline page fallback       │  │
│  └──────────┬──────────┘          └──────────────┬───────────────┘  │
│             │                                    │                   │
│             │ Neon/Postgres                      │ In-memory         │
│             ▼                                    ▼                   │
│  ┌─────────────────────┐          ┌──────────────────────────────┐  │
│  │  provider_definition │          │  tunnels Map<subdomain, ws>  │  │
│  │  provider_manifest   │          │  pendingRequests Map<id, res>│  │
│  │  user_entitlement    │          │                              │  │
│  │  ledger_user         │          │                              │  │
│  │  api_token           │          │                              │  │
│  │  ledger_chain_head   │          │                              │  │
│  └─────────────────────┘          └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              HTTPS pull       WSS tunnel      HTTPS public
              (sync)           (connect)       (requests)
                    │               │               │
                    ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        vivim-final (Desktop)                        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Orchestrator                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ LedgerSync   │  │ TunnelClient│  │ P2PNode             │  │   │
│  │  │ Client       │  │             │  │                     │  │   │
│  │  │              │  │  ┌────────┐ │  │  libp2p + CRDT      │  │   │
│  │  │ • signup     │  │  │Auth    │ │  │  file sync          │  │   │
│  │  │ • sync       │  │  │Handler │ │  │  DHT                │  │   │
│  │  │ • verify     │  │  └────────┘ │  │                     │  │   │
│  │  │ • apply      │  │             │  │                     │  │   │
│  │  └──────┬───────┘  └──────┬──────┘  └──────────┬──────────┘  │   │
│  │         │                 │                     │             │   │
│  │         ▼                 ▼                     ▼             │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │                    LocalServer                           │ │   │
│  │  │  Bun.serve() on localhost:8080                          │ │   │
│  │  │  • HTTP API (workspace UI)                              │ │   │
│  │  │  • Tunnel request handler (forward from gateway)        │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    ProviderRegistrar                          │   │
│  │  • Loads providers from local DB                             │   │
│  │  • Applies verified manifests from ledger sync               │   │
│  │  • Manages CDP connections to provider web UIs               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Local SQLite DB                            │   │
│  │  • provider_definition (from ledger sync)                    │   │
│  │  • provider_manifest_version (verified chain entries)        │   │
│  │  • user_entitlement (synced entitlements)                    │   │
│  │  • conversation, node, session data (local-only)             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Data Flow Sequences

### 2.1 First-Time Setup (Signup + Initial Sync)

```
Desktop                                        Cloud (ledger-service)
  │                                                    │
  │  1. POST /api/v1/beta/signup                       │
  │     { email: "user@example.com" }                  │
  │  ─────────────────────────────────────────────────▶│
  │                                                    │
  │     Creates LedgerUser + ApiToken                  │
  │     Assigns subdomain: "user-a1b2c3"               │
  │     Grants beta_genesis entitlements               │
  │                                                    │
  │  2. { userId, token, subdomain, entitledProviderCount }
  │  ◀─────────────────────────────────────────────────│
  │                                                    │
  │  [Store token + subdomain in local config]         │
  │                                                    │
  │  3. POST /api/v1/tunnel/token                      │
  │     Authorization: Bearer <user-token>             │
  │  ─────────────────────────────────────────────────▶│
  │                                                    │
  │     Mints HS256 JWT: { userId, subdomain, exp }    │
  │     Signed with JWT_SECRET (shared with gateway)   │
  │                                                    │
  │  4. { token: <jwt>, subdomain, connectUrl, publicUrl }
  │  ◀─────────────────────────────────────────────────│
  │                                                    │
  │  5. GET /api/v1/ledger/sync                        │
  │     Authorization: Bearer <user-token>             │
  │  ─────────────────────────────────────────────────▶│
  │                                                    │
  │     Filters by UserEntitlement                     │
  │     Returns all ProviderManifestVersion entries     │
  │     ordered by chain position                      │
  │                                                    │
  │  6. { entries: [...], hasMore, newSyncCursor }     │
  │  ◀─────────────────────────────────────────────────│
  │                                                    │
  │  [Verify each entry's hash chain + Ed25519 sig]    │
  │  [Apply verified manifests to local DB]            │
  │  [Store lastSyncedHash for future incremental]     │
  │                                                    │
```

### 2.2 Tunnel Connection Flow

```
Desktop (TunnelClient)          Cloud (tunnel-gateway)
  │                                    │
  │  WSS /connect                      │
  │  Authorization: Bearer <jwt>       │
  │  X-Subdomain: user-a1b2c3         │
  │  ─────────────────────────────────▶│
  │                                    │
  │     verifyTunnelToken(jwt)         │
  │     Check subdomain claim matches  │
  │     Check not already claimed      │
  │                                    │
  │  { type: "assigned",               │
  │    subdomain: "user-a1b2c3.vivim.live" }
  │  ◀─────────────────────────────────│
  │                                    │
  │  [Tunnel established]              │
  │  [Heartbeat every 30s]             │
  │                                    │
```

### 2.3 Public Request → Desktop Flow

```
Public Client           Cloud (tunnel-gateway)         Desktop (TunnelClient)
  │                           │                              │
  │  GET https://user-a1b2c3  │                              │
  │     .vivim.live/api/data  │                              │
  │  ────────────────────────▶│                              │
  │                           │                              │
  │     Extract subdomain     │                              │
  │     Lookup tunnel entry   │                              │
  │     Rate limit check      │                              │
  │                           │                              │
  │                           │  { id: "req-uuid",           │
  │                           │    type: "http.request",     │
  │                           │    method: "GET",            │
  │                           │    path: "/api/data",        │
  │                           │    headers: {...},           │
  │                           │    body: null }              │
  │                           │  ───────────────────────────▶│
  │                           │                              │
  │                           │     Forward to LocalServer   │
  │                           │     localhost:8080/api/data  │
  │                           │                              │
  │                           │  { id: "req-uuid",           │
  │                           │    type: "http.response",    │
  │                           │    status: 200,              │
  │                           │    headers: {...},           │
  │                           │    body: "base64..." }       │
  │                           │  ◀───────────────────────────│
  │                           │                              │
  │  { status: 200,           │                              │
  │    headers: {...},        │                              │
  │    body: "..." }          │                              │
  │  ◀────────────────────────│                              │
  │                           │                              │
```

### 2.4 Incremental Sync Flow

```
Desktop                                        Cloud (ledger-service)
  │                                                    │
  │  GET /api/v1/ledger/sync                            │
  │  Authorization: Bearer <user-token>                 │
  │  ?since=<lastSyncedHash>                            │
  │  ─────────────────────────────────────────────────▶│
  │                                                    │
  │     Resolve entitledProviderIds                     │
  │     Find entries where hash > since                 │
  │     Return new entries                              │
  │                                                    │
  │  { entries: [...new...], hasMore, newSyncCursor }   │
  │  ◀─────────────────────────────────────────────────│
  │                                                    │
  │  [Verify chain: prevHash links + Ed25519 sigs]      │
  │  [Apply new manifests to local DB]                  │
  │  [Update lastSyncedHash]                            │
  │                                                    │
```

## 3. New Modules (vivim-final)

### 3.1 `src/lib/ledger-client/` — Cloud Ledger Integration

#### 3.1.1 `types.ts` — Ledger Client Types

```typescript
export interface LedgerClientConfig {
  /** Base URL of the ledger-service (e.g., "https://ledger.vivim.live") */
  baseUrl: string;
  /** User's bearer token (from signup, stored locally) */
  userToken: string | null;
  /** User's assigned subdomain (from signup, stored locally) */
  subdomain: string | null;
  /** User ID (from signup, stored locally) */
  userId: string | null;
  /** Ed25519 public key for chain verification (pinned in binary) */
  publicKeyHex: string;
  /** Polling interval for incremental sync (ms) */
  syncIntervalMs: number;
}

export interface LedgerSignupRequest {
  email: string;
}

export interface LedgerSignupResponse {
  userId: string;
  token: string;
  subdomain: string;
  entitledProviderCount: number;
}

export interface LedgerTunnelTokenResponse {
  token: string;          // HS256 JWT for tunnel-gateway
  subdomain: string;
  publicUrl: string;
  connectUrl: string;     // WSS URL for tunnel-gateway
  expiresIn: number;      // seconds
}

export interface LedgerSyncResponse {
  entries: LedgerEntry[];
  hasMore: boolean;
  newSyncCursor: string | null;
}

export interface LedgerEntry {
  id: string;
  providerId: string;
  manifestFile: string;
  version: number;
  hash: string;
  prevHash: string | null;
  signature: string;
  status: "proposed" | "verified" | "deprecated" | "challenged";
  contentJson: string;
  changeSummary: string | null;
  actor: string;
  contributorId: string | null;
  createdAt: number; // epoch ms
}

export interface LedgerHealthResponse {
  chainLength: number;
  lastHash: string | null;
  publicKey: string;
}

export type LedgerClientState =
  | "uninitialized"   // no token stored
  | "signup-pending"  // signup request sent
  | "syncing"         // actively syncing
  | "synced"          // up to date
  | "error";          // last sync failed
```

#### 3.1.2 `ledger-client.ts` — Main Client

```typescript
/**
 * Ledger Client — Cloud ↔ Desktop Sync
 *
 * Handles:
 * 1. First-time signup (POST /beta/signup)
 * 2. Tunnel JWT minting (POST /tunnel/token)
 * 3. Pull-based ledger sync (GET /ledger/sync)
 * 4. Ed25519 chain verification
 * 5. Manifest application to local DB
 */
export class LedgerClient {
  private config: LedgerClientConfig;
  private state: LedgerClientState = "uninitialized";
  private lastSyncedHash: string | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private eventEmitter: EventEmitter;

  constructor(config: LedgerClientConfig) { ... }

  // ── Lifecycle ──────────────────────────────────────────

  /** Initialize from stored credentials (config file or keychain) */
  async init(): Promise<void> { ... }

  /** Start periodic sync (called after init or signup) */
  async start(): Promise<void> { ... }

  /** Stop sync and disconnect */
  async stop(): Promise<void> { ... }

  // ── Auth Flow ──────────────────────────────────────────

  /**
   * First-time signup. Creates user + token + subdomain + entitlements.
   * Returns tunnel token for immediate connection.
   */
  async signup(email: string): Promise<LedgerSignupResponse> { ... }

  /**
   * Mint a tunnel JWT for connecting to the tunnel-gateway.
   * Called once per session (JWT expires in 1 hour).
   */
  async mintTunnelToken(): Promise<LedgerTunnelTokenResponse> { ... }

  // ── Sync Flow ──────────────────────────────────────────

  /**
   * Pull-based sync. Fetches entries since lastSyncedHash.
   * Verifies chain integrity + Ed25519 signatures.
   * Applies verified manifests to local DB.
   */
  async sync(): Promise<{ applied: number; entries: LedgerEntry[] }> { ... }

  /**
   * Full resync (no since param). Used on first sync or corruption.
   */
  async fullSync(): Promise<{ applied: number; entries: LedgerEntry[] }> { ... }

  // ── Verification ───────────────────────────────────────

  /**
   * Verify a single ledger entry against the chain.
   * Returns the entry hash if valid, throws if invalid.
   */
  private verifyEntry(
    entry: LedgerEntry,
    expectedPrevHash: string | null,
    publicKeyHex: string
  ): Promise<string> { ... }

  /**
   * Verify a batch of entries in chain order.
   * Returns verified entries with their computed hashes.
   */
  private verifyBatch(
    entries: LedgerEntry[],
    startPrevHash: string | null,
    publicKeyHex: string
  ): Promise<{ verified: LedgerEntry[]; lastHash: string }> { ... }

  // ── Event Emitter ──────────────────────────────────────

  on(event: "signup", handler: (data: LedgerSignupResponse) => void): void;
  on(event: "sync-start", handler: () => void): void;
  on(event: "sync-complete", handler: (data: { applied: number }) => void): void;
  on(event: "sync-error", handler: (error: Error) => void): void;
  on(event: "tunnel-token", handler: (data: LedgerTunnelTokenResponse) => void): void;
}
```

#### 3.1.3 `chain-verifier.ts` — Ed25519 Verification

```typescript
/**
 * Chain Verifier — Ed25519 Signature Verification
 *
 * Implements the exact algorithm from CRYPTO_SPEC.md §5.
 * Must agree byte-for-byte with:
 * - vivim-page/src/lib/crypto.ts (server signing)
 * - Tauri client verification code
 */
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// Wire SHA-512 into @noble/ed25519 (must be done once at module load)
ed.hashes.sha512 = sha512;

/**
 * Compute entry hash: sha256_hex((prevHash ?? "") + "\n" + contentJson)
 * CRITICAL: Hash the stored string, never re-serialize JSON.
 */
export function computeEntryHash(prevHash: string | null, contentJson: string): string { ... }

/**
 * Verify Ed25519 signature over (prevHash, entryHash).
 * message = utf8_bytes((prevHash ?? "") + "\n" + entryHash)
 * Returns true if signature is valid.
 */
export async function verifyEntrySignature(
  entryHash: string,
  prevHash: string | null,
  signatureHex: string,
  publicKeyHex: string
): Promise<boolean> { ... }

/**
 * Full entry verification (CRYPTO_SPEC.md §5):
 * 1. Chain linkage: entry.prevHash == expectedPrevHash
 * 2. Content hash: recomputedHash == entry.hash
 * 3. Signature: Ed25519_verify(signature, message, publicKey)
 *
 * Returns the entry hash (becomes expectedPrevHash for next entry).
 * Throws on any verification failure.
 */
export async function verifyEntry(
  entry: {
    prevHash: string | null;
    hash: string;
    signature: string;
    contentJson: string;
  },
  expectedPrevHash: string | null,
  publicKeyHex: string
): Promise<string> { ... }
```

#### 3.1.4 `manifest-applier.ts` — Cloud → Local DB Bridge

```typescript
/**
 * Manifest Applier — Applies verified ledger entries to local DB
 *
 * Transforms LedgerEntry.contentJson into local provider DB mutations.
 * This is the bridge between the cloud ledger and the local ProviderRegistrar.
 */
export class ManifestApplier {
  private db: CapStoreDb;

  constructor(db: CapStoreDb) { ... }

  /**
   * Apply a single verified ledger entry to the local DB.
   * Parses contentJson and upserts the appropriate provider tables.
   */
  async applyEntry(entry: LedgerEntry): Promise<void> { ... }

  /**
   * Apply a batch of verified entries in chain order.
   * Uses a transaction to ensure atomicity.
   */
  async applyBatch(entries: LedgerEntry[]): Promise<number> { ... }

  /**
   * Parse contentJson and determine the mutation type.
   * Content shapes:
   * - { type: "provider_definition", ... } → upsert ProviderDefinition
   * - { type: "provider_endpoint", ... } → upsert ProviderEndpoint
   * - { type: "provider_parser", ... } → upsert ProviderParser
   * - { type: "provider_capability", ... } → upsert ProviderCapability
   * - { type: "capability_binding", ... } → upsert CapabilityBinding
   * - { type: "capability_taxonomy", ... } → upsert CapabilityTaxonomy
   */
  private parseContentJson(contentJson: string): {
    type: string;
    data: Record<string, unknown>;
  } { ... }

  /**
   * After applying manifests, trigger ProviderRegistrar re-registration
   * for any providers that changed.
   */
  async notifyProvidersChanged(providerIds: string[]): Promise<void> { ... }
}
```

### 3.2 Tunnel Client Auth Fix

#### 3.2.1 `connection-manager.ts` — Auth Headers

```typescript
// BEFORE (broken):
const ws = new WebSocket(url);

// AFTER (fixed):
const ws = new WebSocket(url, {
  headers: {
    Authorization: `Bearer ${this.config.authToken ?? ""}`,
    "X-Subdomain": this.config.subdomain,
  },
});
```

#### 3.2.2 `types.ts` — TunnelConfig Update

```typescript
export interface TunnelConfig {
  enabled: boolean;
  serverUrl: string;
  subdomain: string;
  protocolVersion: string;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  reconnectInitialDelayMs: number;
  reconnectMaxDelayMs: number;
  reconnectJitterFactor: number;
  maxConcurrentRequests: number;
  requestTimeoutMs: number;
  authToken: string | null;        // ← JWT from /tunnel/token
  ledgerBaseUrl: string;           // ← NEW: ledger-service URL
  userToken: string | null;        // ← NEW: user bearer token
  publicKeyHex: string;            // ← NEW: Ed25519 public key
  syncIntervalMs: number;          // ← NEW: ledger sync interval
}
```

### 3.3 Frame Protocol Alignment

#### 3.3.1 Gateway → Client (Inbound)

The tunnel-gateway sends:
```json
{
  "id": "req-uuid",
  "type": "http.request",
  "method": "GET",
  "path": "/api/data?foo=bar",
  "headers": { "host": "user-a1b2c3.vivim.live", ... },
  "body": "base64-encoded-body-or-null"
}
```

**Client-side parse:** Extract `query` from `path` using `URL` constructor.

```typescript
// In frame-protocol.ts decodeFrame():
function parseHttpRequestMapping(raw: unknown): HttpRequestFrame {
  const msg = raw as Record<string, unknown>;
  const url = new URL(msg.path as string, "http://localhost");

  return {
    id: msg.id as string,
    type: "http.request",
    timestamp: Date.now(),
    version: "1.0",
    method: msg.method as string,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: msg.headers as Record<string, string>,
    body: msg.body as string | null,
    bodySize: msg.body ? Buffer.byteLength(msg.body, "base64") : 0,
    remoteAddress: "",
    protocol: "https",
    host: (msg.headers as Record<string, string>)?.host ?? "",
  };
}
```

#### 3.3.2 Client → Gateway (Outbound)

The tunnel-gateway expects:
```json
{
  "id": "req-uuid",           // ← MUST match the request id
  "type": "http.response",
  "status": 200,
  "headers": { "content-type": "application/json", ... },
  "body": "base64-encoded-body-or-null"
}
```

**Client-side:** The `RequestHandler` must send `id` (not `requestId`).

```typescript
// In request-handler.ts sendResponse():
function formatGatewayResponse(frame: HttpResponseFrame): string {
  return JSON.stringify({
    id: frame.requestId,    // ← Map requestId → id for gateway
    type: "http.response",
    status: frame.status,
    headers: frame.headers,
    body: frame.body,
  });
}
```

### 3.4 Orchestrator Integration

#### 3.4.1 `service-manager.ts` — Add LedgerClient

```typescript
export class ServiceManager {
  private ledgerClient: LedgerClient;  // ← NEW

  constructor(config: VivimConfig) {
    this.ledgerClient = new LedgerClient(config.ledger);  // ← NEW
    // ... existing
  }

  async start(): Promise<void> {
    // 1. Initialize ledger client (load stored creds)
    await this.ledgerClient.init();

    // 2. If no stored credentials, trigger signup flow
    if (!this.ledgerClient.hasCredentials()) {
      // Emit event for UI to show signup form
      this.emit("signup-required");
      return;
    }

    // 3. Mint tunnel JWT (needed for tunnel connection)
    const tunnelToken = await this.ledgerClient.mintTunnelToken();

    // 4. Apply tunnel JWT to config
    this.config.tunnel.authToken = tunnelToken.token;
    this.config.tunnel.subdomain = tunnelToken.subdomain;

    // 5. Start local server
    await this.startService("local-server", async () => {
      await this.localServer.start();
    });

    // 6. Start tunnel client (now has auth)
    await this.startService("tunnel-client", async () => {
      await this.tunnelClient.start();
    });

    // 7. Start P2P node
    await this.startService("p2p-node", async () => {
      await this.p2pNode.start();
    });

    // 8. Start ledger sync (background)
    await this.startService("ledger-sync", async () => {
      await this.ledgerClient.start();
    });
  }
}
```

#### 3.4.2 `config.ts` — Add Ledger Config

```typescript
const DEFAULT_CONFIG: VivimConfig = {
  // ... existing
  ledger: {
    baseUrl: "https://ledger.vivim.live",
    userToken: null,
    subdomain: null,
    userId: null,
    publicKeyHex: "PINNED_PUBLIC_KEY_HERE",
    syncIntervalMs: 300_000, // 5 minutes
  },
};
```

## 4. Wire Protocol Reference

### 4.1 Ledger API (Cloud)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/beta/signup` | POST | none | Create user + token + subdomain |
| `/api/v1/ledger/sync` | GET | Bearer token | Pull signed provider manifests |
| `/api/v1/tunnel/token` | POST | Bearer token | Mint tunnel JWT |
| `/api/v1/health` | GET | none | Chain head + public key |
| `/api/v1/providers` | GET | none | Provider catalog |

### 4.2 Tunnel Protocol (Gateway ↔ Client)

| Frame | Direction | Fields |
|-------|-----------|--------|
| `http.request` | Gateway → Client | `id, type, method, path, headers, body` |
| `http.response` | Client → Gateway | `id, type, status, headers, body` |
| `assigned` | Gateway → Client | `type, subdomain` |
| `error` | Gateway → Client | `type, code, message` |
| `ping` | Both | `type, timestamp` |
| `pong` | Both | `type, serverTime` |

### 4.3 Ledger Sync Protocol

```
Request:
  GET /api/v1/ledger/sync?since=<hash>&limit=500
  Authorization: Bearer <user-token>

Response:
  {
    "entries": [
      {
        "id": "pmv_...",
        "providerId": "prov_chatgpt",
        "manifestFile": "chatgpt.manifest.json",
        "version": 14,
        "hash": "9f86d0...",
        "prevHash": "3c4e2a...",
        "signature": "a1b2c3...",
        "status": "verified",
        "contentJson": "{...}",
        "changeSummary": "...",
        "actor": "vivim_internal",
        "contributorId": null,
        "createdAt": 1753929600000
      }
    ],
    "hasMore": false,
    "newSyncCursor": "9f86d0..."
  }
```

## 5. Security Model

### 5.1 Trust Boundaries

| Layer | Trust | Verification |
|-------|-------|-------------|
| Cloud ledger | Ed25519 signatures | Client verifies every entry before applying |
| Tunnel JWT | HS256 shared secret | Gateway verifies on WSS connect |
| User auth | Bearer token (sha256 stored) | Ledger-service verifies on every API call |
| Tunnel requests | None (public) | Rate limiting + subdomain isolation |

### 5.2 Key Distribution

| Key | Where | Who Has It |
|-----|-------|-----------|
| `SIGNING_PRIVATE_KEY` | Vercel env var | ledger-service only |
| `LEDGER_PUBLIC_KEY` | Tauri binary (pinned) | All desktop clients |
| `JWT_SECRET` | Vercel + Fly.io env vars | ledger-service + tunnel-gateway |
| `user-token` | Desktop config file | One user only |

### 5.3 Chain Integrity

1. Every ledger entry is signed by the server's Ed25519 key
2. Client recomputes `sha256(prevHash + "\n" + contentJson)` and compares to `entry.hash`
3. Client verifies `Ed25519_verify(signature, prevHash + "\n" + hash, publicKey)`
4. Client checks `entry.prevHash == previousEntry.hash` (chain linkage)
5. Any failure = reject the entire batch, prompt full resync

## 6. File Manifest

### New Files (vivim-final)

```
src/lib/ledger-client/
  types.ts                    # LedgerClientConfig, LedgerEntry, etc.
  ledger-client.ts            # Main client (signup, sync, mint)
  chain-verifier.ts           # Ed25519 verification (CRYPTO_SPEC §5)
  manifest-applier.ts         # Apply verified entries to local DB

src/lib/tunnel-client/
  connection-manager.ts       # PATCH: add auth headers to WebSocket
  request-handler.ts          # PATCH: send { id: frame.requestId } not { requestId }
  types.ts                    # PATCH: add ledgerBaseUrl, userToken to TunnelConfig

src/lib/tunnel-shared/
  types.ts                    # PATCH: add ledger fields to TunnelConfig

src/lib/orchestrator/
  service-manager.ts          # PATCH: add LedgerClient lifecycle
  config.ts                   # PATCH: add ledger config defaults
```

### Modified Files (vivim-page)

None. The cloud service is already complete.

## 7. Implementation Order

| Phase | What | Files | Depends On |
|-------|------|-------|-----------|
| 1 | Chain verifier | `chain-verifier.ts` | `@noble/ed25519`, `@noble/hashes` (add to package.json) |
| 2 | Ledger client types | `types.ts` | none |
| 3 | Ledger client (signup + sync) | `ledger-client.ts` | Phase 1, 2 |
| 4 | Manifest applier | `manifest-applier.ts` | Phase 3, Prisma schema |
| 5 | Tunnel auth fix | `connection-manager.ts` | Phase 3 (needs JWT) |
| 6 | Frame protocol fix | `frame-protocol.ts`, `request-handler.ts` | none |
| 7 | Orchestrator wiring | `service-manager.ts`, `config.ts` | Phase 3, 4, 5 |
| 8 | Integration test | `tests/integration/ledger-sync.test.ts` | All above |
