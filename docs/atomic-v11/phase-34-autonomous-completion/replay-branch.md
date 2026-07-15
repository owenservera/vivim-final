# Unit 34.4 — Replay with Branching

**Fork ID:** 8.5 (v3: 7.5) | **Status:** `[~]` | **Class:** C

> **Audit (2026-07-13):** `src/engines/autonomous-execution.ts:444` implements `replay(taskId, fromStep?)`: it re-executes the goal via `execute(prev.goal)` and copies prior results into steps before `fromStep`. This gives replay-from-step, but **not** the spec's branching model (isolated branch run-id, overridden input/provider, re-run from a single step only). Marked `[~]`: core replay exists; branching/override is the remaining work.
**Source spec:** `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.5-replay-branch.md`
**Depends on:** ProvenanceGraph (3.14-3.15 done), task search (8.11 `[~]`)

## Context
Replay a finished autonomous task, but allow branching: swap a step's input/provider and re-run from that point, producing a parallel timeline.

## Current State
- `ProvenanceGraph` node/edge storage + query API done.
- No replay controller.

## Requirements
New `src/engines/autonomous-replay.ts`:
- Load a task's step graph from provenance.
- Re-execute from a chosen step with overridden input/provider.
- Branch = new run id; original timeline preserved.
- Diff view: original vs branch step results.

## Acceptance Criteria
1. Replay reproduces the original result on unchanged input.
2. Overriding a step's input/provider re-runs from that step only.
3. Branch is isolated from the original timeline.
4. `bun run devops gate` passes.

## Tests
`tests/unit/engines/autonomous-replay.test.ts` — replay matches; branch diverges; original intact.

## DevOps
```powershell
bun run devops gate
```
