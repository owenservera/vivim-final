# Quickstart: DevOps Loop & Skill System Upgrade

**Feature**: 025-devops-loop-skill-upgrade
**Date**: 2026-07-19

## Validation Scenarios

### Scenario 1: Single-pass `mark done` (FR-001)

```powershell
# 1. Pick a unit in in_progress
bun run devops select

# 2. Mark done with message (one commit, no [PENDING-COMMIT])
bun run devops mark atomic-v8-XXX done "Implement parser fallback chain"

# 3. Verify exactly one commit + PROGRESS.md has real sha
git log --oneline -1
# → "feat(...): Implement parser fallback chain"
Select-String -Path docs/atomic/PROGRESS.md -Pattern "\[PENDING-COMMIT\]"
# → no matches (should be empty)
```

**Expected**: One commit created; PROGRESS.md contains `<sha>` not placeholder.

### Scenario 2: Pre-compaction checkpoint (FR-003)

```powershell
# 1. Add to opencode.json experimental block:
#    "context_checkpoint_threshold": 0.8,
#    "context_checkpoint_prompt": "Summarize current work and next steps"
# 2. Restart opencode with plugin loaded
# 3. Run a long session until tokens cross 80%
# 4. Observe checkpoint prompt emitted
```

**Expected**: Summarize prompt appears before auto-compaction.

### Scenario 3: parallelize (FR-005)

```powershell
# Dry-run shows fan-out groups
bun run devops parallelize --dry-run
# → lists independent unit closures + subagent count

# Execute (spawns subagents)
bun run devops parallelize
# → each unit done when its subagent passes gates
```

**Expected**: Independent units complete in parallel; merge only when all pass.

### Scenario 4: pino logging (FR-007)

```powershell
bun run devops select 2>&1 | Select-String -Pattern '"engine"'
# → JSON lines with engine/level/msg fields
```

**Expected**: Structured JSON, no bare console.log from engines.

### Scenario 5: OTel sink (FR-009)

```powershell
# With OTEL_EXPORTER_OTLP_ENDPOINT set:
bun run serve
# → spans exported to OTLP endpoint with gen_ai.* attributes

# Without exporter:
bun run serve
# → no-op, loop runs normally
```

**Expected**: Traces flow when configured; silent no-op otherwise.

## Prerequisites

- Bun 1.x installed
- `.specify/feature.json` points to `specs/025-devops-loop-skill-upgrade`
- `opencode.json` writable for checkpoint config
- (OTel only) OTLP endpoint reachable
