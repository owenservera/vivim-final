# Impact Assessment A2 — Engine Layer + Store Contracts

**Assessment point 2 of 5 (DB done → A2).** Scope: where the AI Gateway's
contracts and implementations land in the engine layer, and what Store Contract
surface (per the Store Contracts invariant) the gateway needs.

**Date:** 2026-08-08 · **Status:** Assessment (no code changed)

---

## 1. Executive Summary

- The gateway contract files **do not collide with any existing engine file** —
  `src/ai/` is greenfield. But the design's module map (`ARCHITECTURE.md` §5) is
  **not what's on disk**: the root files are flat (`docs/.../AI-gtewwaay/*.ts`)
  while `index.ts` and every file's `@module` tag assume
  `src/ai/{core,execution,protocol,routing,policy,registry,runtime,tools,plugins,events,gateway}/`.
  Two files exist only in the `mnt/` snapshot (`execution/types.ts`,
  `plugins/manager.ts`). **P0 staging must first reconstruct the directory layout
  per `ARCHITECTURE.md` §5.**
- **Existing engines already cover ~70% of gateway behavior with different
  shapes.** Mapping each gateway contract to its closest existing engine:
  - `IProviderAdapter` ↔ `ApiProviderAdapter` + `LocalModelAdapter` (both are
    HTTP/SSE translation; neither implements the `AsyncIterable<AIEvent>` IR).
  - `IRouter` ↔ `ProviderMuxEngine` (already has `fan_out|round_robin|priority|
    cost_optimized|learned` strategies + a `MuxStore`).
  - `IPolicyEvaluator` ↔ `ExecutionPolicyEngine` (regex rules + approval, advisory
    + throttle semantics — no hard enforcer).
  - `IToolOrchestrator` ↔ `ToolUseProtocolImpl` (MCP `listTools`/`executeTool`,
    **no** authorize/approve/audit stages).
  - `IPluginManager` ↔ `plugin-system.ts` `ProviderPlugin` + `plugin-manager-impl.ts`
    + `PluginRegistry` table.
  - `IEventBus` ↔ `CapabilityEventBus` (transient) + `EventRecordStore` (durable
    mirror outbox).
  - `IExecutionManager` ↔ **no existing equivalent** (only `RouteRequest`,
    `WorkflowExecution`, `ParserExecutionLog` — different semantics).
  - `IRuntimeSupervisor` ↔ `ChromeGovernor`/`FleetSupervisor` (CDP fleet lifecycle)
    — the gateway's is a Rust/Tauri process boundary, net-new.
- **Store Contracts invariant applies:** the gateway must depend on
  `src/storage/contracts/*.ts` interfaces, never `src/storage/impl/*`. New impls go
  in `src/storage/impl/` (additive; the flat `prisma-like.ts` + per-store impls
  pattern).

---

## 2. Per-Contract Landing Map

