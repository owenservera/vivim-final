# UnifiedCapabilityRegistry / Capability Resolution

## Overview

The UnifiedCapabilityRegistry is the **single source of truth** for every capability across all surfaces (CLI, UI, API, MCP, workflow). It replaces the older static 96-command CDP catalog with a DB-driven, provider-bound, hot-swappable capability plane.

## Governing Source Files

| File | Role |
|------|------|
| `src/engines/unified-registry.ts` | Central registry. Defines `UnifiedCapability`, `CapabilityContext`, `CapabilitySurface`. Houses `UnifiedCapabilityRegistry` — the central in-process map of every capability. |
| `src/engines/capability-resolution.ts` | `CapabilityResolutionEngine` resolves the UI contract for a given `(providerId, planTier)`. Reads raw rows from the store, applies plan-tier gating, existential rules, dependency satisfaction, and grouping into `composer/header/message/sidebar/inline`. |
| `src/engines/capability-snapshot.ts` | Boot-time loader (`CapabilitySnapshot`) that hydrates an in-memory map from `CapabilityBinding` rows for all registered providers. Runtime resolution is O(1); no per-request DB hit. |
| `src/engines/capability-bootstrap.ts` | Registers the **default** capabilities every vivim instance ships with (`conversation:list`, `conversation:create`, `conversation:send`, `knowledge:search`, `memory:query`, etc.) using `makeCapability`. |
| `src/engines/capability-event-bus.ts` | Typed in-process pub/sub (`CapabilityEventBus`). Emits `capability:executed`, `capability:failed`, `fleet:slave_status`, `conversation:complete`, etc. |
| `src/server/capability-router.ts` | Universal execution transport: `GET /api/capabilities`, `POST /api/capabilities/:id/execute`, `GET /api/capabilities/:id`. Resolves slug via `getBySlugAsync` (lazy prog-*) and executes handler. |
| `src/server/index.ts` | Wires the registry at boot: `registerDefaultCapabilities`, `registerGeneratedCapabilities`, `registerDiscoveredCdpMethods(registry, CDP_PROTOCOL_CATALOG, ...)`, `registry.setProgramResolver(...)` for lazy `prog-*` resolution. |
| `src/cli/index.ts` | `connectCapabilityRegistry(reg)` calls `syncCliFromUnified(reg, registry)` to mirror every `cli`-surface capability into the `CommandRegistry`. |
| `src/storage/contracts/capability-resolution-store.ts` | `CapabilityResolutionStore` — read-only contract for resolution. `RawResolutionRow` (79 fields) flattens the taxonomy + provider_capability + binding + tier override join. |
| `src/storage/contracts/capability-store.ts` | `CapabilityStore` — write/read capability bindings, programs, selectors. `loadSnapshot(registeredProviderIds)` is the boot-loader for `CapabilitySnapshot`. |

## Key Types and Interfaces

```typescript
// From src/engines/unified-registry.ts
export type CapabilitySurface = 'cli' | 'ui' | 'workflow' | 'mcp' | 'api'

export interface CapabilityContext {
  conversationId?: string
  providerId?: string
  slaveId?: string
  userId?: string
  metadata: Record<string, unknown>
}

export interface UnifiedCapability {
  id: string
  slug: string
  name: string
  description: string
  category: string
  surfaces: CapabilitySurface[]
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  handler: (input: Record<string, unknown>, ctx: CapabilityContext) => Promise<unknown>
  cliCommand?: { name: string; aliases: string[]; examples: string[] }
  ui?: { component: string; position: string; group?: string; order: number; icon?: string; shortcut?: string; requiresConfirmation?: boolean }
  uiAction?: { component: string; position: string; order: number }
  workflowNodeType?: string
  mcpToolName?: string
  apiEndpoint?: { method: string; path: string }
  isAsync: boolean
  requiresConfirmation: boolean
  tags: string[]
  isComposite?: boolean
  compositeId?: string
}
```

```typescript
// From src/engines/capability-resolution.ts
export type PlanTier = 'free' | 'pro' | 'max' | 'enterprise'

export interface ResolvedCapability {
  id: string
  slug: string
  name: string
  category: string
  uiComponent: string
  uiLabel: string
  uiIcon: string
  uiPosition: string
  uiOrder: number
  uiGroup: string
  uiLayerDepth: number
  parentCapabilityId: string | null
  uiPriority: string
  interactionMode: string
  uiStates: string[]
  uiVisibilityRule: string | null
  existentialRule: string | null
  uiInputSchema: Record<string, unknown>
  mutationEffects: Record<string, unknown>
  recoveryBehavior: string
  statePersistence: string
  dataFlow: string
  minPlanTier: PlanTier
  dependsOn: string[]
  concurrencySafe: boolean
  opClassification: string | null
  requiresUserConfirmation: boolean
  maxResultSize: number
  resultComponent: string
  resultLayout: string
  uiSlots: Record<string, { component?: string; sandbox?: string[] }>
  searchHints: string[]
  aliases: string[]
  availability: AvailabilityGating
  prefetch: boolean
  overrideSources: Record<string, OverrideSource>
  bindingStatus: string
  bindingConfidence: number
  tierOverrides: {
    maxModels?: number
    maxFileSize?: number
    maxOptions?: number
    customConfig?: Record<string, unknown>
  }
}
```

## Data Flow

1. **Boot**: `ProviderRegistrar.seedAll()` → seeds providers, parsers, capabilities into DB
2. **Registry Construction**: `UnifiedCapabilityRegistry` created; `registerDefaultCapabilities()` registers built-in caps
3. **Snapshot Load**: `CapabilitySnapshot.load(registeredProviderIds)` reads active bindings from DB → O(1) in-memory maps
4. **Resolution**: `CapabilityResolutionEngine.resolve(providerId, planTier)` reads `RawResolutionRow[]` from store, applies tier gating, existential rules, dependency satisfaction, groups by UI position
5. **Execution**: `registry.execute(id, input, ctx)` validates required fields, calls `cap.handler(input, ctx)`
6. **Surface Export**: `exportForCli()`, `exportForMcp()`, `exportForUi()` derive surface-specific representations from the registry

## Critical Patterns

- **Single Registration**: Every capability is defined once and automatically exported to CLI, UI, workflow, MCP, and API surfaces
- **Lazy prog-* Resolution**: `setProgramResolver(fn)` + `getBySlugAsync(slug)` enables harness DB programs (`prog-<capabilitySlug>-<providerId>`) to be resolved lazily without pre-registration
- **Plan Tier Gating**: `tierRank()` enforces `min_plan_tier` at resolution time
- **Existential Rules**: `satisfiesExistentialRule()` evaluates simple DSL (`key`, `!key`, `key == value`, `key != value`) against conversation context
- **Dependency Satisfaction**: `dependenciesSatisfied(dependsOn, bindings)` ensures all `dependsOn` capabilities are active bindings before showing

## System Connections

- **ChromeGovernor**: `governor.executeCdpMethod` is injected as the `executeCdp` closure for CDP capabilities
- **StreamParserEngine**: parser execution logs flow back into `parser-execution-log-store`
- **EventBus**: `CapabilityEventBus` carries all capability lifecycle events; `ConversationManager` emits `conversation:complete` which the registry can react to
- **ProviderRegistrar**: seeds provider definitions + capabilities_config into DB, which are then resolved by `CapabilityResolutionEngine`
