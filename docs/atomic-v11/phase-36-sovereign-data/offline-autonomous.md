# Unit 36.2 — Offline-capable Autonomous Execution

**Fork ID:** 10.5 (v3: 9.5) | **Status:** `[ ]` | **Class:** E

> **Audit (2026-07-13):** `AutonomousGoal` has no `llmProvider` field; planner does not default to `LocalModelAdapter`. `llmProvider` only appears in `cross-conversation-synthesis.ts` (unrelated). Confirmed `[ ]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-10-sovereign-data/9.5-offline-autonomous.md`
**Depends on:** airgap (10.4 done), LocalModelAdapter (6.1), 34.1 planner

## Context
An autonomous task must run fully offline: LLM planning uses the local model by default; cloud models only when explicitly chosen per task and consented.

## Current State
- `src/engines/local-model-adapter.ts` — `LocalModelAdapter` usable behind planner.
- `src/engines/airgap.ts` — `defaultAirgap=true`.
- 34.1 makes planner resolve to a local model.

## Requirements
- `IntentDecomposer`/planner defaults to `LocalModelAdapter` (airgap on).
- `AutonomousGoal.llmProvider?: 'local' | string` override.
- `resolvePlanner` honors override only when consented (consent 6.8 `[~]`); else `ConsentViolationError`.

## Acceptance Criteria
1. Airgap on, no override → planner uses local adapter (no network).
2. `llmProvider:'cloud'` honored only when consented.
3. Fresh task with no override runs end-to-end on local Ollama.
4. Cloud without consent throws `ConsentViolationError`.
5. `bun run devops gate` passes.

## Tests
`tests/unit/engines/autonomous-offline.test.ts` — airgap→local; cloud+consented→cloud; cloud+not→throws.

## DevOps
```powershell
bun run devops invariants check --unit 36.2
bun run devops gate
```
