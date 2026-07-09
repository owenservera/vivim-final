# Unit 4.29: Survivor — src/executor/* (port/verify 6 files)

**Phase:** 4 | **File:** `src/executor/cdp.ts`, `circuit-breaker.ts`, `async-mutex.ts`, `fleet-config.ts`, `content-blocks.ts`, `ids.ts` (survive as-is)
**Depends:** 1.4 CapStoreDb | **Produces:** Verified executor exports consumed by Governor + other engines
**Source:** `01-merged-epic.md` §Survivor Components, `02-merged-architecture.md` §Module Layout

## Purpose

Ported survivor. These 6 files from the current codebase are consumed by ChromeGovernor subsystems and parser seeds. Copy without modification. This unit verifies they exist, export the right symbols, and integrate with the new engine constructors.

## File-by-File Requirements

### src/executor/cdp.ts
- Exports `BunCdpClient` class (or compatible CDP client)
- Wrapped by `Governor.CDPProxy` — never imported directly by other engines
- Methods: `send(method, params)`, `connect()`, `disconnect()`

### src/executor/circuit-breaker.ts
- Exports `CircuitBreaker` class
- Used by `Governor.HealthMonitor`
- Constructor: `threshold: number, resetMs: number`
- Methods: `recordSuccess()`, `recordFailure()`, `state()`, `isAvailable()`

### src/executor/async-mutex.ts
- Exports `AsyncMutex` class
- Used by `Governor` (per-slave) + `ConversationManager`
- Methods: `acquire()`, `release()`, `isLocked()`

### src/executor/fleet-config.ts
- Exports `FleetConfig` type/interface
- Loaded by `Governor` constructor
- Shape: `{ chromePath?, portRange, healthProbeIntervalMs, ... }`

### src/executor/content-blocks.ts
- Exports `ContentBlock` union type
- Consumed by parser seeds and `StreamBlockStore`
- Kinds: `text | thinking | code | artifact | image | citation | tool_use | error | meta`

### src/executor/ids.ts
- Exports ID derivation helpers
- Functions: `deriveSlaveId(providerId, accountId)`, `deriveId(prefix?)`
- Used by `ConversationManager` step 2 (DERIVE SLAVE)

## Tests
- [ ] All 6 files exist at their expected paths
- [ ] Each file exports the symbols listed above
- [ ] `import { BunCdpClient } from '@/executor/cdp.js'` resolves
- [ ] `import { CircuitBreaker } from '@/executor/circuit-breaker.js'` resolves
- [ ] `import { AsyncMutex } from '@/executor/async-mutex.js'` resolves
- [ ] `import type { FleetConfig } from '@/executor/fleet-config.js'` resolves
- [ ] `import type { ContentBlock } from '@/executor/content-blocks.js'` resolves
- [ ] `import { deriveSlaveId } from '@/executor/ids.js'` resolves

## Gate
- `bunx tsc --noEmit` passes with all executor imports
- No engine has unresolved imports from `@/executor/*`
