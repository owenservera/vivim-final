# VIVIM AI Gateway — Architecture Baseline v1.1

**Status:** Locked contract layer, verified with `tsc --strict` (zero errors).
**Supersedes:** the three-document thread (PRD → interface draft → critique) that preceded this.

---

## 1. Audit of the prior three documents

**Doc 1 (PRD)** got the thesis right: treat the AI Gateway as a protocol
boundary, not an LLM wrapper. `Provider → Runtime → Model → Capability →
Task` is a real and useful decomposition, and the 15 invariants at the end
are worth keeping almost verbatim. Its weakness is that it's a vision
document, not a buildable one — 114 sections of principle with one code
file (`types.ts`), which was solid but included a design mistake it didn't
know it was making yet (see below).

**Doc 2** turned the vision into interfaces fast, which was the right
instinct, but shipped a real coupling bug: `IProviderAdapter extends
AIProvider`. That silently welds "how a provider is discovered/translated"
to "how a request executes," so a provider that only wants to plug into
translation ends up dragging along a second execution contract it didn't
ask for. It also left routing, policy, and the registry as flat CRUD/scoring
shapes with no ownership boundary for *where candidates come from* or *who
has enforcement authority vs. advisory input*.

**Doc 3** correctly diagnosed all of that — the `extends` problem, the
missing execution/job model, routing owning discovery instead of receiving
a pre-built list, policy needing evaluation/enforcement split, registries
needing a lifecycle state machine, resource management needing to
generalize past "memory," and tools needing a four-stage pipeline instead
of one authorizer. What doc 3 didn't do is finish any of it: `events/bus.ts`
was left as an empty line in a file table, the "fixed" adapter contract was
sketched but not reconciled with `core/types.ts` (which still had its own
competing `AIProvider` contract at the bottom), and no file actually
existed for the plugin manager the PRD spent five sections on.

**What this package does:** takes doc 3's diagnosis as correct, finishes
every fix it identified, resolves the leftover conflict between
`core/types.ts` and the adapter layer, and adds the two structural pieces
nothing had yet — a real event bus and a real plugin manager contract.

---

## 2. What changed from doc 3, specifically

| Issue | Doc 3's diagnosis | What this package does |
|---|---|---|
| `extends AIProvider` coupling | Flagged, not resolved | Removed `AIProvider` from `core/types.ts` entirely. `IProviderAdapter` is now the **only** execution contract. `core/types.ts` is data-only — no behavioral interfaces at all. |
| Execution as first-class | Proposed `AIExecution`/`IExecutionManager` | Kept, plus an explicit `EXECUTION_TRANSITIONS` state machine so implementers validate transitions instead of hand-rolling them, and an `attempt` counter for provider-fallback tracking. |
| Router owning discovery | Proposed `route(request)` with no args shape | Defined `RoutingDependencies` (registries + policy evaluator + resource monitor) passed explicitly, plus an `explain()` method for UI route-preview and a pluggable `IRoutingStrategy` seam. |
| Policy evaluation vs. enforcement | Proposed the split, no shapes | `IPolicyEvaluator` (advisory, scoring) and `IPolicyEnforcer` (hard gate, used at actual network egress / tool execution / telemetry export) are now distinct interfaces with distinct return types — a scoring function *cannot* accidentally be used as a security gate; it doesn't return a boolean gate decision. |
| Registry lifecycle | Proposed `setState`/`getState` | Added `PROVIDER_TRANSITIONS`, mirroring the execution state machine, so `stopProvider` can't skip `draining`. |
| Resource abstraction | Proposed generalizing past memory | `ResourceKind` union (`ram-mb`, `vram-mb`, `cpu-cores`, `disk-bytes`, `gpu-device`, `concurrent-slot`) with one `acquire`/`release` pair instead of one method per resource type. Split into `IResourceManager` (leasing authority, lives on the Supervisor) and `IResourceMonitor` (read-only, given to the Router). |
| Tool subsystem | Proposed Authorizer/Approval/Executor/Sandbox/Audit | Built as four explicit stages (`IToolAuthorizer` → `IApprovalManager` → `IToolExecutor` → `IToolAuditLog`) composed by `IToolOrchestrator.handle()`, so a prompt-injected tool call has to clear four independently testable gates, not one function. |
| Event bus | Named, not built | `events/bus.ts` now exists: `GatewayEvent = ExecutionEvent \| ProviderLifecycleEvent \| ResourceEvent \| AuditEvent`, with a bounded-buffer note tied to the PRD's SLO table. |
| Plugin manager | Referenced PRD §38–43, no file | `plugins/manager.ts` added: discover → validate/verify → install → enable/disable → certify, keeping "signed" (publisher identity + integrity) explicitly distinct from "safe" per the PRD's own trust-model section. |

