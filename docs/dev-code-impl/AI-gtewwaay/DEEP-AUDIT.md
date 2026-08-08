# DEEP-AUDIT — AI Gateway Design vs. Full VIVIM Repo

**Purpose:** Verify `CONVERGENCE-PLAN.md` (C1–C5) against the real repo, per area.
Every claim below is evidence-backed with `file:line`; where the plan's premise
differs from repo reality, the delta is flagged as a required plan revision.

**Status:** Audit (no code changed) · **Date:** 2026-08-08
**Scope:** `src/engines/**`, `src/storage/**`, `src/server/**`, `src/executor/**`,
`src/router/**`, `src/config/**`, `src/cli/**`, `src/lib/**`, `src/mcp/**`,
`prisma/schema.prisma`. Design docs read: all 17 contract files + `ARCHITECTURE.md`
+ `CONVERGENCE-PLAN.md` + A1–A5 impact docs.

---

## 0. Verdict at a Glance

| Area | Plan premise | Repo reality | Verdict |
|---|---|---|---|
| C1 adapters | `LocalModelAdapter` + `ApiProviderAdapter` are the provider-execution surface; "no egress outside adapters" | 2 LLM adapters exist **but** a 3rd conversation-history adapter + **~40 non-adapter `fetch(` egress points** span telemetry/sync/update/CDP-control/MCP | **PREMISE HALF-WRONG** — see §1 |
| C2 policy | One `PolicyRule` store, evaluator + hard enforcer | `ExecutionPolicyEngine` + `PolicyStore` live, wired at boot; `evaluate(` is overloaded across engines | **SOUND** — §2 |
| C3 tools | `ToolUseProtocolImpl` is the legacy tool-exec path; re-route its `executeTool` call sites | **`ToolUseProtocolImpl` has ZERO prod call sites.** The real path is `McpClientAdapter.callTool` (6 direct sites) | **PREMISE WRONG** — §3 |
| C4 plugins | One plugin engine to wrap (`plugin-system.ts` + `PluginRegistry`) | **THREE** "plugin/registry" systems; the live one at runtime is a config cache, not an engine; the other two are latent | **PREMISE WRONG** — §4 |
| C5 + bounded coexistence | Registry = `ProviderRegistry`; Supervisor = ChromeGovernor/FleetSupervisor; Routing = `ProviderMuxEngine` | **Three router layers**, a dormant provider registry, a dormant plugin registry, AND a TS-layer process supervisor (`OpenCodeSupervisor`) that DOES spawn | **MULTIPLE GAPS** — §5 |
| Events | Gateway publishes via `CapabilityEventBus` → `EventRecord` | Confirmed — durable outbox substrate exists and is used by opencode + capability layers | **SOUND** — §4.2 |

**Bottom line:** the strangler-fig direction and gate discipline are correct and
verify cleanly. But four plan premises reference surfaces that do not match what the
repo actually runs. The plan must be revised before P0 so convergence phases point at
real code. Details below.

---

## 1. C1 — Adapter convergence

### 1.1 What the plan assumes
`LocalModelAdapter` and `ApiProviderAdapter` become `IProviderAdapter` implementations;
"no new network-egress code exists outside an `IProviderAdapter` impl guarded by
`IPolicyEnforcer`" is a DoA.

### 1.2 Evidence — the two LLM adapters
- `src/engines/api-provider-adapter.ts:17` — `ApiProviderAdapter`, `send(message, model, onToken) → Promise<string>`; 60s timeout; Bearer auth; `parseSseStream` private. **No `providerId`/`manifest` first-class property, no `connect()`/`disconnect()`, no `AIRequest`-typed input, no `AIEvent` streaming** (callback-based, not async-iterator).
- `src/engines/local-model-adapter.ts:32` — `LocalModelAdapter`, `complete(prompt, opts)`, `generate()`, `isAvailable()`, `/api/tags` health probe. Same gaps.
- Importers (structural/type-only, not class-registry-bound):
  - `src/engines/intent-decomposer.ts:92` — `private readonly llm?: LocalModelAdapter` (type-only; injected at construction).
  - `src/engines/autonomous-execution.ts:1284` — comment: `'local' → LocalModelAdapter (offline, always allowed)`.
  - `src/engines/image-gen-bridge.ts:11` — `interface LocalModelAdapter` **re-declared structurally** (not the class).
  - `src/engines/framing/engine.ts:13` — comment only.
- Export: `src/index.ts:345` re-exports `ApiProviderAdapter`.

