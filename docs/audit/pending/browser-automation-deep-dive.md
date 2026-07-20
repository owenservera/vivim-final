# Browser-Automation Deep Dive Audit — RECLASSIFIED

**Status:** **INTENTIONAL SUBSYSTEM (not dead code)**

**Evidence:** `docs/plan-browser-automation-sota.md:115-141` describes this as the "browser-automation backbone" for a provider-free generic browser automation engine. It includes:
- `registry.ts` — `BrowserCapabilityRegistry` (100+ declarative capabilities, 12 axes)
- `types.ts` — shared types across automation layer
- `semantic-grounding.ts` — `SemanticGroundingEngine` (multi-mode resolve)
- `selector-healer.ts` — `SelectorHealer` (selector self-healing)
- `defs/*.ts` (12 files) — axis definition files for capability declarations
- `harness-actions.ts` — CDPProxy-backed primitive ops (injected into governor)
- `recipes.ts` — 43 composite `Recipe` definitions
- `agentic-loop.ts` — `AgenticLoopEngine` (Sense/Plan/Act/Observe/Reflect/Adapt)

---

## Architecture Intent (from SOTA plan)

The `browser-automation/` subtree implements a **separate automation plane** distinct from the provider-wired engine:

| Layer | `browser-automation/` purpose | Live integration points |
|-------|---------------------------|----------------------|
| `types.ts`, `harness-actions.ts`, `recipes.ts` | Core automation surface | Already integrated — used by `automation/orchestrator.ts`, `chrome-governor.ts` |
| `registry.ts`, `defs/*.ts` | Capability registry (100+ declarative caps) | Designed for `BrowserCapabilityRegistry` to be injected; test file `tests/integration/engines/browser-automation.test.ts` planned |
| `semantic-grounding.ts`, `selector-healer.ts` | Semantic/element resolution | Designed as `SemanticGroundingEngine` + `SelectorHealer` for automation plane; NOT duplicates of root-level twins |
| `agentic-loop.ts` | Browser-specific agentic loop | Designed to consume `BrowserCapabilityRegistry` + `AgentLoopStore`; separate from root `agentic-loop.ts` (which uses `MirrorEngine`) |

---

## Current Wiring Status (partial)

| File | Status | Why |
|------|--------|-----|
| `types.ts` | **LIVE** | Imported by `automation/types.ts`, `storage/contracts/agent-loop-store.ts` |
| `harness-actions.ts` | **LIVE** | Imported by `chrome-governor.ts` (lines 15, 728, 1184) |
| `recipes.ts` | **LIVE** | Imported by `automation/orchestrator.ts` (line 9) |
| `registry.ts` | **ORPHANED-COMPOSITION** | Only imports `defs/*`; never imported elsewhere; designed for future wiring (`tests/integration/browser-automation.test.ts` planned) |
| `defs/*.ts` (11 files) | **ORPHANED-COMPOSITION** | Only imported by `registry.ts`; designed for `BrowserCapabilityRegistry` consumption |
| `semantic-grounding.ts` | **ORPHANED-BY-DESIGN** | Designed as browser-automation capability; NOT wired yet but intentional spec |
| `selector-healer.ts` | **ORPHANED-BY-DESIGN** | Designed as browser-automation capability; uses `SelectorHealStore` contract; NOT wired yet but intentional spec |
| `agentic-loop.ts` | **ORPHANED-BY-DESIGN** | Designed as browser-specific agentic loop; uses `AgentLoopStore` contract; NOT wired yet but intentional spec |

---

## Decision

- **KEEP THE FULL SUBTREE** — this is intentional design for a separate automation plane
- **Current orphan status is BY DESIGN**, not cruft (the SOTA plan explicitly states tests + full wiring are planned)
- **The 3 files (`types.ts`, `harness-actions.ts`, `recipes.ts`) are already live**; the other 14 are **substrate awaiting integration**

---

## Action Items (if any)

1. **No purge** — the entire `browser-automation/` subtree is intentional.
2. **Roadmap integration** — follow `docs/plan-browser-automation-sota.md` to wire:
   - `BrowserCapabilityRegistry` instantiation (inject into `AutomationOrchestrator` or `NLCLEngine`)
   - `SemanticGroundingEngine` integration with governor accessibility methods
   - `SelectorHealer` connection to `Selectors` table for self-healing
   - `AgenticLoopEngine` hook into `HarnessProtocolEngine` for agentic goals
3. **Create missing test:** `tests/integration/engines/browser-automation.test.ts` (planned in SOTA doc)