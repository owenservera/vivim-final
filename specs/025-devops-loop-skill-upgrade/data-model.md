# Data Model: DevOps Loop & Skill System Upgrade

**Feature**: 025-devops-loop-skill-upgrade
**Date**: 2026-07-19

## Entities

### Unit (existing — devops tracker)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | e.g. `atomic-v8-001` |
| `state` | enum | `pending` \| `in_progress` \| `done` \| `blocked` |
| `deps` | string[] | Unit IDs this depends on |
| `files` | string[] | Files this unit touches (for parallelize scoping) |

*No schema change — parallelize reads existing tracker state.*

### CheckpointConfig (new — opencode.json experimental)

| Field | Type | Default |
|-------|------|---------|
| `context_checkpoint_threshold` | number (0–1) | `0.8` |
| `context_checkpoint_prompt` | string | `"Summarize current work and next steps"` |

### OtelSpan (new — runtime input)

| Field | Type | Notes |
|-------|------|-------|
| `engine` | string | Source engine name |
| `method` | string | Method/operation name |
| `durationMs` | number | Duration |
| `ok` | boolean | Success flag |
| `attributes` | Record<string, unknown> | gen_ai.* semantic fields |

### Logger (new — lib utility)

| Field | Type | Notes |
|-------|------|-------|
| `engine` | string | Child logger context |
| `level` | enum | `trace`\|`debug`\|`info`\|`warn`\|`error` |
| `msg` | string | Log message |
| `err` | object | Error context (stack) |

## State Transitions

### mark done (FR-001)

```
in_progress → done
  ├─ append PROGRESS.md audit line (with resolved <sha>)
  ├─ git add -A
  └─ git commit -m "<msg> [skip ci]"
```

### parallelize (FR-005)

```
pending → (closure computed) → spawned → in_progress (subagent) → done
  └─ merge only when all pass gates
```