**Delta 1.1:** C1's "same adapter instance for gateway route and IntentDecomposer" DoA
works only if the gateway *injects* the instance into `IntentDecomposer` at construction
(`intent-decomposer.ts:99` takes `llm?` as a constructor arg) — there is no shared
registry lookup today. The plan's wording ("resolve the same adapter instance") must be
reworded to "inject the same adapter instance into both".

### 1.3 Evidence — a third adapter the plan never mentions
- `src/engines/adapters/chatgpt-adapter.ts` — `ChatGPTHistoryAdapter` implementing
  `ProviderConversationAdapter` (`provider-conversation-adapter.ts:17`). **This is a
  conversation-history/data-portability adapter** (REST `chatgpt.com/backend-api`, cookies
  via CDP `Network.getCookies`), **not** an LLM execution adapter.

**Delta 1.2:** C1 scope must explicitly EXCLUDE conversation-history adapters
(`ProviderConversationAdapter` family). `IProviderAdapter` covers provider *execution*
only. Folding `chatgpt-adapter.ts` in would be a category error. Add this exclusion to the
plan's "What converges / What does not".

### 1.4 Evidence — the real egress surface (critical)
`rg "fetch\(" src` → **43 matches** across ~26 files. Only a handful are LLM adapters:
- LLM execution: `api-provider-adapter.ts:28`, `local-model-adapter.ts:52,71,124,166,184`, `adapters/chatgpt-adapter.ts:155` (data, not execution).
- **Non-adapter egress that C1's DoA would sweep up:**
  - Telemetry/observability: `observability/tracing.ts:117` (OTLP), `engines/otel-sink.ts:103`, `engines/telemetry-audit.ts:68`.
  - Update/network: `engines/update-engine.ts:144,262`, `engines/sync.ts:118`, `lib/tunnel-client/request-handler.ts:125`, `engines/tunnel-client/request-handler.ts:125`, `lib/ledger-client/ledger-client.ts:291`.
  - CDP control-plane (governor canon — not provider egress): `engines/chrome-setup-wizard.ts:192,206,266,336`, `executor/launcher.ts:93`, `executor/fleet-supervisor.ts:337`, `executor/cdp-transport.ts:56`, `server/setup-router.ts:134`.
  - MCP client (tool execution): `engines/mcp-client-adapter.ts:39,101`.
  - Embedding: `engines/embedding-ollama.ts:30`.
  - CLI/remote: `cli/repl.ts:61`, `cli/commands/registry-bridge.ts:120,206`, `cli/commands/automate.ts:17`, `engines/command-parity-capabilities.ts:193`.
  - Airgap probe: `engines/airgap.ts:62` (dns.google) + local endpoints.
  - Server handlers: `server/index.ts:271,782` (`fetch(req, server)` — Bun.serve handlers, not egress).

**Delta 1.3 (CRITICAL):** C1's DoA — "no new network-egress code exists outside an
`IProviderAdapter` impl guarded by `IPolicyEnforcer`" — is unenforceable as written
because **~40 pre-existing egress points already exist outside any adapter** (telemetry,
update, sync, tunnel, CDP control-plane, MCP). The gateway cannot and must not be the
gate on all of these. **Revise the DoA to scope the enforcer to LLM provider-execution
egress only** (the adapter layer), and keep telemetry/CDP/MCP/update egress out of
`IPolicyEnforcer`'s remit. Note this explicitly in the plan + A4.

---

## 2. C2 — Policy convergence

### 2.1 What the plan assumes
Gateway `IPolicyEvaluator` reads the existing `PolicyStore` (no new table); `IPolicyEnforcer`
(hard deny) on top; `ExecutionPolicyEngine` keeps serving the legacy loop; rules carry a
`scope` field.

### 2.2 Evidence
- `src/engines/execution-policy.ts` — `ExecutionPolicyEngine.evaluate()` returns
  `allowed/classification/requiresApproval/reason/matchedRule`; cooldown/window throttle.
- `src/storage/contracts/policy-store.ts` — `createRule/updateRule/getRule/listRules/getRecentOccurrences`.
- `src/storage/impl/policy-store-impl.ts` — Prisma `PolicyRule` (`prisma/schema.prisma:2342`), `requiresApproval`/`isActive` as 0/1 ints.
- `DEFAULT_RULES` — `read_only_safe` (regex `^(get|list|read|query|fetch|search)$`), `navigate_safe`, etc.
- Wiring (verified): `server/bootstrap/phases/capabilities.ts:476` `new ExecutionPolicyEngine(pStore)` + `initialize()` → `ctx.policyEngine`; consumed as typed dep by `autonomous-router.ts`; surfaced in `server/index.ts:119,605`. Also `server/engines-catalog.ts:555`.
- `server/bootstrap/phases/knowledge.ts:247` constructs a *different* `Router` + `ProviderMuxEngine` (see §5).