---

## 3. Locked architecture

```
                         VIVIM CORE (UI / Canvas / Automation / Agents)
                                        │
                              imports ONLY src/ai/index.ts
                                        ▼
                              ┌───────────────────┐
                              │   IVIVIMGateway    │  ← public API (data plane + control plane + events)
                              └─────────┬──────────┘
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 ▼                      ▼                      ▼
       IExecutionManager           IRouter                 IEventBus
       (concurrency, retry,   (discover→score→decide,   (execution + lifecycle +
        cancellation, drain)   via RoutingDependencies)   resource + audit events)
                 │                      │
                 │            ┌─────────┴─────────┐
                 │            ▼                   ▼
                 │    IPolicyEvaluator    IProviderRegistry / IModelRegistry
                 │      (advisory)         (lifecycle state machine)
                 ▼
       IProviderAdapter  ←── the ONLY provider execution contract
                 │
                 ▼
       IRuntimeSupervisor (Rust/Tauri) ── IResourceManager (leases)
                 │
                 ▼
         OS process (llama.cpp / Ollama / LM Studio / simulator / remote)

  Alongside, not underneath, the Gateway:
       IToolOrchestrator (authorize → approve → execute → audit)
       IPluginManager    (install/verify/enable providers as packages)
```

**Dependency direction is one-way and enforced by file structure, not
convention alone:** `core/` has zero imports from anywhere else in `ai/`.
`protocol/`, `execution/`, `policy/`, `registry/`, `runtime/`, `routing/`,
`tools/`, `plugins/`, `events/` each import from `core/` and, where noted
above, from one sibling layer — never from `gateway/`. `gateway/` is the
only file permitted to know about all of them. `index.ts` is the only file
VIVIM Core is permitted to import.

---

## 4. Non-negotiable invariants (condensed from the PRD's 15)

1. VIVIM Core never imports a provider SDK, or anything outside `src/ai/index.ts`.
2. `core/types.ts` stays data-only. Behavior contracts live in their own layer files.
3. There is exactly one provider execution contract: `IProviderAdapter`.
4. AI output is untrusted data until `IToolOrchestrator` clears it — no direct-execute path exists.
5. A provider crash cannot crash VIVIM (enforced at the Supervisor/process boundary, not in-process).
6. Network egress is always an `IPolicyEnforcer` decision, never inferred silently.
7. Streaming and cancellation are primitives (`AsyncIterable<AIEvent>` + `AbortSignal`), not features bolted onto a final-string API.
8. Every state machine (`ExecutionState`, `ProviderState`) has an explicit legal-transition table; nothing skips `draining`.
9. Providers, models, and inference engines are all independently swappable at runtime with zero VIVIM Core changes — this is the actual product, not a side effect.
10. Telemetry defaults to local-only and metadata-only; exporting prompts/output requires an explicit `IPolicyEnforcer` allow.

---

## 5. File manifest

