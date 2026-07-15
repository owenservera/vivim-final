# Unit 34.3 — HITL v2: Pause / Resume

**Fork ID:** 8.4 (v3: 7.4) | **Status:** `[ ]` | **Class:** E

> **Audit (2026-07-13):** No `pause()`/`resume()` on `AutonomousExecutionEngine`. `session-checkpoint.ts` has resume for *sessions*, not autonomous tasks. Task state is not pause-flagged. Confirmed `[ ]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.4-hitl-pause.md`
**Depends on:** 34.2 clarification gates, AgenticConversationLoop (3.11-3.12)

## Context
An autonomous task must be pausable (user steps away) and resumable without losing state or re-running completed steps.

## Current State
- `AutonomousExecutionEngine` runs steps sequentially; no pause primitive.
- `AutonomousStep.{status}` exists (`pending|running|done|error|paused`).

## Requirements
- `pause(taskId)` sets a pause flag; the loop yields after the current step.
- `resume(taskId)` continues from the first non-terminal step.
- Persisted task + step state so pause survives a process restart.
- A `paused` gate/notification emitted to the surface.

## Acceptance Criteria
1. `pause()` halts after the in-flight step; new steps don't start.
2. `resume()` continues from the first pending step.
3. Pause/resume survives restart (state in DB).
4. Surface shows paused state + resume control.
5. `bun run devops gate` passes.

## Tests
`tests/unit/engines/autonomous-pause.test.ts` — pause mid-run → step count frozen; resume → continues; restart → resumes from DB.

## DevOps
```powershell
bun run devops gate
```