### 2.3 Overload hazard
`rg "\.evaluate\("` matches dozens of *unrelated* `this.evaluate(` (eviction-manager,
capability.ts, etc.). C2's "one rule edit takes effect in both paths" integration test must
call `ExecutionPolicyEngine.evaluate` + gateway enforcer explicitly — the plan already says
this; **add a note that any naive `evaluate(`-rename refactor will collide with ~20
unrelated methods** (`execution-policy.ts` is not the only `.evaluate`).

### 2.4 Verdict
**SOUND.** One store, additive `scope` column, hard enforcer on top. The `scope` field
must be added to `PolicyRule` (`schema.prisma:2342`) in the A1 additive change set — verify
A1 lists it (it does, per A1 §3 reuse). No plan revision required beyond the scope-field
confirmation and the egress-scoping note from §1.4.

---

## 3. C3 — Tool convergence

### 3.1 What the plan assumes
`ToolUseProtocolImpl` is the legacy tool-execution path; "re-route the legacy `executeTool`
call sites through `IToolOrchestrator.handle()`"; no-bypass gate greps `executeTool\(`.

### 3.2 Evidence — the premise is wrong
- `rg "\.executeTool\(" src` → **ZERO matches** in production code.
- `rg "new ToolUseProtocolImpl" src` → **ZERO matches**. The class is **test-only +
  MCP-server discovery** (`src/mcp/server.ts` `listTools`), never instantiated at runtime.
- `src/engines/tool-use-protocol.ts:49` — the only internal `executeTool` is the class's own
  method delegating to `McpClientAdapter.callTool`.

### 3.3 The real production tool-execution path
`McpClientAdapter.callTool` is the actual executor, called **directly at 6 production sites**:
- `src/engines/live-capability-registry.ts:222` — `this.mcp.callTool(serverId, toolName, input)` (the live execution entry).
- `src/engines/workflow-engine.ts:411` — `this.mcpClient.callTool('llm', { prompt })`.
- `src/engines/workflow-engine.ts:478` — `this.mcpClient.callTool(\`${pluginId}.${method}\`, ...)`.
- `src/engines/selector-healer.ts:295` — `this.mcpClient.callTool('llm_complete', ...)`.
- `src/engines/image-gen-bridge.ts:46` — `deps.providerLLM.callTool('image_generate', ...)`.
- `src/engines/mcp-server-adapter.ts:177,203` — server-side `callTool` handler (inbound).

### 3.4 Required plan revisions (C3)
1. **Pivot the target.** C3 converges `McpClientAdapter.callTool` call sites (6 sites), not
   `ToolUseProtocolImpl.executeTool` (0 sites). `ToolUseProtocolImpl` can still become an
   `IToolExecutor` backend, but it is *not* the legacy path to re-route — the direct
   `McpClientAdapter` callers are.
2. **Fix the no-bypass gate.** Change the DoA grep from `executeTool\(` to
   `\.callTool\(` — the only allowed location becomes inside `IToolOrchestrator.handle()` /
   the `IToolExecutor` backend. As written, the gate passes trivially because the searched
   symbol doesn't exist in prod.
3. **Audit backends exist** (good news):
   - `SandboxAudit` — `storage/contracts/sandbox-audit-store.ts` + `impl/sandbox-audit-store-impl.ts` (Prisma `SandboxAudit`, `schema.prisma:2616`); wired at `stores.ts:67`, `engines-catalog.ts:186`, written by `sandbox-runner.ts:107`. `IToolAuditLog` can extend this.
   - `HitlGate` — `engines/autonomous-types.ts:78` (interface) + `storage/impl/hitl-gate-store-impl.ts` + `createHitlGate/updateHitlGate` (`autonomous-store-impl.ts:97,117`), consumed by `autonomous-execution.ts:616-701,1179-1216` and `workflow-engine.ts:515` (`HitlGateStore`). `IApprovalManager` adapter is grounded.
   - `AgentPermissionDecision` — `storage/contracts/agentic-store.ts:258` `appendAgentPermissionDecision` + `impl/agentic-store-impl.ts:1072` + writer `engines/opencode/opencode-ingest.ts:309`. Grounded.
