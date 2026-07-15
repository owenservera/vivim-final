# SYNTHESIS — Best-of-Breed Injection Harness (cap-store proven → vivim-final truth)

> **Landing place:** `vivim-final` (cap-store v1 Knowledge-Graph Rebuild).
> **Imported truth:** the cap-store (OG) **injection harness methodology is PROVEN** —
> program→recipe→CDP injection into a live, fleet-managed Chrome slave, with a content
> pipeline, stream capture/reconstruction, and a confidence-driven status ladder.
> **Deliverable:** a `docs/atomic-v14/` implementation plan that grafts that proven
> harness onto vivim-final's existing wiring, **fully grounded in vivim-final truth**.

---

## 0. The central realization

vivim-final is **not starting from scratch**. The cap-store harness model is *already
embedded* in vivim-final's bones:

| cap-store proven concept | Already present in vivim-final (grounded) |
|---|---|
| `fleet.ensure(provider)` / fleet lifecycle | `ChromeGovernor` + `FleetSupervisor` (`src/executor/fleet-supervisor.ts`, `storage/contracts/fleet-supervisor.ts`) |
| Circuit breaker on fleet | `CircuitState` (`'closed'\|'half_open'\|'open'`) in `chrome-governor.ts` |
| `ProviderBinding.best_program_id` → `ActionProgram` | `CapabilityBindingRow` + `CapabilityProgramRow` (`bindingId, version, status, configJson`) in `capability-store.ts` |
| Single CDP owner | **Governor Canon** — only `ChromeGovernor` imports CDP transport; engines receive `governor.cdp` |
| Capability = code object w/ handler | `UnifiedCapability` (`unified-registry.ts`) + `cdp-capability-registrar.ts` (every CDP method → capability) |
| Binding status / health | `CapabilityBindingRow.status`, `healthScore` |
| Outcome + event broadcast | `createOutcome` + `CapabilityEventBus` |
| Resolve verb → bindings | `CapabilityResolutionEngine` (3-layer override, `bindingStatus`, `bindingConfidence`) |

So **what is missing is not the architecture — it is the execution richness**:

- vivim-final currently executes a capability as a **single atomic selector hit**
  (`CapabilityEngine.runSelector` → `governor.cdp.send('DOM.querySelector')`) with a
  recovery ladder.
- cap-store proves a capability should execute as a **multi-step program** (click →
  type → wait → navigate → arm) translated to a CDP `Recipe`, driven by a **content
  pipeline** (prompt injection, message composition), with **stream capture /
  reconstruction** and **confidence-driven promotion**.

**atomic-v14 = promote vivim-final's existing program skeleton from "selector only" to
"cap-store-proven recipe injection", without breaking a single existing invariant.**

---

## 1. Invariants this synthesis must NOT break (from AGENTS.md / existing code)

1. **Governor Canon** — only `ChromeGovernor` touches CDP. No new engine imports
   `BunCdpClient`. The harness executor calls `governor.cdp`, exactly like
   `CapabilityEngine` and `cdp-capability-registrar`.
2. **Store Contracts** — engines depend on `storage/contracts/*.ts`, never `impl`. The
   new program store is a contract + impl pair (`capability-program-store.ts` /
   `*-impl.ts`).
3. **One Entry Point** — every operation is a `UnifiedCapability`; CLI/UI/MCP/API are
   thin shells over `POST /api/interpret` → `/api/capabilities/:id/execute`. Recipe
   capabilities are registered the same way (extend `cdp-capability-registrar`).
4. **Research-First / Phase Gates** — atomic-v14 builds on atomic-v8 (taxonomy) and
   atomic-v13 (governor/fleet); its phases open only after those are `done`.
5. **No `any`** — use `unknown` + narrowing; Zod at boundaries.

---

## 2. The cap-store proven harness, mapped onto vivim-final truth

### 2.1 Program → Recipe compilation (port of `executor/recipe.ts: programToRecipe`)

- **cap-store op set** (`click|type|wait|navigate|arm`) becomes a typed
  `RecipeStep` in vivim (`src/engines/harness/recipe-types.ts`).
- A `CapabilityProgramRow.configJson` holds the serialized `ActionProgram`
  (steps). `recipe-compiler.ts` deserializes + maps to `Recipe` verbs.
- Execution runs through `governor.cdp.send(slaveId, ...)` — **single CDP owner**.

### 2.2 Content pipeline (port of `executor/content-pipeline.ts`, `content-blocks.ts`)

- cap-store composes the message/prompt and injects it as `Input.insertText` /
  `Input.dispatchKeyEvent` steps. vivim-final reuses `composer-typing.ts`
  (`submitMessage`, `typeMessage`) as the *human-like typing* primitive inside the
  recipe — a capability vivim-final already has and cap-store lacks.
- Result: cap-store's prompt-injection pipeline + vivim's human-typing engine.

### 2.3 Stream capture / reconstruction (port of `executor/stream-capture.ts`,
`stream-reconstructor.ts`, `stream-detector.ts`)

- cap-store captures the provider's streaming response and reconstructs blocks.
- vivim-final already owns `StreamBlockStore` + `StreamParserEngine`
  (`src/engines/stream-block-store.ts`, `stream-parser.ts`). The adapter routes
  cap-store-style block capture into vivim's existing block store, emitting
  fine-grained `streamBlock` events on `CapabilityEventBus` (mirroring cap-store's
  `publishStreamBlock`).

