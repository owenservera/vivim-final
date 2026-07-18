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
- **All edits first, then gate.** Do NOT run typecheck, lint, or tests
  incrementally during implementation. Complete ALL code edits for the unit,
  then run the single `bun run devops gate` at the end. Running verification
  mid-task wastes cycles and invalidates earlier passes when later edits
  introduce new errors. The gate is the ONLY verification pass per unit.
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
   5. Implement ALL code edits first. Write every file the unit requires.
      Do NOT run typecheck, lint, or tests during this step — accumulate
      all edits, then write tests in a single batch. Delegate to db/review
      subagents for schema/migrations, but NEVER run verification mid-task.
   6. `bun run devops gate`                  # typecheck + lint + bun test (single pass, all edits in)
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

## Intelligence enhancements (preflight / status)

The `devops agentic preflight` output now includes:
- **restoreCandidates** — on-disk Chrome profiles with cookies but not DB-linked (run `devops agentic adopt --provider=X` to restore them)
- **untestedCapabilities** — capabilities registered in DB but NOT verified in the UI frontend (run `onboard test-frontend` to verify)
- **suggestedAction** — a human-readable string leading with the most actionable next step

For a single-provider deep dive: `bun run devops runtime-test status --provider=gemini` — includes seed status, profile cookies, live slave, capability registration, selector confidence, and UI frontend test status with canonical verdict + recommended action.

Track UI test results with `bun run devops ui-test <list|status|record>` — persists to `.runtime/ui-test-registry.json` with timestamps and notes. Every `test-frontend` call auto-records.

## Commands

| Command | Purpose |
|---------|---------|
| `bun run devops select` | Print next unit as JSON (`null` if none) |
| `bun run devops mark <id> <pending\|in_progress\|done\|blocked>` | Transition state |
| `bun run devops gate` | Run typecheck + lint + bun test (exit 1 on fail). Single pass after ALL edits are complete. |
| `bun run devops report` | Print done/total, per-phase, blocked list |
| `bun run devops audit-code <scope>` | Source-code audit (surface\|standard\|deep\|full) + fix/to-units |
| `bun run devops agentic adopt --provider=<slug>` | Restore cookie-bearing on-disk profile → launch → verify → complete in one call |
| `bun run devops agentic preflight` | Full preflight with restore candidates, untested capabilities, suggested action |
| `bun run devops runtime-test status --provider=<slug>` | Per-provider capability status (seed, profile, slave, cap reg, selectors, UI tests) |
| `bun run devops ui-test <list\|status\|record>` | Query/record UI frontend test registry (timestamps + notes) |

## Resume

Re-running always resumes at the first non-`done` selectable unit. The
tracker is authoritative; if file state disagrees, trust the tracker.

## Audit trail

Every pass and block is appended to `docs/atomic-v3/PROGRESS.md`:
`[timestamp] <id> <name> -> <done|blocked> [sha] <gate summary>`.