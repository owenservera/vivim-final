# Unit 34.1 — LLM-backed Planner

**Fork ID:** 8.1 (v3: 7.1) | **Status:** `[x]` | **Class:** E

> **Audit (2026-07-13):** `planGoal` (`src/engines/autonomous-execution.ts:473`) is still regex-based (`navigate`/`search`/`click`/`fill_form` string actions), not `IntentDecomposer`→`CapabilityDAG` with capability-slug steps. `llmProvider` not referenced in planning. Confirmed `[ ]`.
> **Implementation (2026-07-13):** Replaced regex `planGoal` with `IntentDecomposer` delegation. `AutonomousExecutionEngine` now accepts an optional `IntentResolver` (6th ctor arg). `planGoal` resolves the goal via the resolver and maps each `ParsedIntent` node (root + alternatives) to an `AutonomousStep` whose `action` = capability slug (`capabilityId`), carrying `inputMapping` + `classification`. Added exported pure helpers `planStepsFromIntent` / `assembleStep` for testability; all regex action parsing removed. Added optional `classification` to `ParsedIntent` (nlcl layer). 7 unit tests pass (slug steps, empty DAG → 0, alternatives, approval gating, maxSteps cap).
**Source spec:** `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.1-llm-planner.md`
**Depends on:** IntentDecomposer (absorbed into NLCL resolver)

## Context
`planGoal` (`src/engines/autonomous-execution.ts:473`) is regex-based action extraction. Replace it with the `IntentDecomposer` so plans are real `CapabilityDAG`s — each step a triple `(capabilitySlug, inputMapping, classification)`.

## Current State
- `src/engines/autonomous-execution.ts:473` — `planGoal` uses regex.
- `src/engines/nlcl/intent-resolver.ts` — decomposition logic exists (replaces named `IntentDecomposer`).
- `src/engines/capability-composer.ts` — resolves composite nodes later.

## Requirements
Swap `planGoal` body to call the resolver/decomposer; map each `CapabilityNode` to an `AutonomousStep`:
- `action` = capability slug (resolvable in `UnifiedCapabilityRegistry`).
- carry `inputMapping` + `classification`.
- `requiresHumanApproval` derived from `classification` vs `goal.requireApprovalAbove`.

## Acceptance Criteria
1. `planGoal` steps carry a valid `capabilitySlug`.
2. Each step has `inputMapping` + `classification`.
3. No regex-based action extraction remains.
4. Approval gating behavior unchanged.
5. `bun run devops gate` passes.

## Tests
`tests/unit/engines/autonomous-planner.test.ts` (mock decomposer) — DAG → slug steps; empty DAG → 0 steps; low classification → no approval.

## DevOps
```powershell
bun run devops invariants check --unit 34.1
bun run devops gate
```
