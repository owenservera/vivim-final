# Gap Analysis — "CDP Action → Provider → Slave Execution" Concept vs. Implemented Design

**Date:** 2026-07-18
**Scope:** Audit the implemented `vivim-final` codebase against the target concept below. The READ / streaming component is explicitly **out of scope** for this analysis.

---

## 1. Target Concept (the user's mental model)

```
Database with REGISTERED CDP Actions
   → mapped to PROVIDER  [registered only AFTER discovery + testing]
   → SLAVE executes the command  [invoked from CLI / backend / UI]
```

Three stages, each with a hard gate:

1. **Register** — CDP actions live in the DB, registered as first-class capabilities.
2. **Map + Gate** — each action is bound to a provider (chatgpt / claude / gemini) **only after** it has been *discovered and tested*. Untested actions must not be promoted to active.
3. **Execute** — a slave (a running Chrome instance owned by `ChromeGovernor`) executes the command when invoked from any surface (CLI, backend API, UI).

---

## 2. Method & Evidence Base

Traced the actual code paths end-to-end across:

- Capability registration: `src/engines/cdp-discovery.ts`, `src/engines/cdp-capability-registrar.ts`, `src/engines/capability-bootstrap.ts`, `src/engines/capability-bootstrap-generated.ts`
- Boot wiring: `src/server/index.ts` (lines 540–609)
- Provider resolution: `src/engines/capability-resolution.ts`, schema `CapabilityBinding` / `CapabilityProgram`
- Execution transport: `src/engines/chrome-governor.ts`, `CDPProxy.send`, `src/server/conversation-router.ts`, `src/server/capability-router.ts`
- Persistence: `prisma/dev.db` (live sqlite), `prisma/schema.prisma`
- Orphaned usage: `devops/runtime-test/orchestration.ts` (dev/deploy harness, not the server)

All claims below are grounded in specific files/lines. Line numbers reference the working tree at audit time.

---

## 3. Stage-by-Stage Findings

### Stage 1 — "DB with registered CDP Actions"

**Verdict: ⚠️ PARTIAL — the machinery exists but is never invoked in the live system.**

| Component | Status | Evidence |
|---|---|---|
| CDP protocol descriptor parser | ✅ Built | `cdp-discovery.ts:64` `parseCdpProtocolJson()`; curated `CDP_PROTOCOL_CATALOG` (96 commands, lines 92–757) across Runtime/Page/DOM/Network/Target/Input/Fetch/Emulation/Tracing/Debugger/CSS/Log |
| Descriptor → UnifiedCapability | ✅ Built | `cdp-capability-registrar.ts:54` `cdpMethodToCapability()`; `:104` `registerDiscoveredCdpMethods()` |
| Live boot registration | ❌ Missing | `registerDiscoveredCdpMethods` is called **only** in `devops/runtime-test/orchestration.ts:101` (a dev harness) and unit tests. Not referenced anywhere under `src/` runtime. |
| Live boot path | ⚠️ Registers other caps | `src/server/index.ts:546` `registerDefaultCapabilities` (system caps) + `:559` `registerGeneratedCapabilities` (196 taxonomy caps from `pool.taxonomy.json`). **No CDP caps.** |
| DB persistence of CDP actions | ❌ Empty | `prisma/dev.db` → `capability_program`: 0 rows; `capability_binding`: 0 rows; `capability_taxonomy`: 0 rows (verified by direct query). |

**Conclusion:** The CDP-action registration pipeline is real, tested code, but it is **orphaned from the running server**. At boot, zero `cap:cdp:*` capabilities are registered, and nothing is persisted.

---

### Stage 2 — "mapped to provider [after discovery + testing]"

**Verdict: ❌ BROKEN — provider mapping is absent and the "tested" gate does not exist.**

