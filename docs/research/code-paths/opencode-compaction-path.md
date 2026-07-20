# OpenCode Compaction — Confirmed Code Path

**Convergence:** CONFIRMED
**Iterations:** 2 | **Confidence:** High
**Date:** 2026-07-18

## Recommended Approach

Configure compaction behavior in `opencode.json` and leverage instruction files + `AGENTS.md` for critical context that must survive all compactions.

## Working Configuration

```json
{
  "$schema": "https://opencode.ai/config.json",

  // === COMPACTION CONTROL ===
  "compaction": {
    "auto": true,
    "prune": true,
    "reserved": 10000
  },

  // === SURVIVAL MECHANISM: instruction files ===
  // These are loaded as system prompt, survive ALL compactions
  "instructions": [
    "AGENTS.md",
    "docs/roadmap/INVARIANTS.md",
    ".opencode/skill/devops-research/SKILL.md"
  ]
}
```

## Why This Works

1. **Instruction files** (`instructions` array) are loaded as system prompt — they survive every compaction because they're re-injected on every request ([src: opencode.ai/docs/config/](https://opencode.ai/docs/config/)).
2. **`AGENTS.md`** — per the source code analysis, project specifications in `AGENTS.md`/`CLAUDE.md` are part of the system prompt and permanently resident, unaffected by compression ([src: justin3go.com analysis](https://justin3go.com/en/posts/2026/04/09-context-compaction-in-codex-claude-code-and-opencode)).
3. **Pruning** (`prune: true`) removes old tool outputs (the cheapest cleanup — no LLM call needed) and frees space before LLM summary is triggered.
4. **Non-destructive hiding** — OpenCode stamps old messages as hidden (timestamp) rather than deleting them. The data is still in the DB ([src: same analysis]).
5. **Last message replay** — After compaction, OpenCode auto-replays the last user message so the agent's memory resets to the user's latest instruction.

## Prerequisites
- OpenCode v1.x with access to `opencode.json` config

## Known Gotchas
- Compaction triggers at hardcoded ~75% of model context window (feature request #11314 for configurable threshold)
- Tool results are the biggest context consumers (~81% of total tokens in typical sessions)
- `skill` type tool outputs are never pruned (they contain operational instructions)
- If `prune` frees < 20,000 tokens, it won't run (minor cleanups skipped)

## Alternatives Considered
| Approach | Why Rejected | Source |
|----------|--------------|--------|
| Disable auto-compaction (`auto: false`) | Risk of hitting context limit and losing entire session | Config docs |
| Rely only on `/compact` manually | Too easy to forget; agent hits wall first | Community reports |
| Inception messages (preserve: true) | Feature request #4659 — not yet implemented in mainline | Issue #4659 |

## Verification Steps
1. Add `compaction` block + `instructions` array to `opencode.json`
2. Start a session, run several long interactions
3. Watch for compaction message — verify critical context (from AGENTS.md/instructions) survives
4. After compaction, verify the agent remembers project-level context

## Risk Assessment
- **Technical risk:** Low — all settings are documented, stable config keys
- **Integration risk:** Low — no code changes needed, pure configuration
- **Maintenance risk:** Low — config is static, no moving parts
