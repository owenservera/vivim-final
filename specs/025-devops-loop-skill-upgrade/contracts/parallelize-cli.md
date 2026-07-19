# Contract: devops parallelize (FR-005)

**CLI**: `bun run devops parallelize [--dry-run] [--max-agents=N]`

**Behavior**:
1. Load tracker state (all units, deps, files).
2. Compute dependency-closure: group units with no cross-deps and disjoint file sets.
3. If `--dry-run`: print groups + subagent count, exit 0.
4. Else: spawn N OpenCode subagents (isolated worktrees), one per group.
5. Each subagent runs `devops select` → implement → `devops gate`.
6. Merge results: mark units `done` only when all pass gates.
7. On failure: report failing unit, fallback to sequential for that group.

**Config**:
- `max-agents` default = `min(groups.length, os.cpus().length)`

**Errors**:
- No independent units → exit 0, message "nothing to parallelize".
- Subagent spawn fails → exit 1, log error.
- Gate fails in subagent → that group marked failed, not merged.

**Constitution**: Subagents never import BunCdpClient; they use devops CLI only.
