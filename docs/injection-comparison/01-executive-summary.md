# 01 — Executive Summary

## The one-sentence verdict

**vivim-final injects *wiring* (a kernel meta-layer, store contracts, and a
multi-surface capability registry); cap-store (OG) injects *behaviour* (a
DB-loaded program translated to CDP and executed inside a live Chrome slave).**

They share a **conceptual lineage** — capability = taxonomy(global) → binding →
selector/program → recipe executed over CDP — but they sit on **opposite sides of
the code-vs-data injection axis**.

## Two architectures at a glance

| Dimension | vivim-final | cap-store (OG) |
|-----------|-------------|----------------|
| Meta-layer | **Kernel** (`KernelContext`, `KernelRegistry`, oracle, tracer, provenance) | None — flat library modules |
| DI container | `KernelContext` object passed to every engine constructor | No container; `db` passed per-function as a parameter |
| Persistence seam | **Store contracts** (`storage/contracts/*.ts`) — interface DI; engines never import impls | Direct `CapStoreDb` param threading through functions |
| Capability shape | **Code object**: `{ id, slug, handler, surfaces[], inputSchema, outputSchema, cliCommand, ui, mcpToolName, apiEndpoint }` | **DB row**: taxonomy → `ProviderBinding` (`best_program_id`, `status`, `confidence_inputs`) → `ActionProgram` (steps) |
| Where capability lives | Registered at **compile/bootstrap time** in `UnifiedCapabilityRegistry` | Loaded at **execute time** from the DB |
| Execution target | `ChromeGovernor` owns CDP; `CapabilityEngine` calls `governor.cdp.send` | `fleet.ensure(provider)` + `createCdpClient` → attach page → `runRecipe` |
| Entry point | **NLCL "one entry point"**: NL phrase → capability → `POST /api/interpret` → `/api/capabilities/:id/execute` | **Router**: `verb` → taxonomy global → bindings fan-out; `executeBinding` via REST/WS |
| Surface exposure | Auto-export to **5 surfaces** (cli/ui/workflow/mcp/api) from one definition | **2 surfaces**: REST `handle` + WebSocket `publish` (+ SDK client) |
| Health/confidence | Registry status + selector health; confidence drives **recovery** | Binding **status ladder**; confidence drives **promotion/escalation** |
| Self-healing | `oracle` sub-system (diagnostic/actuator/event-stream) | `lifecycle` ladder auto-promotes/breaks; circuit breaker on fleet |

## Three foundational protocol contrasts

1. **Compile-time registry vs runtime DB resolution.**
   vivim-final knows its capabilities *before* it runs (they are code, validated at
   registration, exported to surfaces eagerly). cap-store *discovers* the capability
   at call time by reading binding + program rows.

2. **Interface DI seam vs parameter threading.**
   vivim-final enforces a hard boundary: engines depend on `contracts`, never `impl`
   (the "Store Contracts" invariant). cap-store threads a concrete `CapStoreDb`
   instance through pure functions — flexible, but no compile-time seam.

3. **Confidence as recovery vs confidence as promotion.**
   In vivim-final, confidence/health selects *recovery strategies* when a selector
   misses. In cap-store, confidence *promotes or breaks* the binding itself on the
   status ladder.

## Recommendation (expanded in 09)

Neither is "wrong." vivim-final is the **composition/runtime-architecture** answer;
cap-store is the **live-action-injection** answer. The highest-value synthesis is to
keep vivim-final's kernel/contract/registry as the *wiring substrate* and adopt
cap-store's **data-driven program→recipe→CDP injection** as the *execution substrate*
behind each capability's `handler`.