4. **Bridge subtlety.** Since there are 6 direct `.callTool` callers in 4 distinct engines,
   the transition shim cannot be "a thin `ToolUseProtocolImpl.executeTool` delegating to the
   orchestrator" (that class isn't in the call graph). The shim must be an `McpClientAdapter`
   wrapper or a `callTool`-level facade that the 4 engines inject. Revise §C3 "Bridge".

---

## 4. C4 — Plugin + events convergence

### 4.1 What the plan assumes
One plugin engine (`plugin-system.ts`/`plugin-manager-impl.ts`/`PluginRegistry`) to wrap
with the trust/certify layer; gateway events mirror to `EventRecord`.

### 4.2 Evidence — events substrate: CONFIRMED
- `src/engines/capability-event-bus.ts` — typed in-process pub/sub singleton; line 94 marks
  a legacy event `@deprecated ... Migrate to EventRecord outbox`; lines 171-204: optional
  `setDurableStore(EventRecordStore)` mirrors every emit into the durable outbox.
- `src/engines/event-record-store.ts` — hash-chained outbox; `EventSource =
  'opencode'|'browser_fleet'|'capability'` (line 13); `verifyChain` (line 93). Attached at
  `capabilities.ts:341`; writer `opencode-ingest.ts`.
- **Gateway event source `'ai-gateway'`** slots into the existing union cleanly (A5 §5 plan
  matches). No revision needed.

### 4.3 Evidence — plugin systems: THREE, not one
1. **`src/engines/plugin-system.ts`** (`PluginManagerImpl`) + `plugin-manager-impl.ts`
   (re-export) + `plugin-hot-reload.ts`. Interface `ProviderPlugin` (providerId, onRegister,
   onResolveCapabilities, onAction, onProjectState, onParse + Phase-9 surfaces/mutationHandlers).
   Backed by Prisma `PluginRegistry` (`schema.prisma:2294`).
   → `rg "new PluginManagerImpl" src` = **ZERO**. **Latent engine — not instantiated.**
2. **`src/engines/providers/`** — `ProviderRegistry` (map-based; `registry.ts:9` loads
   `getBuiltinPlugins()`: chatgpt/claude/gemini...) + `ProviderPluginRegistry`
   (`plugin-registry.ts:12`, factory+manifest+healthResults+initOrder) + `abstract-provider-plugin.ts`.
   → `rg "\.initAll\(|\.startAll\(" src` = ZERO matches in engines. **Latent scaffolding.**
3. **`src/config/provider-registry.ts`** (`getProviderRegistry`) — **THIS is the live one.**
   Consumed by `conversation-manager.ts:130`, `provider-selectors.ts:6`,
   `server/setup-router.ts:18,358,425`. It is a **config cache** over the generated protocol
   file (`src/__generated__/provider-protocol.ts`) — not a plugin engine at all.

### 4.4 Required plan revisions (C4)
1. **C4's "wrap the existing plugin engine" targets a latent engine.** `PluginManagerImpl`
   has no production instantiation; wrapping it adds trust semantics to a surface nothing
   runs. **Revise:** (a) decide whether to *activate* `PluginManagerImpl` as the single
   plugin lifecycle first, or (b) land the gateway trust/certify layer against the *live*
   surfaces (`config/provider-registry.ts` is read-only config, so certification would
   attach to the DB `PluginRegistry` + a new activation point). Recommend (a): make
   `PluginManagerImpl` the one installer/loader, then wrap it — otherwise the trust layer
   wraps a dead engine.
2. **Do not confuse the three registries.** The plan's bounded-coexistence "Registry
   namespaces" row references `ProviderRegistry`; the runtime one is
   `config/provider-registry.ts` (a protocol config cache), while `engines/providers/registry.ts`
   is dormant. C4/C5 must name the exact module per namespace.
3. **`ProviderPlugin` interface collision.** `plugin-system.ts` and `providers/plugin.ts`
   both export a `ProviderPlugin` type with different shapes. Any gateway `IPluginManager`
   wrapping "the plugin contract" must specify which one. Flag for A3.

---

## 5. C5 + Bounded Coexistence

### 5.1 Routing: THREE layers, plan names one
- `src/router/router.ts` — `class Router` over `RouterStore` (`RouteSpecRow/RouteRequestRow/
  RouteEventRow/RouteTargetRow`), instantiated at `knowledge.ts:247` and `engines-catalog.ts:532`
  (with a `noopDispatcher` in the catalog path).
