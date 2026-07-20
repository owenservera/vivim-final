# Area 2 — Tool-Use Loop Mechanics

**Verified against:** opencode v1.17.15.
**Evidence:** `evidence/opencode-deep/02-tooluse.transcript.txt`, `evidence/opencode-deep/01-json-stream.transcript.txt`

## Tool call event shape (`--format json`, `type:"tool_use"`)
```json
{
  "type": "tool_use",
  "timestamp": 1784471928597,
  "sessionID": "ses_...",
  "part": {
    "id": "prt_...",
    "messageID": "msg_...",
    "sessionID": "ses_...",
    "type": "tool",
    "tool": "glob",
    "callID": "call_...",
    "state": {
      "status": "completed",
      "input": { "pattern": "src/**/*.ts" },
      "output": "<tool stdout>"
    },
    "metadata": { "state": "..." }
  }
}
```

## Mechanics
1. Model emits a `tool_use` event with `part.tool`, `part.callID`, `part.state.input`.
2. opencode executes the tool (gated by permission — Area 6), fills `part.state.status` (`"completed"`) and `part.state.output`.
3. `step_finish` fires with `reason:"tool-calls"`.
4. A new `step_start` begins; the model sees the tool result and continues (often emitting `text`).
5. Final `step_finish` has `reason:"stop"`.

## How the v2 executor maps tools
- The v2 backend does NOT need to execute opencode's tools itself — opencode runs its own `glob`/`grep`/`read`/`bash` against the repo. The executor only **parses** the `tool_use` events for observability (which tools were called, what input/output).
- For `ContentBlock` mapping: `tool_use` events become `ContentBlock` of type `"tool-call"` (per parser contract: `{type:"tool-call",...}`). The final `text` becomes `{type:"text",text}`.

## Permission gating interaction (Area 6)
If a tool is denied/unavailable, the `tool_use` event has `part.tool:"invalid"` and `part.state.output:"Model tried to call unavailable tool 'bash'..."`. This is NOT a stream error — the run continues and exits 0. The executor MUST detect `tool:"invalid"` and map it to an `EngineError` if the tool was required.

## Logs (`--print-logs`)
Permission evaluation appears in stderr logs as:
```
evaluated permission=read pattern=... action.action=allow
```
This is diagnostic only; the authoritative signal is the `tool_use` event `part.state.status` / `part.tool:"invalid"`.
