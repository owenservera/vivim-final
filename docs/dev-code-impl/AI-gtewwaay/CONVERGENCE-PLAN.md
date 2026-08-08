# CONVERGENCE-PLAN — AI Gateway ↔ Existing Engines

**Purpose:** Fully design how the AI Gateway (`src/ai/`, net-new) progressively
converges with the existing engines that cover ~70% of the same surface — and how we
get from "two systems in parallel" to "one canonical owner per area" without breaking
the platform, the one-entry-point invariant, or the security boundary.

**Status:** Design (no code changed) · **Date:** 2026-08-08
**Inputs:** A1 DB-IMPACT, A2 ENGINE-CONTRACT-IMPACT, A3 CAPABILITY-INTEGRATION-IMPACT,
A4 SECURITY-IMPACT, A5 RUNTIME-BOOTSTRAP-IMPACT, IMPLEMENTATION-LEDGER,
DEEP-AUDIT (repo-evidence verification of this plan).

> **Audit addendum (2026-08-08):** `DEEP-AUDIT.md` verified every phase below against the
> live repo and found **12 required revisions (R-1..R-12)**. They are folded into this
> plan — the affected rows are marked **[AUDIT]** with the revision id. Sections not marked
> are confirmed sound as written.

---

## 1. Convergence Principles (non-negotiable)

1. **Strangler fig.** The gateway lands alongside existing engines behind a config
   flag; it never requires a legacy engine to change to exist. Convergence proceeds by
   *moving ownership*, one area at a time.
2. **Single canonical owner per area.** At end-state, each capability area has exactly
   one owner. No "two routers forever." Duplication is *scheduled* debt with a dated
   removal, not a permanent state.
3. **No-fork policy.** If a capability already exists (policy store, MCP executor,
   plugin registry, event mirror), the gateway must **reuse or adapt** it — never fork
   a parallel copy of the same logic.
4. **Upgrade, never downgrade.** Where a legacy path is weaker than the gateway
   (e.g., tool execution without authorization), convergence *upgrades the legacy path*
   to the stricter semantics. The gateway's security invariants (A4) never bend to fit
   legacy behavior.
5. **Additive schema only.** No table drop, no column delete until C5 — and only with
   explicit sign-off. Rollback at any phase = flip the config flag / ignore new columns.
6. **Gate after every phase.** `bun run devops verify-cross-surface` +
   `bun run devops invariants check` + `bunx tsc --noEmit` + `bun test` must pass
   before advancing. A phase that fails its Definition of Acceptance does not advance.

---

## 2. Target End-State (North Star)

Per area, the canonical owner after convergence completes:

| Area | Gateway contract | Existing engine today | Converge? | **End-state canonical owner** |
|---|---|---|---|---|
| Provider execution | `IProviderAdapter` | `LocalModelAdapter`, `ApiProviderAdapter` | **YES** | `IProviderAdapter` contract; existing classes are its implementations |
| Routing | `IRouter` | `ProviderMuxEngine` + `MuxStore` | **SEAM** | `IRouter` decision surface; `ProviderMuxEngine` = strategy backend for chat-shaped requests; shared telemetry/persistence |
| Policy | `IPolicyEvaluator`/`IPolicyEnforcer` | `ExecutionPolicyEngine` + `PolicyRule`/`PolicyStore` | **YES** | Shared `PolicyRule` store; gateway adds hard-deny enforcer layer on top |
| Tools | `IToolOrchestrator` (4-stage) | `ToolUseProtocolImpl` + `SandboxAudit` | **YES** | `IToolOrchestrator` is the ONLY execution path; `ToolUseProtocolImpl` = `IToolExecutor` backend |
| Plugins | `IPluginManager` (trust/certify) | `plugin-system.ts`/`plugin-manager-impl.ts`/`PluginRegistry` | **YES** | Gateway trust/certify layer over the existing plugin engine |
| Events | `IEventBus` | `CapabilityEventBus` + `EventRecordStore` | **YES** | One bus; gateway bus publishes via `CapabilityEventBus` → `EventRecord` |
| Registry | `IProviderRegistry`/`IModelRegistry` | `ProviderRegistry`/`ProviderRegistrar` | **BOUNDED COEXISTENCE** | Separate identity namespaces **by design** (gateway/local runtimes vs CDP-provider definitions) |
| Supervisor | `IRuntimeSupervisor` | `ChromeGovernor`/`FleetSupervisor` | **BOUNDED COEXISTENCE** | Separate process boundaries **by design** (Rust/Tauri vs CDP browser fleet) |

