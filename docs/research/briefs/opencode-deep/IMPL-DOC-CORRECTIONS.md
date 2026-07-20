# Impl-Doc Corrections — `docs/research/reports/opencode-agentic-impl-docs-2026.md`

The existing impl-doc contains stale assumptions about OpenCode v1.17.15. Verified corrections below (cross-check before v2 implementation):

## 1. Permission denial is SILENT (not an error)
- **Stale:** "Permission denial raises a stream error / non-zero exit."
- **Correct:** Denial emits `type:"tool_use"` with `part.tool:"invalid"` and `part.state.output:"Model tried to call unavailable tool 'bash'..."`. Run exits **0**. Executor must detect `invalid` tool → `EngineError`.

## 2. CLI output is NDJSON (not a JSON array / wrapped envelope)
- **Stale:** "Parse the JSON array of events" / "events wrapped in an envelope."
- **Correct:** `--format json` = one JSON object per line (newline-delimited). No array, no envelope. Split on `\n`, `JSON.parse` each line.

## 3. Always pass `-m`; do not rely on config default model
- **Stale:** "Use the configured default model."
- **Correct:** Repo `opencode.json` sets `default_agent: build` → `anthropic/claude-sonnet-4-20250514` (unauthenticated) → fatal `Model not found` / 500. Executor MUST pass `-m opencode/<free>` and run from a scratch `--dir` with `model` + `permission:allow`.

## 4. Resume uses `-s/--session <id>`, NOT `--continue <id>`
- **Stale:** "`--continue <sessionId>` resumes a session."
- **Correct:** `--continue` takes NO argument (resumes last session). `--continue ses_xxx "msg"` parses `ses_xxx` as the message and creates a NEW session. Use `-s/--session <id>` to resume a specific session (verified: same ID, context retained).

## 5. `--fork` requires `--continue` or `--session`
- **Stale:** "`--fork` alone forks the current session."
- **Correct:** `--fork` is a modifier; must be combined with `-c` or `-s`. Verified: `--fork -s <id>` creates a new forked session inheriting parent context.

## 6. SSE event capture is unreliable for completed runs
- **Stale:** "Subscribe to `/api/session/:id/event` SSE for live results."
- **Correct:** In probes, SSE delivered 0 events for a completed `prompt_async` run (timing race). Reliable capture = `GET /api/session/:id` after `prompt_async` returns 204. SSE shape confirmed only via `server.connected`.

## 7. Serve inherits repo `opencode.json`
- **Stale:** "Serve uses an isolated model config."
- **Correct:** `serve` loads the CWD `opencode.json` (incl. `default_agent: build` → unauthenticated sonnet). A v2 serve backend must run from a scratch dir with a free `model` override, or it 500s.

## 8. Version string discrepancy
- **Stale:** Single version `1.17.15`.
- **Correct:** CLI `--version` = 1.17.15; ACP `initialize` result `agentInfo.version` = 1.18.2. Pin the binary path; re-verify version at deploy; do not hard-code a single string.

## 9. ACP prompt method is not `prompt`/`chat`/`message`
- **Stale:** "Send prompts via ACP `prompt` method."
- **Correct:** `prompt`, `chat`, `message` all return `-32601 Method not found`. ACP requires `initialize` then a session-scoped method (not enumerated in probe). Recommend CLI transport for v2.

## 10. `compaction` is config-driven, not a per-run flag
- **Stale:** "Pass a compaction flag per run."
- **Correct:** `compaction: {prune, reserved}` lives in `opencode.json`. No per-run flag. Let opencode manage it.

---
*All corrections verified against OpenCode v1.17.15 on Windows (Node v24). Evidence in `../evidence/opencode-deep/`.*
