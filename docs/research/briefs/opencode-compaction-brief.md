# OpenCode Auto‑Compaction — Brief

**Source:** N/A (no full report — findings from direct docs + community sources)
**Confidence:** High | **Sources:** 8 | **Date:** 2026-07-18

## TL;DR

OpenCode auto‑compaction preserves the last ~40k tokens + last 2 user turns, marks old data as hidden (not deleted), and replays your last message after compaction. To survive it: put critical context in **instruction files** (`instructions` array) and **AGENTS.md** — these are system prompt and survive all compactions.

## Key Decisions

1. **Use `instructions` config** — files loaded here persist across all compactions as system prompt
2. **Enable `prune: true`** — clears old tool outputs (cheapest cleanup tier, no LLM call needed)
3. **Keep `auto: true`** — disabling it risks session death from overflow
4. **Set `reserved: 10000`** — token buffer prevents overflow during compaction itself

## Evidence Summary

- **Config docs (high):** `compaction.auto`, `.prune`, `.reserved` are stable documented keys
- **justin3go analysis (high):** OpenCode uses 2-step compaction (hide → LLM summary). After summary, last user message is auto-replayed. AGENTS.md/CLAUDE.md are system prompt, permanently resident. Tool results = ~81% of tokens. Skill-type outputs are never pruned
- **Issue #4659 (high):** Inception messages (`preserve: true`) proposed but not in mainline yet
- **Issue #11314 (high):** Compaction triggers at hardcoded 75% of model context window
- **Reddit community (medium):** Keep every section, preserve exact file paths/identifiers, prefer terse bullets over paragraphs

## Open Questions
- When will configurable compaction threshold (issue #11314) land?
- When will inception messages (issue #4659) ship?
- Does `instructions` array support glob patterns for bulk file inclusion?

## Used In
- devops-research skill workflow (surviving compaction during long research sessions)
- AGENTS.md survival strategy (this project's own agent instructions)