- `src/engines/provider-mux.ts` — `ProviderMuxEngine` over `MuxStore` (`MuxStrategy =
  fan_out|round_robin|priority|cost_optimized|learned`, line 72), instantiated at
  `knowledge.ts:248` + `engines-catalog.ts:533`.
- Design `IRouter` (own discovery→policy→score→decide; 10 strategy names).

**Required revision:** the plan's SEAM row says "IRouter vs ProviderMuxEngine" — but a
**third** router (`src/router/router.ts`, `RouterStore`-backed) exists in the middle and is
the one wired at boot. The interop seam must acknowledge all three: design `IRouter` ↔
`ProviderMuxEngine` (conversation mux) ↔ `Router` (spec/route dispatch). Shared telemetry
must cover all three or the one-routing-observability-story claim is false.

### 5.2 Supervisor: the plan's boundary misses a TS-layer process spawner
- Design `IRuntimeSupervisor` (`supervisor.ts`) explicitly "never spawns processes;
  delegates resources" — it is the Rust/Tauri boundary.
- `ChromeGovernor`/`FleetSupervisor` (`executor/fleet-supervisor.ts`) = CDP browser fleet
  (governor canon). Correct per plan.
- **`src/engines/opencode/opencode-supervisor.ts:47` — `OpenCodeSupervisor` DOES spawn a
  subprocess (`Bun.spawn` of `opencode serve`)**. Wired at `capabilities.ts:370-375`. Binds
  127.0.0.1, password-gated, **zero CDP imports** (respects Governor Canon), but it is a
  genuine TS-layer OS-process supervisor. Restarts, readiness polling (90s), restart cap (5).

**Required revision:** the bounded-coexistence "Supervisor" row must add a third boundary —
`OpenCodeSupervisor` (local `opencode serve`, 127.0.0.1, spawns a process) — alongside
Rust/Tauri gateway supervisor and Chrome fleet. The design's `IRuntimeSupervisor` "never
spawns" claim is true for the gateway side, but the repo already has a TS-layer spawner;
C5's duplication report must classify `OpenCodeSupervisor` vs `IRuntimeSupervisor` (not
silently assume they don't overlap).

### 5.3 Registry namespaces
- Live runtime registry = `config/provider-registry.ts` (protocol config cache).
- Dormant: `engines/providers/registry.ts` (builtin plugin registry) + `engines/providers/plugin-registry.ts` (factory registry).
- DB: `ProviderDefinition` (`schema.prisma:39`) / `ProviderModel` (213) — CDP-provider definitions.
- Capability registration surface (one-entry-point): `engines/capability-bootstrap.ts`
  `registerDefaultCapabilities`, `capability-bootstrap-generated.ts`
  `registerGeneratedCapabilities`, `unified-registry.ts` `UnifiedCapabilityRegistry`
  (wired at `capabilities.ts:62-64`, bridged to CLI at 475). NLCL catalog binds patterns →
  capabilityId (e.g. `nlcl/categories/llm.ts:299,319,338`).

**Finding:** the plan's "Gateway providers never enter `ProviderDefinition`" guardrail is
correct but incomplete — the gateway must also stay out of `config/provider-registry.ts`
(the generated-protocol cache) or the gateway/local runtimes get entangled with the CDP
protocol file. Add that to the guardrail.

### 5.4 OpenCode supervisor vs design supervisor (C4/C5 interplay)
`opencode-ingest.ts` writes `AgentPermissionDecision` + `EventRecord` (source 'opencode') —
this is the closest existing analog to the gateway's audit/event flow. The design's
`IExecutionManager`/`IApprovalManager` should reuse the same tables (`AgentPermissionDecision`,
`HitlGate`, `EventRecord`) rather than new ones — A1 already plans reuse; **confirm A1
covers `AgentPermissionDecision` (it does not appear in the A1 table explicitly) and
`HitlGate`** — both are pre-existing approval/audit stores the gateway can drive.

---

## 6. Consolidated Required Revisions (before P0)

