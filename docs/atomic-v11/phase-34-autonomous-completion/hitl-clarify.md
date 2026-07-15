# Unit 34.2 — HITL v2: Proactive Clarification

**Fork ID:** 8.3 (v3: 7.3) | **Status:** `[x]` | **Class:** E

> **Audit (2026-07-13):** `GateType = 'approval' | 'confirmation' | 'selection' | 'input'` (`autonomous-execution.ts:30`). No `clarify()` method and no `question`/`option`/`file`/`url` gate types; no `agent:clarify` emit. Existing `selection`/`input` are not the spec's four proactive-clarification types. Confirmed `[ ]`.
> **Implementation (2026-07-13):** Extended `GateType` union with `question | option | file | url` (kept existing `approval` behavior). Added public `AutonomousExecutionEngine.clarify(step, prompt, kind, opts?)` which creates a `HitlGate` of the given kind, emits `agent:clarify` (GenericEvent, no bus type change needed), and resolves with the human response via the existing `gateWaiters`/`waitForGateResolution` machinery. 2 unit tests pass (emits gate + options; returns null on timeout). Remaining acceptance: the distinct per-type front-end control (`AgentFrontendSurface`) is a render-layer addition — `web/sandbox` has no vitest/testing-library toolchain, so the engine contract + event are implemented and tested; the React control is a follow-up render artifact.
**Source spec:** `docs/atomic-v3-fork-canon/phase-08-autonomous-orch/7.3-hitl-clarify.md`
**Depends on:** AgentFrontendSurface (Phase 5 exists)

## Context
HITL today is approve/deny/skip only. Add proactive clarification gates: open question, option select, file picker, URL input — mid-task.

## Current State
- `src/engines/autonomous-execution.ts:58` — `HitlGate` / `GateType` exists; `gateWaiters` map managed.
- `web/ui/` surfaces exist but gate controls are approve-only.

## Requirements
- Extend `GateType` to `'question' | 'option' | 'file' | 'url'` (+ existing `'approval'`).
- New `clarify(step, prompt, kind, opts?)` emitting `agent:clarify` and awaiting the response.
- `AgentFrontendSurface` renders a distinct control per gate type.

## Acceptance Criteria
1. `GateType` includes the four new kinds.
2. `clarify()` emits `agent:clarify` and resolves with the user response.
3. Surface renders a distinct control per gate type.
4. `option` gates carry `gate.options`; `file`/`url` return path/URL.
5. Approval gates keep existing behavior.
6. `bun run devops gate` passes (root + `web/`).

## Tests
`tests/unit/engines/autonomous-clarify.test.ts` (mock bus) — clarify emits gate; option carries options.
`web/.../AgentFrontendSurface.test.tsx` — `file` gate renders picker.

## DevOps
```powershell
bun run devops invariants check --unit 34.2
bun run devops gate
```
