# Two-Mode Routing & Wiring Plan — `[providers]` vs `[provider-agnostic automation]`

**Status:** PENDING (inspection complete; implementation NOT started)
**Goal:** Ensure both modes are fully wired + operational, and correctly routed.

---

## 1. The two modes (as they exist today)

| Mode | Intent | Entry point | Engine chain | Browser slave |
|------|--------|-------------|--------------|---------------|
| **`[providers]`** | Talk to a specific LLM provider (chatgpt/claude/gemini/…) as a logged-in user | NLCL intent → `ProviderLLMExecutor` (`src/engines/nlcl/executors/provider-llm-executor.ts`) | `ConversationManager` → `ChromeGovernor.ensureRunningForAccount(providerId, accountId)` → CDP send/parse | **provider slave** (`chrome-profiles/<provider>/<account>`) |
| **`[provider-agnostic automation]`** | Generic browser automation, no provider, no login — research/extract/summarize/monitor/test | NLCL intent → `GenericBrowserExecutor` (`src/engines/nlcl/executors/generic-browser-executor.ts`) | `AutomationOrchestrator` (`src/engines/automation/orchestrator.ts`) → `ChromeGovernor.ensureGenericBrowser()` + `runHarnessPlan(dag)` | **generic browser slave** |

### Routing map (verified in code)
- `NLCLEngine.interpret()` (`src/engines/nlcl/nlcl-engine.ts:99`) → `IntentRouter.route()` (`src/engines/nlcl/intent-router.ts:67`).
- Catalog (`src/engines/nlcl/catalog.ts`) splits intents by `executor`:
  - `llm.*` / `web.summarize` / `web.query` → `executor: 'provider-llm'` (→ providers mode)
  - `auto.*` (`auto.research`, `auto.extract`, `auto.summarize`, `auto.monitor`, `auto.test`) → `executor: 'generic-browser'` (→ automation mode)
  - `browser.*` (`browser.navigate`, `browser.search`, `browser.extract`, `browser.screenshot`, `browser.open`) → `executor: 'browser'` (`BrowserExecutor`, `src/engines/nlcl/executors/browser-executor.ts`) — a thin CDP/navigate path, distinct from both above.

**Conclusion:** The two modes ARE already separately routed at the NLCL layer. The work is not "fix routing" but **complete the wiring of the automation plane's substrate** so the `generic-browser` mode is fully operational (today it only runs recipes; the 100+ declarative capabilities, semantic grounding, healing, and agentic loop are not connected).

---

## 2. What is wired vs orphaned (inspection result)

### LIVE today
- `AutomationOrchestrator.run()` (`src/engines/automation/orchestrator.ts:24`) — uses `getRecipe()` from `recipes.ts` + `compileRecipe()` + `governor.ensureGenericBrowser()` + `governor.runHarnessPlan()`.
- `recipes.ts` (43 composite `Recipe` defs) — imported by orchestrator.
- `harness-actions.ts` — imported by `chrome-governor.ts` (lines 15, 728, 1184).
- `browser-automation/types.ts` — imported by `automation/types.ts`, `storage/contracts/agent-loop-store.ts`.

### ORPHANED-BY-DESIGN (substrate, not wired)
- `browser-automation/registry.ts` → `BrowserCapabilityRegistry` (100+ caps, 12 axes). Only imports `defs/*`; never instantiated.
- `browser-automation/defs/*.ts` (12 files: capture, extract, flow, input, nav, net, observe, os, scroll, state, tab, wait) — capability declarations consumed only by `registry.ts`.
- `browser-automation/semantic-grounding.ts` → `SemanticGroundingEngine` (multi-mode resolve via governor CDP). Not instantiated.
- `browser-automation/selector-healer.ts` → `SelectorHealer` (uses `SelectorHealStore` contract). Not instantiated.
- `browser-automation/agentic-loop.ts` → `AgenticLoopEngine` (Sense/Plan/Act/Observe/Reflect/Adapt; uses `AgentLoopStore` contract + `CapabilityResolver`). Not instantiated.

