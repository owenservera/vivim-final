# PENDING — vivim-final Audit & Wiring Findings (this session, 2026-07-18)

> Consolidated holding folder for everything produced/shaped in the 2026-07-18
> session. Two workstreams live here:
> 1. **Dead-code / orphaned-code audit** (full repo) + the `browser-automation/`
>    deep-dive that REVERSED the initial "purge" verdict.
> 2. **Two-mode wiring plan** — make `browser-automation/` (provider-agnostic,
>    full browser automation) fully operational and correctly routed against the
>    `[providers]` mode (provider-wired LLM engine).
>
> Nothing here has been executed/deleted. These are findings + a pending plan.

## Files in this folder

| File | What it is |
|------|-----------|
| `SESSION-INDEX.md` | This file — map of the pending folder |
| `code-audit.md` | Full dead-code / orphaned-code / contract-drift audit (§8 = value assessment) |
| `browser-automation-deep-dive.md` | Deep-dive proving `browser-automation/` is INTENTIONAL, not dead code |
| `two-mode-routing-plan.md` | Implementation plan: wire + route `[providers]` vs `[provider-agnostic automation]` |
| `v8-ui-reprogrammability-goals.md` | Separate V8 UI engine goal doc (cross-referenced, not part of audit) |

> The `code-audit.proposal.html` visual is NOT copied here (binary-ish HTML artifact);
> it lives at `docs/audit/code-audit.proposal.html`.

## Audit verdict (corrected)

- Original first-pass said "purge the `browser-automation/` subtree (14 files)".
- Deep-dive REVERSED this: `browser-automation/` is an **intentional separate
  automation plane** (SOTA-03/05/09). `types.ts`, `harness-actions.ts`, `recipes.ts`
  are LIVE; `registry.ts`, `defs/*.ts`, `semantic-grounding.ts`, `selector-healer.ts`,
  `agentic-loop.ts` are **substrate awaiting integration** (by design).
- Net safe-purge target: **~74 files**, EXCLUDING `browser-automation/`, the
  `harness/` subtree (live via tests), and `web/ui/features/canvas/` (spec'd mount).

## Two-mode routing status (discovered before stop)

| Mode | Executor | Wired? |
|------|----------|--------|
| `[providers]` (provider-wired LLM) | `ProviderLLMExecutor` ← `conversation-manager` | Live |
| `[provider-agnostic automation]` (full browser) | `GenericBrowserExecutor` ← `AutomationOrchestrator` → `ChromeGovernor.ensureGenericBrowser()` + `runHarnessPlan()` | Live (recipe path) |

The two modes ARE separately routed already. Remaining gaps (see `two-mode-routing-plan.md`):
- `BrowserCapabilityRegistry` (100+ declarative caps) is NOT instantiated anywhere.
- `SemanticGroundingEngine` + `SelectorHealer` not injected into the automation plane.
- `AgenticLoopEngine` (browser-specific) not hooked into `HarnessProtocolEngine`.
- No `tests/integration/engines/browser-automation.test.ts` (planned in SOTA).

## How to drive this as a tracker (optional)

The devops system has a `pending` state:
`bun run devops select --tracker docs/atomic-runtime/01-tracker.md`
`bun run devops mark <id> <pending|in_progress|done|blocked> --tracker docs/atomic-runtime/01-tracker.md`

The two-mode wiring items could be promoted to a satellite tracker following
`docs/atomic-runtime`'s pattern (Phase ≥90 is always-open, never blocks product phases).