**Bounded coexistence is convergence.** The two SEAM/COEXISTENCE rows are *decisions*,
not defaults: they are explicitly carved out so nobody re-opens them casually. Routing
gets an interop seam (one decision surface, two request grammars — the gateway router
may delegate strategy execution to `ProviderMuxEngine` for chat-shaped requests, and
`ProviderMuxEngine` gains a strategy hook; both share telemetry so there is one routing
observability story). Registry and Supervisor stay separate because their identity and
process models are genuinely different.

---

## 3. Phase Overview (Dependency DAG)

```
P0 → P1 → P2 → P3        (landing, already designed — no convergence yet)
                       ↘
                         C1 (adapters) ──→ C2 (policy) ──→ C3 (tools) ──┐
                           │                                              │
                           └──────────────→ C4 (plugins+events) ─────────┤
                                                                          ▼
                                                                         C5 (surface consolidation + convergence review)
```

- **P0–P3** = the audit-approved landing plan (P0 layout/mechanical, P1 in-memory
  impls + `AIExecutionStore`, P2 capability surface live, P3 first adapter +
  persistence). Convergence does NOT start until P3 ships — the gateway must first be
  real and user-visible so convergence has a target worth converging to.
- **C1–C5** = the convergence phases designed here.
- C1 must precede C2 (policy gates run inside adapters). C2 must precede C3 (tool
  execution is policy-gated). C4 is parallel to C2/C3 (events + plugins are
  orthogonal). C5 is the capstone and cannot run before C3+C4.

---

## 4. Phase Detail

### C1 — Adapter convergence (`IProviderAdapter` becomes canonical)

**Objective:** One provider-execution contract. The gateway never owns its own LLM
HTTP client.

**Who wins:** `IProviderAdapter`. Existing `LocalModelAdapter` and `ApiProviderAdapter`
become its implementations.

**Move:**
- Add `implements IProviderAdapter` to `LocalModelAdapter` / `ApiProviderAdapter`
  (interface-implementation, not a rewrite — internal logic untouched).
- Register both instances in the gateway `IProviderRegistry` at P3 hand-off, so
  `IRouter`-selected adapters ARE the same objects the legacy loop uses.

**Bridge:** `IProviderAdapter` is the seam; no duplicate adapter class ever exists.

**Delete:** nothing (this phase adds a contract, removes nothing).

**[AUDIT R-1] Egress scope (DEEP-AUDIT §1.4):** the original DoA "no new network-egress
code outside an `IProviderAdapter` impl guarded by `IPolicyEnforcer`" is unenforceable as
written — the repo has ~40 pre-existing non-adapter `fetch(` egress points across
telemetry/observability (`otel-sink.ts:103`, `tracing.ts:117`), update/sync/tunnel
(`update-engine.ts:144`, `sync.ts:118`, `tunnel-client/request-handler.ts:125`), CDP
control-plane (`chrome-setup-wizard.ts`, `executor/cdp-transport.ts:56`), MCP
(`mcp-client-adapter.ts`), embedding, and CLI. **`IPolicyEnforcer` scopes to LLM
provider-execution egress ONLY** (the adapter layer). Telemetry/CDP/MCP/update egress stays
out of its remit. A4 §2.2 is amended to match.

**[AUDIT R-2] Exclude conversation-history adapters (DEEP-AUDIT §1.3):** a third adapter
class exists — `src/engines/adapters/chatgpt-adapter.ts` implements
`ProviderConversationAdapter` (`provider-conversation-adapter.ts:17`); it is a
data-portability adapter (REST + CDP cookies), **not** LLM execution. It does NOT converge
under `IProviderAdapter`. Added to §5 "What does NOT converge".

**[AUDIT R-3] Instance identity mechanism (DEEP-AUDIT §1.2):** `IntentDecomposer` takes
`llm?` as a **constructor dependency** (`intent-decomposer.ts:92,99`) — there is no shared
registry lookup. DoA reworded: "a gateway route and `IntentDecomposer` are injected with the
**same** adapter instance (constructor-injection identity, asserted by a unit test)."

