# Unit 34.5 — Provider Failover Mid-Task

**Fork ID:** 8.8 (v3: 7.8) | **Status:** `[ ]` | **Class:** E

> **Audit (2026-07-13):** No `fallbacksFor()` / `executeStepWithFailover()` in `provider-mux.ts` or `autonomous-execution.ts`. Only selector-level `fallback` chains exist (`provider-selectors.ts`). No mid-task provider reroute. Confirmed `[ ]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.8-provider-failover.md`
**Depends on:** ProviderRouter (6.5 `[~]`), 34.2 clarification gates

## Context
If a provider fails mid-task (Ollama crash, cloud 429), the agent should consult `routing_preference` for fallbacks, emit a clarification gate, and re-execute the step against the fallback with adapted input.

## Current State
- `src/engines/autonomous-execution.ts:636` — `healSelector` is the step-failure path.
- `src/engines/provider-mux.ts` — `ProviderRouter` with `routing_preference`; lacks `fallbacksFor`.
- `clarify()` (34.2) reusable for the approval gate.

## Requirements
- `ProviderRouter.fallbacksFor(providerId): string[]`.
- `executeStepWithFailover`: on catch, look up fallbacks; if any, `clarify(option)` offering them; on approval, re-execute against fallback with `adaptInput`.
- No fallback → original error propagates (no hang).

## Acceptance Criteria
1. Step failure consults `fallbacksFor`.
2. Fallback present → `agent:clarify` `option` gate emitted.
3. Approval → re-execute against fallback with adapted input.
4. No fallback → original error propagates.
5. `bun run devops gate` passes.

## Tests
`tests/unit/engines/autonomous-failover.test.ts` (mock router + clarify) — fail+fallback → gate+rerun; fail+no-fallback → throws.

## DevOps
```powershell
bun run devops invariants check --unit 34.5
bun run devops gate
```
