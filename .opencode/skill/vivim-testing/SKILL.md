---
name: vivim-testing
description: Testing patterns and workflows for vivim-final. Use when writing tests, analyzing coverage, fixing flaky tests, or setting up test infrastructure.
---
# VIVIM Testing Workflow

## Test Structure
```
tests/
  unit/                    # Fast, isolated, mocked
    engines/               # One test per engine
      conversation-manager.test.ts
      capability-engine.test.ts
      harness-command-registry.test.ts
      harness-repair-engine.test.ts
      memory-engine-record.test.ts      # Phase 0A: recordMemory
      harness-condition.test.ts         # Phase 0A: 7 condition types
      ...
    lib/                    # Library-level tests
      ledger-client/
        chain-verifier.test.ts          # Ed25519 hash + signature verification
        ledger-client.test.ts           # Client lifecycle (signup, sync, mint, health)
        manifest-applier.test.ts        # Cloud → local DB bridge (6 content types)
      tunnel-client/
        connection-manager.test.ts      # Auth headers on WebSocket connect
        frame-protocol.test.ts          # Query-from-path, gateway compat, encode/decode
        heartbeat.test.ts               # Ping/pong lifecycle, timeout detection
        reconnection.test.ts            # Backoff delays, max attempts, reset
        request-handler.test.ts         # Request tracking, timeout, abort, concurrent limits
      orchestrator/
        service-manager.test.ts         # Orchestrator lifecycle
        health-monitor.test.ts          # Service registration, error handling
        config.test.ts                  # Defaults, env overrides, ledger config
      tunnel-shared/
        shared.test.ts                  # Protocol versions, error hierarchy
      p2p-node/
        crdt-sync.test.ts              # CRDTDocument clock, operations, merge
        file-sync.test.ts              # Progress events, transfer tracking
        node-manager.test.ts           # Lifecycle (mocked libp2p), state transitions
      local-server/
        local-server.test.ts           # Constructor, lifecycle, request count
      export-import.test.ts             # Phase 0A: ImportData structure
    schema/
      repair-metadata.test.ts
  integration/             # Engine-to-engine, mocked stores
    lib/
      sync-pipeline.test.ts            # Full cloud ↔ desktop sync pipeline
      full-pipeline-crypto.test.ts     # Real Ed25519 crypto pipeline (no mocks)
    engines/
      conversation-pipeline.test.ts
      harness-command-registry.test.ts
      ...
  e2e/                     # Full stack, real DB
    api/
    cli/
    seeds/
    harness-command-registry.test.ts
  helpers/                 # Shared test utilities
    mocks.ts               # Mock store contracts
    mocks/
      governor-store.mock.ts   # GovernorStore mock (17 methods)
    setup.ts               # Test database setup
    factories.ts           # Test data factories
```

## Running Tests
```bash
bun test                              # all
bun test tests/unit                   # unit only
bun test tests/integration            # integration only
bun test tests/e2e                    # e2e only
bun test tests/unit/engines/foo       # specific engine
bun test --grep "should resolve"      # by description
```

## Unit Test Pattern
```typescript
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { createFooEngine } from '../../../src/engines/foo.js'
import type { FooStore } from '../../../src/engines/foo.js'

describe('FooEngine', () => {
  let store: FooStore
  let engine: ReturnType<typeof createFooEngine>

  beforeEach(() => {
    store = {
      findById: mock(() => Promise.resolve(null)),
      create: mock((data) => Promise.resolve({ id: 'test-id', ...data })),
    }
    engine = createFooEngine(store, defaultConfig)
  })

  it('should handle null result', async () => {
    const result = await engine.execute('nonexistent')
    expect(result).toBeNull()
    expect(store.findById).toHaveBeenCalledWith('nonexistent')
  })

  it('should create when not found', async () => {
    const result = await engine.execute('new-id')
    expect(store.create).toHaveBeenCalled()
  })
})
```