**Definition of Acceptance:**
- `LocalModelAdapter` and `ApiProviderAdapter` satisfy `IProviderAdapter` under
  `bunx tsc --noEmit`.
- A gateway route and `IntentDecomposer` both resolve the **same** adapter instance
  for the same provider/model — verified by a unit test asserting instance identity
  (via constructor injection, [AUDIT R-3]).
- No new network-egress code exists outside an `IProviderAdapter` impl **scoped to LLM
  provider-execution** guarded by `IPolicyEnforcer` ([AUDIT R-1]).

**Rollback:** gateway config off → legacy call sites unaffected (they never stopped
using the classes).

**Risk:** interface churn on adapters. Mitigation: contract is interface-only; tsc is
the gate; existing call sites untouched.

---

### C2 — Policy convergence (one policy store; evaluator + hard enforcer)

**Objective:** One policy data model, two decision layers with different guarantees.

**Who wins:** `PolicyRule` storage (existing) + the gateway's hard-deny semantics.

**Move:**
- Gateway `IPolicyEvaluator` implementation reads rules from the existing `PolicyStore`
  (the `ExecutionPolicyEngine` store impl) — **no separate policy table** (A1: reuse).
- Gateway `IPolicyEnforcer` (hard deny at egress, A4 §2.2) runs **on top** of the same
  rules.
- `ExecutionPolicyEngine` continues serving the legacy execution loop unchanged
  (advisory + throttle).

**Bridge:** an evaluator adapter over `PolicyStore`; one rule edit takes effect in both
paths (verified).

**Delete:** nothing.

**Definition of Acceptance:**
- A single `PolicyRule` row change is honored by BOTH the legacy loop and the gateway
  enforcer (integration test).
- `enforceNetworkPolicy`/`enforcePersistencePolicy`/`enforceTelemetryPolicy` deny →
  abort (unit tests).
- Legacy `execution-policy` test suite still green (no behavior regression).

**Rollback:** gateway flag off; legacy loop untouched.

**[AUDIT R-12] `.evaluate(` overload hazard (DEEP-AUDIT §2.3):** `evaluate(` is a common
method name — `rg "\.evaluate\("` matches ~20 unrelated engines (eviction-manager,
capability.ts, etc.). All C2 refactors and tests must scope by type
(`ExecutionPolicyEngine` / gateway enforcer), never by method-name grep. The integration
test calls both entry points explicitly.

**Risk:** a rule meant for one path leaking to the other. Mitigation: rules carry a
`scope` field (`legacy|gateway|both`, default `both`) — additive column, A1 allows.

---

### C3 — Tool convergence (one execution path, upgraded)

**Objective:** `IToolOrchestrator` becomes the **only** way tools execute. Legacy MCP
execution is upgraded to the strict pipeline, not the gateway downgraded to it.

**Who wins:** `IToolOrchestrator` (4-stage authorize → approve → execute → audit).
`ToolUseProtocolImpl` becomes an `IToolExecutor` backend.

**[AUDIT R-4] Real execution path (DEEP-AUDIT §3):** the plan originally targeted
`ToolUseProtocolImpl.executeTool` call sites — **there are ZERO** (`rg "new ToolUseProtocolImpl" src`
= 0; `rg "\.executeTool\(" src` = 0; it is test-only + MCP-server discovery). The real
production tool-execution path is **`McpClientAdapter.callTool`** at **6 sites across 4
engines**: `live-capability-registry.ts:222` (live execution entry),
`workflow-engine.ts:411` (`llm`), `workflow-engine.ts:478` (`${pluginId}.${method}`),
`selector-healer.ts:295` (`llm_complete`), `image-gen-bridge.ts:46` (`image_generate`),
`mcp-server-adapter.ts:177,203` (inbound). C3 converges **those** call sites.

**Move:**
- Implement `IToolExecutor` over the existing MCP client (`ToolUseProtocolImpl` logic —
  it remains a valid backend, but it is NOT the legacy path to re-route).
- Implement `IToolAuthorizer` (per-tool allowlist + `ApprovalMode`),
  `IApprovalManager` (adapter over `HitlGate`/`AgentPermissionDecision` for the
  user-approval round trip), `IToolAuditLog` (persists to extended `SandboxAudit`).
