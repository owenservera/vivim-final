# 10 — Glossary: term mapping across the two repos

| Concept | vivim-final | cap-store (OG) |
|---|---|---|
| Meta-layer | `Kernel` / `KernelContext` / `KernelRegistry` | (none) |
| DI container | `KernelContext` object | (none — param threading + singletons) |
| Persistence seam | store **contracts** (`storage/contracts/*.ts`) | concrete `CapStoreDb` param |
| Composition root | `bootstrapKernel` | implicit module imports |
| Capability (unit) | `UnifiedCapability` (code object w/ `handler`) | taxonomy → `ProviderBinding` → `ActionProgram` (DB rows) |
| Capability registry | `UnifiedCapabilityRegistry` | (DB tables; `router/resolve`) |
| Surface exposure | 5 surfaces auto-exported + parity-checked | REST + WebSocket + SDK |
| NL entry | NLCL `catalog.ts` → `capabilityId` ("one entry point") | (none; `verb` supplied by caller) |
| Resolution | layered resolver → one capability | `verb` → taxonomy → bindings fan-out |
| Execution gate | **Governor Canon** (`ChromeGovernor` only touches CDP) | **fleet** (`fleet.ensure` + `createCdpClient`) |
| Execution unit | single selector + recovery ladder | ordered `ActionProgram` → `Recipe` steps |
| Streaming | `CapabilityEventBus` (`executed`/`failed`) | WS `publishStreamBlock`/`publishStreamDone` |
| Health | registry status + selector/binding health | binding **status ladder** |
| Confidence use | selects **recovery** strategy | drives **promotion/escalation** |
| Self-heal | **oracle** (diagnostic/actuator/event-stream) | ladder auto-promote + circuit breaker |
| Provider | `ProviderRegistrar` seeds JSON manifests; slug = id | `PROVIDER_PROFILES` (debug port map) in `fleet.ts` |
| Outcome | `store.createOutcome` + `eventBus.emit` | `db.upsertOutcomeExtended` + `publish` delta |

## Key files referenced

**vivim-final**
- `src/engines/kernel/kernel-context.ts` — `KernelContext`, DI container
- `src/engines/kernel/kernel-registry.ts` — registry, observers, status
- `src/engines/kernel/kernel-bootstrap.ts` — composition root
- `src/storage/store-factory.ts` — backend selection seam
- `src/engines/unified-registry.ts` — `UnifiedCapability`, surface export
- `src/engines/capability.ts` — `CapabilityEngine`, governor-gated execution
- `src/engines/provider-registrar.ts` — provider seeding
- `src/engines/nlcl/catalog.ts` — NL → capability binding

**cap-store (OG)**
- `src/index.ts` — public library surface
- `src/router/index.ts` — `resolve`/`dispatch` (verb → bindings)
- `src/executor/index.ts` — `executeBinding` (load → fleet → CDP → recipe)
- `src/executor/recipe.ts` — `programToRecipe` / `runRecipe` (CDP injection)
- `src/lifecycle/index.ts` — status ladder + confidence promotion
- `src/schema/types.ts` — domain types (taxonomy/binding/program)
- `src/confidence.ts` — `shouldEscalate` / `confidence`