```
src/ai/
  core/
    types.ts          canonical IR — requests, events, errors, descriptors (data only)
    errors.ts          VivimAIError + AI_ERRORS factory + isSafeToRetry
    invariants.ts       cheap runtime guards at process boundaries
  execution/
    types.ts            AIExecution, ExecutionState + transition table, ExecutionEvent
    manager.ts            IExecutionManager — concurrency, retry, drain, cancellation
  protocol/
    adapter.ts             IProviderAdapter — the sole provider execution contract
  routing/
    router.ts               IRouter — owns discovery + scoring + decision
  policy/
    policy.ts                IPolicyEvaluator (advisory) / IPolicyEnforcer (hard gate)
  registry/
    registry.ts               IProviderRegistry / IModelRegistry + lifecycle state machine
  runtime/
    resources.ts               ResourceKind lease abstraction (RAM/VRAM/CPU/disk/GPU/slots)
    supervisor.ts                IRuntimeSupervisor — Tauri/Rust process boundary
  tools/
    orchestrator.ts                Authorize → Approve → Execute → Audit pipeline
  plugins/
    manager.ts                      Install/verify/enable providers as signed packages
  events/
    bus.ts                           GatewayEvent union + IEventBus
  gateway/
    gateway.ts                        IVIVIMGateway — the ONE public entry point
  index.ts                              Public surface barrel
```

---

## 6. Build order

Same instinct as both prior docs (contracts → simulator → first real
adapter → second adapter to prove neutrality), with the execution/event
layers pulled forward since routing and the gateway both depend on their
shapes:

| Step | Deliverable | Depends on |
|---|---|---|
| M0 | This contract layer (done) | — |
| M1 | `SimulatorAdapter` implementing `IProviderAdapter` — fake streaming, tool calls, injectable failures/latency | `protocol/adapter.ts` |
| M2 | In-memory `IEventBus`, `IExecutionManager`, `IProviderRegistry`/`IModelRegistry` | M0 |
| M3 | Default `IRouter` + a trivial `IPolicyEvaluator`/`IPolicyEnforcer` (`local-only` deny-by-default) | M2 |
| M4 | `IVIVIMGateway` implementation wiring M1–M3 behind `execute()`/`createExecution()` | M1–M3 |
| M5 | Rust `IRuntimeSupervisor` + real `llama.cpp` adapter | M4 |
| M6 | `Ollama` adapter — proves the abstraction is genuinely provider-neutral | M5 |
| M7 | `IToolOrchestrator` + `IPluginManager` real implementations, provider certification suite | M4 |

Do not implement `llama.cpp`/`Ollama` before M1–M4 pass integration tests
against the simulator. That ordering is what actually validates the
abstraction — if the Gateway only ever ran against one real engine, you
wouldn't know which parts of `IProviderAdapter` are genuinely
provider-neutral versus quietly llama.cpp-shaped.

---

## 7. Prompt for your local coding agent

> I'm implementing the VIVIM AI Gateway. The contract layer in `src/ai/`
> is finished and type-checks under `tsc --strict` — treat every file in
> `core/`, `execution/`, `protocol/`, `routing/`, `policy/`, `registry/`,
> `runtime/`, `tools/`, `plugins/`, `events/`, and `gateway/` as frozen
> interface, not a draft to redesign.
>
> Build in this order, stopping for review after each step:
> 1. `SimulatorAdapter` implementing `IProviderAdapter` from `protocol/adapter.ts` — yield fake `AIEvent` streams (text deltas, tool calls) with configurable artificial delay, and support injectable failure modes (timeout, crash, cancellation) so we can test the Gateway without a GPU.
> 2. In-memory implementations of `IEventBus`, `IExecutionManager`, `IProviderRegistry`, `IModelRegistry` — no persistence yet, just correct state-machine behavior per `EXECUTION_TRANSITIONS` and `PROVIDER_TRANSITIONS`.
> 3. A default `IRouter` implementation plus a minimal `IPolicyEvaluator`/`IPolicyEnforcer` pair that defaults every policy to `local-only`/`network: deny` unless a request explicitly overrides it.
> 4. `IVIVIMGateway` wiring the above together.
>
> Rules while doing this:
> - Never let a provider-native exception cross an adapter boundary — catch it and re-throw via `AI_ERRORS` from `core/errors.ts`.
> - Every async operation takes and respects an `AbortSignal`.
> - Do not add methods to `IVIVIMGateway`, `IProviderAdapter`, or `core/types.ts` without flagging it — those are the frozen boundary.
> - Do not implement `llama.cpp` or `Ollama` adapters until the simulator-backed integration tests pass.