### 2.4 Status ladder + confidence (port of `lifecycle/index.ts`, `confidence.ts`)

- cap-store: `prospect → test-1 → test-2 → stable → flaky → broken → retired`
  driven by `confidence()` over `confidence_inputs`.
- vivim-final: `CapabilityBindingRow.status` is currently a free-form string and
  `healthScore` a number. atomic-v14 **typed-enums** the status to the cap-store
  ladder and derives `healthScore` from the same confidence inputs, then feeds
  `bindingConfidence` / `bindingStatus` into `CapabilityResolutionEngine` (which
  already reads them).
- Escalation (`shouldEscalate`) becomes a resolution gate: low-confidence bindings are
  not surfaced as capabilities until promoted.

### 2.5 Circuit breaker (port of `executor/circuit-breaker.ts`)

- vivim-final already has `CircuitState` in the governor. atomic-v14 wires cap-store's
  `CircuitOpenError` semantics so a provider whose slave keeps failing is rejected
  fast and surfaced as a retry-after error — reusing the governor's existing
  `consecutiveFailures` / `circuitState`.

---

## 3. The synthesized execution flow (target)

```
NL phrase ─(NLCL catalog)─▶ UnifiedCapability (id/slug)
   │  POST /api/interpret → /api/capabilities/:id/execute   [One Entry Point]
   ▼
UnifiedCapabilityRegistry.execute(id, input, ctx)
   │  handler (extended by 25.1 to delegate to harness)
   ▼
HarnessExecutorEngine.execute(capabilitySlug, providerId, accountId, input)
   │  1. store.getBinding(capId, providerId)        [Store Contract]
   │  2. store.getProgram(binding.bestProgramId)    [data-driven program]
   │  3. recipe-compiler: program → Recipe
   │  4. fleet.ensure(provider)  ──▶ governor (SINGLE CDP OWNER)
   │  5. runRecipe via governor.cdp.send(slaveId, step)   [cap-store injection]
   │  6. content-pipeline: prompt/message injected (composer-typing)
   │  7. stream-capture → StreamBlockStore + CapabilityEventBus blocks
   │  8. outcome recorded; binding status ladder advanced by confidence
   ▼
WS/event delta + resolved capability UI contract (CapabilityResolutionEngine)
```

This is **cap-store's proven injection, executed inside vivim-final's governor-gated,
registry-backed, multi-surface architecture.**

---

## 4. Why this is best-of-breed

| Concern | vivim-final strength kept | cap-store proven method added |
|---|---|---|
| Composition | Kernel + Store Contracts + composition root | — |
| Multi-surface | 5-surface parity-checked capability | — |
| Human entry | NLCL one-entry-point | — |
| Lifecycle | governor+fleet+circuit | status ladder + confidence promotion |
| Execution | atomic selector + recovery | **program→recipe multi-step injection** |
| Content | composer-typing (human-like) | prompt/message content pipeline |
| Streaming | StreamBlockStore + StreamParser | stream capture/reconstruction adapter |
| Maturity | binding status/healthScore | typed ladder + escalation gate |

Net: vivim-final becomes the **wiring + surface + governance** layer; cap-store becomes
the **proven action-injection engine**. Neither is reimplemented; the proven parts are
ported, the existing parts are extended.

---

## 5. Implementation plan

Full unit-by-unit plan in `00-PHASE-INDEX.md` + `01-tracker.md`, grouped:

- **Phase 21 — Harness Core**: contracts/types/compiler + fleet-lifecycle adapter
  (grounded in `FleetSupervisor`).
- **Phase 22 — Program Model**: schema (extend `CapabilityProgramRow`), store contract,
  registrar, binding link.
- **Phase 23 — Harness Execution**: executor engine (governor-gated), content-pipeline
  adapter, stream capture/reconstruct, circuit-breaker adapter.
- **Phase 24 — Lifecycle & Confidence**: status ladder, confidence promotion, health
  probe, timeout guard.
- **Phase 25 — Surface & Verification**: unified-capability program handler, recipe
  capability registration (extend `cdp-capability-registrar`), observability streaming,
  full invariant gate.

21 units total. Each unit file follows the canon format:
`Context → Existing Baseline → Interface → Acceptance Criteria → Tests → DevOps Verification`.

---

## Verified (2026-07-14) — implemented against real source

All 21 units are implemented and wired through `src/engines/harness/index.ts`
(`composeHarness` / `seedAndPublish`). Gate results:

- `bun run typecheck` -> **0 errors** repo-wide.
- `bun test tests/unit/harness` -> **11/11 pass**.
- `biome check` on all 19 new/changed harness + store files -> **0 errors**.

Invariants held: Governor Canon (harness only touches CDP via `ChromeGovernor.runHarnessPlan`
-> `CDPProxy`, no `BunCdpClient` import), Store Contracts (engines depend on
`storage/contracts/*`), One Entry Point (`seedAndPublish` publishes each program as a
`UnifiedCapability`). Pre-existing B1/A4 invariant-checker findings are unrelated to v14.