## Integration Test Pattern
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { createCapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import { createConversationManager } from '../../../src/engines/conversation-manager.js'

describe('ConversationManager + CapabilityEventBus integration', () => {
  let eventBus: ReturnType<typeof createCapabilityEventBus>
  let manager: ReturnType<typeof createConversationManager>

  beforeAll(async () => {
    eventBus = createCapabilityEventBus()
    // Wire engines together with mocked stores
    manager = createConversationManager(mockStore, eventBus)
    await manager.init()
  })

  afterAll(async () => {
    await manager.shutdown()
  })

  it('should emit events on message send', async () => {
    const events: any[] = []
    eventBus.on('conversation:message', (e) => events.push(e))

    await manager.send({ content: 'hello' })
    expect(events).toHaveLength(1)
  })
})
```

## Mock Store Contract Pattern
```typescript
// tests/helpers/mocks.ts
import type { ProviderRegistrarStore } from '../../src/engines/provider-registrar.js'
import { mock } from 'bun:test'

export function createMockProviderRegistrarStore(): ProviderRegistrarStore {
  return {
    findProviderBySlug: mock(() => Promise.resolve(null)),
    upsertProvider: mock((data) => Promise.resolve({ id: 'mock-id', ...data })),
    findEndpointsByProvider: mock(() => Promise.resolve([])),
    upsertEndpoint: mock((data) => Promise.resolve({ id: 'mock-id', ...data })),
  }
}
```

## Coverage Targets
- Engine implementations: 80%+
- Critical paths (ConversationManager, CapabilityEngine): 100%
- API endpoints: 90%+
- Utilities: 95%+

## Flaky Test Debugging
1. Check for shared state between tests (missing `beforeEach` cleanup)
2. Check for timing issues (async operations not awaited)
3. Check for DB state leaking between tests
4. Use `mock.reset()` in `beforeEach` for mock isolation
5. Run test in isolation: `bun test tests/unit/engines/specific.test.ts`

## Test Data Factories
```typescript
// tests/helpers/factories.ts
import { faker } from '@faker-js/faker' // if available

export function createTestProvider(overrides?: Partial<ProviderDefinition>) {
  return {
    id: faker.string.ulid(),
    name: faker.company.name(),
    slug: faker.internet.domainWord(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}
```

## Node-Store Testing Pattern (Real DB)

NodeStoreImpl tests use a **pre-built fixture DB** (`tests/fixtures/node-store-test.db`) that is kept in sync with `prisma/schema.prisma` via `bunx prisma db push`. Each test run copies the fixture to a temp directory, runs tests against the copy, and cleans up.

**Setup:**
```bash
# (one-time) Build fixture DB when schema changes:
DATABASE_URL="file:./tests/fixtures/node-store-test.db" bunx prisma db push --skip-generate --accept-data-loss
```

**Test pattern:**
```typescript
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { NodeStoreImpl } from '../../../../src/storage/impl/node-store-impl.js'

const FIXTURE = join(import.meta.dir, 'relative-path-to', 'tests', 'fixtures', 'node-store-test.db')

let prisma: PrismaClient
let store: NodeStoreImpl

beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'node-store-test-'))
  const dbPath = join(dir, 'test.db')
  copyFileSync(FIXTURE, dbPath)
  prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } })
  store = new NodeStoreImpl(prisma as never)
})

afterAll(async () => {
  await prisma.$disconnect()
  rmSync(dir, { recursive: true, force: true })
})
```

### Testing Version Chain
```typescript
it('writes a version-1 entry on putNode', async () => {
  await store.putNode(mkNode({ id: 'n1', type: 'cap-store.message' }))
  const history = await store.getNodeHistory('n1')
  expect(history).toHaveLength(1)
  expect(history[0]?.version).toBe(1)
  expect(history[0]?.op).toBe('create')
})

it('updateNode bumps version and appends history', async () => {
  await store.putNode(mkNode({ id: 'n2', type: 'cap-store.message' }))
  await store.updateNode('n2', { dataJson: JSON.stringify({ text: 'edited' }) })
  const history = await store.getNodeHistory('n2')
  expect(history).toHaveLength(2)
  expect(history[1]?.version).toBe(2)
  expect(history[1]?.op).toBe('update')
  expect(history[1]?.parentVersion).toBe(1)
})
```

### Testing Alias Resolution
```typescript
it('registers and resolves alias -> canonical', async () => {
  await store.registerAlias('alias_a', 'canon_x', 'merge', 0.9)
  expect(await store.resolveAlias('alias_a')).toBe('canon_x')
  expect(await store.resolveAlias('nope')).toBeNull()
})
```

### Testing Rebuildable Graph
```typescript
it('materializes edges from node edgesJson', async () => {
  await store.putNode(mkNode({
    id: 'src', type: 'cap-store.message',
    edges: [{ type: 'responds_to', targetId: 'tgt', properties: {} }],
  }))
  await store.putNode(mkNode({ id: 'tgt', type: 'cap-store.message' }))
  const count = await store.rebuildGraphFromNodes()
  expect(count).toBeGreaterThanOrEqual(1)
  const out = await store.getOutgoingEdges('src')
  expect(out.some(e => e.targetId === 'tgt')).toBe(true)
})
```

### mkNode Helper
```typescript
function mkNode(over: Partial<NodeBase> & Pick<NodeBase, 'id' | 'type'>): NodeBase {
  const now = Date.now()
  return {
    id: over.id, type: over.type,
    schemaVersion: 1, version: 1, state: 'active',
    data: over.data ?? { text: 'hello' },
    edges: over.edges ?? [],
    meta: over.meta ?? {},
    createdAt: now, updatedAt: now,
  }
}
```

## Ledger Client Test Patterns

### chain-verifier.test.ts
```typescript
import { computeEntryHash, verifyEntrySignature, verifyEntry } from '../../../src/lib/ledger-client/chain-verifier.js'
import { ed25519 } from '@noble/ed25519'

