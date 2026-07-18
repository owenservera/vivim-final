---
name: agentic
description: >-
  Limited-context agentic dev loop. Designed for agents with ~150K token context windows
  (opencode, Claude Code, etc.) that receive a single high-level objective and need the
  system to decompose it, scope files per step, and produce compact handoffs between
  context resets. Use when the user gives a goal like "fully wire chatgpt.com for full
  frontend multiturn messaging" and expects autonomous decomposed execution.
---

# Agentic — Limited-Context Autonomous Dev Loop

**Purpose:** A limited-context agent (~150K tokens) receives ONE high-level objective. The
system decomposes it into bounded steps, each with scoped files, and the agent implements
step-by-step with compact handoffs. The agent NEVER reads the full codebase — only the
files scoped to the current task.

> **CRITICAL:** This is NOT a black-box loop. You (the agent) are the implementer.
> The CLI commands are your probes. You read files, write code, run tests, and produce
> handoffs. The system only coordinates and keeps you on task.

## The Operating Procedure

### Phase 0: Start the Loop

```
bun run devops agentic start --objective="fully wire chatgpt.com for full frontend multiturn messaging with full features"
```

This:
1. Decomposes the objective into a task DAG with 5-15 tasks
2. Probes current system state (providers, selectors, components, tests)
3. Writes the initial handoff to `.runtime/agentic/agent-handoff.json`
4. Prints a RESUME PROMPT — copy this to the agent

The resume prompt tells you EXACTLY which files to read and what to do. It is designed to
be ~1500-2500 tokens so you have maximum room for implementation.

### Phase 1-N: Execute Tasks

**CRITICAL RULE — Edit-then-verify ordering:** Complete ALL code edits for
the task BEFORE running any verification. Do NOT run typecheck, lint, or
tests incrementally after each file edit — later edits will invalidate
earlier passes. The single verification command at step 4 below is the
ONLY verification pass for the task.

For each task:
1. Read ONLY the `requiredFiles` listed in the task
2. Implement ALL code changes — every file the task requires. Do NOT run
   any verification yet.
3. Write tests (if applicable) — still no verification.
4. Run the `verification` command — this is the single pass after all edits.
5. Produce a handoff file at `.runtime/agentic/handoff-<task-id>.json`:
```json
{
  "taskId": "1.compose",
  "objective": "wire chatgpt composer typing",
  "status": "done",
  "summary": "Updated COMPOSER_SELECTORS for chatgpt with ProseMirror contenteditable strategy. Added test.",
  "filesChanged": ["src/engines/provider-selectors.ts", "tests/unit/engines/composer-typing.test.ts"],
  "testsPassed": 5,
  "testsFailed": 0,
  "typecheckPassed": true,
  "lintPassed": true,
  "blockers": [],
  "completedAt": 1700000000000
}
```
5. State "HANDOFF COMPLETE" — this signals the coordinator to advance

If you run out of context:
- Produce the handoff EARLY (even partially)
- The next agent instance will resume from exactly where you left off

### Phase N+1: Resume

```
bun run devops agentic resume
```

This reads the current handoff, discovers completed tasks, advances to the next
uncompleted task, and prints a fresh resume prompt with the next task's scoped files.

### After All Tasks: Gate

```
bun run devops gate
```

This final gate is the comprehensive pass across ALL tasks' edits combined.
It must pass before the objective is complete. Do NOT run this after each
task — only once after all tasks finish.

## Key Invariants

1. **NEVER read the full codebase.** Only read files listed in the task's `requiredFiles`.
2. **ALWAYS produce a handoff.** Even if you fail, write a handoff with `status: "failed"` and the error.
3. **CONTEXT BUDGET:** Each task's required files are pre-estimated in tokens. If you approach your limit, hand off early.
4. **EDIT-THEN-VERIFY ORDERING (CRITICAL):** Complete ALL code edits for the
   task before running any verification. Never run typecheck/lint/tests
   after individual file edits — only at step 4 (verification command)
   after ALL edits are done. The single verification pass is the only one
   that counts; running verification mid-task wastes cycles and masks
   errors because later edits will invalidate earlier passes.
5. **VERIFICATION ONCE:** Run the task's `verification` command exactly
   once — after all edits are complete. Do not run it multiple times during
   implementation.
6. **STATE PROBE:** Run `bun run devops agentic probe` to get a compact state snapshot (~2K tokens) at any time.
7. **PREFLIGHT BEFORE START:** Run `bun run devops agentic preflight` to see restore candidates (on-disk profiles with cookies not DB-linked), untested capabilities, and the suggested next action.
8. **ADOPT NOT SETUP:** When preflight shows a restore candidate, always use `bun run devops agentic adopt --provider=<slug>` — it restores → launches → verifies → completes in one call. Do NOT use `setup` for existing profiles.

## Commands

| Command | Purpose |
|---------|---------|
| `bun run devops agentic start --objective="..."` | Decompose objective, probe state, create handoff |
| `bun run devops agentic resume` | Read handoff, advance to next task, print resume prompt |
| `bun run devops agentic done <taskId> [--failed]` | Mark task complete, advance handoff |
| `bun run devops agentic status` | Show current progress (JSON) |
| `bun run devops agentic probe` | Generate compact state snapshot |
| `bun run devops agentic preflight` | Full preflight: restore candidates, untested capabilities, gaps, suggested action |
| `bun run devops agentic adopt --provider=<slug>` | Restore on-disk profile → launch visible Chrome → verify → complete DB registration |
| `bun run devops agentic reset` | Clear all agentic state |

## Handoff File Format

Each task produces a handoff at `.runtime/agentic/handoff-<task-id>.json`:

```json
{
  "taskId": "string",
  "objective": "string",
  "status": "done | failed | blocked",
  "summary": "compact description of what was accomplished (~100 tokens)",
  "filesChanged": ["list", "of", "files"],
  "testsPassed": 0,
  "testsFailed": 0,
  "typecheckPassed": true,
  "lintPassed": true,
  "blockers": [],
  "completedAt": 0
}
```

## Resume Prompt Format

The resume prompt includes:
```
# Agentic Task: <objective>
Phase X/Y | Remaining tokens: ~N

## Completed (N)
- [x] task.id: summary

## Next Task: task.id — task.objective
<description>
### Required files (read these first):
- file1.ts
- file2.ts
### Verification:
`command`
### Estimated token cost: N

## Context budget
You have ~150K tokens. Required files cost ~N tokens.
If you approach the limit, produce the handoff EARLY.
```

## Source Files

| File | Purpose |
|------|---------|
| `devops/agentic/decomposer.ts` | Objective → Task DAG with file scoping |
| `devops/agentic/probe.ts` | Compact state snapshot generator |
| `devops/agentic/context-probe.ts` | Full preflight context: restore candidates, untested capabilities, gaps, suggested action |
| `devops/agentic/packager.ts` | Handoff artifact creation, resume prompt generation |
| `devops/agentic/engine.ts` | Loop coordinator (start, resume, mark done) |
| `devops/index.ts` | CLI wiring (`agentic` command) |
| `tests/unit/devops/agentic-decomposer.test.ts` | Decomposer tests |
| `tests/unit/devops/agentic-packager.test.ts` | Packager tests |