| Sub-requirement | Status | Evidence |
|---|---|---|
| Schema supports provider binding | ✅ Model present | `prisma/schema.prisma:405` `CapabilityBinding { providerId, globalId, status, confidence, bestProgramId, promotionHistoryJson }`; `:488` `SelectorStrategy { providerId, capabilityId }` |
| CDP action → provider mapping | ❌ Never performed | `cdpMethodToCapability` (`cdp-capability-registrar.ts:67-95`) produces `cap:cdp:Page.navigate` with **no `providerId`**. CDP caps are inherently provider-agnostic. Taxonomy pool (196 caps) is 100% `shared: true`, no `platformBindings` referencing chatgpt/claude/gemini. |
| "After discovery + testing" gate | ❌ Missing | `registerDiscoveredCdpMethods` (`cdp-capability-registrar.ts:104-120`) registers **every** discovered method unconditionally — no confidence check, no `status` field set, no `bestProgramId`, no test/verify step. The `status: 'prospect'` → `active` promotion workflow in the schema is never driven by any code. |
| Resolution by provider | ❌ Returns nothing | `CapabilityResolutionEngine.resolve(providerId)` (`capability-resolution.ts:159`) reads `CapabilityBinding` rows — which are empty for all providers, so resolution yields nothing. |
| Binding write path exists? | ⚠️ Manual only | The only `capabilityBinding.upsert` is in `provider-store-impl.ts:422`, inside a manual provider-onboarding flow — **not** in any CDP discovery/registration pipeline. |

**Conclusion:** There is no code path that (a) binds a discovered CDP action to a provider, or (b) requires a test/verification before promotion. The binding tables are never populated by the discovery flow.

---

### Stage 3 — "slave executes command [from CLI / backend / UI]"

**Verdict: ❌ BROKEN — transport exists, but the capability→slave execution link is a stub.**

