# Unit 11.1: CDP Client

**Phase:** 11 | **File:** `src/executor/cdp.ts`
**Depends:** 1.4 CapStoreDb | **Produces:** Real WebSocket CDP transport
**Source:** vivim-final `src/executor/cdp.ts` (542 lines, port to vivim-final)

## Purpose
Real WebSocket CDP client with auto-reconnect, session management, per-command timeouts, and event subscription. Currently a 21-line stub — must become 542-line production implementation.

## Interface
```typescript
export class BunCdpClient {
  constructor(private debugUrl: string, private opts?: CdpClientOptions) {}

  async connect(): Promise<void>;
  async send<T = unknown>(method: string, params?: Record<string, unknown>, opts?: CommandOptions): Promise<T>;
  async disconnect(): Promise<void>;
  on(event: string, handler: (params: unknown) => void): void;
  off(event: string, handler: (params: unknown) => void): void;
  get connected(): boolean;
}

export interface CdpClientOptions {
  timeoutMs?: number;       // default 30000
  maxRetries?: number;      // default 3
  retryDelayMs?: number;    // default 1000
  pingIntervalMs?: number;  // default 30000
}

export interface CommandOptions {
  timeoutMs?: number;
  sessionId?: string;
  retries?: number;
}

export class CdpConnectionError extends Error {}
export class CdpTimeoutError extends Error {}
```

## Required Capabilities
- WebSocket connect to `ws://<host>:<port>/devtools/browser/<pageId>`
- Auto-reconnect on disconnect (up to maxRetries with exponential backoff)
- Per-command timeout with configurable timeoutMs
- Event subscription (on/off) for CDP events (Runtime.consoleAPICalled, Network.responseReceived, etc.)
- Session management for multiple targets (pages) via Target.attachToTarget
- Message ID sequencing and response correlation (each send gets unique id, response matched by id)
- Ping/pong keepalive
- Graceful disconnect

## Tests
- [ ] `connect()` opens WebSocket to debug URL
- [ ] `send('Runtime.evaluate', { expression: '1+1' })` returns result
- [ ] Auto-reconnect: disconnect WebSocket -> client reconnects within retry budget
- [ ] Timeout: command that exceeds timeoutMs throws CdpTimeoutError
- [ ] Event subscription: `on('Runtime.consoleAPICalled', handler)` fires on console messages
- [ ] Session: `send(method, params, { sessionId })` scopes to target session
- [ ] `disconnect()` closes WebSocket cleanly
- [ ] Connection error throws CdpConnectionError

## Gate
- `bun run typecheck` passes
- `bun test tests/unit/executor/cdp-client.test.ts` passes
- CDP connects to real Chrome instance at port 9222 within 10s

## Port Notes
Port from vivim-final `src/executor/cdp.ts`. Adapt imports to vivim-final's structure (use `@/errors` not local error defs, use `@/ids` for ULID generation). Remove cap-store-specific logging, keep core CDP logic.