- Re-route the legacy `callTool` call sites through `IToolOrchestrator.handle()`.

**[AUDIT R-4b] Bridge redesign:** with no `ToolUseProtocolImpl` in the call graph, the
transition shim cannot be "a thin `ToolUseProtocolImpl.executeTool`". It must be a
**`callTool`-level facade** (e.g. an `IToolExecutor`-backed wrapper around
`McpClientAdapter`) that the 4 engines inject in place of their direct `this.mcpClient` /
`this.mcp` dependency. Legacy callers keep working through the facade in the same commit.

**[AUDIT R-5] Approval/audit backends confirmed (DEEP-AUDIT §3.4):** all three target
stores exist and are wired today: `SandboxAudit` (`sandbox-audit-store.ts` + impl,
`schema.prisma:2616`, written by `sandbox-runner.ts:107`); `HitlGate`
(`autonomous-types.ts:78`, `hitl-gate-store-impl.ts`, `autonomous-store-impl.ts:97,117`);
`AgentPermissionDecision` (`agentic-store.ts:258`, `agentic-store-impl.ts:1072`,
writer `opencode-ingest.ts:309`). No new approval/audit tables.

**Bridge:** for the transition window, the `callTool` facade delegates to the orchestrator,
so legacy callers don't break in the same commit.

**Delete:** the direct-execute path (after all call sites are migrated).

