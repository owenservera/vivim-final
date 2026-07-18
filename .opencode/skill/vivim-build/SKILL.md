---
name: vivim-build
description: Engine implementation workflow for vivim-final. Use when building new engines, porting engines from spec, or extending existing engine functionality. Follows the 13-engine architecture.
---
# VIVIM Build Workflow

## Engine Implementation Order (from spec)

### Phase 1: Foundation
1. `ConfigManager` — reprogrammable config for all engines
2. `CapabilityEventBus` — typed pub/sub

### Phase 2: Chrome Layer
3. `ChromeGovernor` — CDP proxy, lifecycle, trace, health

### Phase 3: Provider KG
4. `ProviderRegistrar` — seed provider knowledge graph
5. `ProviderHealthKernel` — weighted health scores

### Phase 4: Capability System
6. `CapabilityResolutionEngine` — UI contract resolution
7. `StreamParserEngine` — parse provider API responses

### Phase 5: Session & State
8. `ConversationManager` — 8-step thin pipe
9. `StreamBlockStore` — persist ContentBlock[]

### Phase 6: Lifecycle
10. `RegistrationAuditor` — audit manifest changes
11. `VersionManager` — version chains, rollback
12. `TelemetryAggregator` — scheduled aggregation

### Phase 7: API
13. REST endpoints, WebSocket, CLI, SDK

### Harness Layer (spec 017, completed)
- `HarnessCommandRegistry` — semver version resolution, required-field validation from stored JSON schema
- `HarnessRepairEngine` — Zod schema repair with alias remapping, code-fence strip, trailing-comma fix, apostrophe-safe
- `HarnessFeedbackCoordinator` — escalating retry prompts with exponential backoff + diff (never repeats same prompt)

## Engine File Structure
```
src/engines/
  index.ts                    # barrel exports
  config-manager.ts
  capability-event-bus.ts
  chrome-governor.ts
  provider-registrar.ts
  provider-health-kernel.ts
  capability-resolution-engine.ts
  stream-parser-engine.ts
  conversation-manager.ts
  stream-block-store.ts
  registration-auditor.ts
  version-manager.ts
  telemetry-aggregator.ts
  harness-command-registry.ts
  harness-repair-engine.ts
  harness-feedback-coordinator.ts
```

## Implementation Template
```typescript
// src/engines/my-engine.ts

import type { PrismaClient } from '@prisma/client'
import { createLogger } from '../logging.js'

// 1. Store Contract (what this engine needs from storage)
export interface MyEngineStore {
  findById(id: string): Promise<Foo | null>
  create(data: CreateFoo): Promise<Foo>
  update(id: string, data: Partial<CreateFoo>): Promise<Foo>
}

// 2. Engine Config
export interface MyEngineConfig {
  cycleIntervalMs: number
  maxRetries: number
}

// 3. Engine Interface
export interface MyEngine {
  init(): Promise<void>
  execute(input: MyInput): Promise<MyOutput>
  shutdown(): Promise<void>
}

// 4. Implementation
export function createMyEngine(
  store: MyEngineStore,
  config: MyEngineConfig,
  eventBus: CapabilityEventBus,
): MyEngine {
  const logger = createLogger('MyEngine')

  return {
    async init() {
      logger.info('Initializing MyEngine')
    },

    async execute(input) {
      // implementation
    },

    async shutdown() {
      logger.info('Shutting down MyEngine')
    },
  }
}
```

## Testing Pattern
```typescript
// tests/unit/engines/my-engine.test.ts
import { describe, it, expect, mock } from 'bun:test'
import { createMyEngine } from '../../../src/engines/my-engine.js'

function createMockStore(): MyEngineStore {
  return {
    findById: mock(() => Promise.resolve(null)),
    create: mock((data) => Promise.resolve({ id: '1', ...data })),
    update: mock((id, data) => Promise.resolve({ id, ...data })),
  }
}

describe('MyEngine', () => {
  it('should do something', async () => {
    const store = createMockStore()
    const engine = createMyEngine(store, defaultConfig, mockEventBus)

    const result = await engine.execute({ ... })
    expect(result).toEqual({ ... })
    expect(store.findById).toHaveBeenCalledWith('1')
  })
})
```

## Key Rules
1. Read the spec before implementing — match interfaces exactly
2. Define Store Contract first — enables mock-based testing
3. Use custom error classes from `src/errors.ts`
4. Emit events via CapabilityEventBus for cross-engine communication
5. Never import PrismaClient directly in engine — use Store Contract
6. Write tests alongside implementation