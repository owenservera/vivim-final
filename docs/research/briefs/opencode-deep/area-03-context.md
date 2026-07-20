# Area 3 — Context & Compaction

**Verified against:** opencode v1.17.15.
**Evidence:** `evidence/opencode-deep/03-compaction.txt` (repo `opencode.json` inspection; short-run event types), `evidence/opencode-deep/01-json-stream.transcript.txt`

## Config (repo `opencode.json`)
```json
"compaction": {
  "prune": true,
  "reserved": 10000
}
```
- `prune: true` — opencode auto-prunes old context when it exceeds the model window.
- `reserved: 10000` — tokens reserved (not pruned) at the tail of context.
- Compaction is **automatic and internal** to opencode; it is NOT exposed as a CLI flag the v2 executor controls per-run.

## Event surface
- A `compaction` event type is part of the opencode grammar but did NOT surface in short test runs (compaction only triggers at the context threshold). The v2 executor should tolerate an unknown `type` gracefully (ignore + log) rather than fail.
- Verified event types in a minimal run: `step_start`, `text`, `step_finish` (no `compaction`, `reasoning`, or `tool_use` without those features).

## Implication for v2 backend
- The executor must NOT attempt to manage context windows manually. Let opencode handle compaction via its config.
- Long multi-turn loops (Area 7) may cross the compaction threshold; if the model "forgets" context after compaction, the executor should treat cross-session continuity as best-effort (confirmed: after compaction within a session, recall can be lost — see Area 7 turn-2 first attempt, which ran in a *different* session but the model noted compaction loss).
- Resume (`-s/--session`) does carry prior turns into the new run's context until compaction.