**Definition of Acceptance:**
- **No-bypass gate:** `rg "\.callTool\("` finds calls only inside `IToolOrchestrator.handle()`
  or the `IToolExecutor` backend ([AUDIT R-4] — the original `executeTool\(` gate was a
  false pass, that symbol doesn't exist in prod).
- Unit: authorizer-denies ⇒ executor never invoked; `always-ask` blocked without
  approval; `always-deny` blocks unconditionally.
- Legacy callers (via the `callTool` facade) behave identically for allowed tools.
- `SandboxAudit` extended columns populated on every executed tool.

**Rollback:** keep shim path active; gateway flag off.

**Risk:** orchestrator becomes a latency choke point. Mitigation: approval caching for
`automatic` mode, synchronous path for already-approved tools; latency gate in DoA.

---

### C4 — Plugin + events convergence (trust layer over existing engine)

**Objective:** One plugin lifecycle + one event stream. Gateway adds the trust/certify
layer the platform lacks (A4 §2.3) on top of the existing plugin engine, and mirrors
its events onto the existing durable stream.

**Who wins:** Gateway trust model (`IPluginManager` verify/certify) + existing
`PluginRegistry`/`plugin-system.ts` for lifecycle/storage.

**[AUDIT R-6] Activate before wrapping (DEEP-AUDIT §4.3):** `PluginManagerImpl`
(`plugin-system.ts:69`) has **zero production instantiations** (`rg "new PluginManagerImpl" src`
= 0); `ProviderPluginRegistry`/`ProviderRegistry` (`engines/providers/*`) are also latent
(`rg "\.initAll\(|\.startAll\("` = 0 in engines). The live registry at runtime is
`config/provider-registry.ts` — a **read-only config cache** over the generated protocol
file, not a plugin engine. **C4 step 0: make `PluginManagerImpl` the ONE installer/loader
and activate it at boot** (register the legacy lifecycle), THEN wrap it with the gateway
trust layer. Wrapping a dead engine adds trust semantics to a surface nothing runs.

**[AUDIT R-7] Name the exact registry (DEEP-AUDIT §4.4):** three modules named
"registry" exist with different roles — (1) `config/provider-registry.ts` = live protocol
config cache; (2) `engines/providers/registry.ts` + `providers/plugin-registry.ts` =
dormant provider-plugin scaffolding; (3) DB `ProviderDefinition` (`schema.prisma:39`) /
`ProviderModel` (213) = CDP-provider definitions. Also, `ProviderPlugin` is **two different
interfaces** (`plugin-system.ts` vs `providers/plugin.ts`). C4/C5 must cite the exact
module per namespace; A3 notes the interface collision.

**Move:**
- `IPluginManager` wraps `plugin-system.ts` for load/hook registration; adds
  integrity/signature verify before anything writes to disk, and `certify()` re-running
  the compliance suite. DB home = extended `PluginRegistry` (A1 §3.10).
- Gateway `IEventBus` publishes through `CapabilityEventBus` → `EventRecord`
  (`source='ai-gateway'`) per A5 §5 — same outbox pattern, no new transport.
  **[AUDIT — confirmed]** the substrate is real: `capability-event-bus.ts:171-204`
  (durable mirror) + `event-record-store.ts` (source union `opencode|browser_fleet|
  capability`, line 13) + attach at `capabilities.ts:341`.

**Bridge:** the existing `ProviderPlugin` interface stays the plugin contract; gateway
adds a wrapper.

**Delete:** nothing (additive layering).

**Definition of Acceptance:**
- A plugin installed via the gateway path lands in `PluginRegistry` with integrity hash
  (A1 columns).
- `certify()` failure surfaces `PLUGIN_UNTRUSTED` and blocks activation.
- Gateway execution events appear in `EventRecord` (queryable), and WS consumers see
  them via the existing channel.

**Rollback:** stop publishing; plugin engine unaffected.

**Risk:** double lifecycle management (legacy + gateway). Mitigation: gateway path is
the *only* installer; legacy loader reads from the same `PluginRegistry` — no second
source of truth.

---

### C5 — Surface consolidation + convergence review

**Objective:** Prove there is no residual duplication and retire everything that
convergence made obsolete.

**Who wins:** the one-entry-point invariant (A3). Both systems are already
UnifiedCapabilities; C5 removes any path that bypassed that.

**Move:**
- Retire the C3 transition facade (all call sites direct through orchestrator).
- Retire legacy duplication surfaced by a duplication report: any engine branch that
  re-implements behavior now owned by the gateway (e.g., a hand-rolled egress, a
  second policy table) is deleted.
- Remove the "parallel" scaffolding that is no longer reachable.

**[AUDIT R-8] Three routing layers (DEEP-AUDIT §5.1):** the duplication report and the
C1/C2 seam must cover THREE layers, not two: design `IRouter` ↔ `ProviderMuxEngine`
(`provider-mux.ts:72,120`, `MuxStrategy = fan_out|round_robin|priority|cost_optimized|
learned`) ↔ **`src/router/router.ts` `Router`** (RouterStore-backed: `RouteSpecRow`/
`RouteRequestRow`/`RouteEventRow`/`RouteTargetRow`), which is the one wired at boot
(`knowledge.ts:247`, `engines-catalog.ts:532`). One routing-observability story requires
all three share telemetry.

**[AUDIT R-11] Reuse `AgentPermissionDecision` + `HitlGate`:** C5's consolidation review
must confirm the gateway approval/audit drives the existing tables
(`AgentPermissionDecision` — `agentic-store.ts:258`; `HitlGate` — `autonomous-types.ts:78`),
not parallel copies. A1's additive reuse set is amended to list both explicitly.

**Delete:** the migration shims + confirmed-dead branches. Schema cleanup (if any)
only after sign-off.

**Definition of Acceptance:**
- **Duplication report** (generated artifact): each capability area maps to exactly one
  owner (the C2 table, now true in code, not just on paper). The report covers adapters,
  policy, tools, plugins, events, **routing (all 3 layers)**, and **supervisors (all 3
  boundaries)** per [AUDIT R-8]/[AUDIT R-9].
- `verify-cross-surface` full pass + `invariants check` clean + full `bun test`.
- Zero direct `callTool` outside the orchestrator (no-bypass gate re-run, [AUDIT R-4]).
- `aiGatewayEnabled` default flips to **on** (converged state is the only state).

**Rollback:** not applicable at end-state; the config flag remains as an emergency
circuit breaker only.

**Risk:** C5 never gets scheduled. Mitigation: this plan fixes a **date** for C5's
duplication report in the phase log; CEO gate on the report before any new work.

---

## 5. What Explicitly Does NOT Converge (bounded coexistence — decisions, not gaps)

| Area | Why it stays separate | Guardrail |
|---|---|---|
| Registry namespaces | Gateway/local runtimes (ollama, llama.cpp) are not CDP-provider definitions; different identity, auth, lifecycle | Gateway providers never enter `ProviderDefinition`/`ProviderManifest` tables (A1 §3.1). No cross-write. **[AUDIT R-10]** ALSO never enter `config/provider-registry.ts` (the generated-protocol config cache) — it is the CDP protocol surface, not a provider registry for local runtimes. |
| Supervisor | Gateway process boundary is Rust/Tauri (crash isolation); `ChromeGovernor` is CDP browser fleet | `IRuntimeSupervisor` never touches CDP; Governor Canon intact (A4 §3). **[AUDIT R-9]** There is a **third** supervisor boundary: `OpenCodeSupervisor` (`opencode-supervisor.ts:47`) — a TS-layer `Bun.spawn` of local `opencode serve` (127.0.0.1, password-gated, zero CDP imports). The C5 duplication report classifies it vs `IRuntimeSupervisor`; it does NOT converge into the gateway supervisor (different boundary: local process vs Rust/Tauri). |
| Routing | `IRouter` (per-execution attempts) vs `ProviderMuxEngine` (conversation mux + MuxStore) are different request grammars | Interop seam + shared telemetry (C1/C2 table). **[AUDIT R-8]** includes `src/router/router.ts` `Router` (RouterStore spec dispatch) — three layers share the seam + telemetry. Re-visited at C5 review, but not forced. |
| Conversation adapters | `ProviderConversationAdapter` (`provider-conversation-adapter.ts:17`) is data portability (REST + CDP cookies), not provider execution | **[AUDIT R-2]** `IProviderAdapter` covers execution only; conversation-history adapters (e.g. `adapters/chatgpt-adapter.ts`) never implement it. |

These three rows are re-affirmed at every phase gate, so nobody "helpfully" merges them.

---

## 6. Gate Discipline (applies to every phase)

1. `bunx tsc --noEmit` clean (src/ai + affected engines).
2. `bun run devops invariants check` — no new violations (esp. Governor Canon, Store
   Contracts, One Entry Point).
3. `bun run devops verify-cross-surface` — every capability resolves CLI/API/MCP/UI.
4. Targeted tests (`bun test tests/unit/ai/ ...` + affected legacy suites) green.
5. Phase's Definition of Acceptance checked explicitly, recorded in the ledger.
6. `aiGatewayEnabled` config gate respected through C4; flipped on only at C5.

---

## 7. Risk Register

| # | Risk | Phase | Mitigation |
|---|---|---|---|
| R1 | Two routers drift / divergence | C1–C5 | Seam contract + shared telemetry; C5 report re-check; never force-merge |
| R2 | Sharing `PolicyRule` store changes legacy behavior | C2 | `scope` field, additive columns, legacy test suite as regression gate |
| R3 | Tool orchestrator latency choke point | C3 | Approval caching + sync path; latency DoA |
| R4 | Adapter contract churn breaks legacy call sites | C1 | Interface-implementation only; tsc gate; no internal rewrite |
| R5 | Convergence never scheduled (parallel-forever) | all | Fixed C5 date + CEO gate on duplication report |
| R6 | Security downgrade to match legacy during C3 | C3 | "Upgrade, never downgrade" principle; no-bypass grep gate (now `callTool`, [AUDIT R-4]) |
| R7 | Convergence targets the wrong surface (latent/dead engines) | all | [AUDIT] DEEP-AUDIT §6 R-4/R-6: verify the convergence target is production-instantiated before phase work; activation-first for plugins |
| R8 | Third router / third supervisor drift unmanaged | C5 | [AUDIT R-8]/[AUDIT R-9]: all 3 routing layers + all 3 supervisor boundaries in the duplication report |

---

## 8. Impact on the Immediate Sequence

- This plan is **part of the commit bundle** with the pristine spec + A1–A5 + ledger +
  `DEEP-AUDIT.md`, so the CEO-approved strategy is locked before P0. It does not change
  P0–P3's mechanical plan (P0 stays layout + `.js`-suffix only).
- `DEEP-AUDIT.md` (same bundle) is the repo-evidence verification of this plan; its 12
  revisions (R-1..R-12) are folded into the sections above (marked **[AUDIT]**). The
  revisions do not change P0–P3 — they change what C1–C5 *target* once convergence begins.
- New ledger entry: `CONVERGENCE-PLAN.md` + `DEEP-AUDIT.md` →
  `docs/dev-code-impl/AI-gtewwaay/` (docs stay with the spec; not copied into `src/ai/`).
- C1 is the first convergence phase and depends on P3 (first real adapter + persistence)
  having shipped.