| # | Area | Revision |
|---|---|---|
| R-1 | C1 | Scope `IPolicyEnforcer` to LLM provider-execution egress only; explicitly exclude telemetry/CDP/MCP/update/tunnel egress (~40 pre-existing points) from the enforcer's remit. Reword C1 DoA + A4 §2.2 accordingly. |
| R-2 | C1 | Add conversation-history adapters (`ProviderConversationAdapter`, `adapters/chatgpt-adapter.ts`) to "What does NOT converge". |
| R-3 | C1 | Reword "resolve the same adapter instance" → "inject the same adapter instance into `IntentDecomposer` and the gateway route" (it is a constructor dep at `intent-decomposer.ts:99`). |
| R-4 | C3 | Pivot target from `ToolUseProtocolImpl.executeTool` (0 sites) to `McpClientAdapter.callTool` (6 sites in 4 engines). Fix no-bypass gate to grep `\.callTool\(`. Redesign bridge as a callTool-level facade the 4 engines inject. |
| R-5 | C3 | Confirm `SandboxAudit`, `HitlGate`, `AgentPermissionDecision` are the `IToolAuditLog`/`IApprovalManager` backends (they exist and are wired). |
| R-6 | C4 | `PluginManagerImpl` is latent (no prod instantiation). Decide: activate it as the single plugin lifecycle BEFORE wrapping it with trust/certify. Do not wrap a dead engine. |
| R-7 | C4 | Name the exact registry module per namespace (`config/provider-registry.ts` = live config cache; `engines/providers/*` = dormant; DB `ProviderDefinition` = CDP). Resolve `ProviderPlugin` interface name collision (`plugin-system.ts` vs `providers/plugin.ts`). |
| R-8 | C5 | Routing seam must cover THREE layers: `IRouter` ↔ `ProviderMuxEngine` ↔ `src/router/router.ts` `Router`. One routing-observability story requires all three share telemetry. |
| R-9 | C5 | Add `OpenCodeSupervisor` (TS-layer, spawns `opencode serve`) as a third supervisor boundary alongside Rust/Tauri and Chrome fleet. |
| R-10 | C5 | Extend registry guardrail: gateway never enters `config/provider-registry.ts` (generated protocol cache) either. |
| R-11 | A1/A4 | Confirm `AgentPermissionDecision` + `HitlGate` tables are in the additive reuse set (gateway approval/audit drives these, not new tables). |
| R-12 | C2 | Add note: `evaluate(` is overloaded across ~20 unrelated engines; C2 refactors must scope by type, never by method name. |

---

## 7. Evidence Index (verification trail)

| Claim | Evidence |
|---|---|
| `ToolUseProtocolImpl` unused | `rg "new ToolUseProtocolImpl" src` = 0; `rg "\.executeTool\(" src` = 0 |
| Real tool path | `live-capability-registry.ts:222`, `workflow-engine.ts:411,478`, `selector-healer.ts:295`, `image-gen-bridge.ts:46`, `mcp-server-adapter.ts:177,203` |
| Egress breadth | `rg "fetch\(" src` = 43 matches / 26 files (§1.4) |
| Policy live | `capabilities.ts:476`, `engines-catalog.ts:555`, `autonomous-router.ts`, `server/index.ts:119,605` |
| Event outbox | `capability-event-bus.ts:171-204`, `event-record-store.ts:13,93`, `capabilities.ts:341`, `opencode-ingest.ts` |
| Plugin triple | `plugin-system.ts:69`, `providers/registry.ts:9`, `providers/plugin-registry.ts:12`, `config/provider-registry.ts` (live at `conversation-manager.ts:130`, `provider-selectors.ts:6`) |
| Router triple | `router/router.ts:36`, `provider-mux.ts:72,120`, `knowledge.ts:247-248`, `engines-catalog.ts:532-533` |
| OpenCode supervisor spawns | `opencode-supervisor.ts:47` (`Bun.spawn`), wired `capabilities.ts:370-375` |
| Audit/approval backends | `sandbox-audit-store.ts`/`impl`, `schema.prisma:2616`; `autonomous-types.ts:78`; `agentic-store.ts:258`; `workflow-engine.ts:515` |

---

## 8. What Stays Confirmed (no revision needed)

- C1/C2/C3 direction: interface-implementation, one policy store, hard enforcer on top, orchestrator-only execution — all correct.
- C2 policy convergence plan is fully sound against real code.
- C4 events mirror to `EventRecord` matches the existing durable substrate.
- One-entry-point invariant (UnifiedCapabilityRegistry) is real and the C5 capstone target is well-grounded.
- Gate discipline (tsc + invariants + verify-cross-surface + tests) applies cleanly.
- `aiGatewayEnabled` config flag + rollback posture is compatible with all observed call sites (legacy paths never stop using their classes/engines).
