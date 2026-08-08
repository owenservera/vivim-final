# Impact Assessment A4 — Security / Trust Boundary

**Assessment point 4 of 5 (DB → Engine → Capability → A4).** Scope: how the gateway's
security surfaces — `IToolOrchestrator` 4-stage pipeline, `IPolicyEnforcer` hard
gates, plugin trust model, telemetry default-deny — land against the repo's existing
security machinery.

**Date:** 2026-08-08 · **Status:** Assessment (no code changed)

---

## 1. Executive Summary

The gateway's security posture is **stricter than what exists today**, and that's a
feature, not a duplicate:

- Repo has advisory/throttle policy (`ExecutionPolicyEngine`) + sandbox audit
  (`SandboxAudit`) + HITL gates (`HitlGate`/`AgentPermissionDecision`) + MCP tool
  execution (`ToolUseProtocolImpl`). What it does **not** have is a **hard
  deny-at-egress enforcer** or a **4-stage authorize→approve→execute→audit** pipeline
  with no bypass path.
- The gateway's `IPolicyEnforcer` (deny aborts, not scoring) and `IToolOrchestrator`
  (model output = untrusted until authorized; four independent gates) are **net-new
  security boundaries** — the core value of this design and the highest-risk to get
  wrong.
- No existing capability bypasses execution in a way that conflicts; the gateway
  adds new gates, it doesn't weaken existing ones.

---

## 2. Surface-by-Surface Security Map

### 2.1 `IToolOrchestrator` (authorize → approve → execute → audit)
- **Invariant 4 (design):** model output is untrusted data until the orchestrator
  clears it. No direct-execute path exists.
- **Existing:** `ToolUseProtocolImpl.executeTool` (tool-use-protocol.ts:43) executes
  MCP tools **directly** — there is no authorize/approve stage. `SandboxAudit`
  (schema:2616) records handler outcomes post-hoc; `McpToolCall` records individual
  calls.
- **Gap to close:** the gateway must never call `IToolExecutor` before
  `IToolAuthorizer` + `IApprovalManager` pass — the design's `IToolOrchestrator.handle()`
  is the composition root that makes bypass a type error, not a discipline rule.
- **Landing:** NEW `src/ai/tools/` impls (M7 per ARCHITECTURE.md). The existing MCP
  executor becomes a candidate `IToolExecutor` backend; `SandboxAudit` (extended per
  A1 §4.4) becomes the `IToolAuditLog` persistence. `HitlGate`/`AgentPermissionDecision`
  can back `IApprovalManager` for the user-approval round trip — but the gateway's
  `ApprovalMode` (`automatic|conditional|always-ask|always-deny`) is a finer-grained
  per-tool policy that the existing HITL tables don't express; wire it as a new
  adapter, don't retrofit the tables.

### 2.2 `IPolicyEnforcer` (hard gates) vs `IPolicyEvaluator` (advisory)
- **Invariant 6:** network egress is always an `IPolicyEnforcer` decision, never
  inferred silently. **Invariant 10:** telemetry defaults local-only + metadata-only.
- **Existing:** `ExecutionPolicyEngine.evaluate()` returns `allowed/requiresApproval`
  with cooldown/window throttling — advisory + rate limiting. It is NOT a hard
  egress gate.
- **Gap to close:** `enforceNetworkPolicy` (before any fetch/egress),
  `enforcePersistencePolicy`, `enforceTelemetryPolicy` must **abort** on denial.
  These run inside `IProviderAdapter` impls (which are the only code that performs
  egress). No existing engine provides this; net-new.
- **Existing reuse:** `PolicyRule` table (A1) for rule storage; gateway enforcer
  reads rules from there but keeps the evaluator/enforcer split in type space.

### 2.3 Plugin trust model (`IPluginManager`)
- **Design:** "signed" (publisher identity + integrity) is distinct from "safe"
  (certified). `PluginValidationResult`, `certify()`, `PLUGIN_UNTRUSTED` failure.
