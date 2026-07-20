# Context-Aware DevOps Skill Improvement

**Problem:** The devops skill forces sequential queue execution without checking active context, causing:
- Agent working on implementation plans gets redirected to atomic units
- No awareness of `.kilo/plans/` or active work context
- Loss of focus when skills are invoked mid-task

## Root Cause Analysis

1. **devops/skill SKILL.md** - Step 1 unconditionally runs `bun run devops select` 
2. **No context detection** - Skill has no mechanism to detect active plans or session objectives
3. **No handoff awareness** - Cannot tell if agent was mid-implementation

## Proposed Solution

### 1. Add Context Detection to devops skill

Before running the loop, check for:
- Active plan files in `.kilo/plans/` (most recently modified)
- Session objectives file at `docs/session/current.md`
- `in_progress` units that match current context

### 2. Add `devops context` subcommand

```
bun run devops context
```

Outputs current context:
- Active plan (if any)
- Current focus unit
- Session objectives (if any)

### 3. Modify devops skill behavior

When invoked:
1. Check for active context
2. If context exists AND context != atomic queue → report context and ask "Continue context or switch to atomic loop?"
3. If no context → run atomic loop as usual

### 4. Add Context File Detection

Create `devops/context.ts`:
- Scan `.kilo/plans/` for recent plans
- Scan `docs/session/` for objectives
- Read `PROGRESS.md` for current focus
- Return structured context for agent decision

## Implementation Order

| Step | File | Change |
|------|------|--------|
| 1 | `devops/context.ts` | New file - context detection |
| 2 | `devops/index.ts` | Add `context` subcommand |
| 3 | `.kilo/skill/devops/SKILL.md` | Add context detection preamble |
| 4 | `package.json` | Add `devops context` script alias |

## Validation

- `bun run devops context` returns context when agent working on plan
- `bun run devops context` returns null/empty when no context
- Agent can choose to continue plan vs switch to atomic loop