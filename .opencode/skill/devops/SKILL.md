---
name: devops
description: Autonomous agentic DevOps orchestrator for vivim-final. Drives the 127 atomic units in docs/atomic-v3-fork-canon to completion via a strictly-sequential, fully-autonomous loop. Use when the user says "ralph loop", "devops", "continue", "keep going", or "implement all".
---
# VIVIM Agentic DevOps Orchestrator

Fully-autonomous, strictly-sequential loop that implements the atomic plan
(`docs/atomic-v3-fork-canon/`) to completion. State lives in `docs/atomic-v3-fork-canon/01-tracker.md`
(single source of truth, 127 units). Deterministic mechanics are in `devops/`; the
agent does the creative implementation.

> **CANONICAL:** v3-fork-canon (127 units, 117 pending) absorbs v3 (108 units) + v5 kernel (19 units).
> Deprecated: `docs/atomic-v3/`, `docs/atomic-v4/`, `docs/atomic-v5/`.

## Invariants

- **Strictly sequential.** One unit at a time. Never parallelize.
- **Fully autonomous.** Never ask "should I continue?" / "ready?". Only stop
  on completion or when only blocked units remain.
- **Gate before done.** A unit is marked `[x]` only after the gate is green.
- **Clean tree.** Each passing unit is committed; a blocked unit's changes
  are reset so dependents are not contaminated.

## Loop

```
LOOP:
  1. sel = `bun run devops select`          # next implementable unit (JSON) or "null"
     - null + report shows 0 pending        -> print "DEVOPS COMPLETE. <done>/<total>"; STOP
     - null + blocked remain                -> print report + BLOCKED list; STOP
  2. `bun run devops mark <id> in_progress`
   3. Read the unit's atomic file (path in the select JSON `file` is the
      SOURCE FILE; the unit spec lives at docs/atomic-v3/phase-*/<id>-*.md).
      Follow its Interface + Store Contract + Test Contract + Gate exactly.
   4. Fidelity: at the FIRST unit of a phase, cross-check the atomic files
      for that phase against the design docs (docs/master-plan-v3/*).
      Log any DRIFT into docs/atomic-v3/PROGRESS.md. Hard conflict -> mark blocked.
  5. Implement + write tests. Delegate to db/test/review subagents when useful
     (e.g. schema/migrations -> db, tests -> test).
  6. `bun run devops gate`                  # typecheck + lint + bun test
     - PASS  -> `bun run devops mark <id> done`
                git add -A ; git commit -m "feat(<Name>): implement unit <id>"
                `bun run devops report`
                goto LOOP
     - FAIL  -> fix, retry (max 3)
      - >3 fails -> `bun run devops mark <id> blocked`
                 append BLOCKED reason to docs/atomic-v3/PROGRESS.md
                git checkout -- .   (reset unit's working changes)
                goto LOOP
```

## Selection rules (enforced by `devops/select.ts`)

1. Selectable only if state is `pending` or `in_progress` (resume first).
2. Its **phase is open**: phase N opens only when every unit of all
   smaller-indexed phases is `done`. Enforces "SOTA 7-10 blocked until
   phase 6 complete".
3. Every dependency in the unit's atomic `**Depends:**` is `done`.

## Commands

| Command | Purpose |
|---------|---------|
| `bun run devops select` | Print next unit as JSON (`null` if none) |
| `bun run devops mark <id> <pending\|in_progress\|done\|blocked>` | Transition state |
| `bun run devops gate` | Run typecheck + lint + bun test (exit 1 on fail) |
| `bun run devops report` | Print done/total, per-phase, blocked list |
| `bun run devops audit-code <scope>` | Source-code audit (surface\|standard\|deep\|full) + fix/to-units |

## Resume

Re-running always resumes at the first non-`done` selectable unit. The
tracker is authoritative; if file state disagrees, trust the tracker.

## Audit trail

Every pass and block is appended to `docs/atomic-v3/PROGRESS.md`:
`[timestamp] <id> <name> -> <done|blocked> [sha] <gate summary>`.