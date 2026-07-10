# Unit 4.31: Shared CapabilityEvent type + schema barrel exports

**Phase:** 4 | **File:** `src/schema/index.ts` (barrel re-export)
**Depends:** 3.7 CapabilityEventBus, 4.27-4.29 Survivors | **Produces:** Shared type barrel for all 30 engines
**Source:** `02-merged-architecture.md` §Module Layout (`src/schema/index.ts` = barrel re-export)

## Purpose

Creates `src/schema/index.ts` — the barrel re-export file that all engines import from. Re-exports the `CapabilityEvent` union type (from 3.6), all schema domain types, the `ContentBlock` union (from executor/content-blocks.ts), and Row types (from types.ts). This prevents circular imports and gives every engine a single import point.

Also creates `src/index.ts` — the public barrel that re-exports everything from `src/schema/index.ts` plus engine classes.

## Interface
```typescript
// src/schema/types.ts — barrel re-export
// Re-exports all domain types from schema/* files and executor/content-blocks.ts

export type { CapabilityEvent, EventHandler } from '../engines/capability-event-bus.js';
export type { ContentBlock } from '../executor/content-blocks.js';
export type { SlaveStatus, SuperState, ChromeSlave, LaunchOptions } from '../engines/chrome-governor.js';
export type { SendResult, ConversationContext } from '../engines/conversation-manager.js';
export type { ParseResult } from '../engines/stream-parser.js';
export type { ResolvedCapabilities, ResolvedCapability, PlanTier } from '../engines/capability-resolution.js';
// ... all public types from all engines

// src/index.ts — public barrel
export { CapabilityEventBus } from './engines/capability-event-bus.js';
export { ChromeGovernor } from './engines/chrome-governor.js';
export { ConversationManager } from './engines/conversation-manager.js';
export { StreamParserEngine } from './engines/stream-parser.js';
export { CapabilityEngine } from './engines/capability.js';
export { ProviderRegistrar } from './engines/provider-registrar.js';
export { CapabilityResolutionEngine } from './engines/capability-resolution.js';
export { ProviderHealthKernel } from './engines/provider-health.js';
export { StreamBlockStore } from './engines/stream-block-store.js';
export { RegistrationAuditor } from './engines/registration-auditor.js';
export { VersionManager } from './engines/version-manager.js';
export { TelemetryAggregator } from './engines/telemetry-aggregator.js';
export { ConfigManager } from './engines/config-manager.js';
export { ExecutionMemoizer } from './engines/execution-memoizer.js';
```

## Tests
- [ ] `src/schema/index.ts` exists and re-exports all 14 domain schema files + `types.ts` + `streaming.ts`
- [ ] `src/index.ts` exists and re-exports all 13 engine classes
- [ ] `import { CapabilityTaxonomy } from '@/schema/index.js'` resolves
- [ ] `import { ChromeGovernor } from '@/index.js'` resolves
- [ ] No circular import errors in `bunx tsc --noEmit`
- [ ] Each engine can import shared types without importing concrete implementations

## Gate
- `bunx tsc --noEmit` passes
- Barrel exports match the module layout in 02-merged-architecture.md (14 domain files added under unit 4.32)
- No engine has a direct import from another engine's internal file (only through barrel)
