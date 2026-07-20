# Area 1 — CLI Run Invocation & Event-Stream Contract

**Verified against:** opencode v1.17.15 (CLI reports 1.17.15; ACP handshake reports agentInfo.version 1.18.2 — see Area 5 note).
**Evidence:** `evidence/opencode-deep/01-json-stream.transcript.txt`, `evidence/opencode-deep/08-streaming.transcript.txt`, `evidence/opencode-deep/07-run-help.txt`

## Canonical one-shot invocation
```
opencode run --auto -m <provider/model> --format json "<message>"
```
- `--auto` = auto-approve permissions (equivalent to repo `permission: allow`). The v2 executor MUST pass `--auto` so free models can read/write without interactive prompts.
- `-m/--model <provider/model>` overrides config default. **Without it, the repo `opencode.json` `default_agent: build` resolves to `anthropic/claude-sonnet-4-20250514` which is unauthenticated → fatal error (see Area 9).** Executor must always pass `-m`.
- `--format json` emits the raw event stream (one JSON object per line, NDJSON — see Area 8).

## Event grammar (CLI `--format json`)
Each line is a JSON object with a top-level `type`. Observed types in a minimal run:
| `type` | Meaning | Key fields |
|--------|---------|-----------|
| `step_start` | Agent begins a step | `part.id`, `part.messageID`, `part.sessionID`, `part.type:"step-start"` |
| `reasoning` | Thinking block (`--thinking` only) | `part.text`, `part.type:"reasoning"`, `time{start,end}` |
| `tool_use` | Tool call (Area 2) | `part.tool`, `part.callID`, `part.state{status,input,output}` |
| `text` | Assistant text delta/final | `part.text`, `part.type:"text"`, `time{start,end}` |
| `step_finish` | Step ends | `part.reason` (`"tool-calls"` | `"stop"`), `part.tokens{total,input,output,reasoning,cache{read,write}}`, `part.cost` |
| `error` | Runtime error (Area 9) | `error.name`, `error.data.message` |

## Canonical loop (no tools)
```
step_start → text → step_finish(reason:"stop")
```
With tools:
```
step_start → tool_use(completed) → step_finish(reason:"tool-calls") → step_start → text → step_finish(reason:"stop")
```

## Critical fields for the v2 executor
- **`part.sessionID`** (and top-level `sessionID`) — the session ID for multi-turn (Area 7). Capture from the first `step_start`.
- **`part.messageID`** — message grouping.
- **`part.tokens`** on `step_finish` — usage accounting (input/output/reasoning/cache). `cost` is always `0` for free models.
- **`part.text`** on final `text` event — the actual assistant response to map into `ContentBlock[]`.

## Flags of note (v1.17.15 — correct the impl-doc)
- `-u/--username`, `-p/--password` — basic auth (default username `opencode`, password from `OPENCODE_SERVER_PASSWORD`).
- `--variant <high|max|minimal>` — provider-specific reasoning effort (passthrough; accepted, no grammar change).
- `--thinking` — emit `reasoning` events.
- `-c/--continue` (no arg) = resume LAST session. `-s/--session <id>` = resume SPECIFIC session. **`--continue <id>` mis-parses `<id>` as the message — do NOT use it (Area 7).**

## Impl-doc corrections (Area 1)
- `specs/022-local-agent-opencode/spec.md` describes one-shot-only; confirmed `--format json` is the correct parse target.
- Impl-doc claims may list stale flags; the verified set above is authoritative for v1.17.15.
