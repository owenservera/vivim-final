# Impact Assessment A5 — Runtime / Bootstrap Wiring

**Assessment point 5 of 5 (DB → Engine → Capability → Security → A5).** Scope: how the
AI Gateway is constructed, wired into the boot pipeline, and exposed at runtime —
without disturbing the existing phase orchestrator or its error-containment style.

**Date:** 2026-08-08 · **Status:** Assessment (no code changed)

---

## 1. Current Boot Pipeline (facts)

`src/server/bootstrap/` orchestrates phases in dependency order. Each phase is a
self-contained try/catch that writes to `BootstrapContext`; failures are non-fatal
(`catchDebug` + log.warn). Phases:

1. `seeds.ts` — DB seeding, MigrationRunner, provider registry cache → `providerStore`,
   `registrar`, `providerRegistry`
2. `stores.ts` — storage impls + core engines → `capabilityStore`, `convStore`,
   `resolutionEngine`, `parserEngine`, `streamBlocks`, `memoryEngine`
3. `capabilities.ts` — capability registration + autonomous execution + MCP server +
   memory fabric + OpenCode supervisor + CDP registrar + capability snapshot +
   policy/autonomous engines → `registry`, `policyEngine`, `autonomousEngine`, ...
4. `knowledge.ts` — knowledge/export engines (optional)
5. `lifecycle.ts` — NLCLEngine, automation orchestrator, kernel, health kernel,
   lock manager, idempotency guard, retry engine

`BootstrapContext` (context.ts:36) and `BootstrapEnginesResult` (context.ts:101) are
the two shapes threaded through. `createBootstrapContext(port)` seeds the singleton
`CapabilityEventBus`.

## 2. Gateway Construction: New Phase vs Fold-In

**Recommendation: a new boot phase `ai.ts`** (`bootstrapAiGatewayPhase(ctx)`) that runs
**after `stores.ts` and before `capabilities.ts`** (capabilities phase needs the
gateway instance to register `cap:ai:*`).

Rationale:
- Matches the "one engine per phase, each non-fatal" repo pattern.
- The gateway needs `db` (for `AIExecutionStore`), the event bus (for event mirroring),
  and config — all available by end of `stores.ts`.
- Keeps `capabilities.ts` from growing further (it's already the largest phase).

Wiring inside `bootstrapAiGatewayPhase` (all dynamic `import` + try/catch, same style):
```
db / eventBus / config
  → AIExecutionStore (contract, impl from storage/impl)
  → ProviderRuntimeStateStore (if A1 provider-state model lands)
  → IEventBus (in-memory M2; EventRecord mirror adapter when available)
  → IProviderRegistry/IModelRegistry (in-memory M2)
  → IPolicyEvaluator/IPolicyEnforcer (local-only deny defaults, M3)
  → IRouter (default impl + pluggable strategies, M3)
  → IResourceManager/IResourceMonitor (in-memory M2)
  → IExecutionManager (M2)
  → IVIVIMGateway impl (wires above, M4)
  → ctx.aiGateway = gateway
  → ctx.eventBus → EventRecord outbox mirror (reuse CapabilityEventBus outbox pattern,
     capability-event-bus.ts:6 "also mirror every emitted event into the durable
     EventRecord outbox")
```
Ordering per ARCHITECTURE.md M0–M7. For the initial integration (P0–P3) the phase is
**behind a config flag** (`config.aiGatewayEnabled`, default off) so boot is
unchanged until the gateway is genuinely live — this is the "migrate/refactor step by
step toward the landing spot" posture.

## 3. Context / Result Shape Changes (additive)

| Location | Field | Type |
|---|---|---|
| `BootstrapContext` | `aiGateway?` | `import('../../ai/index.js').IVIVIMGateway` |
| `BootstrapEnginesResult` | `aiGateway?` | same (optional — mirrors `providerMux?`/`costOptimizer?` optional pattern) |
| `BootstrapContext` | `aiExecutionStore?` | `AIExecutionStore` contract (if needed by later phases) |

No existing field changes. Optional-typed so consumers can feature-detect.

## 4. Capability Registration Hand-Off (A3)

`bootstrapCapabilitiesPhase` (capabilities.ts:26) gains a guarded 3-line block after
`registerProviderCapabilities`:
```
if (ctx.aiGateway) {
  const { registerAiGatewayCaps } = await import('../../../engines/ai-gateway-caps.js')
  registerAiGatewayCaps(ctx.registry!, ctx.aiGateway)
}
```
Skipped (with log) when the gateway isn't constructed.

## 5. Event / Streaming Wiring

- `IVIVIMGateway.subscribe()` → gateway `IEventBus` (in-memory M2). A thin WS adapter
  publishes `GatewayEvent`s onto the existing WS channel (frontend already consumes
  `ws://localhost:9420/ws`).
- **Durable mirror:** attach an `EventRecordStore` adapter to the gateway bus,
  reusing the `CapabilityEventBus` outbox pattern (`source='ai-gateway'`,
  `entityType='execution|provider|tool|resource'`) — no new transport, no new server.

## 6. What Changes (additive)

| Change | Type |
|---|---|
| `src/server/bootstrap/phases/ai.ts` (new phase, config-gated) | NEW |
| Phase orchestrator list — insert `bootstrapAiGatewayPhase` between stores and capabilities | EDIT (additive) |
| `BootstrapContext`/`BootstrapEnginesResult` — optional `aiGateway` fields | EDIT (additive) |
| `bootstrapCapabilitiesPhase` — guarded `registerAiGatewayCaps` call | EDIT (additive) |
| `src/config.ts` — `aiGatewayEnabled` (default false), port/timeout knobs | EDIT (additive) |
| `src/server/index.ts` — surface `aiGateway` on the built result (if used by routes) | EDIT (additive) |

## 7. Runtime SLO / Non-Functional Notes

- Gateway construction must not block boot: gate behind config; all internals
  `await import` + try/catch (matches MCP server handling, capabilities.ts:304).
- `IRuntimeSupervisor` delegates to Tauri/Rust — the TS side never spawns processes
  (invariant 5). Until the Rust boundary exists (M5), the supervisor is a stub that
  returns `in-process` connections for adapters that don't need an OS process.
- Lazy startup aligned: no gateway provider starts at boot; adapters start on first
  request (matches repo Lazy Startup invariant).

## 8. Verification Gates

- Boot smoke: server starts with `aiGatewayEnabled=true`, all existing phases still
  pass; with default `false`, zero behavioral change.
- `bun run devops desktop-loop test smoke` / `bun test tests/...` unaffected.
- `bun run devops invariants check` clean.
- Gateway cap set live: `GET /api/capabilities?category=ai` returns `cap:ai:*`.