| Component | Status | Evidence |
|---|---|---|
| CDP transport (Governor Canon) | ✅ Built | `ChromeGovernor` → `CDPProxy.send(slaveId, method, params)` (`chrome-governor.ts:180`) → `CDPTransport`. Only Governor touches CDP. ✅ |
| CDP capability handler | ✅ Defined | `cdp-capability-registrar.ts:76-77` handler calls `opts.executeCdp(desc.fullName, input)` |
| `executeCdp` wired to live slave | ❌ Never injected | In the live server, no `executeCdp` executor is supplied to a registered CDP capability (because the caps aren't registered in boot, and the registrar is only used in devops). |
| `governor.executeCapability` | ❌ Does not exist | `conversation-router.ts:102-109` calls `governor.executeCapability(conversationId, slug)`, but `ChromeGovernor` has **no such method** (confirmed: only `executeHarnessPlan` at `chrome-governor.ts:215`). The router itself falls back to a stub. |
| Execution stub | ❌ No-op | `conversation-router.ts:114-115` → `executed = { status: 'dispatched', slug, conversationId }`. The command is "executed" by returning a fake dispatched status; **no slave is touched.** |
| Unified surface execution | ⚠️ Funnel exists, dead-ends | CLI/API/UI all route through `registry.execute(cap.id, input)` (`capability-router.ts:89`, `canvas-router.ts:33`). For provider/CDP caps the handler has no live `executeCdp`, so nothing reaches a slave. |
| CLI CDP commands | ❌ Absent | The live CLI command tree contains no CDP commands (they would only appear if `registerDiscoveredCdpMethods` ran during boot). |

**Conclusion:** The last mile — capability → live slave — is a stub. `executeCapability` is missing on `ChromeGovernor`; the CDP handler's `executeCdp` is never wired to a running slave; the per-conversation execute route returns a no-op `dispatched` status.

---

## 4. Gap Summary Matrix

| Concept stage | Architected? | Implemented & wired? | Gap ID |
|---|---|---|---|
| DB registered CDP actions | ✅ | ⚠️ orphaned (devops only) | **A** |
| Mapped to provider | ✅ model | ❌ no binding performed | **B** |
| "after discovery + testing" gate | — | ❌ no verify/test step | **B2** |
| Slave executes (CLI/API/UI) | ✅ transport | ❌ stub execution | **C** |

**Net assessment:** The target concept is *architecturally present as isolated components*, but the **three integration seams are missing**:

- **(A)** CDP registration is not in the live boot/seed path.
- **(B / B2)** CDP actions are never bound to providers, and there is no testing gate before promotion.
- **(C)** The capability→slave execution link is a stub (`executeCapability` missing; `executeCdp` unwired).

As a result, in the running system: **0 CDP capabilities are registered, 0 are provider-bound, and 0 can actually be executed by a slave.**

---

## 5. Root-Cause Observations

1. **Devops harness ≠ server.** The only caller of `registerDiscoveredCdpMethods` is `devops/runtime-test/orchestration.ts`, a deployment/verification harness. The production server boot never calls it. The capability system was built and unit-tested in isolation but not integrated into the running backend.

2. **Provider scoping was never designed into CDP caps.** `cdpMethodToCapability` produces provider-agnostic `cap:cdp:*` entries. The "map to provider" step has no code because the capability shape does not carry a `providerId`, and the discovery flow has no notion of which provider a slave belongs to.

3. **No promotion/test lifecycle.** The schema models `CapabilityBinding.status` (`prospect`/`active`) and `confidence`, but the registrar ignores them. There is no "fire the command on a live slave and assert success" step anywhere.

4. **Execution method name mismatch.** `conversation-router.ts` expects `governor.executeCapability(...)`, but `ChromeGovernor` exposes only `executeHarnessPlan(...)`. The contract was never reconciled, so the router silently degrades to a stub.

---

## 6. Recommended Closure Plan (units)

> Ordered; each unit is independently shippable and testable. Open questions from the audit (persistence vs. in-memory; depth of the testing gate) are flagged as **decisions**.

### Decision D1 — Persistence model for registered CDP actions
- **Option 1 (matches user concept "DB with registered CDP actions"):** persist discovered CDP actions + bindings to `capability_program` / `capability_binding` with `status` + `confidence`. Regenerated/merged on each discovery, survives restart.
- **Option 2:** keep CDP caps in-memory, regenerated every boot from discovery (no DB rows). Simpler, but loses the "registered in DB" property and the promotion lifecycle.

### Decision D2 — Depth of the "testing" gate
- **Option A (heavy):** real headless verification — launch slave, fire the CDP command, assert no error / expected DOM/network effect → flip `prospect → active`.
- **Option B (light):** liveness check — assert the method exists on the attached slave's protocol descriptor → mark `active` with `confidence`.

### Unit G1 — Wire CDP registration into live boot (closes Gap A)
- Add `registerDiscoveredCdpMethods(registry, methods, { executeCdp })` call in `src/server/index.ts` boot, after `registerGeneratedCapabilities`.
- Source methods from `CDP_PROTOCOL_CATALOG` (offline-safe) and/or live protocol fetch when a slave is attached.
- Supply a real `executeCdp` that resolves the target slave via `ChromeGovernor` and calls `CDPProxy.send`.

### Unit G2 — Add provider binding + testing gate (closes Gap B / B2)
- Extend `cdpMethodToCapability` (or a wrapper) to attach `providerId` from the discovering slave's provider.
- Add a verification step before `registry.register`: run D2 gate → set `CapabilityBinding.status` (`prospect` until tested, then `active`) and `confidence`.
- Persist to `capability_binding` / `capability_program` if D1=Option 1.

### Unit G3 — Implement `ChromeGovernor.executeCapability` (closes Gap C)
- Add `executeCapability(conversationId | providerId, slug)` to `ChromeGovernor` that:
  - resolves the conversation → provider → slave,
  - looks up the registered `cap:cdp:*` (or harness) capability,
  - invokes the capability's handler (`executeCdp`) on the live slave.
- Replace the stub fallback in `conversation-router.ts:114-115` with the real call (keep graceful degrade only on transport-not-configured).

### Unit G4 — Surface parity verification
- After G1–G3, run `bun run devops verify-cross-surface` to confirm each registered CDP capability resolves across CLI / API / MCP / UI.
- Add a unit test: discovered CDP action → bound to provider → executed on a mock slave returns real result (not `dispatched` stub).

---

## 7. Acceptance Criteria (post-closure)

- [ ] At boot, N `cap:cdp:*` capabilities are registered (N ≥ catalog size).
- [ ] Each registered CDP action has a `CapabilityBinding` row with a `providerId` and a non-null `status`.
- [ ] No `cap:cdp:*` is `active` unless it passed the D2 testing gate.
- [ ] `POST /api/conversations/:id/capabilities/:slug/execute` (and CLI/UI equivalents) drives a real CDP command on the provider's slave and returns the command result — **not** `{ status: 'dispatched' }`.
- [ ] `bun run devops verify-cross-surface` passes for the new capabilities.

---

## 8. Files Touched (planned)

| File | Change |
|---|---|
| `src/server/index.ts` | Call CDP registration in boot (G1) |
| `src/engines/cdp-capability-registrar.ts` | Add provider binding + testing gate (G2) |
| `src/engines/chrome-governor.ts` | Add `executeCapability` (G3) |
| `src/server/conversation-router.ts` | Replace stub with real `executeCapability` (G3) |
| `src/engines/capability-resolution.ts` | Consume populated bindings (G2) |
| `prisma/schema.prisma` | (if D1=Option 1) confirm `capability_binding`/`capability_program` fields suffice |
| `tests/unit/engines/cdp-*.test.ts` | Extend with provider-binding + execution tests (G4) |

---

*Generated by automated design audit. READ/streaming intentionally excluded per scope.*
