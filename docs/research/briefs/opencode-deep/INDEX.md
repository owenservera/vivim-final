# OpenCode `local-agent` Protocol — Deep Verification (v1.17.15)

**Scope:** Empirically verify the OpenCode CLI/serve/ACP protocol across 10 research areas to inform the v2 `local-agent` backend (`specs/022-local-agent-opencode`). Research-only — no source/config edits.

**Host:** Windows, `opencode` v1.17.15 (binary via bun; ACP reports 1.18.2), Node v24.
**Free models used:** `opencode/deepseek-v4-flash-free`, `opencode/mimo-v2.5-free`, `opencode/hy3-free`, `opencode/north-mini-code-free`.

## Area briefs (evidence-backed)
| # | Area | Brief | Evidence |
|---|------|-------|----------|
| 1 | CLI run invocation & event stream | [area-01-cli-run.md](area-01-cli-run.md) | `01-json-stream.transcript.txt`, `08-streaming*.txt`, `07-run-help.txt` |
| 2 | Tool-use loop mechanics | [area-02-tooluse.md](area-02-tooluse.md) | `02-tooluse.transcript.txt`, `01-json-stream.transcript.txt` |
| 3 | Context & compaction | [area-03-context.md](area-03-context.md) | `03-compaction.txt` |
| 4 | Serve HTTP API & auth | [area-04-serve.md](area-04-serve.md) | `04-serve-openapi.json`, `04-serve-probe*.log` |
| 5 | ACP stdio contract | [area-05-acp.md](area-05-acp.md) | `05-acp-help.txt`, `05-acp-stdio*.transcript.txt` |
| 6 | Permission model & tool gating | [area-06-permissions.md](area-06-permissions.md) | `06-permissions.transcript.txt`, `02-tooluse.transcript.txt` |
| 7 | Multi-turn, resume & fork | [area-07-multiturn.md](area-07-multiturn.md) | `07-multiturn.txt`, `07-run-help.txt` |
| 8 | Streaming / NDJSON & SSE | [area-08-streaming.md](area-08-streaming.md) | `08-streaming*.txt`, `04-serve-probe*.log` |
| 9 | Error & failure semantics | [area-09-errors.md](area-09-errors.md) | `09-errors.txt`, `06-permissions.transcript.txt` |
| 10 | Config precedence & routing | [area-10-config.md](area-10-config.md) | `05-acp-stdio2.transcript.txt`, `10-config.txt` |

## Canonical v2 backend recipe (derived from all 10 areas)
```
spawn: opencode.cmd run --auto -m opencode/<free> --format json -s <sessionId?> "<msg>"
  cwd: <scratch dir with opencode.json {model:<free>, permission:allow}>
  env: never edit repo opencode.json; pass -m always
parse: NDJSON stdout lines -> {type, part:{sessionID,messageID,text,tool,state,tokens}}
map:  text -> ContentBlock{type:text}; tool_use(completed) -> ContentBlock{type:tool-call}
      tool_use(tool:invalid) -> EngineError(PermissionDenied)
      error -> EngineError(Provider); exit!=0 w/o error -> stderr EngineError
resume: -s <captured sessionID> (NOT --continue <id>)
auth(serve): OPENCODE_SERVER_PASSWORD + 127.0.0.1; read results via GET /api/session/:id
```

## Open questions resolved
1. **How do tool calls surface in `--format json`?** → `type:"tool_use"` with `part.tool`, `callID`, `part.state{status,input,output}`. (Area 2)
2. **Does permission denial error?** → No. `tool:"invalid"` event + exit 0. (Area 6/9)
3. **CLI vs SSE event identity?** → Same `type` grammar; CLI=NDJSON, SSE=`data: <json>`. (Area 8)
4. **Multi-turn works?** → Yes via `-s/--session <id>`; `--continue <id>` is a trap. (Area 7)
5. **Config override for free model?** → Scratch `--dir` `opencode.json` + `-m` both work; CWD wins. (Area 10)

## Unresolved / caveats
- ACP prompt method name not enumerated (requires session bootstrap); CLI transport recommended.
- Live SSE run-event capture unreliable (timing); use `GET /api/session/:id` post-run.
- Version string mismatch CLI 1.17.15 vs ACP 1.18.2 — pin binary, re-verify at deploy.
- `compaction` event not exercised (threshold not crossed in tests).