### Supporting contracts (declared, some with no impl)
- `storage/contracts/agent-loop-store.ts` (`AgentLoopStore`) — consumed only by orphan `agentic-loop.ts`.
- `storage/contracts/selector-heal-store.ts` (`SelectorHealStore`) — consumed only by orphan `selector-healer.ts`.
- `storage/contracts/harness-protocol-engine.ts` — home of `HarnessProtocolEngine` (the planned hook point for `AgenticLoopEngine`).

---

## 3. Implementation plan (pending units)

> Suggested split into satellite-tracker units (Phase ≥90 so they never block the
> product-phase gate). Drive with `devops select|mark --tracker <path>`.

### U1 — Compose the automation plane (instantiate `BrowserCapabilityRegistry`)
- Create `src/engines/automation/automation-plane.ts` (or extend `AutomationOrchestrator`):
  build `SemanticGroundingEngine` + `SelectorHealer` (with a real `SelectorHealStore` impl) + `BrowserCapabilityRegistry`, wire `registry.healer = healer`.
- Inject `governor` (already available) + a `SelectorHealStore` impl (pick an existing in-memory or add one).
- Keep `AutomationOrchestrator.run()` recipe path working; add `registry.invoke()` as the new capability path.

### U2 — Wire `SemanticGroundingEngine` into the plane
- `SemanticGroundingEngine` already uses only Governor Canon (`governor.enableDomains`, `governor.cdp.send`, `governor.evaluate`) — no BunCdpClient. Instantiate with `governor`.
- Verify `getAccessibilityTree` / `screenshot` / `boxFor` work against a live generic slave.

### U3 — Wire `SelectorHealer` (needs a `SelectorHealStore` impl)
- Root cause of many storage orphans: `store-factory.ts` is a stub. For this plane, instantiate a concrete `InMemorySelectorHealStore` (or wire the Prisma variant) so `SelectorHealer` is operational.
- Confirm `heal()` falls through persisted → rule-based → (optional) LLM.

### U4 — Hook `AgenticLoopEngine` into `HarnessProtocolEngine` for agentic goals
- `AgenticLoopEngine.executeAgenticLoop(slaveId, goal)` needs: `governor`, `grounding`, `AgentLoopStore` impl, `resolver` (= `BrowserCapabilityRegistry`), `planner` (inject a deterministic planner; LLM planner optional/swappable).
- Expose an `auto.agentic` / `auto.goal` NLCL intent → `GenericBrowserExecutor` → `AgenticLoopEngine`.

### U5 — Add the missing integration test
- `tests/integration/engines/browser-automation.test.ts` (planned in SOTA doc):
  spin a generic browser slave (mock governor), run `registry.invoke('auto:nav:click', …)`, assert grounding + heal + agentic loop.

### U6 — Verify two-mode routing end-to-end
- `bun run devops runtime-test test --nl="ask chatgpt about X"` → providers mode.
- `bun run devops runtime-test test --nl="research the AI crisis"` → automation mode.
- Assert no cross-contamination (provider mode never touches generic slave; automation mode never requires a provider login).

### U7 — Register the plane at bootstrap
- Ensure the composed automation plane is built once at server/NLCLEngine bootstrap (singleton), same as other engines, so both modes share one `ChromeGovernor` but distinct slave pools.

---

## 4. Risks / invariants to respect
- **Governor Canon:** only `ChromeGovernor` touches CDP. `SemanticGroundingEngine`/`SelectorHealer`/`defs/*` already comply (no BunCdpClient). Keep it that way.
- **Store Contracts:** engines depend on `storage/contracts/*.ts`, never `impl/*.ts` directly. Add any new impl as a contract-backed store.
- **No purge of `browser-automation/`:** it is intentional substrate (see `browser-automation-deep-dive.md`). Do NOT delete during wiring.
- **Root-level twins are different engines:** `src/engines/agentic-loop.ts` (MirrorEngine) ≠ `browser-automation/agentic-loop.ts` (ChromeGovernor). Don't "dedupe" them.

## 5. Acceptance gate
- `bun run devops gate` passes.
- `bun test tests/integration/engines/browser-automation.test.ts` passes.
- Both NLCL modes route to the correct slave pool and produce results.