// Generate test key pair
const TEST_PRIVATE_KEY = ed25519.utils.randomPrivateKey()
const TEST_PUBLIC_KEY = ed25519.getPublicKey(TEST_PRIVATE_KEY)

it('computeEntryHash produces deterministic SHA-256', () => {
  const h1 = computeEntryHash(null, '{"type":"test"}')
  const h2 = computeEntryHash(null, '{"type":"test"}')
  expect(h1).toBe(h2)
})

it('verifyEntrySignature validates Ed25519 signatures', async () => {
  const content = JSON.stringify({ type: 'provider_definition' })
  const hash = computeEntryHash(null, content)
  const sig = await ed25519.signAsync(hexToBytes(hash), TEST_PRIVATE_KEY)
  expect(await verifyEntrySignature(hash, bytesToHex(sig), TEST_PUBLIC_KEY)).toBe(true)
})
```

### ledger-client.test.ts (mocked fetch)
```typescript
const fetchMock = mock()
globalThis.fetch = fetchMock as never
const { LedgerClient } = await import('../../../src/lib/ledger-client/ledger-client.js')

it('signup updates config with credentials', async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
    userId: 'u1', token: 'tok', subdomain: 'sub', entitledProviderCount: 6
  }), { status: 200 }))
  const config = { baseUrl: 'https://test', userToken: null, subdomain: null, userId: null, publicKeyHex: '00'.repeat(32), syncIntervalMs: 60_000 }
  const client = new LedgerClient(config)
  const result = await client.signup('test@example.com')
  expect(result.userId).toBe('u1')
  expect(config.userToken).toBe('tok')
})
```

### manifest-applier.test.ts (mocked Prisma)
```typescript
const mockDb = {
  prisma: {
    providerDefinition: { upsert: mock(async ({ create }: any) => create) },
    providerEndpoint: { upsert: mock(async ({ create }: any) => create) },
    // ... all 6 models
  }
}
const { applyManifestEntries } = await import('../../../src/lib/ledger-client/manifest-applier.js')

it('applies provider_definition content', async () => {
  const entries = [{ contentJson: JSON.stringify({ type: 'provider_definition', id: 'p1', slug: 'a', name: 'A' }), ... }]
  const result = await applyManifestEntries(mockDb as never, entries)
  expect(result.upserted).toBe(1)
})
```

### frame-protocol.test.ts (query-from-path parsing)
```typescript
const { validateHttpRequestFrame, encodeRequestFrame } = await import('../../../src/lib/tunnel-client/frame-protocol.js')

it('parses query from path when no query field present', () => {
  const result = validateHttpRequestFrame({
    id: '1', type: 'request', method: 'GET', path: '/api/search?q=hello&limit=10'
  })
  expect(result.query).toBe('q=hello&limit=10')
})
```

### connection-manager.test.ts (auth headers)
```typescript
// Mock WebSocket to capture constructor options
let lastConnectOptions: any = {}
class MockWebSocket {
  constructor(url: string, options?: { headers?: Record<string, string> }) {
    lastConnectOptions = options ?? {}
  }
  // ...
}
;(globalThis as any).WebSocket = MockWebSocket

it('sends Authorization header when authToken is set', async () => {
  const cm = new ConnectionManager({ tunnel: { authToken: 'jwt', subdomain: 'user-test', ... } } as any)
  await cm.connect()
  expect(lastConnectOptions.headers['Authorization']).toBe('Bearer jwt')
  expect(lastConnectOptions.headers['X-Subdomain']).toBe('user-test')
})
```

## Integration Test Pattern (sync-pipeline)

### Full cloud ↔ desktop pipeline
```typescript
import { LedgerClient } from '../../../src/lib/ledger-client/ledger-client.js'
import { computeEntryHash } from '../../../src/lib/ledger-client/chain-verifier.js'
import { applyManifestEntries } from '../../../src/lib/ledger-client/manifest-applier.js'

it('signup → sync → verify → apply → mint', async () => {
  // 1. Mock fetch for signup
  // 2. Mock fetch for sync (returns verified entries)
  // 3. applyManifestEntries with mock Prisma
  // 4. Mock fetch for mintTunnelToken
  // 5. Assert full pipeline completes
})
```

## Running New Tests
```bash
# Ledger client tests
bun test tests/unit/lib/ledger-client/

# Tunnel client tests
bun test tests/unit/lib/tunnel-client/

# Orchestrator tests
bun test tests/unit/lib/orchestrator/

# All lib tests
bun test tests/unit/lib/

# Integration sync pipeline
bun test tests/integration/lib/

# Phase 0A patch tests
bun test tests/unit/engines/memory-engine-record.test.ts
bun test tests/unit/engines/harness-condition.test.ts
bun test tests/unit/lib/export-import.test.ts
```