- **Existing:** `PluginRegistry` has `integrityHash`, `manifestJson`, `isActive`
  (schema:2294) and the plugin engine (`plugin-system.ts`, `plugin-manager-impl.ts`)
  does load/hook registration. There is no signature/trust verification or certify
  suite.
- **Gap to close:** trust verification (checksum/signature) before anything is
  written to disk; `certify()` re-running the compliance suite. DB home = extended
  `PluginRegistry` or `EventRecord` plugin-lifecycle events (A1 §3.10 recommendation).

### 2.4 Gateway event / audit boundaries
- **Invariant 5:** a provider crash cannot crash VIVIM — enforced at the
  Supervisor/process boundary (Rust/Tauri IPC), not in-process. This is the single
  most important *architecture-level* security guarantee and it's net-new
  (existing `ChromeGovernor` gives CDP crash isolation, not local-engine process
  isolation).
- **Audit:** `AuditEvent` (`audit.recorded` with actor/action/subject) → persist to
  `EventRecord` (A1) via adapter. Existing `ConfigAudit`/`SandboxAudit` are separate;
  gateway audit is additive.

---

## 3. Security Invariant Compliance Check (repo vs design)

| Repo invariant | Design invariant | Compatible? |
|---|---|---|
| Governor Canon (only ChromeGovernor touches CDP) | Gateway never touches CDP | ✅ (gateway is inference-runtime-bound) |
| DB-only parser logic | Gateway doesn't parse provider DOM | ✅ |
| One Entry Point (capabilities) | Gateway exposed as caps (§A3) | ✅ |
| Chrome Slave = auth source of truth | Gateway providers = local engines, no Chrome profiles | ✅ (separate namespace, A1) |
| Lazy Startup (slaves auto-launch) | Gateway providers start on demand via Supervisor | ✅ (aligned) |
| No Runaway Creation (fleet limits) | Gateway resource leases + concurrency limits | ✅ (complementary) |

---

## 4. New Security Surfaces Introduced

| Surface | Threat it stops | Landing phase |
|---|---|---|
| `IPolicyEnforcer.enforceNetworkPolicy` | prompt-injected exfiltration via provider egress | M3 (local-only deny by default) |
| `IToolOrchestrator.handle()` 4-stage | model-proposed tool calls executing unapproved side effects | M7 |
| `ApprovalMode` per-tool | always-ask/always-deny for dangerous tools | M7 |
| `enforceTelemetryPolicy` default-deny | prompt/output leakage to telemetry | M3 |
| `ProviderConnection`/Supervisor process boundary | provider crash taking down VIVIM | M5 (Rust) |
| Plugin trust verify + certify | malicious/unverified provider packages | M7 |

---

## 5. What Changes (additive)

| Change | Type |
|---|---|
| `src/ai/policy/*` evaluator + enforcer impls (local-only/deny defaults) | NEW (M3) |
| `src/ai/tools/*` orchestrator + authorizer + approval + executor + audit impls | NEW (M7) |
| `SandboxAudit` additive columns (A1 §4.4) | EDIT (schema, gated on A1 approval) |
| `IApprovalManager` adapter over `HitlGate`/`AgentPermissionDecision` | NEW (M7) |
| Plugin trust/certify impl over `PluginRegistry` | NEW (M7) |
| `IProviderAdapter` impls that call `IPolicyEnforcer` before any egress | NEW (M5/M6) |

**Do NOT change:** `ToolUseProtocolImpl` execution semantics, `ExecutionPolicyEngine`
throttle behavior, `ChromeGovernor` crash isolation. Gateway adds a parallel, stricter
boundary.

---

## 6. Verification Gates

- Threat-model review of the 4-stage tool pipeline (no bypass path — grep for direct
  `IToolExecutor.execute(` calls outside `IToolOrchestrator.handle()`).
- Unit tests: authorizer-denies ⇒ executor never invoked; enforcer denial ⇒ egress
  never attempted; approval always-ask ⇒ blocked without approval.
- `bun run devops invariants check` passes (gateway adds no violations).
- No new network egress outside an adapter guarded by `IPolicyEnforcer` (audit-code
  scan).