| Design file (target) | Existing engine collision | Verdict |
|---|---|---|
| `core/types.ts` | `src/schema/streaming.ts` `ContentBlock`, `streaming-protocol.ts` | **Adopt as-is.** No import collision; keep `ai/core` types separate (they're IR-neutral; `ContentBlock` is provider-capture-shaped). Name-space under `ai/core`. |
| `core/errors.ts` | `src/errors.ts` (`EngineError` family) | **Adopt as-is**, but note: `VivimAIError` coexists with `EngineError`. Do NOT merge — different taxonomy. Add a note in `index.ts` barrel; expose `isVivimAIError` from `src/ai/index.ts`. |
| `core/invariants.ts` | `src/engines/harness-repair-engine.ts` (zod repair) | **Adopt as-is.** Cheap guards; no conflict. |
| `execution/types.ts` (from `mnt/`) | none | **Adopt as-is.** The execution model is net-new. |
| `execution/manager.ts` | none | **Adopt as-is** (interface only). Impl is M2. |
| `protocol/adapter.ts` | `ApiProviderAdapter`, `LocalModelAdapter` | **Adopt as-is** as the canonical adapter contract. Existing adapters are *partial* (string-returning, not IR-yielding); they become candidate `IProviderAdapter` impls later, not replacements now. |
| `routing/router.ts` | `ProviderMuxEngine` | **Adopt as-is**, but reconcile with `ProviderMuxEngine` (see §3). |
| `policy/policy.ts` | `ExecutionPolicyEngine` | **Adopt as-is** (evaluator/enforcer split is stricter than existing). Wire existing `ExecutionPolicyEngine` as a candidate `IPolicyEvaluator` adapter (map `PolicyDecision` → `RoutingCandidate`). |
| `registry/registry.ts` | `ProviderRegistrar`, `ProviderDefinition` | **Adopt as-is** for the in-memory `IProviderRegistry`. DB mapping is A1's decision: keep gateway providers in a separate identity namespace (do NOT fold into `ProviderDefinition`). |
| `runtime/resources.ts` | none | **Adopt as-is.** Net-new. |
| `runtime/supervisor.ts` | `ChromeGovernor`/`FleetSupervisor` | **Adopt as-is** as the TS-side contract for a Tauri/Rust boundary. Do NOT map to `ChromeGovernor` (CDP is a different runtime). |
| `tools/orchestrator.ts` | `ToolUseProtocolImpl` | **Adopt as-is** as the 4-stage pipeline. Existing MCP tool executor can back `IToolExecutor` later. |
| `plugins/manager.ts` (from `mnt/`) | `plugin-system.ts`, `plugin-manager-impl.ts` | **Adopt as-is** as contract. `PluginRegistry` table is the DB home (A1). Existing plugin engine is the eventual impl. |
| `events/bus.ts` | `CapabilityEventBus` | **Adopt as-is.** Gateway events are a distinct union; mirror into `EventRecord` via adapter (A1/A5). |
| `gateway/gateway.ts` | none (new public API) | **Adopt as-is.** |
| `index.ts` | `src/index.ts` barrel | **Adopt as-is**, with `src/ai/index.ts` as its own barrel; `src/index.ts` re-exports it. |

---

## 3. Reconciliation Notes (gaps that must be decided, not coded)

1. **`ProviderMuxEngine` vs `IRouter`.** Both own routing. The gateway's router is
   IR-shaped (`AIRequest` → `RoutingDecision`); `ProviderMuxEngine` is
   message-shaped (`MuxRequest` → provider fan-out) over CDP/API providers. Decision:
   keep them separate initially — the gateway router serves `src/ai`, the mux serves
   the legacy capability path. A thin bridge capability (`cap:ai:execute` → mux)
   can be added in P2 without touching mux internals. **Do not merge routers.**
2. **`ExecutionPolicyEngine` vs `IPolicyEvaluator/Enforcer`.** Existing engine is
   advisory + throttle (cooldown/window) + approval flag. Gateway split is
   advisory-scoring vs hard-gate. They are compatible shapes but different
   semantics. Decision: keep `ExecutionPolicyEngine` for legacy autonomous loop;
   add gateway policy impls for `src/ai`. Reuse `PolicyRule` table for gateway rules
   (A1), add gateway-specific fields only if needed.
3. **Store Contracts naming.** Gateway persistence needs new contract interfaces,
   following existing pattern (`interface XStore`, `*Impl` in `src/storage/impl/`):
   - `AIExecutionStore` (create/get/getByRequest/list/transition/snapshot/drain)
   - `ProviderRuntimeStateStore` (get/setState/transitions — if A1 provider-state
     model lands)
   - `ResourceLeaseStore` (acquire/release/list — only if leases persist)
   These are NEW files; existing `RouterStore`, `MuxStore`, `ParserExecutionLogStore`
   are NOT reused for execution (different shapes per A1 §7).

---

## 4. What Changes (additive)

| Change | Type |
|---|---|
| `src/ai/**` package (reconstructed layout per ARCHITECTURE.md §5) | NEW |
| `src/storage/contracts/ai-execution-store.ts` (+ optional provider-runtime, resource-lease) | NEW |
| `src/storage/impl/ai-execution-store-impl.ts` (+ optional peers) | NEW (M2/P3) |
| Re-export `src/ai` from `src/index.ts` barrel | EDIT (additive) |
| Local tsconfig for `src/ai` (design ships its own; align with repo `strict`/`noUncheckedIndexedAccess`) | NEW |
| No changes to existing engines | none |

**Invariants satisfied:** Store Contracts (gateway depends on contracts only);
One Entry Point (gateway exposed as capabilities, §A3); Governor Canon (no CDP in
gateway); DB-only parser logic (gateway never loads file parsers).

---

## 5. Verification Gates

- `bunx tsc --noEmit` on `src/ai` after staging (design claims `--strict` zero errors;
  repo strict adds `noUncheckedIndexedAccess` + `.js` import suffix requirement —
  **this will surface as the first adjustment**: design uses extensionless imports).
- `bun run lint` (Biome) clean.
- `bun test tests/unit/ai/` once M2 impls exist (new test dir).
