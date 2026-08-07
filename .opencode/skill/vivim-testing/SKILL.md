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
      ...
  integration/             # Engine-to-engine, mocked stores
    engines/
      conversation-pipeline.test.ts
      ...
  e2e/                     # Full stack, real DB
    api/
    cli/
    seeds/
  helpers/                 # Shared test utilities
    mocks.ts               # Mock store contracts
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